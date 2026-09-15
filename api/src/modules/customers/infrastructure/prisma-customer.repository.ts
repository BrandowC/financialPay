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
   *      colisión (ver migración 002).
   *   2. `users`
   *   3. `profiles`
   *   4. `balances` en 0
   *   5. evento de outbox `customer.registered` → Google Sheets
   *   6. fila en `registration_ledger` — registro permanente, sobrevive
   *      aunque el cliente elimine la cuenta después (ver migración
   *      20260916000000)
   *
   * Los pasos 5 y 6 son la clave de "que quede guardado apenas se registra,
   * pase lo que pase después". Al ir dentro de la misma transacción, es
   * imposible que un cliente quede registrado sin su evento pendiente o sin
   * su fila permanente. Si Google está caído, el evento espera; no se pierde.
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
              phoneCountryCode: '+1',
              phoneNumber: input.phone.nationalNumber,
              accountNumber,
            },
          },
          balance: {
            create: { amountCents: 0n, currency: 'USD', version: 0 },
          },
        },
        include: { profile: true },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'customer',
          aggregateId: user.id,
          eventType: 'customer.registered',
          payload: {
            userId: user.id,
            accountNumber,
            fullName: input.fullName.value,
            email: input.email.value,
            birthDate: input.birthDate.toISODate(),
            phone: input.phone.toE164(),
            phoneFormatted: input.phone.format(),
            registeredAt: user.createdAt.toISOString(),
            balanceDecimal: '0.00',
            currency: 'USD',
          },
        },
      });

      await tx.registrationLedger.create({
        data: {
          userId: user.id,
          accountNumber,
          fullName: input.fullName.value,
          email: input.email.value,
          phone: input.phone.format(),
          birthDate: new Date(input.birthDate.toISODate()),
          registeredAt: user.createdAt,
        },
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
   * Google Play exige que "eliminar cuenta" elimine los datos de verdad. Un
   * `deleted_at` no cumple: los datos siguen ahí. El ON DELETE CASCADE del
   * esquema arrastra perfil, saldo, historial de auditoría y tokens.
   *
   * Antes de borrar se encola el evento para que el Excel también refleje la
   * baja; si se encolara después, el CASCADE ya habría borrado la fila y no
   * habría datos que enviar.
   *
   * ── `app.allow_account_erasure` ──────────────────────────────────────────
   * `balance_audit` es inmutable por trigger (nadie puede borrar el historial
   * de un cliente que sigue existiendo — ver migración 20260102000000). Pero
   * el CASCADE de este DELETE también intenta borrar las filas de auditoría
   * del cliente, y ese mismo trigger lo bloqueaba, así que la cuenta de
   * cualquiera que ya hubiera tenido un cambio de saldo no se podía eliminar
   * (ver migración 20260915000000). Esta variable de sesión es la única
   * llave que abre esa puerta, y solo vive dentro de esta transacción.
   */
  async hardDelete(id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.findUnique({
        where: { userId: id },
        select: { accountNumber: true },
      });

      await tx.outboxEvent.create({
        data: {
          aggregateType: 'customer',
          aggregateId: id,
          eventType: 'customer.deleted',
          payload: {
            userId: id,
            accountNumber: profile?.accountNumber ?? null,
            deletedAt: new Date().toISOString(),
          },
        },
      });

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
      phoneCountryCode: profile.phoneCountryCode,
      phoneNumber: profile.phoneNumber,
      status: user.status as CustomerRecord['status'],
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  }
}
