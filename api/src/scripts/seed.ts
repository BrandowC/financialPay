import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Semilla: crea el primer administrador si no existe ninguno.
 *
 * ── Por qué vive en `src/` y no en `prisma/` ────────────────────────────────
 * `nest build` solo compila lo que está bajo `sourceRoot` (`src/`, ver
 * nest-cli.json). En producción la imagen se queda sin `ts-node`/`typescript`
 * (son devDependencies, se podan con `npm prune --omit=dev`), así que un
 * script en `prisma/seed.ts` no se podría ejecutar ahí. Al vivir en `src/`,
 * `nest build` lo compila a `dist/src/scripts/seed.js` y se puede correr con
 * `node` a secas, sin ts-node.
 *
 * ── Por qué el `import 'dotenv/config'` de arriba es necesario ─────────────
 * Este archivo se ejecuta directamente (`npm run db:seed` en desarrollo, o
 * `node dist/src/scripts/seed.js` en producción), no a través del CLI de
 * Prisma. La carga automática de `.env` que Prisma documenta solo ocurre
 * cuando el comando pasa por su propio CLI (`prisma migrate`, `npx prisma db
 * seed`…); sin esta línea `DATABASE_URL` llega vacío en desarrollo y
 * `PrismaClient` no puede conectarse (en producción las variables ya las
 * inyecta Render, así que ahí esta línea no hace nada, pero tampoco estorba).
 *
 * ── Por qué es idempotente ───────────────────────────────────────────────
 * Este script se corre en CADA arranque del contenedor (ver el CMD del
 * Dockerfile) — es la única forma de sembrar el primer admin en Render sin
 * acceso a Shell, que el plan gratuito no incluye. Por eso es crítico que
 * solo actúe si la tabla está vacía: nunca duplica ni resetea la contraseña
 * de un administrador que ya la cambió.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existingAdmins = await prisma.adminUser.count();

  if (existingAdmins > 0) {
    console.log(`Ya existen ${existingAdmins} administrador(es). No se crea ninguno nuevo.`);
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@amcuenta.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'CambiaEstaClaveYa2026';
  const fullName = process.env.SEED_ADMIN_NAME ?? 'Administrador General';

  if (password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const admin = await prisma.adminUser.create({
    data: { email, passwordHash, fullName, role: 'SUPER_ADMIN', isActive: true },
  });

  console.log('─'.repeat(70));
  console.log('Administrador creado:');
  console.log(`  Correo:      ${admin.email}`);
  console.log(`  Contraseña:  ${password}`);
  console.log('');
  console.log('  ⚠️  CAMBIA ESTA CONTRASEÑA en tu primer acceso al panel.');
  console.log('─'.repeat(70));
}

main()
  .catch((error) => {
    console.error('Falló la siembra:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
