# =============================================================================
# AM Cuenta · imagen de producción (API + panel administrativo)
# =============================================================================
# Un solo Dockerfile, un solo servicio, una sola URL: el panel administrativo
# (Next.js, exportado como sitio estático) se compila aparte y se copia dentro
# de la misma imagen que la API (NestJS), que lo sirve en `/admin` desde el
# mismo proceso (ver ServeStaticModule en api/src/app.module.ts). La app
# móvil (mobile/) NO participa de esta imagen — sigue compilándose y
# publicándose por separado (EAS Build / Play Store).
#
# El contexto de build es la RAÍZ del monorepo (no `api/`), porque esta
# imagen necesita ver tanto `api/` como `admin/`:
#
#   docker build -f Dockerfile .
#
# La imagen final NO lleva código fuente, TypeScript, ni dependencias de
# desarrollo de ninguno de los dos: solo lo justo para correr.
# =============================================================================

# ── Etapa 1: dependencias de la API ─────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# argon2 se compila de forma nativa y necesita herramientas de construcción
# que NO deben acabar en la imagen final.
RUN apk add --no-cache python3 make g++

COPY api/package*.json ./
COPY api/prisma ./prisma/
RUN npm ci

# ── Etapa 2: compilación del panel administrativo ───────────────────────────
# Independiente de la API: solo necesita Node y sus propias dependencias.
FROM node:22-alpine AS admin-build
WORKDIR /admin

COPY admin/package*.json ./
RUN npm ci

COPY admin/ .

# Ruta relativa: el panel se sirve desde el MISMO origen que la API en
# producción (`/admin` y `/api/v1` en el mismo dominio), así que no hace
# falta — ni conviene — hardcodear un dominio absoluto aquí. `NEXT_PUBLIC_*`
# se incrusta en el bundle en tiempo de build, por eso se fija como ENV antes
# de compilar y no como variable de entorno en tiempo de ejecución.
ENV NEXT_PUBLIC_API_URL=/api/v1
RUN npm run build

# ── Etapa 3: compilación de la API ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY api/ .

RUN npx prisma generate
RUN npm run build

# Elimina las dependencias de desarrollo del árbol ya instalado.
RUN npm prune --omit=dev

# ── Etapa 4: ejecución ───────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# dumb-init como PID 1: Node no reenvía bien las señales cuando es el proceso
# 1, y sin esto un `docker stop` mata el contenedor a los 10 segundos por
# tiempo agotado en vez de dejar que se apague limpiamente.
RUN apk add --no-cache dumb-init

# Usuario sin privilegios. Si alguien lograra ejecutar código dentro del
# contenedor, no sería root.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nodejs -G nodejs

COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nodejs:nodejs /app/package.json ./

# El export estático del panel, en la ruta que ServeStaticModule espera
# (`join(__dirname, '..', 'admin-static')` desde `dist/`, o sea `/app/admin-static`).
COPY --from=admin-build --chown=nodejs:nodejs /admin/out ./admin-static

USER nodejs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/health/live',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]

# Las migraciones se aplican al arrancar. `migrate deploy` solo aplica lo
# pendiente y nunca borra datos (a diferencia de `migrate dev`).
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
