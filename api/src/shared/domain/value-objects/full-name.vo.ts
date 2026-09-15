import { ValidationError } from '../errors/domain.error';

/**
 * Nombre completo del cliente.
 *
 * La normalización (sin tildes, minúsculas, espacios colapsados) se replica
 * aquí y en Postgres a propósito. En la BD es una columna GENERATED que
 * alimenta el índice de búsqueda; aquí sirve para comparar sin tocar la BD y
 * para los tests unitarios. Las dos implementaciones se verifican entre sí en
 * `test/integration/name-normalization.spec.ts`.
 */
export class FullName {
  static readonly MIN_LENGTH = 2;
  static readonly MAX_LENGTH = 120;

  private constructor(
    readonly value: string,
    readonly normalized: string,
  ) {
    Object.freeze(this);
  }

  static create(input: string): FullName {
    if (typeof input !== 'string') {
      throw new ValidationError('El nombre es obligatorio', 'NAME_REQUIRED');
    }

    // Colapsa espacios múltiples y recorta: "  Juan   Pérez " → "Juan Pérez"
    const cleaned = input.replace(/\s+/g, ' ').trim();

    if (cleaned.length < FullName.MIN_LENGTH) {
      throw new ValidationError('Escribe tu nombre completo', 'NAME_TOO_SHORT');
    }

    if (cleaned.length > FullName.MAX_LENGTH) {
      throw new ValidationError(
        `El nombre no puede superar ${FullName.MAX_LENGTH} caracteres`,
        'NAME_TOO_LONG',
      );
    }

    // Letras (incluidas las acentuadas y la ñ), espacios, apóstrofos, guiones y
    // puntos. Cubre "O'Brien", "Jean-Luc", "J. Smith", "Núñez de Arce".
    // Bloquea dígitos, emojis y caracteres de control, que solo aparecen en
    // intentos de inyección o en datos basura.
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\s'.\-]*$/u.test(cleaned)) {
      throw new ValidationError(
        'El nombre solo puede contener letras, espacios, apóstrofos y guiones',
        'NAME_INVALID_CHARACTERS',
      );
    }

    return new FullName(cleaned, FullName.normalize(cleaned));
  }

  /**
   * Debe producir EXACTAMENTE lo mismo que la función `normalize_name(text)`
   * de Postgres (ver migración 001). Si se cambia una, hay que cambiar la otra.
   */
  static normalize(input: string): string {
    const FROM = 'áéíóúüñàèìòùâêîôûÁÉÍÓÚÜÑÀÈÌÒÙÂÊÎÔÛ';
    const TO = 'aeiouunaeiouaeiouAEIOUUNAEIOUAEIOU';

    const lowered = input.replace(/\s+/g, ' ').trim().toLowerCase();

    let out = '';
    for (const char of lowered) {
      const idx = FROM.indexOf(char);
      out += idx === -1 ? char : TO[idx];
    }
    return out;
  }

  /** "Juan Pérez García" → "Juan" — para el saludo de la pantalla de cuenta. */
  get firstName(): string {
    return this.value.split(' ')[0];
  }

  /** "Juan Pérez" → "JP" — para el avatar con iniciales. */
  get initials(): string {
    return this.value
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  equals(other: FullName): boolean {
    return this.normalized === other.normalized;
  }

  toString(): string {
    return this.value;
  }
}
