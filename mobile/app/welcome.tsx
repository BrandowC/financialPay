import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { BrandHeader } from '@/components/BrandHeader';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.spacer} />

        <Animated.View entering={FadeIn.duration(800)}>
          <BrandHeader subtitle="Tu cuenta, siempre contigo" />
        </Animated.View>

        <Animated.View
          entering={FadeIn.delay(300).duration(700)}
          style={styles.tagline}
        >
          <Text style={styles.taglineText}>
            Maneja tu dinero de forma simple,{'\n'}rápida y segura.
          </Text>
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View entering={FadeInDown.delay(500).duration(700)}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.primaryButtonText}>Comenzar</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).duration(700)}>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.secondaryButtonText}>Ya tengo cuenta</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 24, paddingBottom: 32 },
  spacer: { flex: 1 },
  tagline: { marginTop: 8, alignItems: 'center' },
  taglineText: {
    color: '#C9DAFE',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  primaryButton: {
    backgroundColor: '#0B5FFF',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  primaryButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  secondaryButtonPressed: { opacity: 0.6 },
  secondaryButtonText: {
    color: '#C9DAFE',
    fontSize: 15,
    fontWeight: '600',
  },
});
