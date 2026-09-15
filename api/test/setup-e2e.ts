/**
 * Preparación de las pruebas end-to-end.
 *
 * Estas pruebas SÍ tocan una base de datos real (una instancia de PostgreSQL
 * desechable, nunca la de producción). Se validan aquí las cosas que un test
 * unitario no puede probar: los triggers de Postgres, los índices únicos, el
 * bloqueo optimista real bajo concurrencia y las transacciones completas.
 *
 * Requieren `infra/docker-compose.yml` levantado y `TEST_DATABASE_URL`
 * apuntando a una base VACÍA dedicada a pruebas (nunca la de desarrollo: cada
 * corrida trunca las tablas).
 */
import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://amcuenta:amcuenta_dev@localhost:5432/amcuenta_test?schema=public';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-de-al-menos-32-caracteres-para-pasar-zod';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-totalmente-distinto-del-de-access-arriba';
process.env.CORS_ORIGINS ??= 'http://localhost:3001';

beforeAll(() => {
  try {
    // `migrate deploy` y no `migrate dev`: en CI no debe generar migraciones
    // nuevas ni preguntar nada, solo aplicar las que ya existen en el repo.
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'inherit',
    });
  } catch (error) {
    console.error(
      '\nNo se pudo preparar la base de datos de pruebas.\n' +
        'Levanta el entorno primero:\n' +
        '  docker compose -f infra/docker-compose.yml up -d\n' +
        '  createdb -h localhost -U amcuenta amcuenta_test\n',
    );
    throw error;
  }
});
