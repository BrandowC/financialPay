import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Money } from '../../../shared/domain/value-objects/money.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';

export interface CustomerListQuery {
  /** Busca en nombre, correo y número de cuenta. */
  search?: string;
  page: number;
  pageSize: number;
  sortBy: 'registeredAt' | 'fullName' | 'amountCents';
  sortDir: 'asc' | 'desc';
  /** Solo quienes tienen saldo distinto de cero. */
  onlyWithBalance?: boolean;
  /** Solo quienes tienen el saldo en cero. Mutuamente excluyente con
   *  `onlyWithBalance` — si llegaran ambos, no habría fila que cumpla las dos. */
  onlyWithoutBalance?: boolean;
  /** Atajo para "solo quienes se registraron hoy". */
  period?: 'today';
}

export interface CustomerListItem {
  userId: string;
  fullName: string;
  email: string;
  accountNumber: string;
  phone: string;
  birthDate: string;
  registeredAt: string;
  lastLoginAt: string | null;
  status: string;
  balance: { cents: string; decimal: string; formatted: string; currency: string };
  balanceVersion: number;
  balanceUpdatedAt: string | null;
}

export interface RegistrationLedgerRow {
  accountNumber: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  registeredAt: string;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Fila cruda de la vista customer_overview. */
interface OverviewRow {
  user_id: string;
  email: string;
  status: string;
  registered_at: Date;
  last_login_at: Date | null;
  full_name: string;
  account_number: string;
  birth_date: Date;
  phone_country_code: string;
  phone_number: string;
  amount_cents: bigint;
  currency: string;
  balance_version: number;
  balance_updated_at: Date | null;
  total_count: bigint;
}

/**
 * Consultas de solo lectura del panel administrativo.
 *
 * ── Por qué está separado de los repositorios ──────────────────────────────
 * Esto es CQRS en su forma más simple y práctica. Los repositorios existen para
 * cargar y guardar entidades completas con sus reglas. Una tabla paginada con
 * búsqueda, orden y conteo no necesita nada de eso: necesita una consulta
 * eficiente que devuelva justo las columnas que la pantalla pinta.
 *
 * Mezclar ambas cosas lleva a repositorios con veinte métodos de búsqueda y a
 * cargar entidades enteras para mostrar tres campos. Separarlas deja las dos
 * mitades simples.
 */
@Injectable()
export class CustomerQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CustomerListQuery): Promise<PagedResult<CustomerListItem>> {
    const offset = (query.page - 1) * query.pageSize;

    // ── Filtros ───────────────────────────────────────────────────────────
    const conditions: Prisma.Sql[] = [];

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      // El `normalized_name` permite que "jose" encuentre a "José" sin que el
      // administrador tenga que escribir la tilde. La columna está indexada.
      const normalized = `%${CustomerQueryService.normalize(query.search.trim())}%`;

