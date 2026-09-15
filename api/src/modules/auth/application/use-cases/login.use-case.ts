import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitError, UnauthorizedError } from '../../../../shared/domain/errors/domain.error';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { FullName } from '../../../../shared/domain/value-objects/full-name.vo';
import { PlainPassword } from '../../../../shared/domain/value-objects/password.vo';
import {
  CUSTOMER_REPOSITORY,
  CustomerCredentials,
  CustomerRepository,
} from '../../../customers/application/ports/customer.repository';
import { SecurityEventRecorder } from '../../../../shared/infrastructure/security/security-event.recorder';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { IssuedTokens, TOKEN_SERVICE, TokenService } from '../ports/token.port';

export interface LoginCommand {
  /** Nombre completo O correo. La pantalla acepta ambos. */
  identifier: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  tokens: IssuedTokens;
  customerId: string;
}

/**
 * Inicio de sesión de un cliente.
 *
 * ── El problema que arregla ─────────────────────────────────────────────────
 * La versión anterior resolvía el login llamando a una función de Postgres
 * (`lookup_email`) expuesta al rol anónimo, que recibía un nombre y devolvía el
 * CORREO de esa persona. Dos consecuencias graves:
 *
 *   1. FUGA DE DATOS. La clave anónima viaja dentro del APK y cualquiera puede
 *      extraerla. Con ella se podía llamar a esa función en bucle con una lista
 *      de nombres comunes y cosechar correos reales. Datos personales
 *      regalados, sin siquiera necesitar una cuenta.
 *
 *   2. USUARIOS BLOQUEADOS. Si dos personas se llamaban igual, la función
 *      devolvía NULL y NINGUNA de las dos podía entrar jamás. Con 2.000
 *      registros diarios en Estados Unidos, un choque de nombres no es una
 *      hipótesis: es cuestión de días.
 *
 * ── Cómo queda ──────────────────────────────────────────────────────────────
 * La resolución del identificador ocurre solo del lado del servidor y nunca se
 * devuelve nada sobre ella. Si el identificador es un nombre y coincide con
 * varias personas, se prueba la contraseña contra cada candidata y entra la que
 * corresponde: los homónimos dejan de ser un problema.
 *
 * Todas las rutas de fallo devuelven el MISMO mensaje y consumen el MISMO
 * tiempo, así que es imposible distinguir "no existe" de "contraseña
 * incorrecta", ni leyendo la respuesta ni midiendo el reloj.
 */
@Injectable()
export class LoginUseCase {
  private readonly logger = new Logger(LoginUseCase.name);

  /**
   * Tope de homónimos a comprobar. Cada uno cuesta ~50 ms de Argon2, así que
   * sin límite un nombre muy común se convertiría en un vector de denegación
   * de servicio: 500 coincidencias serían 25 segundos de CPU por petición.
   */
  private static readonly MAX_NAME_CANDIDATES = 5;

  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
    private readonly config: ConfigService,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const identifier = command.identifier?.trim() ?? '';

    if (identifier.length === 0 || !command.password) {
      throw LoginUseCase.genericFailure();
    }

    const candidates = await this.resolveCandidates(identifier);

    // Ni un solo candidato: se gasta el mismo tiempo que costaría verificar,
    // para que la respuesta tarde igual que con un usuario real.
    if (candidates.length === 0) {
      await this.hasher.verifyDummy();
      await this.security.record({
        eventType: 'login.failed',
        email: identifier.includes('@') ? identifier.toLowerCase() : null,
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { reason: 'IDENTIFIER_NOT_FOUND' },
      });
      throw LoginUseCase.genericFailure();
    }

    const maxAttempts = this.config.getOrThrow<number>('AUTH_MAX_FAILED_ATTEMPTS');
    const lockoutMinutes = this.config.getOrThrow<number>('AUTH_LOCKOUT_MINUTES');

