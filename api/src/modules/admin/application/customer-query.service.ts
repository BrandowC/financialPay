import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';

export interface CustomerListQuery {
  /** Busca en nombre, correo y teléfono. */
  search?: string;
  page: number;
  pageSize: number;
  sortBy: 'registeredAt' | 'fullName' | 'goalsCount' | 'lastLoginAt';
  sortDir: 'asc' | 'desc';
  /** Solo quienes ya crearon al menos una meta. */
  onlyWithGoals?: boolean;
  /** Solo quienes todavía no crearon ninguna. */
  onlyWithoutGoals?: boolean;
  /** Atajo para "solo quienes se registraron hoy". */
  period?: 'today';
}

export interface CustomerListItem {
  userId: string;
  fullName: string;
  email: string;
  countryCode: string | null;
  phone: string;
  birthDate: string;
  registeredAt: string;
  lastLoginAt: string | null;
  status: string;
  goalsCount: number;
  completedGoalsCount: number;
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
  birth_date: Date;
  country_code: string | null;
  phone_country_code: string;
  phone_number: string;
  goals_count: bigint;
  completed_goals_count: bigint;
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
      // El `normalize_name` permite que "jose" encuentre a "José" sin que haya
      // que escribir la tilde.
      const normalized = `%${CustomerQueryService.normalize(query.search.trim())}%`;

      conditions.push(Prisma.sql`(
        full_name ILIKE ${term}
        OR email ILIKE ${term}
        OR phone_number ILIKE ${term}
        OR normalize_name(full_name) LIKE ${normalized}
      )`);
    }

    if (query.onlyWithGoals) conditions.push(Prisma.sql`goals_count > 0`);
    if (query.onlyWithoutGoals) conditions.push(Prisma.sql`goals_count = 0`);

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
      goalsCount: Prisma.sql`goals_count`,
      lastLoginAt: Prisma.sql`last_login_at`,
    }[query.sortBy];

    const sortDirection = query.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    // Conteo y página en UNA sola consulta con una ventana: así el total y la
    // lista nunca se contradicen si alguien se registra justo entre ambas.
    const rows = await this.prisma.$queryRaw<OverviewRow[]>`
      SELECT *, COUNT(*) OVER() AS total_count
      FROM customer_overview
      ${where}
      ORDER BY ${sortColumn} ${sortDirection} NULLS LAST, user_id ASC
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
   * Las metas de una persona, solo para el panel: nombre, moneda, objetivo y
   * lo ahorrado. NO trae los aportes uno por uno — el panel muestra el
   * panorama, no el diario de cada persona.
   */
  async goalsOf(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      emoji: string | null;
      currency: string;
      targetCents: string;
      savedCents: string;
      completed: boolean;
      archived: boolean;
      createdAt: string;
    }>
  > {
    const rows = await this.prisma.$queryRaw<
      {
        id: string;
        name: string;
        emoji: string | null;
        currency: string;
        target_cents: bigint;
        saved_cents: bigint;
        archived_at: Date | null;
        created_at: Date;
      }[]
    >`
      SELECT g.id, g.name, g.emoji, g.currency, g.target_cents, g.archived_at, g.created_at,
             COALESCE(SUM(c.amount_cents), 0)::bigint AS saved_cents
      FROM goals g
      LEFT JOIN contributions c ON c.goal_id = g.id
      WHERE g.user_id = ${userId}::uuid
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `;

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      currency: r.currency.trim(),
      targetCents: r.target_cents.toString(),
      savedCents: r.saved_cents.toString(),
      completed: r.saved_cents >= r.target_cents,
      archived: r.archived_at !== null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  /** Todas las personas, en páginas, para exportar a Excel. */
  async *streamAll(batchSize = 500): AsyncGenerator<CustomerListItem[]> {
    let offset = 0;

    for (;;) {
      const rows = await this.prisma.$queryRaw<OverviewRow[]>`
        SELECT *, 0::bigint AS total_count
        FROM customer_overview
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
    customersWithGoals: number;
    totalGoals: number;
    completedGoals: number;
    /** Lo ahorrado por moneda — sumar monedas distintas no tiene sentido. */
    savedByCurrency: Array<{ currency: string; savedCents: string; goals: number }>;
    byCountry: Array<{ countryCode: string | null; customers: number }>;
  }> {
    const [stats] = await this.prisma.$queryRaw<
      {
        total_customers: bigint;
        registered_today: bigint;
        registered_this_month: bigint;
        customers_with_goals: bigint;
        total_goals: bigint;
        completed_goals: bigint;
      }[]
    >`
      SELECT
        COUNT(*)                                                            AS total_customers,
        COUNT(*) FILTER (WHERE registered_at >= date_trunc('day', now()))   AS registered_today,
        COUNT(*) FILTER (WHERE registered_at >= date_trunc('month', now())) AS registered_this_month,
        COUNT(*) FILTER (WHERE goals_count > 0)                             AS customers_with_goals,
        COALESCE(SUM(goals_count), 0)::bigint                               AS total_goals,
        COALESCE(SUM(completed_goals_count), 0)::bigint                     AS completed_goals
      FROM customer_overview
    `;

    const byCurrency = await this.prisma.$queryRaw<
      { currency: string; saved: bigint; goals: bigint }[]
    >`
      SELECT g.currency, COALESCE(SUM(c.amount_cents), 0)::bigint AS saved, COUNT(DISTINCT g.id) AS goals
      FROM goals g
      LEFT JOIN contributions c ON c.goal_id = g.id
      GROUP BY g.currency
      ORDER BY saved DESC
    `;

    const byCountry = await this.prisma.$queryRaw<{ country_code: string | null; customers: bigint }[]>`
      SELECT country_code, COUNT(*) AS customers
      FROM customer_overview
      GROUP BY country_code
      ORDER BY customers DESC
      LIMIT 8
    `;

    return {
      totalCustomers: Number(stats.total_customers),
      registeredToday: Number(stats.registered_today),
      registeredThisMonth: Number(stats.registered_this_month),
      customersWithGoals: Number(stats.customers_with_goals),
      totalGoals: Number(stats.total_goals),
      completedGoals: Number(stats.completed_goals),
      savedByCurrency: byCurrency.map((r) => ({
        currency: r.currency.trim(),
        savedCents: r.saved.toString(),
        goals: Number(r.goals),
      })),
      byCountry: byCountry.map((r) => ({
        countryCode: r.country_code ? r.country_code.trim() : null,
        customers: Number(r.customers),
      })),
    };
  }

  // ── Mapeo ───────────────────────────────────────────────────────────────

  private static toItem(row: OverviewRow): CustomerListItem {
    return {
      userId: row.user_id,
      fullName: row.full_name,
      email: row.email,
      countryCode: row.country_code ? row.country_code.trim() : null,
      phone: `${row.phone_country_code} ${row.phone_number}`,
      birthDate: row.birth_date.toISOString().slice(0, 10),
      registeredAt: row.registered_at.toISOString(),
      lastLoginAt: row.last_login_at?.toISOString() ?? null,
      status: row.status,
      goalsCount: Number(row.goals_count),
      completedGoalsCount: Number(row.completed_goals_count),
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