      conditions.push(Prisma.sql`(
        full_name ILIKE ${term}
        OR email ILIKE ${term}
        OR account_number ILIKE ${term}
        OR phone_number ILIKE ${term}
        OR normalize_name(full_name) LIKE ${normalized}
      )`);
    }

    if (query.onlyWithBalance) {
      conditions.push(Prisma.sql`amount_cents > 0`);
    }

    if (query.onlyWithoutBalance) {
      conditions.push(Prisma.sql`amount_cents = 0`);
    }

    if (query.period === 'today') {
      conditions.push(Prisma.sql`registered_at >= date_trunc('day', now())`);
    }

    const where =
      conditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
        : Prisma.empty;

    // ── Orden ─────────────────────────────────────────────────────────────
    // La columna NO puede venir interpolada del usuario: sería inyección SQL.
    // Se traduce desde una lista blanca cerrada.
    const sortColumn = {
      registeredAt: Prisma.sql`registered_at`,
      fullName: Prisma.sql`full_name`,
      amountCents: Prisma.sql`amount_cents`,
    }[query.sortBy];

    const sortDirection = query.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    /**
     * Conteo y página en UNA sola consulta con una ventana.
     *
     * La alternativa habitual son dos consultas (un COUNT y un SELECT), pero
     * eso recorre el filtro dos veces y, peor, puede dar resultados
     * inconsistentes si alguien se registra entre ambas: el total diría 41 y la
     * lista traería 40. `COUNT(*) OVER()` calcula el total sobre el mismo
     * conjunto en la misma pasada.
     */
    const rows = await this.prisma.$queryRaw<OverviewRow[]>`
      SELECT *, COUNT(*) OVER() AS total_count
      FROM customer_overview
      ${where}
      ORDER BY ${sortColumn} ${sortDirection}, user_id ASC
      LIMIT ${query.pageSize} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    return {
      items: rows.map(CustomerQueryService.toItem),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  async findOne(userId: string): Promise<CustomerListItem | null> {
    const rows = await this.prisma.$queryRaw<OverviewRow[]>`
      SELECT *, 1::bigint AS total_count
      FROM customer_overview
      WHERE user_id = ${userId}::uuid
    `;

    return rows.length > 0 ? CustomerQueryService.toItem(rows[0]) : null;
  }

  /**
   * Filas para exportar, limitadas a quienes se registraron en los últimos
   * `registeredWithinDays` días (el cliente pidió que el Excel no traiga el
   * histórico completo cada vez, solo lo reciente). Se recorre en páginas
   * para no cargar decenas de miles de registros en memoria de golpe.
   */
  async *streamAll(batchSize = 500, registeredWithinDays?: number): AsyncGenerator<CustomerListItem[]> {
    let offset = 0;

    const where =
      registeredWithinDays !== undefined
        ? Prisma.sql`WHERE registered_at >= now() - ${registeredWithinDays}::int * interval '1 day'`
        : Prisma.empty;

    for (;;) {
      const rows = await this.prisma.$queryRaw<OverviewRow[]>`
        SELECT *, 0::bigint AS total_count
        FROM customer_overview
        ${where}
        ORDER BY registered_at DESC, user_id ASC
        LIMIT ${batchSize} OFFSET ${offset}
      `;

      if (rows.length === 0) return;

      yield rows.map(CustomerQueryService.toItem);

      if (rows.length < batchSize) return;
      offset += batchSize;
    }
  }

  /** Métricas del tablero del panel. */
  async dashboardStats(): Promise<{
    totalCustomers: number;
    registeredToday: number;
    registeredThisMonth: number;
    totalBalance: { decimal: string; formatted: string };
    customersWithBalance: number;
    pendingSyncEvents: number;
    deadSyncEvents: number;
  }> {
    const [stats] = await this.prisma.$queryRaw<
      {
        total_customers: bigint;
        registered_today: bigint;
        registered_this_month: bigint;
        total_balance: bigint;
        customers_with_balance: bigint;
      }[]
    >`
      SELECT
        COUNT(*)                                                   AS total_customers,
        COUNT(*) FILTER (WHERE registered_at >= date_trunc('day', now()))   AS registered_today,
        COUNT(*) FILTER (WHERE registered_at >= date_trunc('month', now())) AS registered_this_month,
        COALESCE(SUM(amount_cents), 0)::bigint                     AS total_balance,
        COUNT(*) FILTER (WHERE amount_cents > 0)                   AS customers_with_balance
      FROM customer_overview
    `;

    const [sync] = await this.prisma.$queryRaw<{ pending: bigint; dead: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'FAILED', 'PROCESSING')) AS pending,
        COUNT(*) FILTER (WHERE status = 'DEAD')                               AS dead
      FROM outbox_events
    `;

    const totalBalance = Money.fromCents(stats.total_balance);

    return {
      totalCustomers: Number(stats.total_customers),
      registeredToday: Number(stats.registered_today),
      registeredThisMonth: Number(stats.registered_this_month),
      totalBalance: {
        decimal: totalBalance.toDecimalString(),
        formatted: totalBalance.format(),
      },
      customersWithBalance: Number(stats.customers_with_balance),
      pendingSyncEvents: Number(sync.pending),
      deadSyncEvents: Number(sync.dead),
    };
  }

  /**
   * Todas las filas de `registration_ledger`, para el export de historial
   * completo — incluye cuentas ya eliminadas, a propósito (ver
   * RegistrationLedger en schema.prisma). Se recorre en páginas por la misma
   * razón que `streamAll()`: no cargar decenas de miles de filas de golpe.
   */
  async *streamRegistrationLedger(batchSize = 500): AsyncGenerator<RegistrationLedgerRow[]> {
    let cursorId: bigint | undefined;

    for (;;) {
      const rows = await this.prisma.registrationLedger.findMany({
        take: batchSize,
        ...(cursorId !== undefined ? { skip: 1, cursor: { id: cursorId } } : {}),
        orderBy: { id: 'asc' },
      });

      if (rows.length === 0) return;

      yield rows.map((r) => ({
        accountNumber: r.accountNumber,
        fullName: r.fullName,
        email: r.email,
        phone: r.phone,
        birthDate: r.birthDate.toISOString().slice(0, 10),
        registeredAt: r.registeredAt.toISOString(),
      }));

      if (rows.length < batchSize) return;
      cursorId = rows[rows.length - 1].id;
    }
  }

  // ── Mapeo ───────────────────────────────────────────────────────────────

  private static toItem(row: OverviewRow): CustomerListItem {
    const money = Money.fromCents(row.amount_cents, row.currency.trim());

    return {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      accountNumber: row.account_number,
      phone: `${row.phone_country_code} ${row.phone_number}`,
      birthDate: row.birth_date.toISOString().slice(0, 10),
      registeredAt: row.registered_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString() ?? null,
      status: row.status,
      balance: {
        cents: money.cents.toString(),
        decimal: money.toDecimalString(),
        formatted: money.format(),
        currency: money.currency,
      },
      balanceVersion: row.balance_version,
      balanceUpdatedAt: row.balance_updated_at?.toISOString() ?? null,
    };
  }

  /** Igual que `normalize_name` de Postgres y que `FullName.normalize`. */
  private static normalize(input: string): string {
    const FROM = 'áéíóúüñàèìòùâêîôûÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛ';
    const TO = 'aeiouunaeiouaeiouAEIOUUNAEIOUAEIOU';

    return [...input.replace(/\s+/g, ' ').trim().toLowerCase()]
      .map((c) => {
        const i = FROM.indexOf(c);
        return i === -1 ? c : TO[i];
      })
      .join('');
  }
}
