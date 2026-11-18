import { join } from 'node:path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { validateEnv } from './config/env.schema';
import { AdminLoginUseCase } from './modules/admin/application/admin-login.use-case';
import { ChangeAdminPasswordUseCase } from './modules/admin/application/change-admin-password.use-case';
import { CustomerQueryService } from './modules/admin/application/customer-query.service';
import { ExcelExportService } from './modules/admin/application/excel-export.service';
import { AdminController } from './modules/admin/presentation/admin.controller';
import { LoginUseCase } from './modules/auth/application/use-cases/login.use-case';
import { RegisterUseCase } from './modules/auth/application/use-cases/register.use-case';
import { AuthController } from './modules/auth/presentation/auth.controller';
import { MeController } from './modules/customers/presentation/me.controller';
import { GoalsService } from './modules/goals/application/goals.service';
import { GoalsController } from './modules/goals/presentation/goals.controller';
import { HealthController } from './modules/health/health.controller';
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
    ServeStaticModule.forRoot(
      {
        rootPath: join(__dirname, '..', '..', 'admin-static'),
        serveRoot: '/admin',
        exclude: ['/api/{*splat}', '/health', '/health/ready', '/health/live'],
      },
      /**
       * Política de privacidad pública, en `/privacy`. Las tiendas (App Store y
       * Google Play) exigen una URL pública y estable; servirla desde la propia
       * API evita depender de un documento externo que pueda borrarse. La
       * carpeta `public/` la copia el Dockerfile junto a `admin-static/`.
       */
      {
        rootPath: join(__dirname, '..', '..', 'public', 'privacy'),
        serveRoot: '/privacy',
      },
    ),

    SharedModule,
  ],

  controllers: [AuthController, MeController, GoalsController, AdminController, HealthController],

  providers: [
    // ── Casos de uso ────────────────────────────────────────────────────────
    RegisterUseCase,
    LoginUseCase,
    GoalsService,
    AdminLoginUseCase,
    ChangeAdminPasswordUseCase,
    CustomerQueryService,
    ExcelExportService,

    /**
     * Guards globales. El ORDEN importa: el throttler va primero para que
     * frene el abuso ANTES de gastar CPU verificando firmas de tokens.
     */
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
