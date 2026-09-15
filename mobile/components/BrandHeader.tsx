import { Image, StyleSheet, Text, View } from 'react-native';
import { useT } from '@/lib/i18n';

type Props = {
  /** Texto opcional bajo "Solutions & Services" (ej. tagline de pantalla) */
  subtitle?: string;
  compact?: boolean;
};

const GOLD = '#C9A961';

// Logo de AM Financial. Para cambiarlo, reemplaza assets/images/Logo.png
// con un PNG cuadrado (recomendado 1024×1024) y recarga la app.
const LOGO_SOURCE = require('../assets/images/Logo.png');

export function BrandHeader({ subtitle, compact }: Props) {
  const t = useT();

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <Image
        source={LOGO_SOURCE}
        style={[styles.logo, compact && styles.logoCompact]}
        resizeMode="contain"
      />

      <Text style={[styles.brand, compact && styles.brandCompact]}>
        AM Cuenta
      </Text>

      <Text style={[styles.tagline, compact && styles.taglineCompact]}>
        {t('brandTagline')}
      </Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 24 },
  wrapperCompact: { marginBottom: 12 },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 4,
  },
  logoCompact: {
    width: 100,
    height: 100,
    marginBottom: 2,
  },
  brand: {
    fontSize: 36,
    fontWeight: '900',
    color: GOLD,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandCompact: { fontSize: 22 },
  tagline: {
    fontSize: 13,
    fontWeight: '700',
    color: GOLD,
    letterSpacing: 2.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  taglineCompact: { fontSize: 10, letterSpacing: 1.5 },
  subtitle: {
    color: '#B9CBEC',
    marginTop: 10,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
