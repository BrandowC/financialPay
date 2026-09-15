import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PASSWORD_HASHER } from '../modules/auth/application/ports/password-hasher.port';
import { TOKEN_SERVICE } from '../modules/auth/application/ports/token.port';
import { Argon2PasswordHasher } from '../modules/auth/infrastructure/argon2-password-hasher';
import { JwtTokenService } from '../modules/auth/infrastructure/jwt-token.service';
import { BALANCE_REPOSITORY } from '../modules/balances/application/ports/balance.repository';
import { PrismaBalanceRepository } from '../modules/balances/infrastructure/prisma-balance.repository';
import { CUSTOMER_REPOSITORY } from '../modules/customers/application/ports/customer.repository';
import { PrismaCustomerRepository } from '../modules/customers/infrastructure/prisma-customer.repository';
import { PrismaService } from './infrastructure/persistence/prisma.service';
import { SecurityEventRecorder } from './infrastructure/security/security-event.recorder';

/**
 * Infraestructura transversal.
 *
 * ── Por qué es @Global ──────────────────────────────────────────────────────
 * Marcar módulos como globales suele ser mala práctica: oculta las dependencias
 * reales y convierte el grafo de módulos en una sopa. Aquí está justificado por
 * un motivo concreto y acotado.
 *
 * Las piezas de este módulo son las que TODOS los demás necesitan (base de
 * datos, hasher, tokens, repositorios, auditoría) y, más importante, hay
 * dependencias cruzadas naturales: el caso de uso de login vive en `auth` pero
 * necesita el repositorio de `customers`, mientras que `customers` necesita el
 * servicio de tokens de `auth`. Sin un módulo compartido, eso es una
 * dependencia circular entre módulos que Nest no puede resolver sin
 * `forwardRef`, que es bastante peor de mantener.
 *
 * ── Cómo se cumple igualmente la inversión de dependencias ─────────────────
 * Fíjese en que se registran SÍMBOLOS (`CUSTOMER_REPOSITORY`), no clases. Los
 * casos de uso piden el símbolo y reciben lo que aquí se decida darles. En los
 * tests se sustituye por un doble en memoria sin tocar el código de negocio.
 * Cambiar de Prisma a otra cosa es cambiar una línea en este archivo.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      // La configuración se resuelve en tiempo de arranque, ya validada por zod.
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { issuer: config.getOrThrow<string>('JWT_ISSUER') },
      }),
    }),
  ],
  providers: [
    PrismaService,
    SecurityEventRecorder,
    { provide: PASSWORD_HASHER, useClass: Argon2PasswordHasher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: CUSTOMER_REPOSITORY, useClass: PrismaCustomerRepository },
    { provide: BALANCE_REPOSITORY, useClass: PrismaBalanceRepository },
  ],
  exports: [
    PrismaService,
    SecurityEventRecorder,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    CUSTOMER_REPOSITORY,
    BALANCE_REPOSITORY,
    JwtModule,
  ],
})
export class SharedModule {}
