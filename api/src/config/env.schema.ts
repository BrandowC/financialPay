import { z } from 'zod';

/**
 * Contrato de variables de entorno.
 *
 * ── Por qué se valida al arrancar y no al usarlas ───────────────────────────
 * Un `process.env.JWT_SECRET` indefinido no explota cuando se lee: explota
 * tres semanas después, en producción, cuando un usuario intenta entrar. Al
 * validar todo en el arranque, el contenedor simplemente no levanta y el
 * despliegue falla de inmediato, que es exactamente lo que uno quiere.
 *
 * Esto es "fail fast": es preferible un despliegue que no arranca a un
 * despliegue que arranca roto.
 */

/** Valores de ejemplo que jamás deben llegar a producción. */
const PLACEHOLDER_SECRETS = [
  'changeme',
  'change-me',
  'secret',
  'password',
  'cambiar',
  'tu-secreto',
  'your-secret-here',
];

const secret = (name: string) =>
  z
    .string({ required_error: `Falta la variable ${name}` })
    // 32 bytes es el mínimo razonable para HMAC-SHA256: por debajo, la clave
    // tiene menos entropía que el propio hash y se vuelve el eslabón débil.
    .min(32, `${name} debe tener al menos 32 caracteres`)
    .refine(
      (v) => !PLACEHOLDER_SECRETS.some((p) => v.toLowerCase().includes(p)),
      `${name} parece un valor de ejemplo. Genera uno real con: openssl rand -base64 48`,
    );

/** Duración tipo "15m", "7d", "3600s". */
const duration = z.string().regex(/^\d+[smhd]$/, 'Formato inválido. Usa algo como 15m, 24h o 7d');

/**
 * Envuelve un esquema opcional para que una cadena vacía cuente como "no
 * configurado", igual que si la variable no existiera.
 *
 * ── Por qué hace falta esto ──────────────────────────────────────────────
 * Un `.env` real casi siempre deja las variables opcionales como
 * `GOOGLE_SERVICE_ACCOUNT_EMAIL=` (la línea existe, vacía) en vez de omitir la
 * línea por completo — es lo que queda al copiar `.env.example` y no llenar
 * ese campo. `dotenv` carga eso como `""`, no como `undefined`, y
 * `.optional()` de Zod solo exime la AUSENCIA de la clave, no una cadena
 * vacía: `z.string().email().optional()` sigue intentando validar `""` como
 * correo y falla. Sin este envoltorio, cualquier variable opcional sin
 * rellenar tumba el arranque con un error que no tiene nada que ver con lo
 * que el desarrollador hizo mal.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === '' ? undefined : value), schema.optional());

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    API_PREFIX: z.string().default('api/v1'),

    // ── Base de datos ──────────────────────────────────────────────────────
    DATABASE_URL: z
      .string()
      .url('DATABASE_URL debe ser una URL válida de PostgreSQL')
      .refine((v) => v.startsWith('postgres'), 'DATABASE_URL debe apuntar a PostgreSQL'),

    /**
     * Tamaño del pool. Regla práctica: (núcleos × 2) + husos de disco.
     * Con 2.000 usuarios/día y picos de ~30 req/s, 10-20 conexiones sobran.
     * Subirlo NO da más rendimiento: Postgres degrada con muchas conexiones
     * ociosas, y por eso existe PgBouncer. Ver docs/escalabilidad.md.
     */
    DATABASE_POOL_SIZE: z.coerce.number().int().min(2).max(100).default(15),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).default(15_000),

    // ── Autenticación ──────────────────────────────────────────────────────
    JWT_ACCESS_SECRET: secret('JWT_ACCESS_SECRET'),
    JWT_REFRESH_SECRET: secret('JWT_REFRESH_SECRET'),
    JWT_ACCESS_TTL: duration.default('15m'),
    JWT_REFRESH_TTL: duration.default('30d'),
    JWT_ISSUER: z.string().default('am-cuenta-api'),

    /** Intentos fallidos antes de bloquear la cuenta. */
    AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),

    // ── Redis (caché + rate limiting distribuido) ──────────────────────────
    // Opcional: sin Redis la app funciona igual, pero el rate limiting pasa a
    // ser por instancia en vez de global. Ver ThrottlerStorage.
    REDIS_URL: optional(z.string().url()),

    // ── Google Sheets ──────────────────────────────────────────────────────
    // También opcional: si no está configurado, los eventos se acumulan en la
    // tabla outbox y se procesan en cuanto se configure. Nada se pierde.
    GOOGLE_SHEETS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    GOOGLE_SHEETS_SPREADSHEET_ID: optional(z.string()),
    GOOGLE_SHEETS_TAB_NAME: z.string().default('Registros'),
    GOOGLE_SERVICE_ACCOUNT_EMAIL: optional(z.string().email()),
    /** La clave privada del JSON de la cuenta de servicio, con \n literales. */
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: optional(z.string()),

    // ── Worker de outbox ───────────────────────────────────────────────────
    OUTBOX_ENABLED: z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(1000).default(5_000),
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(50),

    // ── CORS ───────────────────────────────────────────────────────────────
    // Lista separada por comas. La app móvil no manda Origin, así que esto
    // aplica sobre todo al panel administrativo.
    CORS_ORIGINS: z.string().default('http://localhost:3001'),

    // ── Rate limiting ──────────────────────────────────────────────────────
    THROTTLE_TTL_SECONDS: z.coerce.number().int().min(1).default(60),
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(100),

    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  // ── Reglas que cruzan varias variables ───────────────────────────────────
  .superRefine((env, ctx) => {
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_REFRESH_SECRET'],
        message:
          'Los secretos de access y refresh deben ser distintos. Si son iguales, ' +
          'un access token robado puede usarse como refresh token y la sesión se vuelve eterna.',
      });
    }

    if (env.GOOGLE_SHEETS_ENABLED) {
      const missing = (
        [
          ['GOOGLE_SHEETS_SPREADSHEET_ID', env.GOOGLE_SHEETS_SPREADSHEET_ID],
          ['GOOGLE_SERVICE_ACCOUNT_EMAIL', env.GOOGLE_SERVICE_ACCOUNT_EMAIL],
          ['GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY', env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY],
        ] as const
      )
        .filter(([, value]) => !value)
        .map(([key]) => key);

      if (missing.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['GOOGLE_SHEETS_ENABLED'],
          message: `GOOGLE_SHEETS_ENABLED=true pero faltan: ${missing.join(', ')}`,
        });
      }
    }

    if (env.NODE_ENV === 'production') {
      if (env.CORS_ORIGINS.includes('*')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'En producción no se permite CORS con comodín. Lista los dominios exactos.',
        });
      }
      if (env.CORS_ORIGINS.includes('localhost')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGINS'],
          message: 'En producción CORS_ORIGINS no debe incluir localhost.',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Valida `process.env` y devuelve un objeto tipado.
 * Si algo falla, imprime TODOS los problemas juntos (no uno a uno) y aborta.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  · ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `\n╔══════════════════════════════════════════════════════════════╗\n` +
        `║  Configuración inválida — la API no puede arrancar            ║\n` +
        `╚══════════════════════════════════════════════════════════════╝\n\n` +
        `${details}\n\n` +
        `Revisa tu archivo .env (hay una plantilla en .env.example).\n`,
    );
  }

  return result.data;
}
