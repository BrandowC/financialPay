import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Copia de seguridad legible de la base de datos: una hoja de Excel por tabla
 * (un único .xlsx) y además un .csv por tabla.
 *
 * Es de SOLO LECTURA: únicamente hace SELECT, nunca modifica la base.
 *
 * Uso (PowerShell, desde api/):
 *   $env:DATABASE_URL = "<External Database URL de Render>"
 *   $env:BACKUP_DIR   = "D:\ruta\a\la\carpeta"
 *   npm run db:backup
 *
 * Decisiones:
 * - Todas las columnas se piden como texto (`::text`): evita errores con tipos
 *   que el cliente de Prisma no sabe leer en consultas crudas (citext, inet…)
 *   y deja los números grandes sin perder precisión.
 * - Se omiten los hashes de contraseña y de tokens: no sirven como "datos
 *   recolectados" y dejarlos en un archivo suelto solo agrega riesgo.
 * - `refresh_tokens` y `_prisma_migrations` se omiten: son técnicas, no datos
 *   de personas.
 */

const SKIPPED_TABLES = new Set(['_prisma_migrations', 'refresh_tokens']);
const SKIPPED_COLUMNS = new Set(['password_hash', 'token_hash']);

const dbUrl = process.env.DATABASE_URL;
const outDir = process.env.BACKUP_DIR;

if (!dbUrl) throw new Error('Falta DATABASE_URL');
if (!outDir) throw new Error('Falta BACKUP_DIR (carpeta donde guardar la copia)');

const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(dbUrl);
const url = !isLocal && !/sslmode=/.test(dbUrl)
  ? `${dbUrl}${dbUrl.includes('?') ? '&' : '?'}sslmode=require`
  : dbUrl;

const prisma = new PrismaClient({ datasources: { db: { url } } });

function csvCell(value: string | null): string {
  if (value === null) return '';
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

async function main(): Promise<void> {
  fs.mkdirSync(outDir as string, { recursive: true });

  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`,
  );

  const workbook = new ExcelJS.Workbook();
  const summary: string[] = [];

  for (const { table_name: table } of tables) {
    if (SKIPPED_TABLES.has(table)) continue;

    const columns = (
      await prisma.$queryRawUnsafe<{ column_name: string }[]>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position`,
        table,
      )
    )
      .map((c) => c.column_name)
      .filter((c) => !SKIPPED_COLUMNS.has(c));

    const select = columns.map((c) => `"${c}"::text AS "${c}"`).join(', ');
    const rows = await prisma.$queryRawUnsafe<Record<string, string | null>[]>(
      `SELECT ${select} FROM "${table}"`,
    );

    const sheet = workbook.addWorksheet(table.slice(0, 31));
    sheet.addRow(columns);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) sheet.addRow(columns.map((c) => row[c]));
    sheet.columns.forEach((col) => (col.width = 24));

    const csv = [columns.join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
    fs.writeFileSync(path.join(outDir as string, `${table}.csv`), '\uFEFF' + csv.join('\r\n'), 'utf8');

    summary.push(`${table}: ${rows.length} filas`);
    console.log(`  ${table}: ${rows.length} filas`);
  }

  await workbook.xlsx.writeFile(path.join(outDir as string, 'backup-completo.xlsx'));

  fs.writeFileSync(
    path.join(outDir as string, 'LEEME.txt'),
    [
      'Copia de seguridad de la base de datos de AM Cuenta',
      `Generada: ${new Date().toISOString()}`,
      '',
      'Contenido: backup-completo.xlsx (una hoja por tabla) y un .csv por tabla.',
      'No incluye contraseñas ni tokens (se omitieron a propósito).',
      'Contiene datos personales (nombre, correo, teléfono, fecha de nacimiento):',
      'guárdala en un lugar privado y no la subas a ningún repositorio.',
      '',
      ...summary,
      '',
    ].join('\r\n'),
    'utf8',
  );

  console.log(`\nListo. Copia guardada en: ${outDir}`);
}

main()
  .catch((error) => {
    console.error('Falló la copia:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
