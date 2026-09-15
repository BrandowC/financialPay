import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { InfrastructureError } from '../../domain/errors/domain.error';

/** Contexto de quién ejecuta una transacción, para la auditoría automática. */
export interface AuditContext {
  actorId?: string | null;
  actorEmail?: string | null;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** El cliente dentro de una transacción no expone $connect, $transaction, etc. */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(private readonly config: ConfigService) {
    super({
      datasources: { db: { url: config.getOrThrow<string>('DATABASE_URL') } },
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
        ...(config.get('NODE_ENV') === 'development'
          ? ([{ emit: 'event', level: 'query' }] as const)
          : []),
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    // Los logs de Prisma se enrutan al logger de Nest para que salgan en el
    // mismo formato JSON estructurado que el resto y los recoja el agregador.
    this.$on('warn' as never, (e: Prisma.LogEvent) => this.logger.warn(e.message));
    this.$on('error' as never, (e: Prisma.LogEvent) => this.logger.error(e.message));

    if (this.config.get('NODE_ENV') === 'development') {
      this.$on('query' as never, (e: Prisma.QueryEvent) => {
        // Solo las consultas lentas: el log completo es ruido puro.
        if (e.duration > 200) {
          this.logger.debug(`Consulta lenta (${e.duration}ms): ${e.query}`);
        }
      });
    }

    await this.$connect();

    /**
     * statement_timeout es la red de seguridad más importante de toda la BD.
     * Sin él, una consulta mal planificada bloquea una conexión del pool para
     * siempre; con suficientes de esas, el pool se agota y la API entera deja
     * de responder aunque Postgres esté sano. Es la causa número uno de caídas
     * en APIs con tráfico real.
     */
    const timeout = this.config.getOrThrow<number>('DATABASE_STATEMENT_TIMEOUT_MS');
    await this.$executeRawUnsafe(`SET statement_timeout = ${Number(timeout)}`);

    this.logger.log(`PostgreSQL conectado (statement_timeout=${timeout}ms)`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('PostgreSQL desconectado limpiamente');
  }

  /**
   * Ejecuta una transacción propagando el contexto de auditoría a los triggers
   * de Postgres mediante `SET LOCAL`.
   *
   * ── Por qué SET LOCAL y no pasar el actor como columna ──────────────────
   * El trigger `audit_balance_change()` corre dentro de Postgres y no tiene
   * forma de saber qué administrador está detrás del UPDATE. `SET LOCAL` fija
   * variables que viven SOLO hasta el COMMIT o ROLLBACK de esta transacción y
   * SOLO en esta conexión, así que no se filtran a la siguiente petición que
   * reutilice la misma conexión del pool.
   *
   * El resultado es que la auditoría es imposible de saltarse: no depende de
   * que el programador se acuerde de escribir la fila.
   */
  async transactionWithAudit<T>(
    context: AuditContext,
    work: (tx: TransactionClient) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        // set_config(clave, valor, is_local=true) es el equivalente
        // parametrizable de SET LOCAL. Al ir por $executeRaw con parámetros
        // ligados, el valor NO se interpola en el SQL y la inyección es
        // imposible incluso si el user-agent trae comillas.
        const settings: [string, string | null | undefined][] = [
          ['app.actor_id', context.actorId],
          ['app.actor_email', context.actorEmail],
          ['app.reason', context.reason],
          ['app.ip', context.ip],
          ['app.user_agent', context.userAgent],
        ];

        for (const [key, value] of settings) {
          await tx.$executeRaw`SELECT set_config(${key}, ${value ?? ''}, true)`;
        }

        return work(tx);
      },
      {
        timeout: options?.timeout ?? 10_000,
        maxWait: options?.maxWait ?? 5_000,
        // ReadCommitted es suficiente: la protección contra escrituras
        // concurrentes la da el bloqueo optimista por `version`, no el nivel
        // de aislamiento. Serializable aquí solo añadiría reintentos y coste.
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );
  }

  /** ¿Responde la base de datos? Lo usa el endpoint /health. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error('Fallo el health check de PostgreSQL', error);
      return false;
    }
  }

  /**
   * Traduce los errores de Prisma a errores del dominio.
   *
   * Sin esto, un `P2002` (violación de unicidad) subiría hasta el controlador
   * y devolvería un 500 con el nombre de la tabla y de la columna dentro —
   * información que no debe salir nunca al exterior.
   */
  static translateError(error: unknown, resource = 'Recurso'): InfrastructureError | null {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return null;

    switch (error.code) {
      case 'P2002':
        return new InfrastructureError(
          `${resource}: violación de unicidad`,
          'UNIQUE_VIOLATION',
          error,
          { fields: error.meta?.target },
        );
      case 'P2003':
        return new InfrastructureError(
          `${resource}: violación de clave foránea`,
          'FOREIGN_KEY_VIOLATION',
          error,
        );
      case 'P2025':
        return new InfrastructureError(`${resource} no encontrado`, 'RECORD_NOT_FOUND', error);
      case 'P2024':
        // El pool se agotó: casi siempre significa consultas lentas o una fuga
        // de conexiones, no que falten conexiones.
        return new InfrastructureError(
          'Se agotó el pool de conexiones',
          'CONNECTION_POOL_TIMEOUT',
          error,
        );
      default:
        return new InfrastructureError(
          `Error de base de datos (${error.code})`,
          'DATABASE_ERROR',
          error,
        );
    }
  }
}
