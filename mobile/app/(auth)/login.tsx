import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { BrandHeader } from '@/components/BrandHeader';
import { supabase, isNetworkError } from '@/lib/supabase';

type Errors = Partial<Record<'fullName' | 'password' | 'general', string>>;

export default function LoginScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  function clearError(key: keyof Errors) {
    if (errors[key] || errors.general) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        delete next.general;
        return next;
      });
    }
  }

  async function handleLogin() {
    const newErrors: Errors = {};
    if (!fullName.trim()) newErrors.fullName = 'Escribe tu nombre completo.';
    if (!password) newErrors.password = 'Escribe tu contraseña.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      const { data: emailData, error: lookupError } = await supabase.rpc(
        'lookup_email',
        { input: fullName.trim() }
      );

      if (lookupError) {
        setSubmitting(false);
        console.warn('[FinancialPay] lookup error:', lookupError);
        setErrors({
          general: isNetworkError(lookupError)
            ? 'Sin conexión o internet muy lento. Revisa tu Wi-Fi y vuelve a intentar.'
            : 'Error al buscar tu cuenta. Intenta de nuevo.',
        });
        return;
      }

      if (!emailData) {
        setSubmitting(false);
        setErrors({
          general:
            'No encontramos una cuenta con ese nombre. Verifica que esté escrito igual que cuando te registraste.',
        });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailData as string,
        password,
      });

      setSubmitting(false);

      if (error) {
        console.warn('[FinancialPay] signIn error:', error);
        setErrors({
          general: isNetworkError(error)
            ? 'Sin conexión o internet muy lento. Revisa tu Wi-Fi y vuelve a intentar.'
            : 'Nombre o contraseña incorrectos.',
        });
        return;
      }

      router.replace('/(app)/account');
    } catch (err) {
      setSubmitting(false);
      console.warn('[FinancialPay] login exception:', err);
      setErrors({
        general: isNetworkError(err)
          ? 'Sin conexión o internet muy lento. Revisa tu Wi-Fi y vuelve a intentar.'
          : 'Algo salió mal. Intenta de nuevo.',
      });
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(500)}>
              <BrandHeader subtitle="Tu cuenta, siempre contigo" />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              {errors.general ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>{errors.general}</Text>
                </View>
              ) : null}
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(500)}>
              <View style={styles.field}>
                <Text style={styles.label}>Nombre completo</Text>
                <TextInput
                  style={[
                    styles.input,
                    (errors.fullName || errors.general) && styles.inputError,
                  ]}
                  placeholder="Juan Pérez"
                  placeholderTextColor="#8aa0c4"
                  autoCapitalize="words"
                  autoCorrect={false}
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    clearError('fullName');
                  }}
                />
                {errors.fullName ? (
                  <Text style={styles.errorText}>{errors.fullName}</Text>
                ) : null}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <View style={styles.field}>
                <Text style={styles.label}>Contraseña</Text>
                <TextInput
                  style={[
                    styles.input,
                    (errors.password || errors.general) && styles.inputError,
                  ]}
                  placeholder="••••••••"
                  placeholderTextColor="#8aa0c4"
                  secureTextEntry
                  autoComplete="password"
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearError('password');
                  }}
                />
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password}</Text>
                ) : null}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(500)}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.primaryButtonPressed,
                ]}
                onPress={handleLogin}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? 'Entrando…' : 'Entrar'}
                </Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>¿No tienes cuenta? </Text>
                <Link href="/(auth)/register" style={styles.footerLink}>
                  Crear cuenta
                </Link>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  field: { marginBottom: 16 },
  label: { color: '#B9CBEC', marginBottom: 6, fontSize: 14, fontWeight: '500' },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0B2A6B',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  inputError: { borderColor: '#FF6B6B' },
  errorText: {
    color: '#FFB3B3',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  banner: {
    backgroundColor: 'rgba(255,107,107,0.16)',
    borderColor: '#FF6B6B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  bannerText: { color: '#FFD7D7', fontSize: 14, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#0B5FFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  primaryButtonText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: { color: '#B9CBEC' },
  footerLink: { color: '#ffffff', fontWeight: '700' },
});
