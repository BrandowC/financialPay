import { BirthDate } from '../../../../shared/domain/value-objects/birth-date.vo';
import { Email } from '../../../../shared/domain/value-objects/email.vo';
import { FullName } from '../../../../shared/domain/value-objects/full-name.vo';
import { UsPhoneNumber } from '../../../../shared/domain/value-objects/phone-number.vo';

export const CUSTOMER_REPOSITORY = Symbol('CUSTOMER_REPOSITORY');

/** Vista de lectura de un cliente. Nunca incluye el hash de la contraseña. */
export interface CustomerRecord {
  id: string;
  email: string;
  fullName: string;
  accountNumber: string;
  birthDate: string;
  phoneCountryCode: string;
  phoneNumber: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  createdAt: Date;
  lastLoginAt: Date | null;
}

/** Lo mínimo para poder verificar unas credenciales. Uso interno de auth. */
export interface CustomerCredentials {
  id: string;
  email: string;
  passwordHash: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}

export interface CreateCustomerInput {
  email: Email;
  passwordHash: string;
  fullName: FullName;
  birthDate: BirthDate;
  phone: UsPhoneNumber;
}

/**
 * Puerto de persistencia de clientes.
 *
 * La interfaz habla en value objects del dominio hacia dentro y devuelve
 * estructuras planas hacia fuera. El caso de uso nunca ve un modelo de Prisma,
 * así que se puede testear con un repositorio en memoria y sin base de datos.
 */
export interface CustomerRepository {
  /**
   * Crea usuario + perfil + saldo inicial + evento de outbox EN UNA SOLA
   * TRANSACCIÓN.
   *
   * Es deliberado que sea una única operación del repositorio y no cuatro
   * llamadas desde el caso de uso: la atomicidad es una responsabilidad de la
   * capa de persistencia. Si el sistema cayera entre la creación del usuario y
   * la del saldo, quedaría un cliente sin saldo que la pantalla no sabría
   * mostrar. Y si el evento de outbox se escribiera fuera de la transacción,
   * podría registrarse un cliente que nunca llega al Excel.
   */
  create(input: CreateCustomerInput): Promise<CustomerRecord>;

  findById(id: string): Promise<CustomerRecord | null>;

  findCredentialsByEmail(email: Email): Promise<CustomerCredentials | null>;

  /**
   * Todos los clientes cuyo nombre normalizado coincide.
   *
   * ── Por qué devuelve una lista y no uno solo ────────────────────────────
   * La app permite entrar escribiendo el nombre completo. El esquema original
   * resolvía esto con una función SQL que devolvía NULL si había más de una
   * coincidencia — es decir, si dos personas se llamaban "Juan Pérez", la
   * segunda quedaba SIN PODER ENTRAR NUNCA, sin ningún mensaje que lo
   * explicara.
   *
   * Devolviendo todos los candidatos, el caso de uso prueba la contraseña
   * contra cada uno y entra al que corresponde. El límite acota el coste: cada
   * comprobación cuesta ~50 ms de Argon2.
   */
  findCredentialsByNormalizedName(
    normalizedName: string,
    limit: number,
  ): Promise<CustomerCredentials[]>;

  emailExists(email: Email): Promise<boolean>;

  /** Reinicia el contador de fallos y sella la fecha de último acceso. */
  recordSuccessfulLogin(id: string): Promise<void>;

  /**
   * Incrementa el contador de fallos y bloquea si se pasó del umbral.
   * @returns el estado de bloqueo resultante, para poder avisar al usuario.
   */
  recordFailedLogin(
    id: string,
    maxAttempts: number,
    lockoutMinutes: number,
  ): Promise<{ attempts: number; lockedUntil: Date | null }>;

  /** Actualiza el hash tras un rehash transparente por parámetros nuevos. */
  updatePasswordHash(id: string, passwordHash: string): Promise<void>;

  /**
   * Borrado definitivo. Obligatorio para Google Play desde 2024: toda app con
   * cuentas debe permitir eliminarlas desde dentro. El ON DELETE CASCADE del
   * esquema arrastra perfil, saldo, auditoría y tokens.
   */
  hardDelete(id: string): Promise<void>;
}
