export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

/** Quién es el portador del token. */
export type PrincipalKind = 'CUSTOMER' | 'ADMIN';

/** Contenido del access token. Se mantiene mínimo a propósito. */
export interface AccessTokenClaims {
  /** `sub` — id del usuario o del administrador. */
  sub: string;
  kind: PrincipalKind;
  /** Solo para administradores. Los clientes no tienen roles. */
  role?: string;
  /** Id de la familia de refresh, para poder revocar la sesión completa. */
  sid: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Segundos de vida del access token, para que el cliente sepa cuándo renovar. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface RefreshContext {
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Emisión, rotación y revocación de tokens.
 *
 * ── El diseño: access corto + refresh rotativo ──────────────────────────────
 * El access token es un JWT firmado con vida corta (15 min). No se guarda en
 * ninguna parte: se valida con la firma, así que verificarlo no toca la base de
 * datos. Eso es lo que permite que la API escale — el 95% de las peticiones no
 * consultan la tabla de sesiones.
 *
 * El refresh token sí vive en la base (solo su SHA-256) y se ROTA en cada uso:
 * cada renovación entrega uno nuevo y marca el anterior como consumido.
 *
 * ── Detección de robo por reuso ─────────────────────────────────────────────
 * Si llega un refresh token que ya fue consumido, solo hay dos explicaciones:
 * o el cliente perdió la respuesta por un corte de red, o alguien robó el
 * token. Como no se pueden distinguir, se asume lo peor y se revoca la FAMILIA
 * entera: el atacante y el usuario legítimo quedan fuera, y el usuario vuelve a
 * entrar con su contraseña. Es la mitigación estándar (RFC 6819 §5.2.2.3).
 */
export interface TokenService {
  /** Nueva sesión: crea una familia de refresh y emite el primer par. */
  issue(
    principalId: string,
    kind: PrincipalKind,
    role: string | undefined,
    context: RefreshContext,
  ): Promise<IssuedTokens>;

  /** Valida y rota. Lanza UnauthorizedError si el token fue reusado o expiró. */
  rotate(refreshToken: string, context: RefreshContext): Promise<IssuedTokens>;

  /** Cierra una sesión concreta (logout normal). */
  revoke(refreshToken: string): Promise<void>;

  /** Cierra TODAS las sesiones del principal (cambio de contraseña, robo…). */
  revokeAllForPrincipal(principalId: string, kind: PrincipalKind): Promise<number>;

  /** Verifica la firma y la vigencia de un access token. */
  verifyAccessToken(token: string): Promise<AccessTokenClaims>;
}
