# Escalabilidad

Referenciado desde `api/.env.example` (`DATABASE_POOL_SIZE`) y desde el
comentario de `ThrottlerModule` en `api/src/app.module.ts`. Notas prácticas
para dimensionar AM Cuenta con ~2.000 usuarios/día y picos de 200-300
peticiones concurrentes (login/registro/consulta de saldo desde la app móvil).

## Tamaño del pool de conexiones a Postgres (`DATABASE_POOL_SIZE`)

Regla práctica: `(núcleos de la base × 2) + husos de disco`. Con el plan
Postgres "Starter" de Render (compartido, ~1 vCPU) o "Standard" (1-2 vCPU),
eso da un rango de **10 a 20 conexiones** — el valor por defecto (15) ya cae
ahí.

Subirlo mucho más allá de eso **no da más rendimiento**: Postgres degrada con
demasiadas conexiones activas a la vez (cada una reserva memoria del lado del
servidor, incluso ociosa), y a partir de cierto punto el propio Postgres pasa
más tiempo coordinando conexiones que ejecutando consultas. Si algún día el
tráfico crece mucho más allá de 2.000 usuarios/día, la solución no es subir
este número sino poner **PgBouncer** delante (pooling del lado del servidor,
transaccional) — Render lo ofrece como add-on.

Con picos de ~30 peticiones/segundo (200-300 usuarios concurrentes haciendo
login/consulta en pocos segundos), 15-20 conexiones bastan siempre que las
consultas sean rápidas — que es justo lo que ya garantiza el índice de
`customer_overview`, el `access token` sin consulta a base (JWT verificado
solo por firma) y Argon2id con parámetros moderados.

## Rate limiting distribuido (`REDIS_URL`)

`ThrottlerModule` (ver `api/src/app.module.ts`) usa memoria por defecto: con
una sola instancia de la API (que es lo que hace falta para este volumen) el
límite es exacto. Si en algún momento se corre más de una instancia (por
ejemplo, autoscaling en Render), cada réplica lleva su propia cuenta y el
límite efectivo se multiplica por el número de instancias — un atacante con
tres réplicas delante podría hacer 3× los intentos de login permitidos.

La solución ya está lista para activarse: basta con configurar `REDIS_URL`
(Redis administrado de Render) y el mismo `ThrottlerModule.forRootAsync` pasa
a compartir el contador entre todas las instancias vía
`@nest-lab/throttler-storage-redis`. No hace falta ningún otro cambio de
código.

## Cuándo preocuparse de verdad

Con 2.000 usuarios/día repartidos en el uso normal de una app de saldo (no
todos a la vez, y cada sesión es unas pocas peticiones), una sola instancia de
la API con el pool por defecto sobra. Vale la pena revisar esta guía de nuevo
si:

- El pool de conexiones empieza a saturarse (Render expone métricas de
  conexiones activas en el panel de la base de datos).
- Se necesita más de una instancia de la API por disponibilidad (no por
  carga) — en ese momento, activar `REDIS_URL` es obligatorio, no opcional.
- El volumen de usuarios crece a un orden de magnitud más (decenas de miles
  al día) — ahí sí conviene evaluar PgBouncer y una réplica de lectura de
  Postgres para el panel administrativo (que solo lee).
