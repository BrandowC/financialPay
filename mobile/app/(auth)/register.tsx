import { useMemo, useState } from 'react';
import {
  Alert,
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
import { Select, type SelectOption } from '@/components/Select';
import {
  COUNTRIES,
  ID_TYPES,
  MONTHS,
  YEARS,
  daysInMonth,
} from '@/lib/constants';
import { supabase, isNetworkError } from '@/lib/supabase';

const ID_TYPE_OPTIONS: SelectOption[] = ID_TYPES.map((t) => ({
  value: t.code,
  label: t.label,
  hint: t.code,
}));

const COUNTRY_OPTIONS: SelectOption[] = COUNTRIES.map((c) => ({
  value: c.code,
  label: `${c.flag}  ${c.name}`,
  displayLabel: `${c.flag} ${c.dialCode}`,
  hint: c.dialCode,
}));

const MONTH_OPTIONS: SelectOption[] = MONTHS.map((name, i) => ({
  value: String(i + 1),
  label: name,
}));

const YEAR_OPTIONS: SelectOption[] = YEARS.map((y) => ({
  value: String(y),
  label: String(y),
}));

function pad2(n: number | string) {
  return String(n).padStart(2, '0');
}

type Errors = Partial<Record<
  | 'fullName'
  | 'idType'
  | 'idNumber'
  | 'date'
  | 'phone'
  | 'email'
  | 'password'
  | 'general',
  string
>>;

export default function RegisterScreen() {
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [idType, setIdType] = useState<string | null>('CC');
  const [idNumber, setIdNumber] = useState('');
  const [day, setDay] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>('CO');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const dayOptions: SelectOption[] = useMemo(() => {
    const m = month ? Number(month) : 12;
    const y = year ? Number(year) : 2000;
    const total = daysInMonth(m, y);
    return Array.from({ length: total }, (_, i) => ({
      value: String(i + 1),
      label: pad2(i + 1),
    }));
  }, [month, year]);

  const country = COUNTRIES.find((c) => c.code === countryCode);

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

    if (!fullName.trim()) newErrors.fullName = 'Escribe tu nombre completo.';
    if (!idType) newErrors.idType = 'Selecciona el tipo.';
    if (!idNumber.trim()) newErrors.idNumber = 'Escribe el número.';
    if (!day || !month || !year) newErrors.date = 'Completa día, mes y año.';
    if (!country) newErrors.phone = 'Selecciona país.';
    else if (!phone.trim() || phone.replace(/\D/g, '').length < 7)
      newErrors.phone = 'Número de celular inválido.';
    if (!email.trim()) newErrors.email = 'Escribe tu correo.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      newErrors.email = 'Correo no válido.';
    if (!password) newErrors.password = 'Escribe una contraseña.';
    else if (password.length < 6)
      newErrors.password = 'Mínimo 6 caracteres.';

    if (Object.keys(newErrors).length > 0) {
      setErrors({
        ...newErrors,
        general: 'Completa los campos marcados en rojo.',
      });
      return;
    }

    setErrors({});
    const birthDate = `${year}-${pad2(month!)}-${pad2(day!)}`;

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            birth_date: birthDate,
            id_type: idType,
            id_number: idNumber.trim(),
            phone_country_code: country!.dialCode,
            phone_number: phone.trim(),
          },
        },
      });
      setSubmitting(false);

      if (error) {
        console.warn('[FinancialPay] signUp error:', error);
        if (isNetworkError(error)) {
          setErrors({
            general:
              'Sin conexión o internet muy lento. Revisa tu Wi-Fi y vuelve a intentar.',
          });
        } else if (/already registered|exists/i.test(error.message)) {
          setErrors({
            general: 'Este correo ya tiene una cuenta. Intenta iniciar sesión.',
          });
        } else {
          setErrors({
            general: error.message || 'No pudimos crear tu cuenta.',
          });
        }
        return;
      }

      if (!data.session) {
        Alert.alert(
          '¡Cuenta creada!',
          'Revisa tu correo para confirmar la cuenta y luego inicia sesión.'
        );
        router.replace('/(auth)/login');
        return;
      }

      router.replace('/(app)/account');
    } catch (err) {
      setSubmitting(false);
      console.warn('[FinancialPay] signUp exception:', err);
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
              <BrandHeader subtitle="Crea tu cuenta" />
            </Animated.View>

            {errors.general ? (
              <Animated.View entering={FadeInDown.duration(300)} style={styles.banner}>
                <Text style={styles.bannerText}>{errors.general}</Text>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(100).duration(500)}>
              <Field label="Nombre completo" error={errors.fullName}>
                <TextInput
                  style={[styles.input, errors.fullName && styles.inputError]}
                  placeholder="Juan Pérez"
                  placeholderTextColor="#8aa0c4"
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t);
                    clearError('fullName');
                  }}
                />
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(150).duration(500)}>
              <Field
                label="Documento"
                error={errors.idType ?? errors.idNumber}
              >
                <View style={styles.row}>
                  <Select
                    value={idType}
                    onChange={(v) => {
                      setIdType(v);
                      clearError('idType');
                    }}
                    options={ID_TYPE_OPTIONS}
                    placeholder="Tipo"
                    title="Tipo de documento"
                    hasError={!!errors.idType}
                    containerStyle={styles.docType}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      styles.docNumber,
                      errors.idNumber && styles.inputError,
                    ]}
                    placeholder="Número"
                    placeholderTextColor="#8aa0c4"
                    keyboardType="number-pad"
                    value={idNumber}
                    onChangeText={(t) => {
                      setIdNumber(t.replace(/[^\d]/g, ''));
                      clearError('idNumber');
                    }}
                  />
                </View>
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(200).duration(500)}>
              <Field label="Fecha de nacimiento" error={errors.date}>
                <View style={styles.row}>
                  <Select
                    value={day}
                    onChange={(v) => {
                      setDay(v);
                      clearError('date');
                    }}
                    options={dayOptions}
                    placeholder="Día"
                    title="Día"
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
                    options={MONTH_OPTIONS}
                    placeholder="Mes"
                    title="Mes"
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
                    placeholder="Año"
                    title="Año"
                    hasError={!!errors.date}
                    containerStyle={styles.cell}
                  />
                </View>
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(250).duration(500)}>
              <Field label="Celular" error={errors.phone}>
                <View style={styles.row}>
                  <Select
                    value={countryCode}
                    onChange={(v) => {
                      setCountryCode(v);
                      clearError('phone');
                    }}
                    options={COUNTRY_OPTIONS}
                    placeholder="🇨🇴 +57"
                    title="País"
                    hasError={!!errors.phone}
                    containerStyle={styles.country}
                  />
                  <TextInput
                    style={[
                      styles.input,
                      styles.phoneInput,
                      errors.phone && styles.inputError,
                    ]}
                    placeholder="3001234567"
                    placeholderTextColor="#8aa0c4"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={(t) => {
                      setPhone(t.replace(/[^\d]/g, ''));
                      clearError('phone');
                    }}
                  />
                </View>
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(300).duration(500)}>
              <Field label="Correo electrónico" error={errors.email}>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="tu@correo.com"
                  placeholderTextColor="#8aa0c4"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    clearError('email');
                  }}
                />
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(350).duration(500)}>
              <Field label="Contraseña" error={errors.password}>
                <TextInput
                  style={[styles.input, errors.password && styles.inputError]}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#8aa0c4"
                  secureTextEntry
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t);
                    clearError('password');
                  }}
                />
              </Field>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(400).duration(500)}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  (pressed || submitting) && styles.primaryButtonPressed,
                ]}
                onPress={handleRegister}
                disabled={submitting}
              >
                <Text style={styles.primaryButtonText}>
                  {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
                </Text>
              </Pressable>

              <View style={styles.footer}>
                <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                <Link href="/(auth)/login" style={styles.footerLink}>
                  Entrar
                </Link>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 32, paddingBottom: 48 },
  field: { marginBottom: 14 },
  label: { color: '#B9CBEC', marginBottom: 6, fontSize: 14, fontWeight: '500' },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0B2A6B',
    minHeight: 50,
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
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, minHeight: 50 },
  cellWide: { flex: 1.5, minHeight: 50 },
  docType: { flex: 1, minHeight: 50 },
  docNumber: { flex: 1.4 },
  country: { width: 110, minHeight: 50 },
  phoneInput: { flex: 1 },
  primaryButton: {
    backgroundColor: '#0B5FFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
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
    marginTop: 20,
  },
  footerText: { color: '#B9CBEC' },
  footerLink: { color: '#ffffff', fontWeight: '700' },
});
