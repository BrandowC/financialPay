import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';

type Props = {
  children?: ReactNode;
  style?: ViewStyle;
};

export function GradientBackground({ children, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <LinearGradient
        // arriba: azul oscuro · medio: azul intermedio · abajo: azul más claro
        colors={['#0A1A4D', '#1538A8', '#3B82F6']}
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
