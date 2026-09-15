import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

/**
 * Semilla: crea el primer administrador si no existe ninguno.
 *
 * ── Por qué el `import 'dotenv/config'` de arriba es necesario ─────────────
 * Este archivo se ejecuta con `ts-node` directamente (`npm run db:seed`), no a
 * través del CLI de `prisma`. La carga automática de `.env` que Prisma
 * documenta solo ocurre cuando el comando pasa por su propio CLI (`prisma
 * migrate`, `npx prisma db seed`…); un `ts-node` corriendo a secas no carga
 * nada por su cuenta, así que sin esta línea `DATABASE_URL` llega vacío y
 * `PrismaClient` no puede conectarse.
 *
 * ── Por qué es idempotente ───────────────────────────────────────────────
 * Este script se puede correr tantas veces como se quiera (en cada
 * despliegue, por ejemplo) sin duplicar nada ni resetear la contraseña de un
 * administrador que ya la cambió. Solo actúa si la tabla está vacía.
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
