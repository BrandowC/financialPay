import { ValidationError } from '../errors/domain.error';

/**
 * Money — el value object más importante de todo el sistema.
 *
 * ── Por qué existe ──────────────────────────────────────────────────────────
 * En JavaScript, `0.1 + 0.2 === 0.30000000000000004`. Un `number` es un
 * IEEE-754 de doble precisión y pierde exactitud a partir de 2^53. Guardar
 * dinero en un `number` (o en un FLOAT de Postgres) produce, tarde o temprano,
 * saldos que no cuadran con un centavo de diferencia. En una app financiera eso
 * es inaceptable, y además es el tipo de bug que aparece meses después y es
 * imposible de rastrear.
 *
 * La solución es guardar SIEMPRE centavos en un entero. Aquí usamos `bigint`
 * de JavaScript (precisión arbitraria) contra un `BIGINT` de Postgres.
 *
 * ── Invariantes que garantiza ───────────────────────────────────────────────
 *   · El constructor es privado: no se puede crear un Money inválido.
 *   · Nunca acepta un `number` como entrada. La única forma de entrar es desde
 *     una cadena o desde un bigint de centavos. Esto hace IMPOSIBLE introducir
 *     un error de coma flotante por descuido.
 *   · Es inmutable: toda operación devuelve una instancia nueva.
 *   · Rechaza negativos por decisión de producto (el saldo nunca baja de 0).
 */
export class Money {
  /** Tope de seguridad: 1.000 millones de dólares. Cualquier cosa por encima
   *  es casi con certeza un error de tipeo del administrador (un cero de más). */
  static readonly MAX_CENTS = 100_000_000_000n;

  private constructor(
    readonly cents: bigint,
    readonly currency: string,
  ) {
    Object.freeze(this);
  }

  // ── Constructores ─────────────────────────────────────────────────────────

  /** Desde centavos crudos. Es la vía que usa el repositorio al leer de la BD. */
  static fromCents(cents: bigint, currency = 'USD'): Money {
    Money.assertCurrency(currency);
    Money.assertRange(cents);
    return new Money(cents, currency);
  }

  /**
   * Desde una cadena decimal escrita por un humano: "1234.56", "1,234.56",
   * "0.5", "890". Es la vía que usa el panel administrativo.
   *
   * Deliberadamente NO acepta `number`. Si alguien intenta pasar 1234.56 como
   * número, TypeScript lo rechaza en compilación; y si llega por JSON, el DTO
   * lo obliga a ser string antes de llegar aquí.
   */
  static fromDecimalString(input: string, currency = 'USD'): Money {
    Money.assertCurrency(currency);

    if (typeof input !== 'string') {
      throw new ValidationError('El monto debe enviarse como texto', 'MONEY_NOT_A_STRING');
    }

    // Quita separadores de miles y espacios, pero NO tocamos el punto decimal.
    const cleaned = input.trim().replace(/[\s,_]/g, '');

    if (cleaned === '') {
      throw new ValidationError('El monto no puede estar vacío', 'MONEY_EMPTY');
    }

    // Formato estricto: dígitos, opcionalmente un punto y 1 o 2 decimales.
    // Rechaza "1e5", "1.234.5", "--3", "0x10", "Infinity", "1.999".
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
    if (!match) {
      throw new ValidationError(
        'El monto debe ser un número positivo con máximo 2 decimales (ej: 1500.75)',
        'MONEY_INVALID_FORMAT',
        { received: input },
      );
    }

    const [, wholePart, decimalPart = ''] = match;
    // padEnd convierte "5" en "50": 1.5 dólares son 150 centavos, no 105.
    const cents = BigInt(wholePart) * 100n + BigInt(decimalPart.padEnd(2, '0'));

    Money.assertRange(cents);
    return new Money(cents, currency);
  }

  static zero(currency = 'USD'): Money {
    return new Money(0n, currency);
  }

  // ── Operaciones (siempre devuelven instancias nuevas) ─────────────────────

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents - other.cents, this.currency);
  }

  equals(other: Money): boolean {
    return this.cents === other.cents && this.currency === other.currency;
  }

  isZero(): boolean {
    return this.cents === 0n;
  }

  // ── Representaciones ──────────────────────────────────────────────────────

  /** "1234.56" — formato canónico para APIs y para el Excel. Sin símbolo. */
  toDecimalString(): string {
    const whole = this.cents / 100n;
    const fraction = this.cents % 100n;
    return `${whole}.${fraction.toString().padStart(2, '0')}`;
  }

  /**
   * "$1,234.56" — formato de PRESENTACIÓN, nunca de cálculo ni de almacenamiento.
   *
   * Aquí sí se pasa por `Number`, y es seguro hacerlo: `MAX_CENTS` (100 mil
   * millones) está muy por debajo de 2^53, así que la conversión a entero es
   * exacta. La división entre 100 puede tener un error de redondeo binario
   * invisible (a nivel de 10^-15), pero `Intl.NumberFormat` redondea a 2
   * decimales para mostrarlo, así que ese error nunca llega a verse. Lo que
   * esta clase garantiza — y lo único que importa — es que `cents` y
   * `toDecimalString()` son exactos siempre; `format()` es solo para pintar en
   * pantalla.
   */
  format(locale = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(this.cents) / 100);
  }

  /** Lo que viaja en el JSON de la API. Nunca exponemos un `number`. */
  toJSON(): { cents: string; decimal: string; currency: string } {
    return {
      cents: this.cents.toString(),
      decimal: this.toDecimalString(),
      currency: this.currency,
    };
  }

  // ── Invariantes internas ──────────────────────────────────────────────────

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new ValidationError(
        `No se pueden operar montos de distinta moneda (${this.currency} vs ${other.currency})`,
        'MONEY_CURRENCY_MISMATCH',
      );
    }
  }

  private static assertRange(cents: bigint): void {
    if (cents < 0n) {
      throw new ValidationError('El saldo no puede ser negativo', 'MONEY_NEGATIVE');
    }
    if (cents > Money.MAX_CENTS) {
      throw new ValidationError(
        'El monto supera el máximo permitido (1.000.000.000.00)',
        'MONEY_TOO_LARGE',
      );
    }
  }

  private static assertCurrency(currency: string): void {
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new ValidationError(
        'La moneda debe ser un código ISO-4217 de 3 letras mayúsculas',
        'MONEY_INVALID_CURRENCY',
      );
    }
  }
}
