import { Inject, Injectable } from '@nestjs/common';
import { RateLimitError, UnauthorizedError } from '../../../shared/domain/errors/domain.error';
import { Email } from '../../../shared/domain/value-objects/email.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import { SecurityEventRecorder } from '../../../shared/infrastructure/security/security-event.recorder';
import { PASSWORD_HASHER, PasswordHasher } from '../../auth/application/ports/password-hasher.port';
import { IssuedTokens, TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';

export interface AdminLoginCommand {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AdminLoginResult {
  tokens: IssuedTokens;
  admin: { id: string; email: string; fullName: string; role: string };
}

/**
 * Inicio de sesión de un administrador.
 *
 * Es más estricto que el de los clientes, y con razón: quien entra aquí puede
 * cambiar el saldo de cualquier persona y exportar todos los datos personales
 * de la base. Diferencias respecto al login de cliente:
 *
 *   · Solo por correo. No hay "entrar con el nombre".
 *   · Bloqueo tras 3 fallos (los clientes tienen 5) y durante 30 minutos.
 *   · Un administrador desactivado no entra ni con la contraseña correcta.
 */
@Injectable()
export class AdminLoginUseCase {
  private static readonly MAX_ATTEMPTS = 3;
  private static readonly LOCKOUT_MINUTES = 30;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
  ) {}

  async execute(command: AdminLoginCommand): Promise<AdminLoginResult> {
    let email: Email;
    try {
      email = Email.create(command.email);
    } catch {
      await this.hasher.verifyDummy();
      throw AdminLoginUseCase.genericFailure();
    }

    const admin = await this.prisma.adminUser.findUnique({ where: { email: email.value } });

    if (!admin) {
      // Mismo tiempo que un intento real: sin esto se podría averiguar qué
      // correos son administradores midiendo la respuesta.
      await this.hasher.verifyDummy();
      await this.security.record({
        eventType: 'admin_login.failed',
        email: email.value,
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { reason: 'ADMIN_NOT_FOUND' },
      });
      throw AdminLoginUseCase.genericFailure();
    }

    if (admin.lockedUntil && admin.lockedUntil.getTime() > Date.now()) {
      const retryAfter = Math.ceil((admin.lockedUntil.getTime() - Date.now()) / 1000);
      throw new RateLimitError(
        `Cuenta bloqueada temporalmente. Reintenta en ${Math.ceil(retryAfter / 60)} minutos.`,
        retryAfter,
        'ADMIN_ACCOUNT_LOCKED',
      );
    }

    const valid = await this.hasher.verify(admin.passwordHash, command.password);

    if (!valid) {
      const attempts = admin.failedLoginAttempts + 1;
      const shouldLock = attempts >= AdminLoginUseCase.MAX_ATTEMPTS;

      await this.prisma.adminUser.update({
        where: { id: admin.id },
        data: {
          failedLoginAttempts: attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + AdminLoginUseCase.LOCKOUT_MINUTES * 60_000)
            : admin.lockedUntil,
        },
      });

      await this.security.record({
        eventType: shouldLock ? 'admin_account.locked' : 'admin_login.failed',
        principalId: admin.id,
        email: admin.email,
        ip: command.ip,
        userAgent: command.userAgent,
        metadata: { attempts },
      });

      throw AdminLoginUseCase.genericFailure();
    }

    // La comprobación de "activo" va DESPUÉS de verificar la contraseña: si
    // fuera antes, un atacante sabría qué correos existen aunque estén
    // desactivados.
    if (!admin.isActive) {
      await this.security.record({
        eventType: 'admin_login.rejected_inactive',
        principalId: admin.id,
        email: admin.email,
        ip: command.ip,
      });
      throw new UnauthorizedError('Tu cuenta está desactivada', 'ADMIN_DEACTIVATED');
    }

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });

    const tokens = await this.tokens.issue(admin.id, 'ADMIN', admin.role, {
      ip: command.ip,
      userAgent: command.userAgent,
    });

    await this.security.record({
      eventType: 'admin_login.success',
      principalId: admin.id,
      email: admin.email,
      ip: command.ip,
      userAgent: command.userAgent,
      metadata: { role: admin.role },
    });

    return {
      tokens,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  private static genericFailure(): UnauthorizedError {
    return new UnauthorizedError('Correo o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }
}
