import { Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../../shared/domain/errors/domain.error';
import { Money } from '../../../shared/domain/value-objects/money.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';

/** Monedas que la app ofrece. Se valida aquí y no solo en la app: la API no se
 *  fía de lo que mande el cliente. Todas usan 2 decimales (centavos). */
export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'UYU', 'BOB', 'PYG',
  'VES', 'CRC', 'GTQ', 'HNL', 'NIO', 'PAB', 'DOP', 'CAD', 'GBP', 'CHF',
] as const;

/** Tope por persona: evita que un script llene la base de metas basura. */
const MAX_GOALS_PER_USER = 50;

interface GoalRow {
  id: string;
  name: string;
  emoji: string | null;
  target_cents: bigint;
  currency: string;
  deadline: Date | null;
  archived_at: Date | null;
  created_at: Date;
  saved_cents: bigint;
  contributions_count: bigint;
  last_contribution_on: Date | null;
}

interface ContributionRow {
  id: string;
  amount_cents: bigint;
  note: string | null;
  made_on: Date;
  created_at: Date;
}

export interface GoalView {
  id: string;
  name: string;
  emoji: string | null;
  currency: string;
  /** Centavos como texto: los bigint no viajan en JSON. */
  targetCents: string;
  savedCents: string;
  /** Avance de 0 a 1, solo para pintar la barra (nunca para cálculos). */
  progress: number;
  completed: boolean;
  deadline: string | null;
  archived: boolean;
  contributionsCount: number;
  lastContributionOn: string | null;
  createdAt: string;
}

export interface ContributionView {
  id: string;
  /** Positivo = aporte, negativo = retiro. */
  amountCents: string;
  note: string | null;
  madeOn: string;
  createdAt: string;
}

/**
 * Metas de ahorro y sus aportes.
 *
 * ── Cada consulta filtra por `userId` ──────────────────────────────────────
 * El id de la persona sale SIEMPRE del token (ver GoalsController), nunca de la
 * URL ni del cuerpo. Todas las consultas de este servicio lo llevan en el
 * WHERE, así que una persona no puede ni nombrar la meta de otra: si el id de
 * la meta no es suyo, para ella simplemente no existe (404, no 403, para no
 * revelar que existe).
 *
 * ── El total ahorrado nunca se guarda ──────────────────────────────────────
 * Es `SUM(amount_cents)` de los aportes. Guardarlo en una columna aparte
 * obligaría a mantenerlo sincronizado en cada alta y baja, y el día que dejara
 * de cuadrar nadie sabría cuál de los dos números es el verdadero.
 */
