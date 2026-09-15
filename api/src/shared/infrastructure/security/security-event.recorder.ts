import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../persistence/prisma.service';

export interface SecurityEventInput {
  /** Nombre en punto: 'login.success', 'account.locked', 'balance.updated'. */
  eventType: string;
  principalId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Registro de eventos de seguridad.
 *
 * ── La regla que gobierna esta clase ────────────────────────────────────────
 * NUNCA lanza. Si Postgres está saturado y no se puede escribir la fila de
 * auditoría, lo último que queremos es que un usuario legítimo no pueda entrar
 * a su cuenta por eso. La auditoría es importante, pero es secundaria respecto
 * a que el servicio funcione: se registra el fallo en el log y se sigue.
 *
 * Es la diferencia entre un sistema que se degrada con elegancia y uno que se
 * cae entero por su componente menos crítico.
 *
 * ── Para qué sirve en la práctica ───────────────────────────────────────────
 *   · Detectar ataques de fuerza bruta (muchos login.failed desde una IP).
 *   · Responder "¿quién cambió este saldo y cuándo?" con pruebas.
 *   · Cumplir el requisito de trazabilidad que pide Google Play para apps que
 *     manejan datos personales.
 */
@Injectable()
export class SecurityEventRecorder {
  private readonly logger = new Logger(SecurityEventRecorder.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: SecurityEventInput): Promise<void> {
    try {
      await this.prisma.securityEvent.create({
        data: {
          eventType: input.eventType,
          principalId: input.principalId ?? null,
          email: input.email ?? null,
          ipAddress: SecurityEventRecorder.sanitizeIp(input.ip),
          // Se recorta: algunos user-agents de bots miden kilobytes.
          userAgent: input.userAgent?.slice(0, 512) ?? null,
          metadata: (input.metadata ?? {}) as never,
        },
      });
    } catch (error) {
      this.logger.error(
        `No se pudo registrar el evento de seguridad '${input.eventType}'`,
        error instanceof Error ? error.stack : String(error),
      );
      // Se traga a propósito. Ver el comentario de la clase.
    }
  }

  /**
   * Postgres rechaza la transacción entera si un INET recibe basura, así que se
   * valida antes. Un proxy mal configurado puede mandar "unknown" o encadenar
   * varias IPs separadas por coma en X-Forwarded-For.
   */
  private static sanitizeIp(ip?: string | null): string | null {
    if (!ip) return null;

    const first = ip.split(',')[0].trim();

    // IPv4 con prefijo IPv6 (::ffff:190.1.2.3) que añaden algunos balanceadores.
    const unmapped = first.replace(/^::ffff:/i, '');

    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(unmapped);
    const isIPv6 = /^[0-9a-f:]+$/i.test(first) && first.includes(':');

    if (isIPv4) {
      const octetsValid = unmapped.split('.').every((o) => Number(o) <= 255);
      return octetsValid ? unmapped : null;
    }

    return isIPv6 ? first : null;
  }
}
