import { z } from 'zod';

/**
 * Variables de entorno del panel.
 *
 * Son pocas y todas públicas (`NEXT_PUBLIC_*`) porque el panel es enteramente
 * cliente: nada de lo que hay aquí es secreto, es solo la URL a la que hay que
 * apuntar. El secreto real (las contraseñas de los administradores) nunca pasa
 * por este código — vive hasheado en la base de datos y la API es la única
 * que lo verifica.
 *
 * ── Por qué acepta también una ruta relativa ────────────────────────────────
 * En producción el panel se sirve desde el mismo origen que la API (ver
 * Dockerfile + ServeStaticModule), así que el valor compilado ahí es la ruta
 * relativa `/api/v1` — no hace falta (ni conviene) hardcodear un dominio. En
 * desarrollo, con `admin/` corriendo aparte (`npm run dev`, puerto 3001),
 * sigue usándose una URL absoluta a la API local.
 */
const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_API_URL es obligatorio')
    .refine(
      (v) => v.startsWith('/') || /^https?:\/\//.test(v),
      'NEXT_PUBLIC_API_URL debe ser una ruta relativa (ej: /api/v1) o una URL completa (ej: https://api.amcuenta.com/api/v1)',
    ),
});

function readEnv() {
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!result.success) {
    // Se lanza en cuanto se importa el módulo: es preferible una pantalla de
    // error clara en desarrollo a un `fetch` fallando en silencio contra
    // "undefined/api/v1/...".
    throw new Error(
      `Configuración del panel inválida:\n${result.error.issues
        .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
        .join('\n')}\n\nRevisa tu archivo .env.local (hay una plantilla en .env.example).`,
    );
  }

  return result.data;
}

export const env = readEnv();
