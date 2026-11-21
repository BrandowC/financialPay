import { Injectable } from '@nestjs/common';
import { Money } from '../../../shared/domain/value-objects/money.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import {
  BalanceHistoryEntry,
  BalanceRepository,
  BalanceSnapshot,
  UpdateBalanceInput,
} from '../application/ports/balance.repository';

/** Forma cruda que devuelve el UPDATE ... RETURNING. */
interface BalanceRow {
  user_id: string;
  amount_cents: bigint;
  currency: string;
  version: number;
  updated_at: Date;
  updated_by: string | null;
}

@Injectable()
export class PrismaBalanceRepository implements BalanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByUserId(userId: string): Promise<BalanceSnapshot | null> {
    const row = await this.prisma.balance.findUnique({ where: { userId } });
    if (!row) return null;

    return {
      userId: row.userId,
      money: Money.fromCents(row.amountCents, row.currency.trim()),
      version: row.version,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy,
    };
  }

  /**
   * UPDATE condicionado a la versión, dentro de una transacción que lleva el
   * contexto de auditoría.
   *
   * Todo ocurre en UNA transacción:
   *   · `SET LOCAL app.*`  → el trigger sabrá quién hizo el cambio
   *   · `UPDATE ... WHERE version = N`  → bloqueo optimista
   *   · el trigger inserta solo la fila de `balance_audit`
   *   · se encola el evento de outbox para Google Sheets
   *
   * Si algo falla, se deshace todo junto. Es imposible que quede un saldo
   * cambiado sin su registro de auditoría, o un evento de sincronización de un
   * cambio que nunca ocurrió.
   */
  async updateAmount(input: UpdateBalanceInput): Promise<BalanceSnapshot | null> {
    return this.prisma.transactionWithAudit(input.audit, async (tx) => {
      const rows = await tx.$queryRaw<BalanceRow[]>`
        UPDATE balances
        SET amount_cents = ${input.amount.cents},
            currency     = ${input.amount.currency},
            version      = version + 1,
            updated_at   = now(),
            updated_by   = ${input.audit.actorId}::uuid
        WHERE user_id = ${input.userId}::uuid
          AND version = ${input.expectedVersion}
        RETURNING user_id, amount_cents, currency, version, updated_at, updated_by
      `;

      // Cero filas = la versión ya no coincide. La capa superior lo traduce a
      // 409 Conflict. No se lanza aquí: "no se pudo por conflicto" es un
      // resultado legítimo del repositorio, no una excepción.
      if (rows.length === 0) return null;

      const row = rows[0];

      // Evento para el worker que sincroniza con Google Sheets. Al ir en la
      // misma transacción, o se guardan las dos cosas o ninguna.
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'balance',
          aggregateId: input.userId,
          eventType: 'balance.updated',
          payload: {
            userId: input.userId,
            amountCents: row.amount_cents.toString(),
            amountDecimal: input.amount.toDecimalString(),
            currency: row.currency.trim(),
            updatedAt: row.updated_at.toISOString(),
            updatedByEmail: input.audit.actorEmail ?? null,
            reason: input.audit.reason ?? null,
          },
        },
      });

      return {
        userId: row.user_id,
        money: Money.fromCents(row.amount_cents, row.currency.trim()),
        version: row.version,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      };
    });
  }

  async findHistory(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<BalanceHistoryEntry[]> {
    const rows = await this.prisma.balanceAudit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      // +0 defensivo: si llegara un limit gigante desde el query string, el DTO
      // ya lo acota, pero el repositorio no debe confiar en eso.
      take: Math.min(limit, 200),
      skip: Math.max(offset, 0),
    });

    return rows.map((row) => ({
      id: row.id.toString(),
      previous: Money.fromCents(row.previousCents, row.currency.trim()),
      current: Money.fromCents(row.newCents, row.currency.trim()),
      deltaCents: (row.deltaCents ?? row.newCents - row.previousCents).toString(),
      changedByEmail: row.changedByEmail,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }

  async countHistory(userId: string): Promise<number> {
    return this.prisma.balanceAudit.count({ where: { userId } });
  }
}
