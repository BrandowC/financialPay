import { ValidationError } from '../errors/domain.error';

/**
 * Número de celular internacional.
 *
 * La app ya no se limita a Estados Unidos: cada persona elige su país y la app
 * manda el prefijo (`+57`, `+34`, `+1`...) por un lado y el número nacional por
 * otro. En vez de arrastrar libphonenumber (200 KB y reglas por país que casi
 * nadie necesita aquí) se validan las reglas universales del plan E.164 de la
 * UIT, que son pocas y estables:
 *
 *   · El prefijo es `+` y de 1 a 4 dígitos, sin ceros a la izquierda.
 *   · Prefijo + número nacional suman como máximo 15 dígitos.
 *   · El número nacional tiene al menos 7 dígitos (es también el mínimo de la
 *     restricción `profiles_phone_chk` de la base de datos).
 *   · Un número con todos los dígitos iguales ("0000000", "1111111") es
 *     basura casi seguro, y se rechaza.
 *
 * Validar esto de verdad importa: con un teléfono falso no hay cómo ayudar a
 * la persona si pierde el acceso a su cuenta.
 */
export class PhoneNumber {
  static readonly MIN_NATIONAL_DIGITS = 7;
  static readonly MAX_TOTAL_DIGITS = 15;

  private constructor(
    /** "+57" */
    readonly dialCode: string,
    /** Solo dígitos, sin prefijo de país. */
    readonly nationalNumber: string,
  ) {
    Object.freeze(this);
  }

  static create(dialCode: string, nationalInput: string): PhoneNumber {
    if (typeof dialCode !== 'string' || typeof nationalInput !== 'string') {
      throw new ValidationError('El número de celular es obligatorio', 'PHONE_REQUIRED');
    }

    const dial = dialCode.trim();
    if (!/^\+[1-9]\d{0,3}$/.test(dial)) {
      throw new ValidationError('El prefijo del país no es válido', 'PHONE_INVALID_DIAL_CODE', {
        received: dialCode,
      });
    }

    // Acepta como venga: "(301) 555-1234", "301 555 1234", "301-555-1234".
    const digits = nationalInput.replace(/\D/g, '');

    if (digits.length === 0) {
      throw new ValidationError('El número de celular es obligatorio', 'PHONE_REQUIRED');
    }

    if (digits.length < PhoneNumber.MIN_NATIONAL_DIGITS) {
      throw new ValidationError(
        `El número debe tener al menos ${PhoneNumber.MIN_NATIONAL_DIGITS} dígitos`,
        'PHONE_TOO_SHORT',
        { received: digits.length },
      );
    }

    if (dial.length - 1 + digits.length > PhoneNumber.MAX_TOTAL_DIGITS) {
      throw new ValidationError('El número es demasiado largo', 'PHONE_TOO_LONG', {
        received: digits.length,
      });
    }

    if (/^(\d)\1+$/.test(digits)) {
      throw new ValidationError('Escribe tu número real', 'PHONE_INVALID');
    }

    return new PhoneNumber(dial, digits);
  }

  /** "+573015551234" — canónico E.164. */
  toE164(): string {
    return `${this.dialCode}${this.nationalNumber}`;
  }

  /** "+57 3015551234" — para mostrar en el panel administrativo. */
  format(): string {
    return `${this.dialCode} ${this.nationalNumber}`;
  }

  equals(other: PhoneNumber): boolean {
    return this.dialCode === other.dialCode && this.nationalNumber === other.nationalNumber;
  }

  toString(): string {
    return this.toE164();
  }
}
