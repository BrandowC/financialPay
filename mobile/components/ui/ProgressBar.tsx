import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/lib/theme';

type Props = {
  /** 0 a 1. */
  progress: number;
  /** Cumplida: la barra se pinta en dorado en vez de azul. */
  completed?: boolean;
  height?: number;
};

/**
 * Barra de progreso de una meta. Se llena con una animación corta al aparecer
 * y cada vez que cambia el avance (al registrar un aporte, por ejemplo): ver
 * cómo crece es la recompensa de ahorrar.
 */
export function ProgressBar({ progress, completed, height = 12 }: Props) {
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(Math.max(0, Math.min(1, progress)), {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.fill,
          { borderRadius: height / 2, backgroundColor: completed ? colors.gold : colors.brand400 },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: '100%' },
});
