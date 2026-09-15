import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { BrandHeader } from '@/components/BrandHeader';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/lib/auth';
import { messageFor } from '@/lib/error-messages';
import { useT } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

type Errors = Partial<Record<'identifier' | 'password' | 'general', string>>;

export default function LoginScreen() {
  const router = useRouter();
  const t = useT();
  const { login, authenticating } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
    if (!identifier.trim()) newErrors.identifier = t('errEnterFullName');
    if (!password) newErrors.password = t('errEnterPassword');

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      await login(identifier.trim(), password);
      router.replace('/(app)/account');
    } catch (err) {
      console.warn('[AMCuenta] login error:', err);
      setErrors({ general: messageFor(err, t) });
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topBar}>
            <LanguageToggle />
          </View>

          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(500)}>
              <BrandHeader compact subtitle={t('loginSubtitle')} />
            </Animated.View>

            {errors.general ? (
              <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.banner}>
                <Text style={styles.bannerText}>{errors.general}</Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(150).duration(500)}>
              <TextField
                label={t('identifierLabel')}
                placeholder={t('identifierPlaceholder')}
                placeholderTextColor={colors.textOnDarkFaint}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                value={identifier}
                onChangeText={(v) => {
                  setIdentifier(v);
                  clearError('identifier');
                }}
                error={errors.identifier}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <TextField
                label={t('password')}
                placeholder={t('passwordPlaceholder')}
                secureTextEntry
                autoComplete="password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
                error={errors.password}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(280).duration(500)}>
              <Button
                title={authenticating ? t('entering') : t('enter')}
                onPress={handleLogin}
                loading={authenticating}
                style={styles.submitButton}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('noAccount')}</Text>
                <Link href="/(auth)/register" style={styles.footerLink}>
                  {t('createAccount')}
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
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.xl, paddingTop: 4 },
  container: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center' },
  banner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: '#FFD7D7', fontSize: 14, lineHeight: 20 },
  submitButton: { marginTop: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textOnDarkMuted },
  footerLink: { ...typography.bodyStrong, color: colors.white },
});
