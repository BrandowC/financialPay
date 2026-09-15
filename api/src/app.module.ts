import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { validateEnv } from './config/env.schema';
import { AdminLoginUseCase } from './modules/admin/application/admin-login.use-case';
import { CustomerQueryService } from './modules/admin/application/customer-query.service';
import { ExcelExportService } from './modules/admin/application/excel-export.service';
import { AdminController } from './modules/admin/presentation/admin.controller';
import { LoginUseCase } from './modules/auth/application/use-cases/login.use-case';
import { RegisterUseCase } from './modules/auth/application/use-cases/register.use-case';
import { AuthController } from './modules/auth/presentation/auth.controller';
import { UpdateBalanceUseCase } from './modules/balances/application/use-cases/update-balance.use-case';
import { MeController } from './modules/customers/presentation/me.controller';
import { HealthController } from './modules/health/health.controller';
import { SPREADSHEET_SYNC } from './modules/sync/application/ports/spreadsheet.port';
import { GoogleSheetsAdapter } from './modules/sync/infrastructure/google-sheets.adapter';
import { OutboxWorker } from './modules/sync/infrastructure/outbox.worker';
import { AuthGuard } from './shared/infrastructure/http/auth.guard';
import { SharedModule } from './shared/shared.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // El esquema de zod valida TODO al arrancar. Si algo falta o está mal,
      // el proceso muere aquí con un mensaje que dice exactamente qué arreglar.
      validate: validateEnv,
      cache: true,
    }),

    // Tareas programadas: rescate de eventos atascados y purga nocturna.
    ScheduleModule.forRoot(),

    /**
     * Rate limiting global.
     *
     * Estos son los límites por defecto para TODA la API. Los endpoints
     * sensibles los aprietan con @Throttle (login 10/15min, registro 5/hora,
     * exportación 3/hora).
     *
     * ── Por qué el almacenamiento es condicional ────────────────────────────
     * Sin Redis, cada instancia lleva su propia cuenta: con una sola réplica
     * (lo que basta para 2.000 usuarios/día) no hay problema, pero al escalar
     * a varias el límite efectivo se multiplica por el número de instancias.
     * `REDIS_URL` es opcional (ver env.schema.ts) — si está configurada, el
     * límite se comparte entre todas las instancias vía Redis; si no, cae al
     * almacenamiento en memoria del propio paquete. Detalle en
     * docs/escalabilidad.md.
     */
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        return {
          throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
          storage: redisUrl ? new ThrottlerStorageRedisService(redisUrl) : undefined,
        };
      },
    }),

    /**
     * Sirve el panel administrativo (Next.js, exportado como sitio estático)
     * bajo `/admin`. `admin-static/` lo copia ahí el Dockerfile de la raíz del
     * monorepo tras compilar `admin/` — ver el Dockerfile y admin/next.config.ts.
     * Se excluyen `/api/*` y `/health*` para que nunca compitan con las rutas
     * reales de la API.
     *
     * `__dirname` aquí es `dist/src` (Nest compila preservando la carpeta
     * `src/`), así que hacen falta DOS niveles hacia arriba para llegar a la
     * raíz de `api/` (donde vive `admin-static/`, junto a `dist/`), no uno.
     */
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'admin-static'),
      serveRoot: '/admin',
      exclude: ['/api/{*splat}', '/health', '/health/ready', '/health/live'],
    }),

    SharedModule,
  ],

  controllers: [AuthController, MeController, AdminController, HealthController],

  providers: [
    // ── Casos de uso ────────────────────────────────────────────────────────
    RegisterUseCase,
    LoginUseCase,
    UpdateBalanceUseCase,
    AdminLoginUseCase,
    CustomerQueryService,
    ExcelExportService,

    // ── Sincronización con la hoja de cálculo ──────────────────────────────
    { provide: SPREADSHEET_SYNC, useClass: GoogleSheetsAdapter },
    OutboxWorker,

    /**
     * Guards globales. El ORDEN importa: el throttler va primero para que
     * frene el abuso ANTES de gastar CPU verificando firmas de tokens.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
