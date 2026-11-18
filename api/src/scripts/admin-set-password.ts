import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PlainPassword } from '../shared/domain/value-objects/password.vo';

/**
 * Crea el administrador, o le pone una contraseña nueva si ya existe.
 *
 * Existe porque la semilla (`seed.ts`) solo crea un administrador cuando no hay
 * ninguno y NUNCA toca la contraseña de uno que ya existe — correcto para no
 * pisar una clave que alguien cambió, pero deja sin salida a quien olvidó la
 * suya o la puso mal en las variables de entorno. Este script es esa salida.
 *
 * Uso (PowerShell, desde api/):
 *   $env:DATABASE_URL    = "<URL de la base de datos>"
 *   $env:ADMIN_EMAIL     = "tu-correo@ejemplo.com"
 *   $env:ADMIN_PASSWORD  = "una clave larga que solo tú sepas"
 *   npm run admin:set-password
 *
 * Además de cambiar la contraseña:
 *   · desbloquea la cuenta si estaba bloqueada por intentos fallidos,
 *   · la reactiva si estaba desactivada,
 *   · y cierra las sesiones abiertas (cualquiera que tuviera la clave vieja
 *     queda fuera).
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const rawPassword = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (!email) throw new Error('Falta ADMIN_EMAIL');
  if (!rawPassword) throw new Error('Falta ADMIN_PASSWORD');

  // Mismas reglas que el panel (largo, contraseñas comunes, repetición).
  PlainPassword.create(rawPassword);

  const passwordHash = await argon2.hash(rawPassword, {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });

  const existing = await prisma.adminUser.findUnique({ where: { email } });

  const admin = existing
    ? await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash, isActive: true, failedLoginAttempts: 0, lockedUntil: null },
      })
    : await prisma.adminUser.create({
        data: { email, passwordHash, fullName, role: 'SUPER_ADMIN', isActive: true },
      });

  const revoked = await prisma.refreshToken.updateMany({
    where: { principalId: admin.id, principalKind: 'ADMIN', revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(existing ? 'Contraseña actualizada para:' : 'Administrador creado:', admin.email);
  console.log(`Sesiones cerradas: ${revoked.count}`);

  const others = await prisma.adminUser.count({ where: { NOT: { id: admin.id } } });
  if (others > 0) {
    console.log(
      `\nOjo: hay ${others} administrador(es) más en la base de datos. ` +
        'Si no deberían tener acceso, desactívalos.',
    );
  }
}

main()
  .catch((error) => {
    console.error('Falló:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
