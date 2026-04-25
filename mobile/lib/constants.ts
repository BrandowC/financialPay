export type IdType = {
  code: string;
  label: string;
};

export const ID_TYPES: IdType[] = [
  { code: 'CC', label: 'Cédula de Ciudadanía' },
  { code: 'CE', label: 'Cédula de Extranjería' },
  { code: 'PA', label: 'Pasaporte' },
  { code: 'TI', label: 'Tarjeta de Identidad' },
  { code: 'NIT', label: 'NIT' },
];

export type Country = {
  code: string;
  flag: string;
  name: string;
  dialCode: string;
};

export const COUNTRIES: Country[] = [
  { code: 'CO', flag: '🇨🇴', name: 'Colombia',     dialCode: '+57' },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos', dialCode: '+1' },
  { code: 'MX', flag: '🇲🇽', name: 'México',       dialCode: '+52' },
  { code: 'ES', flag: '🇪🇸', name: 'España',       dialCode: '+34' },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador',      dialCode: '+593' },
  { code: 'PE', flag: '🇵🇪', name: 'Perú',         dialCode: '+51' },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela',    dialCode: '+58' },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',    dialCode: '+54' },
  { code: 'CL', flag: '🇨🇱', name: 'Chile',        dialCode: '+56' },
  { code: 'BR', flag: '🇧🇷', name: 'Brasil',       dialCode: '+55' },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá',       dialCode: '+507' },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica',   dialCode: '+506' },
];

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
