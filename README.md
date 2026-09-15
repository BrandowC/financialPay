# AM Cuenta

Monorepo del proyecto AM Cuenta (antes "FinancialPay").

- [`mobile/`](mobile/README.md) — App Expo (Android/iOS). 4 pantallas: bienvenida, login, registro, cuenta (saldo de solo lectura). Se compila y publica aparte (EAS Build / Google Play).
- [`api/`](api/README.md) — Backend NestJS + PostgreSQL. Auth, saldo con bloqueo optimista y auditoría, sincronización a Google Sheets/Excel. **También sirve el panel administrativo** (ver abajo) — es un solo servicio desplegable.
- [`admin/`](admin/README.md) — Panel web (Next.js) donde el administrador edita el saldo de cada cliente. Se compila como sitio estático y lo sirve `api/` en `/admin` — no se despliega por separado.
- [`infra/`](infra/docker-compose.yml) — PostgreSQL + Redis + pgAdmin para desarrollo local (en producción son servicios administrados, ver despliegue abajo).
- [`docs/`](docs/) — guías de escalabilidad y de configuración de Google Sheets.

## Orden para levantar todo en desarrollo

1. `docker compose -f infra/docker-compose.yml up -d`
2. `cd api && cp .env.example .env` (ajusta los secretos) `&& npm install && npm run db:migrate && npm run db:seed && npm run start:dev`
3. `cd admin && cp .env.example .env.local && npm install && npm run dev`
4. `cd mobile && cp .env.example .env && npm install && npx expo start`

## Despliegue

Un solo `Dockerfile` en la raíz empaqueta la API y el panel administrativo (compilado como sitio estático) en una sola imagen — ver los comentarios del propio `Dockerfile`. `render.yaml` despliega esa imagen en [Render](https://render.com) junto con Postgres y Redis administrados: en Render, "New +" → "Blueprint" → conectar este repositorio. Después del primer deploy, hace falta:

1. Rellenar en el panel de Render las variables marcadas `sync: false` en `render.yaml` (secretos de JWT, credenciales de Google Sheets si aplica, el admin sembrado, y `CORS_ORIGINS`).
2. Crear el primer administrador una sola vez desde la pestaña "Shell" del servicio: `npm run db:seed`.
3. Actualizar `mobile/eas.json` con el dominio real que Render asigna, antes de compilar el build de producción para Play Store.

La app móvil no se despliega en Render — sigue el checklist en [`mobile/playstore/README.md`](mobile/playstore/README.md).
