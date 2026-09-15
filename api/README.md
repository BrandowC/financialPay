# AM Cuenta — API

Backend en NestJS + PostgreSQL (Prisma), arquitectura hexagonal por módulo (`domain` / `application` / `infrastructure` / `presentation`).

Además de la API, este servicio sirve el panel administrativo (`../admin/`, exportado como sitio estático) en `/admin` — ver `ServeStaticModule` en `src/app.module.ts` y el `Dockerfile` en la raíz del monorepo. Es un solo proceso, un solo despliegue.

## Arrancar en desarrollo

```bash
docker compose -f ../infra/docker-compose.yml up -d   # Postgres + Redis
cp .env.example .env                                   # genera secretos: openssl rand -base64 48
npm install
npm run db:migrate      # aplica prisma/migrations/*.sql
npm run db:seed         # crea el primer administrador (ver SEED_ADMIN_* en .env)
npm run start:dev
```

La API queda en `http://localhost:3000/api/v1`, con documentación Swagger en `/api/v1/docs` (solo fuera de producción).

En desarrollo, `admin/` sigue corriendo aparte (`npm run dev`, puerto 3001): la sesión funciona igual que fusionado, porque para `SameSite` `localhost:3000` y `localhost:3001` son el mismo "site" (el puerto no cuenta) — ver la nota en `../admin/README.md`. Para probar el resultado EXACTO de producción (un solo proceso sirviendo `/admin` y `/api/v1` desde el mismo origen) hace falta el build fusionado: `npm run build` en `admin/`, copiar `admin/out` a `api/admin-static/`, y correr esta API con `npm run start:prod` — o, más fiel todavía, `docker build -f ../Dockerfile ..` desde la raíz del monorepo.

## Pruebas

```bash
npm run test:unit    # value objects y casos de uso, sin base de datos
npm run test:e2e     # requiere Postgres de pruebas — ver test/setup-e2e.ts
```

## Qué resuelve esta reconstrucción

- Login por nombre ya no bloquea a homónimos ni permite enumerar correos (antes se hacía con una función de Postgres expuesta al rol `anon`).
- El saldo se edita con bloqueo optimista (columna `version`): dos administradores nunca pueden pisarse un cambio en silencio.
- Cada cambio de saldo lo audita un TRIGGER de Postgres, no la aplicación — es imposible saltárselo.
- Cada registro y cada cambio de saldo se sincronizan a Google Sheets vía un patrón outbox: si Google está caído, nada se pierde, se reintenta con backoff.
- Contraseñas con Argon2id, JWT de acceso corto + refresh rotativo con detección de reuso, rate limiting por endpoint.
