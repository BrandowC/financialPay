/**
 * Dinero en la app: todo viaja como CENTAVOS en una cadena (nunca un `number`
 * decimal), igual que en la API. Estas funciones convierten desde/hacia lo que
 * la persona escribe y ve.
 */

/** Monedas que la API acepta (debe coincidir con SUPPORTED_CURRENCIES). */
export const CURRENCIES = [
  'USD', 'EUR', 'COP', 'MXN', 'ARS', 'CLP', 'PEN', 'BRL', 'UYU', 'BOB', 'PYG',
  'VES', 'CRC', 'GTQ', 'HNL', 'NIO', 'PAB', 'DOP', 'CAD', 'GBP', 'CHF',
] as const;

/**
 * "1.500,50" / "1,500.50" / "1500.5" / "1500" → "1500.50" (formato canónico
 * que entiende la API), o `null` si no es un monto válido.
 *
 * La regla para saber cuál separador es el decimal: si hay uno solo y lo siguen
 * 1 o 2 dígitos, es el decimal ("12,5" → 12.50); si lo siguen 3 dígitos es de
 * miles ("1.500" → 1500). Con los dos presentes, el último es el decimal.
 */
export function normalizeAmount(input: string): string | null {
  const text = input.trim().replace(/\s/g, '');
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');
  const decimalIndex = Math.max(lastDot, lastComma);

  let whole = text;
  let fraction = '';

  if (decimalIndex !== -1) {
    const after = text.slice(decimalIndex + 1);
    const separatorsBefore = text.slice(0, decimalIndex).match(/[.,]/g)?.length ?? 0;
    const bothKinds = lastDot !== -1 && lastComma !== -1;
    // Un solo separador seguido de exactamente 3 dígitos es de miles: "1.500".
    const looksLikeThousands = !bothKinds && separatorsBefore === 0 && after.length === 3;
    const repeatedSameSeparator = !bothKinds && separatorsBefore > 0;

    if (!looksLikeThousands && !repeatedSameSeparator) {
      if (after.length > 2) return null;
      whole = text.slice(0, decimalIndex);
      fraction = after;
    }
  }

  whole = whole.replace(/[.,]/g, '');
  if (whole === '') whole = '0';
  if (whole.length > 12) return null;

  const normalized = fraction ? `${whole}.${fraction}` : whole;
  return Number(normalized) > 0 ? normalized : null;
}

/** Centavos (cadena) → número de unidades, SOLO para dar formato en pantalla. */
function unitsOf(cents: string): number {
  return Number(cents) / 100;
}

export function formatMoney(cents: string, currency: string, locale?: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(unitsOf(cents));
  } catch {
    return `${unitsOf(cents).toFixed(2)} ${currency}`;
  }
}

/** Fecha AAAA-MM-DD → texto legible en el idioma de la persona. */
export function formatDate(iso: string, locale?: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Hoy como AAAA-MM-DD en la zona horaria de la persona. */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Días que faltan para una fecha (negativo si ya pasó). */
export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1, d).getTime();
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - start) / 86_400_000);
}
