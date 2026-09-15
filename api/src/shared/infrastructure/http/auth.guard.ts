import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../domain/errors/domain.error';
import {
  AccessTokenClaims,
  PrincipalKind,
  TOKEN_SERVICE,
  TokenService,
} from '../../../modules/auth/application/ports/token.port';

/** Marca un endpoint como público (sin token). */
export const IS_PUBLIC = 'auth:public';
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restringe un endpoint a clientes o a administradores. */
export const REQUIRED_KIND = 'auth:kind';
export const RequireCustomer = () => SetMetadata(REQUIRED_KIND, 'CUSTOMER' as PrincipalKind);
export const RequireAdmin = () => SetMetadata(REQUIRED_KIND, 'ADMIN' as PrincipalKind);

/** Restringe por rol de administrador. */
export const REQUIRED_ROLES = 'auth:roles';
export const RequireRoles = (...roles: string[]) => SetMetadata(REQUIRED_ROLES, roles);

/** Lo que el guard deja disponible en `request.principal`. */
export interface AuthenticatedPrincipal {
  id: string;
  kind: PrincipalKind;
  role?: string;
  sessionId: string;
}

export type AuthenticatedRequest = Request & { principal?: AuthenticatedPrincipal };

/**
 * Guard global de autenticación.
 *
 * ── Por qué es global y se exceptúa con @Public, y no al revés ──────────────
 * Si el guard se aplicara endpoint por endpoint, el día que alguien añada uno
 * nuevo y se le olvide el decorador, ese endpoint queda ABIERTO A INTERNET sin
 * que nadie lo note. Aplicándolo globalmente, el olvido produce el fallo
 * contrario: el endpoint responde 401 y se detecta en el primer intento de uso.
 *
 * Es el principio de "seguro por defecto": que el descuido lleve a lo cerrado,
 * nunca a lo abierto.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = AuthGuard.extractBearerToken(request) ?? AuthGuard.extractCookieToken(request);

    if (!token) {
      throw new UnauthorizedError('Falta el token de acceso', 'MISSING_ACCESS_TOKEN');
    }

    const claims: AccessTokenClaims = await this.tokens.verifyAccessToken(token);

    request.principal = {
      id: claims.sub,
      kind: claims.kind,
      role: claims.role,
      sessionId: claims.sid,
    };

    // ── Tipo de principal ─────────────────────────────────────────────────
    const requiredKind = this.reflector.getAllAndOverride<PrincipalKind>(REQUIRED_KIND, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredKind && claims.kind !== requiredKind) {
      // 403 y no 404: el recurso existe, simplemente no es para este tipo de
      // usuario. Un cliente intentando entrar al panel debe verlo claro.
      throw new ForbiddenError(
        'Esta sección no está disponible para tu tipo de cuenta',
        'WRONG_PRINCIPAL_KIND',
      );
    }

    // ── Rol ───────────────────────────────────────────────────────────────
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(REQUIRED_ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles?.length && !requiredRoles.includes(claims.role ?? '')) {
      throw new ForbiddenError(
        'Tu rol no permite realizar esta acción',
        'INSUFFICIENT_ROLE',
      );
    }

    return true;
  }

  private static extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;

    const [scheme, value] = header.split(' ');
    // Comparación insensible a mayúsculas: algunos clientes mandan "bearer".
    if (scheme?.toLowerCase() !== 'bearer' || !value) return null;

    return value.trim();
  }

  /**
   * El panel administrativo manda el token en una cookie httpOnly en vez de
   * un header (ver admin.controller.ts) — la app móvil sigue usando
   * `Authorization: Bearer` sin cambios, así que este es solo un segundo
   * lugar donde mirar, nunca el primero.
   */
  private static extractCookieToken(request: Request & { cookies?: Record<string, string> }): string | null {
    return request.cookies?.admin_access_token ?? null;
  }
}
