import { Money } from '../../../../shared/domain/value-objects/money.vo';
import { AuditContext } from '../../../../shared/infrastructure/persistence/prisma.service';

export const BALANCE_REPOSITORY = Symbol('BALANCE_REPOSITORY');

export interface BalanceSnapshot {
  userId: string;
  money: Money;
  /** Versión para el bloqueo optimista. El cliente la devuelve al guardar. */
  version: number;
  updatedAt: Date;
  updatedBy: string | null;
}

export interface BalanceHistoryEntry {
  id: string;
  previous: Money;
  current: Money;
  /** Positivo si subió, negativo si bajó. */
  deltaCents: string;
  changedByEmail: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface UpdateBalanceInput {
  userId: string;
  amount: Money;
  /** Versión que el administrador tenía en pantalla. */
  expectedVersion: number;
  audit: AuditContext;
}

export interface BalanceRepository {
  findByUserId(userId: string): Promise<BalanceSnapshot | null>;

  /**
   * Guarda un saldo nuevo con bloqueo optimista.
   *
   * ── El problema de la actualización perdida ─────────────────────────────
   * Dos administradores abren la ficha del mismo cliente, que tiene $100.
   * El primero escribe $500 y guarda. El segundo, que sigue viendo $100 en su
   * pantalla, escribe $300 y guarda. Sin protección, el resultado es $300 y el
   * cambio del primero desaparece SIN QUE NADIE SE ENTERE. En un sistema que
   * maneja saldos, eso es inaceptable.
   *
   * ── La solución ─────────────────────────────────────────────────────────
   * Cada fila lleva un contador `version`. El UPDATE incluye
   * `WHERE version = <la que el admin tenía en pantalla>`. Si otro ya guardó,
   * la versión cambió, el UPDATE afecta 0 filas y devolvemos `null` para que
   * la capa superior responda 409 y el panel diga "otro administrador acaba de
   * cambiar este saldo, recarga y revisa".
   *
   * Se prefiere bloqueo optimista y no `SELECT FOR UPDATE` porque los conflictos
   * son rarísimos (dos admins sobre el mismo cliente a la vez) y el bloqueo
   * pesimista mantendría filas bloqueadas durante todo el tiempo que el
   * administrador tarde en pensar.
   *
   * @returns el nuevo estado, o `null` si hubo conflicto de versión.
   */
  updateAmount(input: UpdateBalanceInput): Promise<BalanceSnapshot | null>;

  /** Historial de cambios, del más reciente al más antiguo. */
  findHistory(userId: string, limit: number, offset: number): Promise<BalanceHistoryEntry[]>;

  countHistory(userId: string): Promise<number>;
}
