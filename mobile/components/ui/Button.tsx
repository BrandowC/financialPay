import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { colors, motion, radii, shadows, typography } from '@/lib/theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
};

/**
 * Botón con retroalimentación física real: se encoge levemente al presionar
 * (resorte, no un `opacity` plano) y dispara un haptic. La versión anterior de
 * la app solo cambiaba la opacidad al presionar — funciona, pero no transmite
 * "esto es un botón físico que estás pulsando". Ese matiz es buena parte de lo
 * que separa una interfaz que se siente "genérica" de una que se siente hecha
 * a mano.
 */
export function Button({ title, onPress, variant = 'primary', loading, disabled, style, icon }: Props) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePressIn() {
    if (isDisabled) return;
    scale.value = withSpring(motion.pressScale, motion.spring);
  }

  function handlePressOut() {
    scale.value = withSpring(1, motion.spring);
  }

  function handlePress() {
    if (isDisabled) return;
    Haptics.impactAsync(
      variant === 'danger' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light,
    );
    onPress();
  }

  const variantStyle = VARIANTS[variant];

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={isDisabled}
        style={[
          styles.base,
          variantStyle.container,
          variant === 'primary' && !isDisabled && shadows.button,
          isDisabled && styles.disabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyle.text.color as string} />
        ) : (
          <View style={styles.content}>
            {icon}
            <Text style={[styles.label, variantStyle.text]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const VARIANTS: Record<Variant, { container: ViewStyle; text: { color: string } }> = {
  primary: { container: { backgroundColor: colors.brand500 }, text: { color: colors.white } },
  secondary: {
    container: { backgroundColor: colors.glassFillStrong, borderWidth: 1.5, borderColor: colors.glassBorder },
    text: { color: colors.white },
  },
  ghost: { container: { backgroundColor: 'transparent' }, text: { color: colors.textOnDarkMuted } },
  danger: { container: { backgroundColor: colors.dangerBg }, text: { color: colors.danger } },
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { ...typography.bodyStrong, fontSize: 16 },
  disabled: { opacity: 0.5 },
});
