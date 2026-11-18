import { Injectable, Logger } from '@nestjs/common';
import { Email } from '../../../shared/domain/value-objects/email.vo';
import { PrismaService } from '../../../shared/infrastructure/persistence/prisma.service';
import {
  CreateCustomerInput,
  CustomerCredentials,
  CustomerRecord,
  CustomerRepository,
} from '../application/ports/customer.repository';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  private readonly logger = new Logger(PrismaCustomerRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Alta completa en una sola transacción:
   *   1. `generate_account_number()` — función de Postgres que reintenta ante
   *      colisión (ver migración 002). El número es un identificador interno
   *      de la cuenta: la app ya no lo muestra.
   *   2. `users`
   *   3. `profiles`
   */
  async create(input: CreateCustomerInput): Promise<CustomerRecord> {
    return this.prisma.$transaction(async (tx) => {
      const [{ generate_account_number: accountNumber }] = await tx.$queryRaw<
        { generate_account_number: string }[]
      >`SELECT generate_account_number()`;

      const user = await tx.user.create({
        data: {
          email: input.email.value,
          passwordHash: input.passwordHash,
          status: 'ACTIVE',
          profile: {
            create: {
              fullName: input.fullName.value,
              birthDate: new Date(input.birthDate.toISODate()),
              countryCode: input.countryCode,
              phoneCountryCode: input.phone.dialCode,
              phoneNumber: input.phone.nationalNumber,
              accountNumber,
            },
          },
        },
        include: { profile: true },
      });

      return PrismaCustomerRepository.toRecord(user, user.profile!);
    });
  }

  async findById(id: string): Promise<CustomerRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: true },
    });

    if (!user?.profile) return null;
    return PrismaCustomerRepository.toRecord(user, user.profile);
  }

  async findCredentialsByEmail(email: Email): Promise<CustomerCredentials | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: email.value, deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    return user as CustomerCredentials | null;
  }

  /**
   * Homónimos. Se ordena por fecha de creación para que el resultado sea
   * determinista: sin ORDER BY, Postgres puede devolver las filas en distinto
   * orden entre ejecuciones y el comportamiento del login dejaría de ser
   * reproducible en los tests.
   */
  async findCredentialsByNormalizedName(
    normalizedName: string,
    limit: number,
  ): Promise<CustomerCredentials[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        profile: { normalizedName },
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return users as CustomerCredentials[];
  }

  async emailExists(email: Email): Promise<boolean> {
    const found = await this.prisma.user.findFirst({
      where: { email: email.value, deletedAt: null },
      select: { id: true },
    });
    return found !== null;
  }

  async recordSuccessfulLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  /**
   * Incremento atómico del contador de fallos.
   *
   * Se hace con SQL crudo y no con leer-sumar-escribir a propósito: dos
   * intentos fallidos simultáneos con leer-y-escribir dejarían el contador en 1
   * en vez de 2, y el bloqueo por fuerza bruta nunca llegaría a dispararse.
   * `failed_login_attempts + 1` dentro del propio UPDATE es atómico por
   * definición.
   */
  async recordFailedLogin(
    id: string,
    maxAttempts: number,
    lockoutMinutes: number,
  ): Promise<{ attempts: number; lockedUntil: Date | null }> {
    // `${lockoutMinutes}::int * interval '1 minute'` y no
    // `(${lockoutMinutes} || ' minutes')::interval`: concatenar un número con
    // texto (`||`) depende de una conversión implícita a texto que Postgres no
    // garantiza para el tipo bigint que Prisma envía. Multiplicar un
    // `interval` por un entero es aritmética estándar sin esa ambigüedad.
    const rows = await this.prisma.$queryRaw<
      { failed_login_attempts: number; locked_until: Date | null }[]
    >`
      UPDATE users
      SET failed_login_attempts = failed_login_attempts + 1,
          locked_until = CASE
            WHEN failed_login_attempts + 1 >= ${maxAttempts}::int
            THEN now() + (${lockoutMinutes}::int * interval '1 minute')
            ELSE locked_until
          END
      WHERE id = ${id}::uuid
      RETURNING failed_login_attempts, locked_until
    `;

    if (rows.length === 0) return { attempts: 0, lockedUntil: null };

    return {
      attempts: rows[0].failed_login_attempts,
      lockedUntil: rows[0].locked_until,
    };
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  /**
   * Borrado real, no lógico.
   *
   * Google Play y App Store exigen que "eliminar cuenta" elimine los datos de
   * verdad. Un `deleted_at` no cumple: los datos siguen ahí. El ON DELETE
   * CASCADE del esquema arrastra perfil, metas, aportes y tokens.
   *
   * ── `app.allow_account_erasure` ──────────────────────────────────────────
   * Las cuentas que vienen de la app anterior pueden tener filas en
   * `balance_audit`, que es inmutable por trigger. El CASCADE de este DELETE
   * también intenta borrarlas y ese trigger lo bloquearía (ver migración
   * 20260915000000). Esta variable de sesión es la llave que abre esa puerta,
   * y solo vive dentro de esta transacción.
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.allow_account_erasure', 'true', true)`;
      await tx.user.delete({ where: { id } });
    });

    this.logger.log(`Cuenta eliminada definitivamente: ${id}`);
  }

  // ── Mapeo ───────────────────────────────────────────────────────────────

  private static toRecord(
    user: {
      id: string;
      email: string;
      status: string;
      createdAt: Date;
      lastLoginAt: Date | null;
    },
    profile: {
      fullName: string;
      accountNumber: string;
      birthDate: Date;
      countryCode: string | null;
      phoneCountryCode: string;
      phoneNumber: string;
    },
  ): CustomerRecord {
    return {
      id: user.id,
      email: user.email,
      fullName: profile.fullName,
      accountNumber: profile.accountNumber,
      birthDate: profile.birthDate.toISOString().slice(0, 10),
      countryCode: profile.countryCode,
      phoneCountryCode: profile.phoneCountryCode,
      phoneNumber: profile.phoneNumber,
      status: user.status as CustomerRecord['status'],
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
