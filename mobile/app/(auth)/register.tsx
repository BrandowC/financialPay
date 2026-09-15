import { useMemo, useState } from 'react';
import {
  Image,
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
import { LanguageToggle } from '@/components/LanguageToggle';
import { Select, type SelectOption } from '@/components/Select';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { UsFlag } from '@/components/ui/UsFlag';

const LOGO = require('../../assets/images/Logo.png');
import {
  isAtLeastMinAge,
  YEARS,
  daysInMonth,
  US_DIAL_CODE,
  US_PHONE_DIGITS,
} from '@/lib/constants';
import { useAuth } from '@/lib/auth';
import { messageFor } from '@/lib/error-messages';
import { useLanguage, useT } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MONTHS_EN = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const YEAR_OPTIONS: SelectOption[] = YEARS.map((y) => ({ value: String(y), label: String(y) }));

function pad2(n: number | string) {
  return String(n).padStart(2, '0');
}

type Errors = Partial<Record<'fullName' | 'date' | 'phone' | 'email' | 'password' | 'general', string>>;

export default function RegisterScreen() {
  const router = useRouter();
  const t = useT();
  const { language } = useLanguage();
  const { register, authenticating } = useAuth();

  const [fullName, setFullName] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Errors>({});

  const monthOptions: SelectOption[] = useMemo(() => {
    const list = language === 'en' ? MONTHS_EN : MONTHS_ES;
    return list.map((name, i) => ({ value: String(i + 1), label: name }));
  }, [language]);

  const dayOptions: SelectOption[] = useMemo(() => {
    const m = month ? Number(month) : 12;
    const y = year ? Number(year) : 2000;
    const total = daysInMonth(m, y);
    return Array.from({ length: total }, (_, i) => ({ value: String(i + 1), label: pad2(i + 1) }));
  }, [month, year]);

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

  async function handleRegister() {
    const newErrors: Errors = {};

    if (!fullName.trim()) newErrors.fullName = t('errEnterFullName');

    if (!day || !month || !year) {
      newErrors.date = t('errEnterDate');
    } else if (!isAtLeastMinAge(Number(day), Number(month), Number(year))) {
      newErrors.date = t('errUnderage');
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (!phoneDigits) newErrors.phone = t('errEnterPhone');
    else if (phoneDigits.length !== US_PHONE_DIGITS) newErrors.phone = t('errInvalidUsPhone');

    if (!email.trim()) newErrors.email = t('errEnterEmail');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) newErrors.email = t('errInvalidEmail');

    if (!password) newErrors.password = t('errEnterPassword');
    else if (password.length < 8) newErrors.password = t('errPasswordMin');

    if (Object.keys(newErrors).length > 0) {
      setErrors({ ...newErrors, general: t('errCompleteFields') });
      return;
    }

    setErrors({});
    const birthDate = `${year}-${pad2(month!)}-${pad2(day!)}`;

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        birthDate,
        phone: phoneDigits,
      });
      router.replace('/(app)/account');
    } catch (err) {
      console.warn('[AMCuenta] register error:', err);
      setErrors({ general: messageFor(err, t) });
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.topBar}>
            <View style={styles.brandRow}>
              <Image source={LOGO} style={styles.brandLogo} resizeMode="contain" />
              <View>
                <Text style={styles.brandTitle}>AM Cuenta</Text>
                <Text style={styles.brandTagline}>{t('brandTagline')}</Text>
              </View>
            </View>
            <LanguageToggle />
          </View>

          <ScrollView
            contentContainerStyle={styles.container}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.duration(500)}>
              <Text style={styles.subtitle}>{t('registerSubtitle')}</Text>
            </Animated.View>

            {errors.general ? (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.banner}>
                <Text style={styles.bannerText}>{errors.general}</Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <TextField
                label={t('fullName')}
                placeholder={t('fullNamePlaceholder')}
                value={fullName}
                onChangeText={(v) => {
                  setFullName(v);
                  clearError('fullName');
                }}
                error={errors.fullName}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(500)}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('birthDate')}</Text>
                <View style={styles.row}>
                  <Select
                    value={day}
                    onChange={(v) => {
                      setDay(v);
                      clearError('date');
                    }}
                    options={dayOptions}
                    placeholder={t('day')}
                    title={t('day')}
                    hasError={!!errors.date}
                    containerStyle={styles.cell}
                  />
                  <Select
                    value={month}
                    onChange={(v) => {
                      setMonth(v);
                      if (day) {
                        const m = Number(v);
                        const y = year ? Number(year) : 2000;
                        const max = daysInMonth(m, y);
                        if (Number(day) > max) setDay(String(max));
                      }
                      clearError('date');
                    }}
                    options={monthOptions}
                    placeholder={t('month')}
                    title={t('month')}
                    hasError={!!errors.date}
                    containerStyle={styles.cellWide}
                  />
                  <Select
                    value={year}
                    onChange={(v) => {
                      setYear(v);
                      clearError('date');
                    }}
                    options={YEAR_OPTIONS}
                    placeholder={t('year')}
                    title={t('year')}
                    hasError={!!errors.date}
                    containerStyle={styles.cell}
                  />
                </View>
                {errors.date ? (
                  <Text style={styles.errorText}>{errors.date}</Text>
                ) : (
                  <Text style={styles.hintText}>{t('birthDateHint')}</Text>
                )}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('phoneLabel')}</Text>
                <View style={styles.row}>
                  <View style={styles.fixedCountry}>
                    <UsFlag />
                    <Text style={styles.fixedCountryText}>{US_DIAL_CODE}</Text>
                  </View>
                  <View style={styles.phoneFieldWrap}>
                    <TextField
                      placeholder={t('phonePlaceholder')}
                      keyboardType="phone-pad"
                      maxLength={US_PHONE_DIGITS}
                      value={phone}
                      onChangeText={(v) => {
                        setPhone(v.replace(/[^\d]/g, '').slice(0, US_PHONE_DIGITS));
                        clearError('phone');
                      }}
                    />
                  </View>
                </View>
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(500)}>
              <TextField
                label={t('email')}
                placeholder={t('emailPlaceholder')}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  clearError('email');
                }}
                error={errors.email}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(500)}>
              <TextField
                label={t('password')}
                placeholder={t('passwordHint')}
                secureTextEntry
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  clearError('password');
                }}
                error={errors.password}
              />
              <View style={styles.strengthWrap}>
                <PasswordStrengthMeter password={password} />
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(350).duration(500)}>
              <Button
                title={authenticating ? t('creating') : t('create')}
                onPress={handleRegister}
                loading={authenticating}
                style={styles.submitButton}
              />

              <View style={styles.footer}>
                <Text style={styles.footerText}>{t('haveAccountQ')}</Text>
                <Link href="/(auth)/login" style={styles.footerLink}>
                  {t('enter')}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 8,
    paddingBottom: 4,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  brandLogo: { width: 50, height: 50 },
  brandTitle: {
    color: colors.gold,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  brandTagline: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 1,
  },
  subtitle: {
    ...typography.body,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 18,
  },
  container: { padding: spacing.xl, paddingTop: 4, paddingBottom: 48 },
  field: { marginBottom: spacing.md },
  label: { ...typography.label, color: colors.textOnDarkMuted, marginBottom: spacing.sm },
  banner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: '#FFD7D7', fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minHeight: 52 },
  cellWide: { flex: 1.5, minHeight: 52 },
  fixedCountry: {
    width: 74,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.glassFillStrong,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
  },
  fixedCountryText: { color: colors.white, fontSize: 15, fontWeight: '600' },
  phoneFieldWrap: { flex: 1 },
  errorText: { color: '#FFB3B3', fontSize: 13, marginTop: 6, marginLeft: 4 },
  hintText: { color: colors.textOnDarkFaint, fontSize: 12, marginTop: 6, marginLeft: 4 },
  strengthWrap: { marginTop: -spacing.md },
  submitButton: { marginTop: spacing.sm },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  footerText: { color: colors.textOnDarkMuted },
  footerLink: { ...typography.bodyStrong, color: colors.white },
});
