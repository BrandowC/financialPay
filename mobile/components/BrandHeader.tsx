import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  subtitle?: string;
  compact?: boolean;
};

export function BrandHeader({ subtitle, compact }: Props) {
  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <View style={[styles.logoCircle, compact && styles.logoCircleCompact]}>
        {/* Reemplaza este View por <Image source={require('../assets/logo.png')} /> cuando tengas el logo */}
        <Text style={[styles.logoText, compact && styles.logoTextCompact]}>
          FP
        </Text>
      </View>

      <Text style={[styles.brand, compact && styles.brandCompact]}>
        Financial<Text style={styles.brandAccent}>Pay</Text>
      </Text>

      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', marginBottom: 28 },
  wrapperCompact: { marginBottom: 16 },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  logoCircleCompact: { width: 64, height: 64, borderRadius: 32, marginBottom: 10 },
  logoText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  logoTextCompact: { fontSize: 22 },
  brand: {
    fontSize: 44,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  brandCompact: { fontSize: 28 },
  brandAccent: { color: '#7DD3FC' },
  subtitle: {
    color: '#B9CBEC',
    marginTop: 6,
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
