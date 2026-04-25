export const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

const currentYear = new Date().getFullYear();
export const YEARS: number[] = Array.from(
  { length: currentYear - 1899 },
  (_, i) => currentYear - i
);

// Solo USA — el formulario está restringido a Estados Unidos
export const US_FLAG = '🇺🇸';
export const US_DIAL_CODE = '+1';
export const US_PHONE_DIGITS = 10;
