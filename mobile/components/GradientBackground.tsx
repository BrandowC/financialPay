import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '@/lib/theme';

type Props = {
  children?: ReactNode;
  style?: ViewStyle;
};

/**
 * Fondo de marca de las cuatro pantallas.
 *
 * El primer color es el mismo azul oscuro del fondo del logo dorado, para que
 * la imagen se mezcle perfectamente con la pantalla y no se vea como un PNG
 * pegado.
 */
export function GradientBackground({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        colors={[colors.midnight, colors.brand600, colors.brand400]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
