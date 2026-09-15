import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../../shared/domain/errors/domain.error';
import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { SecurityEventRecorder } from '../../../../shared/infrastructure/security/security-event.recorder';
import {
  BALANCE_REPOSITORY,
  BalanceRepository,
  BalanceSnapshot,
} from '../ports/balance.repository';

/** Quién ejecuta la acción. Lo arma el guard a partir del token. */
export interface AdminActor {
  id: string;
  email: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
}

export interface UpdateBalanceCommand {
  customerId: string;
  /** Monto como TEXTO decimal: "1500.75". Nunca un number. */
  amount: string;
  /** Versión que el administrador tenía en pantalla. */
  expectedVersion: number;
  reason?: string;
  actor: AdminActor;
  ip?: string | null;
  userAgent?: string | null;
}

export interface UpdateBalanceResult {
  balance: BalanceSnapshot;
  previous: Money;
  changed: boolean;
}

/**
 * Actualización del saldo de un cliente por parte de un administrador.
 *
 * Es la única operación de escritura de todo el panel, y por eso concentra
 * cuatro controles:
 *
 *   1. AUTORIZACIÓN — el rol VIEWER puede mirar pero no tocar.
 *   2. VALIDACIÓN   — el monto pasa por `Money`, que rechaza negativos,
 *                     notación científica, más de dos decimales y cifras
 *                     absurdas.
 *   3. CONCURRENCIA — bloqueo optimista por versión.
 *   4. AUDITORÍA    — la escribe un trigger de Postgres, no este código, así
 *                     que es imposible saltársela.
 */
@Injectable()
export class UpdateBalanceUseCase {
  private readonly logger = new Logger(UpdateBalanceUseCase.name);

  constructor(
    @Inject(BALANCE_REPOSITORY) private readonly balances: BalanceRepository,
    private readonly security: SecurityEventRecorder,
  ) {}

  async execute(command: UpdateBalanceCommand): Promise<UpdateBalanceResult> {
    // ── 1. Autorización ───────────────────────────────────────────────────
    if (command.actor.role === 'VIEWER') {
      await this.security.record({
        eventType: 'balance.update_denied',
        principalId: command.actor.id,
        email: command.actor.email,
        ip: command.ip,
        metadata: { customerId: command.customerId, reason: 'ROLE_VIEWER' },
      });

      throw new ForbiddenError(
        'Tu rol solo permite consultar. Pide a un administrador que haga el cambio.',
        'INSUFFICIENT_ROLE',
      );
    }

    // ── 2. Validación del monto ───────────────────────────────────────────
    // Money.fromDecimalString lanza ValidationError con código específico si
    // el texto no cumple. No hace falta comprobar nada más aquí.
    const current = await this.balances.findByUserId(command.customerId);
    if (!current) {
      throw new NotFoundError('Cliente', 'CUSTOMER_NOT_FOUND');
    }

    const amount = Money.fromDecimalString(command.amount, current.money.currency);

    // Guardar el mismo valor no es un error, pero tampoco debe generar una
    // entrada de auditoría falsa. Se corta aquí y se devuelve tal cual.
    if (amount.equals(current.money)) {
      return { balance: current, previous: current.money, changed: false };
    }

    // ── 3. Escritura con bloqueo optimista ────────────────────────────────
    const updated = await this.balances.updateAmount({
      userId: command.customerId,
      amount,
      expectedVersion: command.expectedVersion,
      audit: {
        actorId: command.actor.id,
        actorEmail: command.actor.email,
        reason: command.reason ?? null,
        ip: command.ip ?? null,
        userAgent: command.userAgent ?? null,
      },
    });

    if (!updated) {
      // 0 filas afectadas: alguien más guardó entre que este admin cargó la
      // ficha y pulsó guardar.
      await this.security.record({
        eventType: 'balance.version_conflict',
        principalId: command.actor.id,
        email: command.actor.email,
        ip: command.ip,
        metadata: {
          customerId: command.customerId,
          expectedVersion: command.expectedVersion,
          actualVersion: current.version,
        },
      });

      throw new ConflictError(
        'Otro administrador cambió este saldo mientras lo editabas. ' +
          'Recarga la ficha para ver el valor actual antes de guardar.',
        'BALANCE_VERSION_CONFLICT',
        { currentVersion: current.version, currentAmount: current.money.toDecimalString() },
      );
    }

    // ── 4. Registro (la auditoría fina ya la escribió el trigger) ─────────
    await this.security.record({
      eventType: 'balance.updated',
      principalId: command.actor.id,
      email: command.actor.email,
      ip: command.ip,
      userAgent: command.userAgent,
      metadata: {
        customerId: command.customerId,
        from: current.money.toDecimalString(),
        to: amount.toDecimalString(),
        reason: command.reason ?? null,
      },
    });

    this.logger.log(
      `Saldo actualizado · cliente=${command.customerId} ` +
        `${current.money.toDecimalString()} → ${amount.toDecimalString()} ` +
        `por ${command.actor.email}`,
    );

    return { balance: updated, previous: current.money, changed: true };
  }
}
