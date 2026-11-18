/**
 * Países para el registro: código ISO, prefijo telefónico y nombre en español.
 * El nombre en inglés sale de `Intl.DisplayNames` cuando el dispositivo lo
 * soporta; si no, se muestra el español (ver `countryName`).
 *
 * Los países que comparten el prefijo +1 (Canadá, Jamaica, República
 * Dominicana…) llevan "+1" y el usuario escribe su número completo con código de
 * área, igual que en el plan de numeración norteamericano.
 */
export type Country = {
  iso: string;
  dial: string;
  es: string;
};

const RAW: Array<[string, string, string]> = [
  ['AF', '+93', 'Afganistán'], ['AL', '+355', 'Albania'], ['DE', '+49', 'Alemania'],
  ['AD', '+376', 'Andorra'], ['AO', '+244', 'Angola'], ['AG', '+1', 'Antigua y Barbuda'],
  ['SA', '+966', 'Arabia Saudita'], ['DZ', '+213', 'Argelia'], ['AR', '+54', 'Argentina'],
  ['AM', '+374', 'Armenia'], ['AW', '+297', 'Aruba'], ['AU', '+61', 'Australia'],
  ['AT', '+43', 'Austria'], ['AZ', '+994', 'Azerbaiyán'], ['BS', '+1', 'Bahamas'],
  ['BD', '+880', 'Bangladés'], ['BB', '+1', 'Barbados'], ['BH', '+973', 'Baréin'],
  ['BE', '+32', 'Bélgica'], ['BZ', '+501', 'Belice'], ['BJ', '+229', 'Benín'],
  ['BY', '+375', 'Bielorrusia'], ['BO', '+591', 'Bolivia'], ['BA', '+387', 'Bosnia y Herzegovina'],
  ['BW', '+267', 'Botsuana'], ['BR', '+55', 'Brasil'], ['BN', '+673', 'Brunéi'],
  ['BG', '+359', 'Bulgaria'], ['BF', '+226', 'Burkina Faso'], ['BI', '+257', 'Burundi'],
  ['BT', '+975', 'Bután'], ['CV', '+238', 'Cabo Verde'], ['KH', '+855', 'Camboya'],
  ['CM', '+237', 'Camerún'], ['CA', '+1', 'Canadá'], ['QA', '+974', 'Catar'],
  ['TD', '+235', 'Chad'], ['CL', '+56', 'Chile'], ['CN', '+86', 'China'],
  ['CY', '+357', 'Chipre'], ['CO', '+57', 'Colombia'], ['KM', '+269', 'Comoras'],
  ['CG', '+242', 'Congo'], ['CD', '+243', 'Congo (Rep. Dem.)'], ['KP', '+850', 'Corea del Norte'],
  ['KR', '+82', 'Corea del Sur'], ['CI', '+225', 'Costa de Marfil'], ['CR', '+506', 'Costa Rica'],
  ['HR', '+385', 'Croacia'], ['CU', '+53', 'Cuba'], ['CW', '+599', 'Curazao'],
  ['DK', '+45', 'Dinamarca'], ['DM', '+1', 'Dominica'], ['EC', '+593', 'Ecuador'],
  ['EG', '+20', 'Egipto'], ['SV', '+503', 'El Salvador'], ['AE', '+971', 'Emiratos Árabes Unidos'],
  ['ER', '+291', 'Eritrea'], ['SK', '+421', 'Eslovaquia'], ['SI', '+386', 'Eslovenia'],
  ['ES', '+34', 'España'], ['US', '+1', 'Estados Unidos'], ['EE', '+372', 'Estonia'],
  ['SZ', '+268', 'Esuatini'], ['ET', '+251', 'Etiopía'], ['PH', '+63', 'Filipinas'],
  ['FI', '+358', 'Finlandia'], ['FJ', '+679', 'Fiyi'], ['FR', '+33', 'Francia'],
  ['GA', '+241', 'Gabón'], ['GM', '+220', 'Gambia'], ['GE', '+995', 'Georgia'],
  ['GH', '+233', 'Ghana'], ['GI', '+350', 'Gibraltar'], ['GD', '+1', 'Granada'],
  ['GR', '+30', 'Grecia'], ['GL', '+299', 'Groenlandia'], ['GP', '+590', 'Guadalupe'],
  ['GU', '+1', 'Guam'], ['GT', '+502', 'Guatemala'], ['GF', '+594', 'Guayana Francesa'],
  ['GG', '+44', 'Guernsey'], ['GN', '+224', 'Guinea'], ['GQ', '+240', 'Guinea Ecuatorial'],
  ['GW', '+245', 'Guinea-Bisáu'], ['GY', '+592', 'Guyana'], ['HT', '+509', 'Haití'],
  ['HN', '+504', 'Honduras'], ['HK', '+852', 'Hong Kong'], ['HU', '+36', 'Hungría'],
  ['IN', '+91', 'India'], ['ID', '+62', 'Indonesia'], ['IQ', '+964', 'Irak'],
  ['IR', '+98', 'Irán'], ['IE', '+353', 'Irlanda'], ['IS', '+354', 'Islandia'],
  ['KY', '+1', 'Islas Caimán'], ['FO', '+298', 'Islas Feroe'], ['MH', '+692', 'Islas Marshall'],
  ['SB', '+677', 'Islas Salomón'], ['VG', '+1', 'Islas Vírgenes Británicas'],
  ['VI', '+1', 'Islas Vírgenes de EE. UU.'], ['IL', '+972', 'Israel'], ['IT', '+39', 'Italia'],
  ['JM', '+1', 'Jamaica'], ['JP', '+81', 'Japón'], ['JE', '+44', 'Jersey'],
  ['JO', '+962', 'Jordania'], ['KZ', '+7', 'Kazajistán'], ['KE', '+254', 'Kenia'],
  ['KG', '+996', 'Kirguistán'], ['KI', '+686', 'Kiribati'], ['XK', '+383', 'Kosovo'],
  ['KW', '+965', 'Kuwait'], ['LA', '+856', 'Laos'], ['LS', '+266', 'Lesoto'],
  ['LV', '+371', 'Letonia'], ['LB', '+961', 'Líbano'], ['LR', '+231', 'Liberia'],
  ['LY', '+218', 'Libia'], ['LI', '+423', 'Liechtenstein'], ['LT', '+370', 'Lituania'],
  ['LU', '+352', 'Luxemburgo'], ['MO', '+853', 'Macao'], ['MK', '+389', 'Macedonia del Norte'],
  ['MG', '+261', 'Madagascar'], ['MY', '+60', 'Malasia'], ['MW', '+265', 'Malaui'],
  ['MV', '+960', 'Maldivas'], ['ML', '+223', 'Malí'], ['MT', '+356', 'Malta'],
  ['MA', '+212', 'Marruecos'], ['MQ', '+596', 'Martinica'], ['MU', '+230', 'Mauricio'],
  ['MR', '+222', 'Mauritania'], ['MX', '+52', 'México'], ['FM', '+691', 'Micronesia'],
  ['MD', '+373', 'Moldavia'], ['MC', '+377', 'Mónaco'], ['MN', '+976', 'Mongolia'],
  ['ME', '+382', 'Montenegro'], ['MS', '+1', 'Montserrat'], ['MZ', '+258', 'Mozambique'],
  ['MM', '+95', 'Myanmar'], ['NA', '+264', 'Namibia'], ['NR', '+674', 'Nauru'],
  ['NP', '+977', 'Nepal'], ['NI', '+505', 'Nicaragua'], ['NE', '+227', 'Níger'],
  ['NG', '+234', 'Nigeria'], ['NO', '+47', 'Noruega'], ['NC', '+687', 'Nueva Caledonia'],
  ['NZ', '+64', 'Nueva Zelanda'], ['OM', '+968', 'Omán'], ['NL', '+31', 'Países Bajos'],
  ['PK', '+92', 'Pakistán'], ['PW', '+680', 'Palaos'], ['PS', '+970', 'Palestina'],
  ['PA', '+507', 'Panamá'], ['PG', '+675', 'Papúa Nueva Guinea'], ['PY', '+595', 'Paraguay'],
  ['PE', '+51', 'Perú'], ['PF', '+689', 'Polinesia Francesa'], ['PL', '+48', 'Polonia'],
  ['PT', '+351', 'Portugal'], ['PR', '+1', 'Puerto Rico'], ['GB', '+44', 'Reino Unido'],
  ['CF', '+236', 'República Centroafricana'], ['CZ', '+420', 'República Checa'],
  ['DO', '+1', 'República Dominicana'], ['RE', '+262', 'Reunión'], ['RW', '+250', 'Ruanda'],
  ['RO', '+40', 'Rumania'], ['RU', '+7', 'Rusia'], ['EH', '+212', 'Sahara Occidental'],
  ['WS', '+685', 'Samoa'], ['KN', '+1', 'San Cristóbal y Nieves'], ['SM', '+378', 'San Marino'],
  ['VC', '+1', 'San Vicente y las Granadinas'], ['LC', '+1', 'Santa Lucía'],
  ['ST', '+239', 'Santo Tomé y Príncipe'], ['SN', '+221', 'Senegal'], ['RS', '+381', 'Serbia'],
  ['SC', '+248', 'Seychelles'], ['SL', '+232', 'Sierra Leona'], ['SG', '+65', 'Singapur'],
  ['SY', '+963', 'Siria'], ['SO', '+252', 'Somalia'], ['LK', '+94', 'Sri Lanka'],
  ['ZA', '+27', 'Sudáfrica'], ['SD', '+249', 'Sudán'], ['SS', '+211', 'Sudán del Sur'],
  ['SE', '+46', 'Suecia'], ['CH', '+41', 'Suiza'], ['SR', '+597', 'Surinam'],
  ['TH', '+66', 'Tailandia'], ['TW', '+886', 'Taiwán'], ['TZ', '+255', 'Tanzania'],
  ['TJ', '+992', 'Tayikistán'], ['TL', '+670', 'Timor Oriental'], ['TG', '+228', 'Togo'],
  ['TO', '+676', 'Tonga'], ['TT', '+1', 'Trinidad y Tobago'], ['TN', '+216', 'Túnez'],
  ['TM', '+993', 'Turkmenistán'], ['TR', '+90', 'Turquía'], ['TV', '+688', 'Tuvalu'],
  ['UA', '+380', 'Ucrania'], ['UG', '+256', 'Uganda'], ['UY', '+598', 'Uruguay'],
  ['UZ', '+998', 'Uzbekistán'], ['VU', '+678', 'Vanuatu'], ['VA', '+39', 'Vaticano'],
  ['VE', '+58', 'Venezuela'], ['VN', '+84', 'Vietnam'], ['YE', '+967', 'Yemen'],
  ['DJ', '+253', 'Yibuti'], ['ZM', '+260', 'Zambia'], ['ZW', '+263', 'Zimbabue'],
];

