import { Inject, Injectable } from '@nestjs/common';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../shared/domain/errors/domain.error';
import { PlainPassword } from '../../../shared/domain/value-objects/password.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import { SecurityEventRecorder } from '../../../shared/infrastructure/security/security-event.recorder';
import { PASSWORD_HASHER, PasswordHasher } from '../../auth/application/ports/password-hasher.port';
import { TOKEN_SERVICE, TokenService } from '../../auth/application/ports/token.port';

export interface ChangeAdminPasswordCommand {
  adminId: string;
  currentPassword: string;
  newPassword: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Cambio de contraseña del administrador.
 *
 * Exige la contraseña ACTUAL aunque la sesión ya esté abierta: si alguien deja
 * el panel abierto en un computador ajeno, no puede apropiarse de la cuenta
 * cambiando la clave. Al terminar se cierran TODAS las sesiones del
 * administrador (incluida esta), así que hay que volver a entrar con la nueva.
 */
@Injectable()
export class ChangeAdminPasswordUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_SERVICE) private readonly tokens: TokenService,
    private readonly security: SecurityEventRecorder,
  ) {}

  async execute(command: ChangeAdminPasswordCommand): Promise<void> {
    const admin = await this.prisma.adminUser.findUnique({ where: { id: command.adminId } });
    if (!admin) throw new NotFoundError('Administrador', 'ADMIN_NOT_FOUND');

    const currentIsValid = await this.hasher.verify(admin.passwordHash, command.currentPassword);
    if (!currentIsValid) {
      await this.security.record({
        eventType: 'admin_password_change.failed',
        principalId: admin.id,
        email: admin.email,
        ip: command.ip,
        userAgent: command.userAgent,
      });
      throw new UnauthorizedError('La contraseña actual no es correcta', 'INVALID_CURRENT_PASSWORD');
    }

    if (command.newPassword === command.currentPassword) {
      throw new ValidationError(
        'La contraseña nueva tiene que ser distinta de la actual',
        'PASSWORD_UNCHANGED',
      );
    }

    // Valida largo, lista de contraseñas comunes y repetición (ver PlainPassword).
    const newPassword = PlainPassword.create(command.newPassword);
    const passwordHash = await this.hasher.hash(newPassword);

    await this.prisma.adminUser.update({
      where: { id: admin.id },
      data: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    });

    await this.tokens.revokeAllForPrincipal(admin.id, 'ADMIN');

    await this.security.record({
      eventType: 'admin_password_change.success',
      principalId: admin.id,
      email: admin.email,
      ip: command.ip,
      userAgent: command.userAgent,
    });
  }
}
