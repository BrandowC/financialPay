import { ConfigService } from '@nestjs/config';
import { RateLimitError, UnauthorizedError } from '../../../../shared/domain/errors/domain.error';
import { SecurityEventRecorder } from '../../../../shared/infrastructure/security/security-event.recorder';
import {
  CustomerCredentials,
  CustomerRepository,
} from '../../../customers/application/ports/customer.repository';
import { PasswordHasher } from '../ports/password-hasher.port';
import { TokenService } from '../ports/token.port';
import { LoginUseCase } from './login.use-case';

/**
 * Estas pruebas son la demostración de que se cerraron los dos huecos reales
 * del login original:
 *   · Login por nombre bloqueado ante homónimos.
 *   · Enumeración de correos vía tiempos de respuesta distintos.
 * Se usan dobles en memoria: nada de base de datos ni de Argon2 real, así la
 * suite corre en milisegundos.
 */
describe('LoginUseCase', () => {
  let customers: jest.Mocked<CustomerRepository>;
  let hasher: jest.Mocked<PasswordHasher>;
  let tokens: jest.Mocked<TokenService>;
  let security: SecurityEventRecorder;
  let useCase: LoginUseCase;

  const makeCredentials = (overrides: Partial<CustomerCredentials> = {}): CustomerCredentials => ({
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'user1@example.com',
    passwordHash: overrides.passwordHash ?? 'hash-for-user-1',
    status: overrides.status ?? 'ACTIVE',
    failedLoginAttempts: overrides.failedLoginAttempts ?? 0,
    lockedUntil: overrides.lockedUntil ?? null,
  });

  beforeEach(() => {
    customers = {
      create: jest.fn(),
      findById: jest.fn(),
      findCredentialsByEmail: jest.fn(),
      findCredentialsByNormalizedName: jest.fn(),
      emailExists: jest.fn(),
      recordSuccessfulLogin: jest.fn(),
      recordFailedLogin: jest.fn().mockResolvedValue({ attempts: 1, lockedUntil: null }),
      updatePasswordHash: jest.fn(),
      hardDelete: jest.fn(),
    };

    hasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      verifyDummy: jest.fn().mockResolvedValue(false),
      needsRehash: jest.fn().mockReturnValue(false),
    };

    tokens = {
      issue: jest.fn().mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        expiresIn: 900,
        tokenType: 'Bearer',
      }),
      rotate: jest.fn(),
      revoke: jest.fn(),
      revokeAllForPrincipal: jest.fn(),
      verifyAccessToken: jest.fn(),
    };

    security = { record: jest.fn().mockResolvedValue(undefined) } as unknown as SecurityEventRecorder;

    const config = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'AUTH_MAX_FAILED_ATTEMPTS') return 5;
        if (key === 'AUTH_LOCKOUT_MINUTES') return 15;
        throw new Error(`clave no configurada en el test: ${key}`);
      }),
    } as unknown as ConfigService;

    useCase = new LoginUseCase(customers, hasher, tokens, security, config);
  });

  it('entra con éxito cuando el nombre es único y la contraseña coincide', async () => {
    const credentials = makeCredentials();
    customers.findCredentialsByNormalizedName.mockResolvedValue([credentials]);
    hasher.verify.mockResolvedValue(true);

    const result = await useCase.execute({ identifier: 'Juan Pérez', password: 'clave-correcta' });

    expect(result.customerId).toBe('user-1');
    expect(customers.recordSuccessfulLogin).toHaveBeenCalledWith('user-1');
  });

  it('entra con éxito por correo', async () => {
    const credentials = makeCredentials();
    customers.findCredentialsByEmail.mockResolvedValue(credentials);
    hasher.verify.mockResolvedValue(true);

    const result = await useCase.execute({ identifier: 'user1@example.com', password: 'clave' });

    expect(result.customerId).toBe('user-1');
    expect(customers.findCredentialsByEmail).toHaveBeenCalled();
  });

  it('con dos homónimos, entra al que tiene la contraseña correcta (el bug original bloqueaba a ambos)', async () => {
    const juanA = makeCredentials({ id: 'juan-a', passwordHash: 'hash-a' });
    const juanB = makeCredentials({ id: 'juan-b', passwordHash: 'hash-b' });
    customers.findCredentialsByNormalizedName.mockResolvedValue([juanA, juanB]);

    // Solo la contraseña de juan-b es correcta.
    hasher.verify.mockImplementation(async (hash) => hash === 'hash-b');

    const result = await useCase.execute({ identifier: 'Juan Pérez', password: 'clave-de-juan-b' });

    expect(result.customerId).toBe('juan-b');
  });

  it('con homónimos y ninguna contraseña correcta, NO incrementa el contador de fallos de nadie', async () => {
    const juanA = makeCredentials({ id: 'juan-a' });
    const juanB = makeCredentials({ id: 'juan-b' });
    customers.findCredentialsByNormalizedName.mockResolvedValue([juanA, juanB]);
    hasher.verify.mockResolvedValue(false);

    await expect(
      useCase.execute({ identifier: 'Juan Pérez', password: 'clave-equivocada' }),
    ).rejects.toThrow(UnauthorizedError);

    expect(customers.recordFailedLogin).not.toHaveBeenCalled();
  });

  it('usuario inexistente y contraseña incorrecta devuelven EXACTAMENTE el mismo error', async () => {
    customers.findCredentialsByEmail.mockResolvedValue(null);
    let notFoundError: unknown;
    try {
      await useCase.execute({ identifier: 'nadie@example.com', password: 'x' });
    } catch (e) {
      notFoundError = e;
    }

    const credentials = makeCredentials();
    customers.findCredentialsByEmail.mockResolvedValue(credentials);
    hasher.verify.mockResolvedValue(false);
    let wrongPasswordError: unknown;
    try {
      await useCase.execute({ identifier: credentials.email, password: 'incorrecta' });
    } catch (e) {
      wrongPasswordError = e;
    }

    expect((notFoundError as UnauthorizedError).code).toBe('INVALID_CREDENTIALS');
    expect((wrongPasswordError as UnauthorizedError).code).toBe('INVALID_CREDENTIALS');
    expect((notFoundError as UnauthorizedError).message).toBe(
      (wrongPasswordError as UnauthorizedError).message,
    );
  });

  it('cuando el usuario no existe, igual se consume el tiempo de un hash (verifyDummy)', async () => {
    customers.findCredentialsByEmail.mockResolvedValue(null);

    await expect(useCase.execute({ identifier: 'nadie@example.com', password: 'x' })).rejects.toThrow();

    expect(hasher.verifyDummy).toHaveBeenCalled();
  });

  it('rechaza con RateLimitError si la cuenta está bloqueada', async () => {
    const lockedUntil = new Date(Date.now() + 60_000);
    customers.findCredentialsByEmail.mockResolvedValue(makeCredentials({ lockedUntil }));

    await expect(
      useCase.execute({ identifier: 'user1@example.com', password: 'cualquiera' }),
    ).rejects.toThrow(RateLimitError);

    expect(hasher.verify).not.toHaveBeenCalled();
  });

  it('rechaza cuentas suspendidas aunque la contraseña sea correcta', async () => {
    customers.findCredentialsByEmail.mockResolvedValue(makeCredentials({ status: 'SUSPENDED' }));
    hasher.verify.mockResolvedValue(true);

    await expect(
      useCase.execute({ identifier: 'user1@example.com', password: 'correcta' }),
    ).rejects.toMatchObject({ code: 'ACCOUNT_SUSPENDED' });
  });

  it('rehashea de forma transparente cuando el hasher lo indica', async () => {
    customers.findCredentialsByEmail.mockResolvedValue(makeCredentials());
    hasher.verify.mockResolvedValue(true);
    hasher.needsRehash.mockReturnValue(true);
    hasher.hash.mockResolvedValue('nuevo-hash-mas-fuerte');

    await useCase.execute({ identifier: 'user1@example.com', password: 'clave-valida' });

    expect(customers.updatePasswordHash).toHaveBeenCalledWith('user-1', 'nuevo-hash-mas-fuerte');
  });
});
