import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

/**
 * Borra TODOS los datos de personas de la app anterior (AM Cuenta): cuentas,
 * perfiles, saldos, historial de saldos, registro permanente de altas, sesiones
 * y el rastro de eventos de seguridad (que guarda correos).
 *
 * NO borra: administradores, ni las tablas en sí (solo su contenido).
 *
 * ── Es irreversible ────────────────────────────────────────────────────────
 * Por eso:
 *   1. Primero MUESTRA cuántas filas hay en cada tabla y no hace nada más.
 *   2. Solo borra si se corre con `CONFIRM_PURGE=BORRAR` explícito.
 * Haz y verifica la copia de seguridad (`npm run db:backup`) ANTES.
 *
 * Uso (PowerShell, desde api/):
 *   $env:DATABASE_URL = "<URL de la base de datos>"
 *   npm run db:purge-legacy                      # solo muestra
 *   $env:CONFIRM_PURGE = "BORRAR"; npm run db:purge-legacy   # borra
 *
 * `TRUNCATE` y no `DELETE`: las tablas de auditoría son de solo-inserción por
 * trigger de fila (nadie puede reescribir la historia), y TRUNCATE es la única
 * operación que no dispara esos triggers. Es justo lo que se quiere aquí,
 * una sola vez y a propósito.
 */
const prisma = new PrismaClient();

const TABLES = [
  'users',
  'profiles',
  'balances',
  'balance_audit',
  'registration_ledger',
  'security_events',
  'goals',
  'contributions',
] as const;

async function counts(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const table of TABLES) {
    const [row] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM "${table}"`);
    result[table] = Number(row.n);
  }
  return result;
}

async function main(): Promise<void> {
  const before = await counts();
  console.log('Filas actuales:');
  for (const [table, n] of Object.entries(before)) console.log(`  ${table.padEnd(22)} ${n}`);

  if (process.env.CONFIRM_PURGE !== 'BORRAR') {
    console.log('\nNo se borró nada. Para borrar de verdad: $env:CONFIRM_PURGE = "BORRAR"');
    return;
  }

  console.log('\nBorrando…');
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE users, registration_ledger, security_events RESTART IDENTITY CASCADE',
  );
  await prisma.$executeRawUnsafe(`DELETE FROM refresh_tokens WHERE principal_kind = 'CUSTOMER'`);

  const after = await counts();
  console.log('Filas después:');
  for (const [table, n] of Object.entries(after)) console.log(`  ${table.padEnd(22)} ${n}`);
}

main()
  .catch((error) => {
    console.error('Falló:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
