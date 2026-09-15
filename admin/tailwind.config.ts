import type { Config } from 'tailwindcss';

/**
 * Paleta de marca tomada directamente de la app móvil (GradientBackground.tsx
 * y BrandHeader.tsx), para que el panel se sienta como parte del mismo
 * producto y no como una herramienta interna genérica.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          950: '#0A1A4D',
          900: '#0B2A6B',
          800: '#15233F',
          700: '#1F3A8A',
          600: '#1538A8',
          500: '#0B5FFF',
          400: '#3B82F6',
        },
        gold: {
          400: '#D4B96A',
          DEFAULT: '#C9A961',
          600: '#A8863F',
        },
        surface: {
          50: '#F7F9FC',
          100: '#EEF2F9',
          200: '#E2E8F5',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 8px 30px -8px rgba(11, 42, 107, 0.25)',
        'card-hover': '0 16px 40px -12px rgba(11, 42, 107, 0.35)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