    for (const candidate of candidates) {
      // ── Cuenta bloqueada por intentos fallidos ──────────────────────────
      if (candidate.lockedUntil && candidate.lockedUntil.getTime() > Date.now()) {
        const retryAfter = Math.ceil((candidate.lockedUntil.getTime() - Date.now()) / 1000);

        await this.security.record({
          eventType: 'login.blocked_while_locked',
          principalId: candidate.id,
          email: candidate.email,
          ip: command.ip,
          userAgent: command.userAgent,
          metadata: { retryAfter },
        });

        throw new RateLimitError(
          `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(retryAfter / 60)} minutos.`,
          retryAfter,
          'ACCOUNT_TEMPORARILY_LOCKED',
        );
      }

      const matches = await this.hasher.verify(candidate.passwordHash, command.password);
      if (!matches) continue;

      // ── Contraseña correcta ─────────────────────────────────────────────

      // Una cuenta suspendida sí recibe un mensaje distinto: quien acierta la
      // contraseña ya demostró ser el dueño, y decirle "escribe mal" cuando en
      // realidad está suspendida sería mandarlo a soporte a ciegas.
      if (candidate.status !== 'ACTIVE') {
        await this.security.record({
          eventType: 'login.rejected_inactive',
          principalId: candidate.id,
          email: candidate.email,
          ip: command.ip,
          metadata: { status: candidate.status },
        });

        throw new UnauthorizedError(
          'Tu cuenta está suspendida. Comunícate con soporte.',
          'ACCOUNT_SUSPENDED',
        );
      }

      // Si los parámetros de Argon2 subieron desde que se creó la cuenta, se
      // rehashea ahora que tenemos la contraseña en claro. El usuario no nota
      // nada y la seguridad se actualiza sola.
      if (this.hasher.needsRehash(candidate.passwordHash)) {
        const fresh = await this.hasher.hash(PlainPassword.create(command.password));
        await this.customers.updatePasswordHash(candidate.id, fresh);
        this.logger.log(`Contraseña rehasheada para el usuario ${candidate.id}`);
      }

      await this.customers.recordSuccessfulLogin(candidate.id);

      const tokens = await this.tokens.issue(candidate.id, 'CUSTOMER', undefined, {
        ip: command.ip,
        userAgent: command.userAgent,
      });

      await this.security.record({
        eventType: 'login.success',
        principalId: candidate.id,
        email: candidate.email,
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { candidatesEvaluated: candidates.length },
      });

      return { tokens, customerId: candidate.id };
    }

    // ── Ningún candidato aceptó la contraseña ──────────────────────────────
    // El contador de fallos solo sube cuando hay UN candidato. Con homónimos no
    // se puede saber a quién iba dirigido el intento, y castigar a los dos
    // permitiría a un tercero bloquear cuentas ajenas a propósito.
    if (candidates.length === 1) {
      const { attempts, lockedUntil } = await this.customers.recordFailedLogin(
        candidates[0].id,
        maxAttempts,
        lockoutMinutes,
      );

      await this.security.record({
        eventType: lockedUntil ? 'account.locked' : 'login.failed',
        principalId: candidates[0].id,
        email: candidates[0].email,
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { attempts, reason: 'WRONG_PASSWORD' },
      });
    } else {
      await this.security.record({
        eventType: 'login.failed',
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { reason: 'WRONG_PASSWORD', ambiguousCandidates: candidates.length },
      });
    }

    throw LoginUseCase.genericFailure();
  }

  /**
   * Traduce el identificador escrito a la lista de credenciales candidatas.
   * Si contiene "@" se trata como correo (a lo sumo una); si no, como nombre.
   */
  private async resolveCandidates(identifier: string): Promise<CustomerCredentials[]> {
    if (identifier.includes('@')) {
      try {
        const email = Email.create(identifier);
        const found = await this.customers.findCredentialsByEmail(email);
        return found ? [found] : [];
      } catch {
        // Formato de correo inválido: se devuelve vacío en vez de un error de
        // validación, para no revelar por qué falló.
        return [];
      }
    }

    try {
      const name = FullName.create(identifier);
      return await this.customers.findCredentialsByNormalizedName(
        name.normalized,
        LoginUseCase.MAX_NAME_CANDIDATES,
      );
    } catch {
      return [];
    }
  }

  /**
   * UN SOLO mensaje para todos los fallos de credenciales.
   * Si dijéramos "ese correo no existe" estaríamos confirmando qué correos SÍ
   * existen, que es justo lo que un atacante quiere averiguar.
   */
  private static genericFailure(): UnauthorizedError {
    return new UnauthorizedError(
      'Los datos no coinciden. Revisa tu nombre o correo y tu contraseña.',
      'INVALID_CREDENTIALS',
    );
  }
}
