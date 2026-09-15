import { View, StyleSheet } from 'react-native';

/**
 * Bandera de EE.UU. dibujada con Views en vez del emoji 🇺🇸.
 *
 * El emoji se ve bien en el editor, pero los dos "regional indicator symbols"
 * que lo forman no siempre se combinan en un solo glifo — según el
 * dispositivo/fuente, algunos terminan mostrando "US" en vez de la bandera.
 * Dibujarla con Views garantiza el mismo resultado en cualquier teléfono.
 */
export function UsFlag() {
  return (
    <View style={styles.flag}>
      {STRIPES.map((isRed, i) => (
        <View key={i} style={[styles.stripe, isRed && styles.stripeRed]} />
      ))}
      <View style={styles.canton} />
    </View>
  );
}

const STRIPES = [true, false, true, false, true, false, true];

const styles = StyleSheet.create({
  flag: {
    width: 20,
    height: 14,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  stripe: { flex: 1, backgroundColor: '#FFFFFF' },
  stripeRed: { backgroundColor: '#B22234' },
  canton: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '42%',
    height: '57%',
    backgroundColor: '#3C3B6E',
  },
});
