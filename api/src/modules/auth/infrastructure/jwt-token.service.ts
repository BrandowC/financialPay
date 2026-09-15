import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { UnauthorizedError } from '../../../shared/domain/errors/domain.error';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import {
  AccessTokenClaims,
  IssuedTokens,
  PrincipalKind,
  RefreshContext,
  TokenService,
} from '../application/ports/token.port';

@Injectable()
export class JwtTokenService implements TokenService {
  private readonly logger = new Logger(JwtTokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Emisión ───────────────────────────────────────────────────────────────

  async issue(
    principalId: string,
    kind: PrincipalKind,
    role: string | undefined,
    context: RefreshContext,
  ): Promise<IssuedTokens> {
    const familyId = randomUUID();
    return this.mint(principalId, kind, role, familyId, context);
  }

  // ── Rotación ──────────────────────────────────────────────────────────────

  async rotate(refreshToken: string, context: RefreshContext): Promise<IssuedTokens> {
    const tokenHash = JwtTokenService.hashToken(refreshToken);

    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored) {
      // Nunca existió, o ya se limpió. No se distingue de un token falso.
      throw new UnauthorizedError('Sesión inválida. Inicia sesión de nuevo.', 'REFRESH_INVALID');
    }

    // ── Detección de reuso ──────────────────────────────────────────────────
    // El token ya fue consumido (tiene sucesor) o revocado explícitamente.
    // Se asume robo y se corta la familia completa.
    if (stored.revokedAt || stored.replacedBy) {
      this.logger.warn(
        `Reuso de refresh token detectado. Familia ${stored.familyId} revocada por completo.`,
      );

      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await this.prisma.securityEvent.create({
        data: {
          eventType: 'refresh_token.reuse_detected',
          principalId: stored.principalId,
          ipAddress: context.ip ?? undefined,
          userAgent: context.userAgent ?? undefined,
          metadata: { familyId: stored.familyId, tokenId: stored.id },
        },
      });

      throw new UnauthorizedError(
        'Tu sesión se cerró por seguridad. Inicia sesión de nuevo.',
        'REFRESH_REUSE_DETECTED',
      );
    }

    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Tu sesión expiró. Inicia sesión de nuevo.', 'REFRESH_EXPIRED');
    }

    // El rol puede haber cambiado desde que se emitió el token, así que se
    // relee en vez de confiar en lo que venía dentro.
    const role =
      stored.principalKind === 'ADMIN'
        ? await this.currentAdminRole(stored.principalId)
        : undefined;

    const issued = await this.mint(
      stored.principalId,
      stored.principalKind,
      role,
      stored.familyId,
      context,
      stored.id,
    );

    return issued;
  }

  // ── Revocación ────────────────────────────────────────────────────────────

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = JwtTokenService.hashToken(refreshToken);

    // updateMany y no update: si el token no existe no queremos que lance.
    // Un logout siempre debe "funcionar" desde el punto de vista del cliente.
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForPrincipal(principalId: string, kind: PrincipalKind): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { principalId, principalKind: kind, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count;
  }

  // ── Verificación ──────────────────────────────────────────────────────────

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      return await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
      });
    } catch (error) {
      const expired = (error as Error).name === 'TokenExpiredError';
      throw new UnauthorizedError(
        expired ? 'Tu sesión expiró' : 'Sesión inválida',
        expired ? 'ACCESS_TOKEN_EXPIRED' : 'ACCESS_TOKEN_INVALID',
      );
    }
  }

  // ── Internos ──────────────────────────────────────────────────────────────

  /**
   * Emite el par de tokens y persiste el refresh. Si viene `replacesTokenId`,
   * enlaza el anterior con el nuevo dentro de la MISMA transacción: así nunca
   * queda un token viejo sin marcar por un fallo a medio camino.
   */
  private async mint(
    principalId: string,
    kind: PrincipalKind,
    role: string | undefined,
    familyId: string,
    context: RefreshContext,
    replacesTokenId?: string,
  ): Promise<IssuedTokens> {
    // 32 bytes de entropía criptográfica. El refresh token NO es un JWT a
    // propósito: es opaco, no lleva información dentro, y su única fuente de
    // verdad es la fila en la base. Eso lo hace revocable de verdad.
    const refreshToken = randomBytes(32).toString('base64url');
    const tokenHash = JwtTokenService.hashToken(refreshToken);

    const accessTtl = this.config.getOrThrow<string>('JWT_ACCESS_TTL');
    const refreshTtlMs = JwtTokenService.parseDuration(
      this.config.getOrThrow<string>('JWT_REFRESH_TTL'),
    );

    const claims: AccessTokenClaims = { sub: principalId, kind, sid: familyId, ...(role ? { role } : {}) };

    const accessToken = await this.jwt.signAsync(
      // @nestjs/jwt tipa `claims` como el objeto libre que es (Record<string,
      // unknown>) en la firma que acepta `expiresIn` como string; se explicita
      // el tipo de retorno con la interfaz propia más abajo.
      claims as unknown as Record<string, unknown>,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        issuer: this.config.getOrThrow<string>('JWT_ISSUER'),
        // El paquete `jsonwebtoken` tipa `expiresIn` con un literal muy
        // estricto (ms.StringValue); nuestro esquema de entorno ya garantiza
        // el formato correcto ("15m", "24h"...), así que el cast es seguro.
        expiresIn: accessTtl as never,
      },
    );

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          principalId,
          principalKind: kind,
          tokenHash,
          familyId,
          userAgent: context.userAgent?.slice(0, 512) ?? null,
          ipAddress: context.ip ?? null,
          expiresAt: new Date(Date.now() + refreshTtlMs),
        },
      });

      if (replacesTokenId) {
        await tx.refreshToken.update({
          where: { id: replacesTokenId },
          data: { replacedBy: created.id, revokedAt: new Date() },
        });
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(JwtTokenService.parseDuration(accessTtl) / 1000),
      tokenType: 'Bearer',
    };
  }

  private async currentAdminRole(adminId: string): Promise<string | undefined> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: adminId },
      select: { role: true, isActive: true },
    });

    // Si al administrador lo desactivaron, su sesión deja de renovarse.
    if (!admin?.isActive) {
      throw new UnauthorizedError('Tu cuenta fue desactivada', 'ADMIN_DEACTIVATED');
    }

    return admin.role;
  }

  /**
   * SHA-256 sin sal, a propósito.
   *
   * Aquí NO se usa Argon2 aunque parezca lo coherente. La diferencia está en la
   * entropía de lo que se hashea: una contraseña humana tiene ~30 bits y hay que
   * hacerla cara de probar. Este token tiene 256 bits de aleatoriedad
   * criptográfica: ni con toda la energía del sol se recorre ese espacio. Un
   * hash rápido basta, y además permite buscar por `tokenHash` con un índice
   * único, que es lo que hace que la validación sea O(1).
   */
  private static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** "15m" → 900000 ms. Ya validado por el esquema de entorno. */
  private static parseDuration(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value);
    if (!match) throw new Error(`Duración inválida: ${value}`);

    const amount = Number(match[1]);
    const unit = match[2] as 's' | 'm' | 'h' | 'd';
    const multipliers = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

    return amount * multipliers[unit];
  }
}
