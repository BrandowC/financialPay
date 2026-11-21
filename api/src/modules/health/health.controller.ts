import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/infrastructure/persistence/prisma.service';
import { Public } from '../../shared/infrastructure/http/auth.guard';
import { SPREADSHEET_SYNC, SpreadsheetSync } from '../sync/application/ports/spreadsheet.port';

/**
 * Sondas de salud.
 *
 * ── Por qué hay tres y no una ──────────────────────────────────────────────
 * Confundirlas es una de las causas más comunes de caídas en cascada:
 *
 *   /health/live  — ¿el proceso está vivo? Solo eso. Si esto falla, el
 *                   orquestador REINICIA el contenedor. Por eso NO debe
 *                   consultar la base de datos: si Postgres se cae un minuto,
 *                   una sonda de vida que dependa de él reiniciaría todas las
 *                   réplicas a la vez, y al volver Postgres se encontraría con
 *                   una avalancha de reconexiones. El remedio peor que la
 *                   enfermedad.
 *
 *   /health/ready — ¿puede atender tráfico? Aquí SÍ se mira la base. Si falla,
 *                   el balanceador deja de mandarle peticiones pero NO lo
 *                   reinicia: cuando Postgres vuelva, la instancia se
 *                   reincorpora sola.
 *
 *   /health       — informe completo para monitorización y para el panel.
 *                   Incluye el estado de la sincronización con la hoja.
 */
@ApiTags('Salud')
@Controller('health')
@Public()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SPREADSHEET_SYNC) private readonly sheets: SpreadsheetSync,
  ) {}

  @Get('live')
  @ApiOperation({ summary: 'Sonda de vida (no toca la base de datos)' })
  live() {
    return { status: 'ok', uptime: Math.floor((Date.now() - this.startedAt) / 1000) };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Sonda de disponibilidad (comprueba PostgreSQL)' })
  async ready() {
    const databaseUp = await this.prisma.isHealthy();

    return {
      status: databaseUp ? 'ok' : 'degraded',
      checks: { database: databaseUp ? 'up' : 'down' },
    };
  }

  /**
   * Informe completo.
   *
   * La cola de sincronización se reporta pero NO tumba el estado general: si
   * Google Sheets está caído, la API sigue siendo perfectamente utilizable —
   * los registros se guardan y los eventos esperan en el outbox. Marcarlo como
   * "unhealthy" haría que el balanceador sacara instancias sanas de servicio
   * por un problema de un sistema de terceros que no es crítico.
   */
  @Get()
  @ApiOperation({ summary: 'Informe completo de estado' })
  async full() {
    const [databaseUp, sheetsUp, queue] = await Promise.all([
      this.prisma.isHealthy(),
      this.sheets.isAvailable().catch(() => false),
      this.queueStats().catch(() => null),
    ]);

    return {
      status: databaseUp ? 'ok' : 'unhealthy',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: {
        database: databaseUp ? 'up' : 'down',
        // 'disabled' no es un fallo: es una configuración válida.
        spreadsheet: sheetsUp ? 'up' : 'down_or_disabled',
      },
      sync: queue,
    };
  }

  private async queueStats() {
    const [row] = await this.prisma.$queryRaw<
      { pending: bigint; failed: bigint; dead: bigint; oldest_pending: Date | null }[]
    >`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PENDING')            AS pending,
        COUNT(*) FILTER (WHERE status = 'FAILED')             AS failed,
        COUNT(*) FILTER (WHERE status = 'DEAD')               AS dead,
        MIN(created_at) FILTER (WHERE status IN ('PENDING','FAILED')) AS oldest_pending
      FROM outbox_events
    `;

    return {
      pending: Number(row.pending),
      failed: Number(row.failed),
      // Si esto sube de 0, hay que mirarlo a mano: son eventos que agotaron
      // todos sus reintentos.
      dead: Number(row.dead),
      oldestPendingAt: row.oldest_pending?.toISOString() ?? null,
    };
  }
}
