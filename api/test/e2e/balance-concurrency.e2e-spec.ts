import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence/prisma.service';
import { DomainExceptionFilter } from '../../src/shared/infrastructure/http/domain-exception.filter';

/**
 * El login de administrador ya no devuelve el token en el cuerpo — viaja en
 * una cookie httpOnly (ver admin.controller.ts). Estas pruebas siguen
 * autenticándose con `Authorization: Bearer` (la app móvil usa ese mismo
 * mecanismo y `AuthGuard` lo sigue aceptando sin cambios), así que solo hace
 * falta sacar el valor de la cookie de la respuesta de login.
 */
function extractCookieValue(
  setCookieHeader: string[] | string | undefined,
  cookieName: string,
): string {
  const headers = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : setCookieHeader
      ? [setCookieHeader]
      : [];
  const raw = headers.find((c) => c.startsWith(`${cookieName}=`));
  if (!raw) throw new Error(`No se encontró la cookie ${cookieName} en la respuesta de login`);
  return raw.split(';')[0].split('=').slice(1).join('=');
}

/**
 * Prueba de caja negra sobre el sistema completo levantado (HTTP real, base de
 * datos real). El objetivo concreto: demostrar que el bloqueo optimista
 * FUNCIONA bajo concurrencia de verdad, no solo en la lógica leída.
 *
 * El escenario reproduce exactamente el caso descrito en el diseño: dos
 * administradores abren la misma ficha y guardan casi a la vez. Sin
 * protección, "última escritura gana" perdería el primer cambio en silencio.
 * Con el bloqueo optimista, el segundo debe recibir 409 y el primero debe
 * quedar intacto.
 */
describe('Concurrencia en la actualización de saldo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let customerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new DomainExceptionFilter(false));
    await app.init();

    prisma = app.get(PrismaService);

    // Limpieza total: estas pruebas asumen una base de pruebas desechable.
    await prisma.balanceAudit.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.securityEvent.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.balance.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.user.deleteMany();
    await prisma.adminUser.deleteMany();

    // Administrador de prueba.
    const passwordHash = await argon2.hash('ClaveDePruebasSegura123');
    await prisma.adminUser.create({
      data: {
        email: 'admin.test@amcuenta.com',
        passwordHash,
        fullName: 'Admin de Pruebas',
        role: 'SUPER_ADMIN',
        isActive: true,
      },
    });

    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin.test@amcuenta.com', password: 'ClaveDePruebasSegura123' })
      .expect(200);

    adminToken = extractCookieValue(loginResponse.headers['set-cookie'], 'admin_access_token');

    // Cliente de prueba con saldo inicial en 0.
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        fullName: 'Cliente De Pruebas',
        email: 'cliente.pruebas@example.com',
        password: 'ClaveDelClientePruebas1',
        birthDate: '1995-01-01',
        phone: '3015551234',
      })
      .expect(201);

    customerId = registerResponse.body.data.customer.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('el primer guardado con version=0 tiene éxito', async () => {
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerId}/balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: '500.00', expectedVersion: 0, reason: 'Carga inicial' })
      .expect(200);

    expect(response.body.data.current).toBe('500.00');
    expect(response.body.data.version).toBe(1);
    expect(response.body.data.changed).toBe(true);
  });

  it('un segundo guardado con la MISMA versión ya usada devuelve 409, no pisa el cambio', async () => {
    // La versión ya subió a 1 en la prueba anterior; se reintenta con la 0
    // vieja, simulando al segundo administrador que no recargó su pantalla.
    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerId}/balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: '999.00', expectedVersion: 0, reason: 'Intento con versión obsoleta' })
      .expect(409);

    expect(response.body.error.code).toBe('BALANCE_VERSION_CONFLICT');

    // El valor sigue siendo el del primer guardado: NADA se perdió.
    const check = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(check.body.data.balance.decimal).toBe('500.00');
  });

  it('bajo 10 escrituras concurrentes con la misma versión, exactamente UNA gana', async () => {
    const before = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const startVersion = before.body.data.balanceVersion;

    const attempts = Array.from({ length: 10 }, (_, i) =>
      request(app.getHttpServer())
        .patch(`/api/v1/admin/customers/${customerId}/balance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: `${100 + i}.00`, expectedVersion: startVersion, reason: `Intento ${i}` }),
    );

    const results = await Promise.all(attempts);
    const succeeded = results.filter((r) => r.status === 200);
    const conflicted = results.filter((r) => r.status === 409);

    expect(succeeded).toHaveLength(1);
    expect(conflicted).toHaveLength(9);

    // El registro de auditoría refleja exactamente un cambio nuevo, no diez.
    const auditCount = await prisma.balanceAudit.count({ where: { userId: customerId } });
    expect(auditCount).toBe(startVersion); // primer guardado + este = startVersion total
  });

  it('el historial de auditoría registra quién hizo cada cambio', async () => {
    const history = await request(app.getHttpServer())
      .get(`/api/v1/admin/customers/${customerId}/history`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(history.body.data.length).toBeGreaterThan(0);
    expect(history.body.data[0].changedBy).toBe('admin.test@amcuenta.com');
  });

  it('un rol VIEWER no puede modificar el saldo (403)', async () => {
    const viewerHash = await argon2.hash('ClaveDelViewer12345678');
    await prisma.adminUser.create({
      data: {
        email: 'viewer.test@amcuenta.com',
        passwordHash: viewerHash,
        fullName: 'Solo Lectura',
        role: 'VIEWER',
        isActive: true,
      },
    });

    const viewerLogin = await request(app.getHttpServer())
      .post('/api/v1/admin/auth/login')
      .send({ email: 'viewer.test@amcuenta.com', password: 'ClaveDelViewer12345678' })
      .expect(200);

    const viewerToken = extractCookieValue(viewerLogin.headers['set-cookie'], 'admin_access_token');

    const response = await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerId}/balance`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ amount: '1.00', expectedVersion: 99, reason: 'No debería pasar' })
      .expect(403);

    expect(response.body.error.code).toBe('INSUFFICIENT_ROLE');
  });

  it('un monto negativo se rechaza en el DTO antes de llegar al dominio', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/customers/${customerId}/balance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ amount: '-50.00', expectedVersion: 1 })
      .expect(400);
  });

  it('un cliente autenticado NO puede acceder a los endpoints de admin', async () => {
    const customerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ identifier: 'cliente.pruebas@example.com', password: 'ClaveDelClientePruebas1' })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerLogin.body.data.accessToken}`)
      .expect(403);
  });
});
