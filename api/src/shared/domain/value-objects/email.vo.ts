import { ValidationError } from '../errors/domain.error';

/**
 * Email normalizado.
 *
 * Normalizar en el dominio (y no solo en la BD) evita el clásico bug de
 * "me registré con Juan@Mail.com y no puedo entrar con juan@mail.com".
 * Postgres ya lo cubre con CITEXT, pero el dominio no debe depender de eso:
 * si mañana cambia el motor, la regla sigue viva.
 */
export class Email {
  private constructor(readonly value: string) {
    Object.freeze(this);
  }

  /**
   * Validación deliberadamente pragmática. El RFC 5322 completo permite
   * direcciones absurdas que ningún proveedor real acepta, y las regex que lo
   * implementan son un vector conocido de ReDoS. Esta versión es lineal y
   * cubre el 99.9% de los casos reales.
   */
  private static readonly PATTERN = /^[^\s@]{1,64}@[^\s@.]+(?:\.[^\s@.]+)+$/;

  static create(input: string): Email {
    if (typeof input !== 'string') {
      throw new ValidationError('El correo es obligatorio', 'EMAIL_REQUIRED');
    }

    const normalized = input.trim().toLowerCase();

    if (normalized.length === 0) {
      throw new ValidationError('El correo es obligatorio', 'EMAIL_REQUIRED');
    }

    // 254 es el máximo real de una dirección de correo (RFC 5321).
    if (normalized.length > 254) {
      throw new ValidationError('El correo es demasiado largo', 'EMAIL_TOO_LONG');
    }

    if (!Email.PATTERN.test(normalized)) {
      throw new ValidationError('El correo no tiene un formato válido', 'EMAIL_INVALID');
    }

    return new Email(normalized);
  }

  /** Para logs y mensajes de soporte: j***n@mail.com */
  mask(): string {
    const [local, domain] = this.value.split('@');
    if (local.length <= 2) return `${local[0]}***@${domain}`;
    return `${local[0]}${'*'.repeat(Math.min(local.length - 2, 5))}${local.at(-1)}@${domain}`;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
