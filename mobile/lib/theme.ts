/**
 * Sistema de diseño de AM Cuenta.
 *
 * Centralizar esto en un solo archivo es lo que permite que las cuatro
 * pantallas se vean como UN producto y no como cuatro pantallas hechas en
 * momentos distintos. Antes del rediseño, cada pantalla repetía sus propios
 * hex codes (`#0B5FFF`, `#B9CBEC`...) — cambiar el azul de marca habría
 * significado tocar seis archivos. Ahora es una constante.
 */

export const colors = {
  // Azules de marca — el degradado va de oscuro (arriba) a más vivo (abajo),
  // igual que en el logo, para que la marca y el fondo se sientan como una
  // sola pieza en vez de un logo "pegado" sobre un fondo genérico.
  navy: '#0A1230',
  midnight: '#101B3D',
  brand900: '#0B2A6B',
  brand700: '#1538A8',
  brand600: '#1F3A8A',
  brand500: '#0B5FFF',
  brand400: '#3B82F6',

  gold: '#C9A961',
  goldLight: '#E4CD8F',
  goldDark: '#A8863F',

  white: '#FFFFFF',
  ink: '#0B1730',

  // Texto sobre fondo oscuro, en tres intensidades — usar siempre una de
  // estas tres en vez de inventar un blanco-con-opacidad nuevo cada vez.
  textOnDark: '#FFFFFF',
  textOnDarkMuted: '#C7D4F5',
  textOnDarkFaint: '#8FA3D6',

  success: '#22C55E',
  danger: '#F16565',
  dangerBg: 'rgba(241, 101, 101, 0.14)',
  warning: '#F5A623',

  glassFill: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassFillStrong: 'rgba(255, 255, 255, 0.14)',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

/**
 * Tres pesos y una escala tipográfica limitada. Tener solo cinco tamaños
 * (en vez de que cada texto tenga su propio fontSize suelto) es lo que le da
 * a la interfaz una sensación de jerarquía intencional en vez de "cada quien
 * eligió un número".
 */
export const typography = {
  display: { fontSize: 34, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  caption: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.2 },
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  button: {
    shadowColor: colors.brand500,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
} as const;

/** Curva de resorte estándar para toda animación de entrada/salida. */
export const motion = {
  spring: { damping: 16, stiffness: 180, mass: 0.9 },
  springSoft: { damping: 20, stiffness: 140, mass: 1 },
  pressScale: 0.97,
};
