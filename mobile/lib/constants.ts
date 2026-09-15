export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export const MIN_AGE = 18;

const currentYear = new Date().getFullYear();

/**
 * El año más reciente que se ofrece en el selector es `currentYear - MIN_AGE`:
 * así el usuario no puede ni siquiera INTENTAR elegir un año que lo deja menor
 * de edad con certeza. Igual se revalida con día y mes exactos al enviar el
 * formulario (alguien nacido hace exactamente MIN_AGE años puede no haber
 * cumplido años todavía este año) — ver `isAtLeastMinAge` más abajo y
 * `BirthDate.create` en la API, que es la validación que de verdad cuenta.
 */
const mostRecentAllowedYear = currentYear - MIN_AGE;
export const YEARS: number[] = Array.from(
  { length: mostRecentAllowedYear - 1899 },
  (_, i) => mostRecentAllowedYear - i,
);

/** Mismo cálculo que `BirthDate.calculateAge` en la API — debe coincidir. */
export function isAtLeastMinAge(day: number, month: number, year: number, now = new Date()): boolean {
  let age = now.getFullYear() - year;
  const monthDiff = now.getMonth() + 1 - month;
  const dayDiff = now.getDate() - day;

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;

  return age >= MIN_AGE;
}

// Solo USA — el formulario está restringido a Estados Unidos
export const US_FLAG = '🇺🇸';
export const US_DIAL_CODE = '+1';
export const US_PHONE_DIGITS = 10;
