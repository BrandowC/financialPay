import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import {
  BalanceSheetUpdate,
  CustomerSheetRow,
  SPREADSHEET_SYNC,
  SpreadsheetSync,
} from '../application/ports/spreadsheet.port';

/** Fila cruda que devuelve claim_outbox_events(). */
interface ClaimedEvent {
  id: bigint;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/**
 * Worker que vacía la tabla `outbox_events` hacia Google Sheets.
 *
 * ── Por qué existe este worker y no se llama a Sheets al registrarse ───────
 * Si el registro llamara a Google directamente, tendría tres problemas serios:
 *
 *   1. LENTITUD. La API de Sheets tarda 300-800 ms. El usuario esperaría todo
 *      eso mirando un spinner después de pulsar "Crear cuenta".
 *   2. FRAGILIDAD. Si Google devuelve un 500, ¿qué se hace? ¿Se cancela el
 *      registro que ya está guardado? ¿Se le dice al usuario que falló cuando
 *      en realidad su cuenta sí se creó?
 *   3. CUOTA. Sheets permite 60 peticiones por minuto y por usuario. Una
 *      campaña que traiga 200 registros en cinco minutos ya la agota.
 *
 * Con el patrón outbox, el registro solo escribe una fila más en su propia
 * transacción (microsegundos) y este worker se encarga del resto en segundo
 * plano, agrupando y reintentando. El usuario nunca espera por Google, y si
 * Google está caído tres horas, al volver se sincroniza todo lo pendiente.
 *
 * ── Seguridad ante varias instancias ────────────────────────────────────────
 * Cuando la API corre replicada, todas las réplicas ejecutan este worker. La
 * función `claim_outbox_events` usa `FOR UPDATE SKIP LOCKED`, así que dos
 * instancias nunca toman el mismo evento y tampoco se bloquean entre sí.
 */
@Injectable()
export class OutboxWorker implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);

  /** Identifica a esta instancia en la columna `locked_by`. */
  private readonly workerId = `${process.env.HOSTNAME ?? 'local'}-${randomUUID().slice(0, 8)}`;

  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private stopping = false;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SPREADSHEET_SYNC) private readonly sheets: SpreadsheetSync,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.get<boolean>('OUTBOX_ENABLED')) {
      this.logger.warn('Worker de outbox desactivado por configuración');
      return;
    }

    const interval = this.config.getOrThrow<number>('OUTBOX_POLL_INTERVAL_MS');

    // setInterval y no @Cron porque el intervalo es configurable y suele ser de
    // segundos; la expresión cron más fina es de un minuto.
    this.timer = setInterval(() => {
      void this.tick();
    }, interval);

    // unref() evita que este temporizador mantenga vivo el proceso e impida un
    // apagado limpio.
    this.timer.unref();

    this.logger.log(`Worker de outbox iniciado · id=${this.workerId} · cada ${interval}ms`);
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);

    // Espera a que termine el ciclo en curso para no dejar eventos marcados
    // como PROCESSING al apagar el contenedor.
    let waited = 0;
    while (this.running && waited < 10_000) {
      await new Promise((r) => setTimeout(r, 100));
      waited += 100;
    }

    this.logger.log('Worker de outbox detenido');
  }

  /**
   * Un ciclo. El guardia `running` evita que dos ciclos se solapen si uno
   * tarda más que el intervalo — sin él, un Sheets lento provocaría ciclos
   * apilados hasta agotar el pool de conexiones.
   */
  private async tick(): Promise<void> {
    if (this.running || this.stopping) return;
    this.running = true;

    try {
      const batchSize = this.config.getOrThrow<number>('OUTBOX_BATCH_SIZE');

      // El cast ::int es obligatorio: Prisma envía los números de JavaScript
      // como bigint por defecto, y a diferencia de una comparación (WHERE x =
      // $1), la resolución de una LLAMADA A FUNCIÓN en Postgres exige que el
      // tipo del argumento coincida exactamente con la firma — no hay
      // conversión implícita de bigint a integer en ese contexto. Sin el
      // cast, Postgres responde "function claim_outbox_events(text, bigint)
      // does not exist" aunque la función sí exista con (text, integer).
      const events = await this.prisma.$queryRaw<ClaimedEvent[]>`
        SELECT * FROM claim_outbox_events(${this.workerId}, ${batchSize}::int)
      `;

      if (events.length === 0) return;

      this.logger.debug(`${events.length} evento(s) reclamados`);
      await this.dispatch(events);
    } catch (error) {
      this.logger.error(
        'Fallo el ciclo del worker de outbox',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.running = false;
    }
  }

  /** Agrupa por tipo para poder enviar en lote, y marca el resultado. */
  private async dispatch(events: ClaimedEvent[]): Promise<void> {
    const registrations = events.filter((e) => e.event_type === 'customer.registered');
    const balanceUpdates = events.filter((e) => e.event_type === 'balance.updated');
    const deletions = events.filter((e) => e.event_type === 'customer.deleted');

    await this.handleGroup(registrations, async (batch) => {
      const rows: CustomerSheetRow[] = batch.map((e) => {
        const p = e.payload as Record<string, string>;
        return {
          accountNumber: p.accountNumber,
          fullName: p.fullName,
          email: p.email,
          phone: p.phoneFormatted ?? p.phone,
          birthDate: p.birthDate,
          registeredAt: OutboxWorker.formatDate(p.registeredAt),
          balance: p.balanceDecimal ?? '0.00',
          currency: p.currency ?? 'USD',
          lastBalanceUpdate: '',
          updatedBy: '',
          status: 'Activa',
        };
      });

      await this.sheets.appendCustomers(rows);
    });

    await this.handleGroup(balanceUpdates, async (batch) => {
      // Si el mismo cliente cambió varias veces en el lote, solo interesa el
      // último valor. Enviar los intermedios gastaría cuota para nada.
      const latest = new Map<string, BalanceSheetUpdate>();

      for (const e of batch) {
        const p = e.payload as Record<string, string>;
        const accountNumber = await this.accountNumberFor(e.aggregate_id);
        if (!accountNumber) continue;

        latest.set(accountNumber, {
          accountNumber,
          balance: p.amountDecimal,
          updatedAt: OutboxWorker.formatDate(p.updatedAt),
          updatedBy: p.updatedByEmail ?? '',
        });
      }

      await this.sheets.updateBalances([...latest.values()]);
    });

    await this.handleGroup(deletions, async (batch) => {
      for (const e of batch) {
        const p = e.payload as Record<string, string>;
        if (p.accountNumber) {
          await this.sheets.markDeleted(p.accountNumber, p.deletedAt);
        }
      }
    });
  }

  /** Ejecuta el envío de un grupo y marca todos sus eventos según el resultado. */
  private async handleGroup(
    events: ClaimedEvent[],
    send: (batch: ClaimedEvent[]) => Promise<void>,
  ): Promise<void> {
    if (events.length === 0) return;

    try {
      await send(events);
      await this.markCompleted(events);
    } catch (error) {
      await this.markFailed(events, error);
    }
  }

  private async markCompleted(events: ClaimedEvent[]): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: events.map((e) => e.id) } },
      data: { status: 'COMPLETED', processedAt: new Date(), lockedBy: null, lockedAt: null, lastError: null },
    });

    this.logger.log(`${events.length} evento(s) sincronizados con la hoja`);
  }

  /**
   * Marca los eventos como fallidos y calcula cuándo reintentar.
   *
   * El backoff exponencial (5s, 10s, 20s, 40s… hasta 1 hora) evita machacar un
   * servicio que ya está caído — reintentar cada segundo solo empeora una
   * caída ajena y gasta nuestra cuota.
   *
   * Pasados los intentos máximos el evento pasa a DEAD: deja de reintentarse y
   * queda visible en /health y en el panel para revisión manual. Un evento que
   * falla 12 veces no es un problema de red, es un problema de datos o de
   * configuración, y hay que mirarlo con ojos humanos.
   */
  private async markFailed(events: ClaimedEvent[], error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);

    for (const event of events) {
      const isDead = event.attempts >= event.max_attempts;

      const backoffSeconds = Math.min(5 * 2 ** (event.attempts - 1), 3600);
      const jitter = Math.random() * 0.3 * backoffSeconds;

      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: isDead ? 'DEAD' : 'FAILED',
          lastError: message.slice(0, 1000),
          nextAttemptAt: new Date(Date.now() + (backoffSeconds + jitter) * 1000),
          lockedBy: null,
          lockedAt: null,
        },
      });
    }

    const dead = events.filter((e) => e.attempts >= e.max_attempts).length;

    this.logger.error(
      `${events.length} evento(s) fallaron: ${message}` +
        (dead > 0 ? ` · ${dead} pasaron a DEAD y requieren revisión manual` : ''),
    );
  }

  /** El payload de balance.updated trae el userId; la hoja indexa por cuenta. */
  private async accountNumberFor(userId: string): Promise<string | null> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { accountNumber: true },
    });
    return profile?.accountNumber ?? null;
  }

  /**
   * Rescata eventos de workers que murieron a media tarea.
   *
   * Si un contenedor se reinicia mientras procesaba, sus eventos quedan en
   * PROCESSING para siempre y nunca se reintentan. Este barrido los devuelve a
   * la cola pasados 5 minutos.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async releaseStaleEvents(): Promise<void> {
    if (!this.config.get<boolean>('OUTBOX_ENABLED')) return;

    try {
      const [{ release_stale_outbox_events: released }] = await this.prisma.$queryRaw<
        { release_stale_outbox_events: number }[]
      >`SELECT release_stale_outbox_events('5 minutes'::interval)`;

      if (released > 0) {
        this.logger.warn(`${released} evento(s) rescatados de workers caídos`);
      }
    } catch (error) {
      this.logger.error('Fallo el rescate de eventos atascados', error);
    }
  }

  /** Limpieza nocturna: los eventos completados no aportan nada tras 30 días. */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async purgeCompletedEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const { count } = await this.prisma.outboxEvent.deleteMany({
      where: { status: 'COMPLETED', processedAt: { lt: cutoff } },
    });

    if (count > 0) this.logger.log(`${count} eventos completados purgados`);
  }

  /** "2026-03-04T10:15:00Z" → "2026-03-04 10:15" para que se lea en la hoja. */
  private static formatDate(iso: string): string {
    if (!iso) return '';
    return iso.replace('T', ' ').slice(0, 16);
  }
}
