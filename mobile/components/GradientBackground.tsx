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
        colors={['#050E2C', '#0B2A6B', '#1E40AF']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