@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Lectura ───────────────────────────────────────────────────────────────

  async list(userId: string): Promise<GoalView[]> {
    const rows = await this.prisma.$queryRaw<GoalRow[]>`
      SELECT g.id, g.name, g.emoji, g.target_cents, g.currency, g.deadline,
             g.archived_at, g.created_at,
             COALESCE(SUM(c.amount_cents), 0)::bigint AS saved_cents,
             COUNT(c.id)                              AS contributions_count,
             MAX(c.made_on)                           AS last_contribution_on
      FROM goals g
      LEFT JOIN contributions c ON c.goal_id = g.id
      WHERE g.user_id = ${userId}::uuid
      GROUP BY g.id
      ORDER BY (g.archived_at IS NOT NULL), g.created_at DESC
    `;

    return rows.map(GoalsService.toGoalView);
  }

  async get(userId: string, goalId: string): Promise<{ goal: GoalView; contributions: ContributionView[] }> {
    const goal = await this.findGoal(userId, goalId);

    const rows = await this.prisma.$queryRaw<ContributionRow[]>`
      SELECT id, amount_cents, note, made_on, created_at
      FROM contributions
      WHERE goal_id = ${goalId}::uuid AND user_id = ${userId}::uuid
      ORDER BY made_on DESC, created_at DESC
      LIMIT 500
    `;

    return { goal, contributions: rows.map(GoalsService.toContributionView) };
  }

  // ── Escritura ─────────────────────────────────────────────────────────────

  async create(
    userId: string,
    input: { name: string; emoji?: string; targetAmount: string; currency: string; deadline?: string },
  ): Promise<GoalView> {
    const name = GoalsService.cleanName(input.name);
    const target = GoalsService.parsePositiveMoney(input.targetAmount, input.currency, 'La meta');
    GoalsService.assertCurrency(input.currency);
    const deadline = GoalsService.parseDeadline(input.deadline);

    const count = await this.prisma.goal.count({ where: { userId } });
    if (count >= MAX_GOALS_PER_USER) {
      throw new ValidationError(
        `Llegaste al máximo de ${MAX_GOALS_PER_USER} metas. Archiva o elimina alguna para crear otra.`,
        'GOALS_LIMIT_REACHED',
      );
    }

    const created = await this.prisma.goal.create({
      data: {
        userId,
        name,
        emoji: input.emoji?.trim() || null,
        targetCents: target.cents,
        currency: input.currency,
        deadline,
      },
    });

    return this.findGoal(userId, created.id);
  }

  async update(
    userId: string,
    goalId: string,
    input: {
      name?: string;
      emoji?: string;
      targetAmount?: string;
      deadline?: string | null;
      archived?: boolean;
    },
  ): Promise<GoalView> {
    const current = await this.findGoal(userId, goalId);

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = GoalsService.cleanName(input.name);
    if (input.emoji !== undefined) data.emoji = input.emoji.trim() || null;
    if (input.targetAmount !== undefined) {
      data.targetCents = GoalsService.parsePositiveMoney(input.targetAmount, current.currency, 'La meta').cents;
    }
    if (input.deadline !== undefined) {
      data.deadline = input.deadline === null ? null : GoalsService.parseDeadline(input.deadline);
    }
    if (input.archived !== undefined) {
      data.archivedAt = input.archived ? new Date() : null;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.goal.update({ where: { id: goalId }, data });
    }

    return this.findGoal(userId, goalId);
  }

  async remove(userId: string, goalId: string): Promise<void> {
    // `deleteMany` con el dueño en el filtro: si la meta no es de esta persona,
    // no borra nada y se responde 404 igual que si no existiera.
    const { count } = await this.prisma.goal.deleteMany({ where: { id: goalId, userId } });
    if (count === 0) throw new NotFoundError('Meta', 'GOAL_NOT_FOUND');
  }

  async addContribution(
    userId: string,
    goalId: string,
    input: { amount: string; type: 'deposit' | 'withdrawal'; note?: string; madeOn?: string },
  ): Promise<{ goal: GoalView; contribution: ContributionView }> {
    const current = await this.findGoal(userId, goalId);
    const amount = GoalsService.parsePositiveMoney(input.amount, current.currency, 'El monto');
    const madeOn = GoalsService.parseMadeOn(input.madeOn);
    const signed = input.type === 'withdrawal' ? -amount.cents : amount.cents;

    const contributionId = await this.prisma.$transaction(async (tx) => {
      // Se bloquea la fila de la meta: dos retiros simultáneos no pueden, entre
      // los dos, dejar el total por debajo de cero.
      await tx.$queryRaw`SELECT id FROM goals WHERE id = ${goalId}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;

      if (signed < 0n) {
        const [{ saved }] = await tx.$queryRaw<{ saved: bigint }[]>`
          SELECT COALESCE(SUM(amount_cents), 0)::bigint AS saved
          FROM contributions WHERE goal_id = ${goalId}::uuid
        `;
        if (saved + signed < 0n) {
          throw new ValidationError(
            'No puedes retirar más de lo que has ahorrado en esta meta.',
            'WITHDRAWAL_EXCEEDS_SAVED',
          );
        }
      }

      const row = await tx.contribution.create({
        data: {
          goalId,
          userId,
          amountCents: signed,
          note: input.note?.trim() || null,
          madeOn,
        },
      });
      return row.id;
    });

    const { goal, contributions } = await this.get(userId, goalId);
    const contribution = contributions.find((c) => c.id === contributionId)!;
    return { goal, contribution };
  }

  async removeContribution(userId: string, goalId: string, contributionId: string): Promise<GoalView> {
    await this.findGoal(userId, goalId);

    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM goals WHERE id = ${goalId}::uuid AND user_id = ${userId}::uuid FOR UPDATE`;

      const { count } = await tx.contribution.deleteMany({
        where: { id: contributionId, goalId, userId },
      });
      if (count === 0) throw new NotFoundError('Movimiento', 'CONTRIBUTION_NOT_FOUND');

      // Borrar un aporte que respalda un retiro posterior dejaría el total en
      // negativo. Si pasa, se deshace todo (el throw revierte la transacción).
      const [{ saved }] = await tx.$queryRaw<{ saved: bigint }[]>`
        SELECT COALESCE(SUM(amount_cents), 0)::bigint AS saved
        FROM contributions WHERE goal_id = ${goalId}::uuid
      `;
      if (saved < 0n) {
        throw new ValidationError(
          'No puedes borrar este aporte porque hay retiros que dependen de él. Borra primero esos retiros.',
          'CONTRIBUTION_NEEDED_BY_WITHDRAWAL',
        );
      }
    });

    return this.findGoal(userId, goalId);
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  private async findGoal(userId: string, goalId: string): Promise<GoalView> {
    const rows = await this.prisma.$queryRaw<GoalRow[]>`
      SELECT g.id, g.name, g.emoji, g.target_cents, g.currency, g.deadline,
             g.archived_at, g.created_at,
             COALESCE(SUM(c.amount_cents), 0)::bigint AS saved_cents,
             COUNT(c.id)                              AS contributions_count,
             MAX(c.made_on)                           AS last_contribution_on
      FROM goals g
      LEFT JOIN contributions c ON c.goal_id = g.id
      WHERE g.id = ${goalId}::uuid AND g.user_id = ${userId}::uuid
      GROUP BY g.id
    `;

    if (rows.length === 0) throw new NotFoundError('Meta', 'GOAL_NOT_FOUND');
    return GoalsService.toGoalView(rows[0]);
  }

  private static cleanName(raw: string): string {
    const name = raw.replace(/\s+/g, ' ').trim();
    if (name.length === 0 || name.length > 80) {
      throw new ValidationError('El nombre de la meta debe tener entre 1 y 80 caracteres', 'GOAL_NAME_INVALID');
    }
    return name;
  }

  private static assertCurrency(currency: string): void {
    if (!(SUPPORTED_CURRENCIES as readonly string[]).includes(currency)) {
      throw new ValidationError('Esa moneda no está disponible', 'CURRENCY_NOT_SUPPORTED');
    }
  }

  private static parsePositiveMoney(input: string, currency: string, label: string): Money {
    const money = Money.fromDecimalString(input, currency);
    if (money.isZero()) {
      throw new ValidationError(`${label} debe ser mayor que cero`, 'AMOUNT_MUST_BE_POSITIVE');
    }
    return money;
  }

  /** Fecha límite: no puede estar en el pasado (una meta ya vencida no ayuda). */
  private static parseDeadline(input: string | undefined): Date | null {
    if (!input) return null;
    const date = GoalsService.parseDate(input, 'La fecha límite');
    if (input < GoalsService.todayIso()) {
      throw new ValidationError('La fecha límite no puede estar en el pasado', 'DEADLINE_IN_PAST');
    }
    return date;
  }

  /** Fecha del aporte: hoy por defecto; se tolera un día de más por husos horarios. */
  private static parseMadeOn(input: string | undefined): Date {
    if (!input) return GoalsService.parseDate(GoalsService.todayIso(), 'La fecha');
    const date = GoalsService.parseDate(input, 'La fecha');
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    if (input > tomorrow) {
      throw new ValidationError('La fecha no puede ser futura', 'DATE_IN_FUTURE');
    }
    return date;
  }

  private static parseDate(input: string, label: string): Date {
    const date = new Date(`${input}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input) {
      throw new ValidationError(`${label} no es una fecha válida`, 'DATE_INVALID');
    }
    return date;
  }

  private static todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private static toGoalView(row: GoalRow): GoalView {
    const target = row.target_cents;
    const saved = row.saved_cents;
    // Solo para pintar la barra: la razón se calcula en `number`, pero ambos
    // extremos caben de sobra en 2^53 (el tope de monto es 10^11 centavos).
    const ratio = target > 0n ? Number(saved) / Number(target) : 0;

    return {
      id: row.id,
      name: row.name,
      emoji: row.emoji,
      currency: row.currency.trim(),
      targetCents: target.toString(),
      savedCents: saved.toString(),
      progress: Math.max(0, Math.min(1, ratio)),
      completed: saved >= target,
      deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : null,
      archived: row.archived_at !== null,
      contributionsCount: Number(row.contributions_count),
      lastContributionOn: row.last_contribution_on
        ? row.last_contribution_on.toISOString().slice(0, 10)
        : null,
      createdAt: row.created_at.toISOString(),
    };
  }

  private static toContributionView(row: ContributionRow): ContributionView {
    return {
      id: row.id,
      amountCents: row.amount_cents.toString(),
      note: row.note,
      madeOn: row.made_on.toISOString().slice(0, 10),
      createdAt: row.created_at.toISOString(),
    };
  }
}
