import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = TextInputProps & {
  /** Omitir cuando el campo va dentro de una fila con su propia etiqueta
   *  compartida (ej. el teléfono, que comparte fila con el código de país). */
  label?: string;
  error?: string;
  hint?: string;
  rightAccessory?: React.ReactNode;
};

/**
 * Campo de texto con estado de foco animado.
 *
 * El detalle que marca la diferencia: el borde no solo cambia de color al
 * enfocar, lo hace con una transición suave (ver `focused` en el estilo) y el
 * error se anima al aparecer en vez de aparecer de golpe. Son detalles
 * pequeños, pero sumados es lo que hace que un formulario se sienta pulido en
 * vez de "funcional a secas".
 */
export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, rightAccessory, style, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputRow,
          focused && styles.inputRowFocused,
          !!error && styles.inputRowError,
        ]}
      >
        <TextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={colors.textOnDarkFaint}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightAccessory}
      </View>
      {error ? (
        <Animated.Text entering={FadeIn.duration(180)} style={styles.error}>
          {error}
        </Animated.Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  label: { ...typography.label, color: colors.textOnDarkMuted, marginBottom: spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  inputRowFocused: { borderColor: colors.brand500 },
  inputRowError: { borderColor: colors.danger },
  input: { flex: 1, ...typography.body, color: colors.ink, paddingVertical: 12 },
  error: { color: '#FFC2C2', fontSize: 13, marginTop: spacing.xs, marginLeft: 2 },
  hint: { color: colors.textOnDarkFaint, fontSize: 12, marginTop: spacing.xs, marginLeft: 2 },
});
