import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, typography } from '@/lib/theme';

type Props = {
  /** Centavos, como string exacto (nunca un `number`: ver Money en la API). */
  cents: string;
  currency: string;
};

/**
 * Saldo que cuenta hacia arriba al aparecer, en vez de mostrarse de golpe.
 *
 * ── Por qué esto importa para ESTA pantalla en particular ───────────────────
 * Es la pantalla final: el usuario entra, ve su valor, y no puede hacer nada
 * más — así lo pidió el cliente. Con tan poca interacción posible, la única
 * oportunidad de que la app se sienta "viva" y no como una tarjeta estática de
 * imagen es este momento de entrada. Un número que aparece contando transmite
 * "esto es un sistema en vivo calculando tu saldo", aunque el valor sea el
 * mismo de la última vez.
 *
 * ── Por qué la interpolación se hace en enteros, no en el texto formateado ──
 * Se anima el valor en CENTAVOS (un entero) con Reanimated en el hilo de UI, y
 * solo al final de cada frame se formatea a texto para mostrarlo. Interpolar
 * directamente sobre el string "$1,234.56" no tiene sentido matemático; sobre
 * el entero sí, y es exactamente el mismo principio de Money.vo.ts trasladado
 * a la animación: la aritmética ocurre en centavos, el texto es solo la
 * proyección final.
 */
export function AnimatedBalance({ cents, currency }: Props) {
  const target = Number(cents); // seguro: los saldos de esta app caben de sobra en un double
  const animated = useSharedValue(0);
  const [displayCents, setDisplayCents] = useState(0);

  // `useAnimatedReaction` corre en el hilo de UI en cada frame; `runOnJS` es
  // el puente oficial de Reanimated para volver al hilo de JS y actualizar
  // estado de React sin saltarse el bridge de forma manual.
  useAnimatedReaction(
    () => Math.round(animated.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setDisplayCents)(value);
    },
  );

  useEffect(() => {
    animated.value = 0;
    animated.value = withTiming(target, { duration: 1100, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(animated);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  const whole = Math.floor(displayCents / 100);
  const fraction = String(displayCents % 100).padStart(2, '0');
  const formattedWhole = whole.toLocaleString('en-US');

  return (
    <View style={styles.row}>
      <Text style={styles.currencySymbol}>$</Text>
      <Text style={styles.whole}>{formattedWhole}</Text>
      <Text style={styles.fraction}>.{fraction}</Text>
      <Text style={styles.currencyCode}> {currency}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  currencySymbol: {
    ...typography.title,
    color: colors.white,
    marginBottom: 4,
    marginRight: 2,
    opacity: 0.85,
  },
  whole: { fontSize: 44, fontWeight: '800', color: colors.white, letterSpacing: -1 },
  fraction: { fontSize: 24, fontWeight: '700', color: colors.white, opacity: 0.85, marginBottom: 3 },
  currencyCode: { fontSize: 15, fontWeight: '700', color: colors.textOnDarkMuted, marginBottom: 6, marginLeft: 2 },
});
