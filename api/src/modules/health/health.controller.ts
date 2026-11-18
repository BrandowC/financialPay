import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../shared/infrastructure/persistence/prisma.service';
import { Public } from '../../shared/infrastructure/http/auth.guard';

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
 */
@ApiTags('Salud')
@Controller('health')
@Public()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

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

  @Get()
  @ApiOperation({ summary: 'Informe completo de estado' })
  async full() {
    const databaseUp = await this.prisma.isHealthy();

    return {
      status: databaseUp ? 'ok' : 'unhealthy',
      version: process.env.npm_package_version ?? '1.0.0',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      timestamp: new Date().toISOString(),
      checks: { database: databaseUp ? 'up' : 'down' },
    };
  }
}
