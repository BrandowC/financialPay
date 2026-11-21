import { ValidationError } from '../errors/domain.error';

/**
 * Número de celular de Estados Unidos.
 *
 * La app está restringida a EE. UU. (así estaba el formulario original), así
 * que en vez de arrastrar una librería de 200 KB como libphonenumber, se
 * implementan las reglas reales del Plan de Numeración de Norteamérica (NANP),
 * que son pocas y estables:
 *
 *   Formato: NXX-NXX-XXXX  (10 dígitos)
 *     · El código de área no empieza por 0 ni por 1.
 *     · El prefijo central tampoco empieza por 0 ni por 1.
 *     · 555-01XX está reservado para ficción (se rechaza: es dato falso).
 *     · N11 (411, 911…) son códigos de servicio, no números de abonado.
 *
 * Validar esto de verdad importa: si el número es basura, el cliente del
 * negocio no puede contactar a la persona que se registró, y ese es
 * literalmente el propósito del Excel.
 */
export class UsPhoneNumber {
  static readonly COUNTRY_CODE = '+1';
  static readonly DIGITS = 10;

  private constructor(readonly nationalNumber: string) {
    Object.freeze(this);
  }

  static create(input: string): UsPhoneNumber {
    if (typeof input !== 'string') {
      throw new ValidationError('El número de celular es obligatorio', 'PHONE_REQUIRED');
    }

    // Acepta como venga: "(301) 555-1234", "301-555-1234", "+1 301 555 1234".
    let digits = input.replace(/\D/g, '');

    // Quita el prefijo de país si el usuario lo escribió.
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    }

    if (digits.length === 0) {
      throw new ValidationError('El número de celular es obligatorio', 'PHONE_REQUIRED');
    }

    if (digits.length !== UsPhoneNumber.DIGITS) {
      throw new ValidationError(
        'El número debe tener 10 dígitos (Estados Unidos)',
        'PHONE_INVALID_LENGTH',
        { received: digits.length },
      );
    }

    const areaCode = digits.slice(0, 3);
    const exchange = digits.slice(3, 6);
    const line = digits.slice(6);

    if (areaCode[0] === '0' || areaCode[0] === '1') {
      throw new ValidationError(
        'El código de área no es válido en Estados Unidos',
        'PHONE_INVALID_AREA_CODE',
      );
    }

    if (exchange[0] === '0' || exchange[0] === '1') {
      throw new ValidationError('El número no es válido', 'PHONE_INVALID_EXCHANGE');
    }

    // 411, 911, 611… son servicios, nunca abonados.
    if (areaCode[1] === '1' && areaCode[2] === '1') {
      throw new ValidationError('Ese es un código de servicio, no un celular', 'PHONE_SERVICE_CODE');
    }

    // 555-0100 a 555-0199 están reservados para cine y documentación.
    if (exchange === '555' && line.startsWith('01')) {
      throw new ValidationError(
        'Ese número está reservado para ejemplos. Escribe tu número real.',
        'PHONE_RESERVED_FICTIONAL',
      );
    }

    return new UsPhoneNumber(digits);
  }

  /** "+13015551234" — canónico E.164, el que se guarda y se exporta. */
  toE164(): string {
    return `${UsPhoneNumber.COUNTRY_CODE}${this.nationalNumber}`;
  }

  /** "(301) 555-1234" — para mostrar en el panel administrativo. */
  format(): string {
    const d = this.nationalNumber;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }

  equals(other: UsPhoneNumber): boolean {
    return this.nationalNumber === other.nationalNumber;
  }

  toString(): string {
    return this.toE164();
  }
}
