import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictError } from '../../../../shared/domain/errors/domain.error';
import { BirthDate } from '../../../../shared/domain/value-objects/birth-date.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { FullName } from '../../../../shared/domain/value-objects/full-name.vo';
import { PlainPassword } from '../../../../shared/domain/value-objects/password.vo';
import { UsPhoneNumber } from '../../../../shared/domain/value-objects/phone-number.vo';
import { SecurityEventRecorder } from '../../../../shared/infrastructure/security/security-event.recorder';
import {
  CUSTOMER_REPOSITORY,
  CustomerRecord,
  CustomerRepository,
} from '../../../customers/application/ports/customer.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher.port';
import { IssuedTokens, TOKEN_SERVICE, TokenService } from '../ports/token.port';

export interface RegisterCommand {
  fullName: string;
  email: string;
  password: string;
  birthDate: string;
  phone: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface RegisterResult {
  customer: CustomerRecord;
  tokens: IssuedTokens;
}

/**
 * Alta de un cliente nuevo.
 *
 * ── El orden de las cosas, y por qué importa ────────────────────────────────
 *   1. Se construyen los value objects. Cada uno valida lo suyo y lanza con un
 *      código de error concreto. Al terminar este paso, es IMPOSIBLE que los
 *      datos sean inválidos: no existe forma de crear un `Email` inválido.
 *   2. Se comprueba que el correo esté libre (para dar un mensaje claro).
 *   3. Se hashea la contraseña — lo más caro, ~50 ms.
 *   4. El repositorio escribe usuario + perfil + saldo + evento de outbox en
 *      UNA transacción.
 *   5. Se emiten los tokens y el usuario entra directo, sin volver a login.
 *
 * ── La carrera del paso 2 ───────────────────────────────────────────────────
 * Entre comprobar que el correo está libre y escribirlo pueden pasar
 * microsegundos, y en ese hueco otra petición puede registrar el mismo correo.
 * Es una condición de carrera real, no teórica, cuando entran 2.000 personas al
 * día desde una campaña.
 *
 * Por eso la comprobación NO es la defensa: la defensa es el índice único
 * `users_email_active_uidx` de Postgres, que es atómico por definición. El paso
 * 2 solo existe para dar un mensaje amable en el 99.99% de los casos; el
 * catch del final cubre el 0.01% restante. Comprobar-y-luego-actuar sin
 * respaldo en la base de datos es uno de los errores más frecuentes que se ven
 * en producción.
 */
@Injectable()
export class RegisterUseCase {
  private readonly logger = new Logger(RegisterUseCase.name);

  constructor(
    @Inject(CUSTOMER_REPOSITORY) private readonly customers: CustomerRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
  ) {}

  async execute(command: RegisterCommand): Promise<RegisterResult> {
    // ── 1. Validación de dominio ──────────────────────────────────────────
    const email = Email.create(command.email);
    const fullName = FullName.create(command.fullName);
    const password = PlainPassword.create(command.password);
    const birthDate = BirthDate.create(command.birthDate);
    const phone = UsPhoneNumber.create(command.phone);

    // ── 2. Mensaje amable si el correo ya está tomado ─────────────────────
    if (await this.customers.emailExists(email)) {
      await this.security.record({
        eventType: 'register.duplicate_email',
        email: email.value,
        ip: command.ip,
        userAgent: command.userAgent,
      });

      throw new ConflictError(
        'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
        'EMAIL_ALREADY_REGISTERED',
      );
    }

    // ── 3. Hasheo ─────────────────────────────────────────────────────────
    const passwordHash = await this.hasher.hash(password);

    // ── 4. Escritura atómica ──────────────────────────────────────────────
    let customer: CustomerRecord;
    try {
      customer = await this.customers.create({
        email,
        passwordHash,
        fullName,
        birthDate,
        phone,
      });
    } catch (error) {
      // La carrera del paso 2, atrapada por el índice único de Postgres.
      if (RegisterUseCase.isUniqueEmailViolation(error)) {
        throw new ConflictError(
          'Ese correo ya tiene una cuenta. Intenta iniciar sesión.',
          'EMAIL_ALREADY_REGISTERED',
        );
      }
      throw error;
    }

    // ── 5. Sesión inmediata ───────────────────────────────────────────────
    const tokens = await this.tokens.issue(customer.id, 'CUSTOMER', undefined, {
      ip: command.ip,
      userAgent: command.userAgent,
    });

    await this.security.record({
      eventType: 'register.success',
      principalId: customer.id,
      email: email.value,
      ip: command.ip,
      userAgent: command.userAgent,
      metadata: { accountNumber: customer.accountNumber },
    });

    this.logger.log(`Cliente registrado: ${customer.accountNumber} (${email.mask()})`);

    return { customer, tokens };
  }

  /** Detecta el P2002 de Prisma sobre el índice de correo. */
  private static isUniqueEmailViolation(error: unknown): boolean {
    const code = (error as { code?: string })?.code;
    if (code !== 'P2002' && code !== 'UNIQUE_VIOLATION') return false;

    const target = (error as { meta?: { target?: unknown } })?.meta?.target;
    const asText = Array.isArray(target) ? target.join(',') : String(target ?? '');

    // Si no se puede saber qué índice fue, se asume que es el correo: es el
    // único que un cliente puede provocar desde el formulario.
    return asText === '' || asText.includes('email');
  }
}