export const COUNTRIES: Country[] = RAW.map(([iso, dial, es]) => ({ iso, dial, es }));

const BY_ISO = new Map(COUNTRIES.map((c) => [c.iso, c]));

export function findCountry(iso: string | null | undefined): Country | undefined {
  return iso ? BY_ISO.get(iso.toUpperCase()) : undefined;
}

/** Nombre del país en el idioma activo. `Intl.DisplayNames` no existe en todos
 *  los motores de JS: si falta o falla, se cae al nombre en español. */
export function countryName(country: Country, language: 'es' | 'en'): string {
  if (language === 'es') return country.es;
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    return names.of(country.iso) ?? country.es;
  } catch {
    return country.es;
  }
}

/** URL de la bandera. Se usan imágenes y no emojis: en Windows y en la web los
 *  emojis de bandera se ven como dos letras. */
export function flagUrl(iso: string, width: 40 | 80 = 80): string {
  return `https://flagcdn.com/w${width}/${iso.toLowerCase()}.png`;
}

/** País por defecto según el idioma del teléfono; Colombia si no se sabe. */
export function guessDefaultCountry(): Country {
  try {
    const region = new Intl.Locale(Intl.DateTimeFormat().resolvedOptions().locale).region;
    return findCountry(region) ?? BY_ISO.get('CO')!;
  } catch {
    return BY_ISO.get('CO')!;
  }
}

/** Moneda sugerida para un país (la que más probablemente use esa persona). */
const CURRENCY_BY_COUNTRY: Record<string, string> = {
  CO: 'COP', MX: 'MXN', AR: 'ARS', CL: 'CLP', PE: 'PEN', BR: 'BRL', UY: 'UYU', BO: 'BOB',
  PY: 'PYG', VE: 'VES', CR: 'CRC', GT: 'GTQ', HN: 'HNL', NI: 'NIO', PA: 'PAB', DO: 'DOP',
  CA: 'CAD', GB: 'GBP', CH: 'CHF', US: 'USD', EC: 'USD', SV: 'USD', PR: 'USD',
  ES: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', PT: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  IE: 'EUR', FI: 'EUR', GR: 'EUR',
};

export function suggestedCurrency(iso: string | null | undefined): string {
  return (iso && CURRENCY_BY_COUNTRY[iso.toUpperCase()]) || 'USD';
}
