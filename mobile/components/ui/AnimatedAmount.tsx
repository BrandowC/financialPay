import { useEffect, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useLanguage } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { colors } from '@/lib/theme';

type Props = {
  /** Centavos, como texto exacto (nunca un `number` decimal). */
  cents: string;
  currency: string;
  style?: TextStyle;
};

/**
 * Monto que cuenta hacia arriba al aparecer y al cambiar, en vez de saltar de
 * golpe.
 *
 * Se anima el valor en CENTAVOS (un entero) con Reanimated en el hilo de UI, y
 * solo al final de cada frame se formatea a texto con la moneda de la meta.
 * Interpolar sobre el texto "$1,234.56" no tiene sentido matemático; sobre el
 * entero sí: la aritmética ocurre en centavos, el texto es la proyección final.
 */
export function AnimatedAmount({ cents, currency, style }: Props) {
  const { language } = useLanguage();
  const target = Number(cents); // seguro: los montos de esta app caben de sobra en un double
  const animated = useSharedValue(target);
  const [display, setDisplay] = useState(String(target));

  useAnimatedReaction(
    () => Math.round(animated.value),
    (value, previous) => {
      if (value !== previous) runOnJS(setDisplay)(String(value));
    },
  );

  useEffect(() => {
    animated.value = withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(animated);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Text style={[styles.amount, style]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {formatMoney(display, currency, language)}
    </Text>
  );
}

const styles = StyleSheet.create({
  amount: { fontSize: 38, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
});
