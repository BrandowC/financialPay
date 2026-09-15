import { ValidationError } from '../errors/domain.error';

/**
 * Fecha de nacimiento con verificación de mayoría de edad.
 *
 * ── Por qué se exige 18+ ────────────────────────────────────────────────────
 * La app recoge nombre, fecha de nacimiento, correo y celular, y está dirigida
 * a Estados Unidos. Recoger esos datos de un menor de 13 años activa la COPPA
 * (multas de hasta 50.000 USD por infracción) y, en Google Play, la Families
 * Policy, que impone un proceso de revisión mucho más estricto.
 *
 * Declarar la app como 18+ y validarlo en el dominio es la postura correcta y
 * la que menos fricción tiene con la revisión de Google. Está reflejado en
 * `playstore/content-rating-respuestas.md`.
 *
 * ── Por qué todo se calcula en UTC ──────────────────────────────────────────
 * Si se usa la fecha local del servidor, alguien que cumple años hoy puede ser
 * mayor de edad en Bogotá y menor en Los Ángeles según dónde esté desplegado el
 * contenedor. Fijar UTC hace el resultado determinista y hace posible testearlo.
 */
export class BirthDate {
  static readonly MIN_AGE = 18;
  static readonly MAX_AGE = 120;

  private constructor(
    /** Medianoche UTC del día de nacimiento. */
    readonly value: Date,
  ) {
    Object.freeze(this);
  }

  /**
   * @param input Fecha ISO `YYYY-MM-DD`. Se rechaza cualquier otro formato:
   *   `new Date("03/04/2001")` se interpreta distinto según la plataforma y es
   *   una fuente clásica de bugs de un mes de diferencia.
   * @param now Inyectable para poder testear el límite exacto de los 18 años
   *   sin depender del reloj de la máquina que corre los tests.
   */
  static create(input: string, now: Date = new Date()): BirthDate {
    if (typeof input !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      throw new ValidationError(
        'La fecha de nacimiento debe tener el formato AAAA-MM-DD',
        'BIRTH_DATE_INVALID_FORMAT',
      );
    }

    const [year, month, day] = input.split('-').map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    // Detecta fechas que no existen: "2001-02-30" se desbordaría a marzo.
    // Comparar los componentes de vuelta es la única forma fiable.
    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      throw new ValidationError('Esa fecha no existe', 'BIRTH_DATE_NOT_REAL');
    }

    const age = BirthDate.calculateAge(parsed, now);

    if (age < 0) {
      throw new ValidationError(
        'La fecha de nacimiento no puede estar en el futuro',
        'BIRTH_DATE_IN_FUTURE',
      );
    }

    if (age < BirthDate.MIN_AGE) {
      throw new ValidationError(
        `Debes tener al menos ${BirthDate.MIN_AGE} años para crear una cuenta`,
        'BIRTH_DATE_UNDERAGE',
      );
    }

    if (age > BirthDate.MAX_AGE) {
      throw new ValidationError('Verifica tu fecha de nacimiento', 'BIRTH_DATE_TOO_OLD');
    }

    return new BirthDate(parsed);
  }

  /**
   * Edad en años cumplidos. El detalle importante es que resta 1 si aún no
   * llegó el cumpleaños de este año — un `(hoy - nacimiento) / 365.25` da
   * resultados distintos alrededor de los años bisiestos.
   */
  static calculateAge(birth: Date, now: Date): number {
    let age = now.getUTCFullYear() - birth.getUTCFullYear();

    const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
    const dayDiff = now.getUTCDate() - birth.getUTCDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }

    return age;
  }

  age(now: Date = new Date()): number {
    return BirthDate.calculateAge(this.value, now);
  }

  /** "1998-04-23" — canónico para BD y exportación. */
  toISODate(): string {
    return this.value.toISOString().slice(0, 10);
  }

  toString(): string {
    return this.toISODate();
  }
}
