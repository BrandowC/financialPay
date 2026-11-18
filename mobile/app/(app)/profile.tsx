import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/GradientBackground';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { deleteMyAccount } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PRIVACY_URL } from '@/lib/constants';
import { countryName, findCountry } from '@/lib/countries';
import { messageFor } from '@/lib/error-messages';
import { useLanguage } from '@/lib/i18n';
import { formatDate } from '@/lib/money';
import { colors, radii, spacing, typography } from '@/lib/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { language, t } = useLanguage();
  const { profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const country = findCountry(profile?.countryCode);

  function confirmDeleteAccount() {
    Alert.alert(
      t('deleteAccountTitle'),
      t('deleteAccountMsg'),
      [
        { text: t('deleteAccountCancel'), style: 'cancel' },
        { text: t('deleteAccountConfirm'), style: 'destructive', onPress: handleDeleteAccount },
      ],
      { cancelable: true },
    );
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    try {
      await deleteMyAccount();
      await signOut();
    } catch (err) {
      console.warn('[Metas] delete account error:', err);
      Alert.alert(t('deleteAccountTitle'), messageFor(err, t));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel={t('back')}>
            <Ionicons name="chevron-back" size={30} color={colors.white} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('profile')}</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.name}>{profile?.fullName}</Text>
            <Text style={styles.email}>{profile?.email}</Text>

            <View style={styles.divider} />

            <Field label={t('country')} value={country ? countryName(country, language) : '—'} />
            <Field
              label={t('memberSince')}
              value={profile ? formatDate(profile.memberSince.slice(0, 10), language) : '—'}
            />
            <View style={styles.languageRow}>
              <Text style={styles.fieldLabel}>{t('languageLabel')}</Text>
              <LanguageToggle />
            </View>
          </View>

          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.link}>
            <Text style={styles.linkText}>{t('privacyPolicy')}</Text>
            <Ionicons name="open-outline" size={18} color={colors.textOnDarkMuted} />
          </Pressable>

          <Button title={t('signOut')} onPress={signOut} variant="secondary" style={{ marginTop: spacing.xl }} />

          <Pressable onPress={confirmDeleteAccount} disabled={deleting} style={styles.deleteButton} hitSlop={8}>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={styles.deleteText}>{t('deleteAccount')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerTitle: { ...typography.title, color: colors.white },
  content: { padding: spacing.xl, paddingBottom: 48 },
  card: {
    backgroundColor: colors.glassFill,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.xl,
  },
  name: { ...typography.title, color: colors.white },
  email: { ...typography.body, color: colors.textOnDarkMuted, marginTop: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.18)', marginVertical: spacing.lg },
  field: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  fieldLabel: { ...typography.body, color: colors.textOnDarkMuted },
  fieldValue: { ...typography.bodyStrong, color: colors.white },
  languageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md },
  link: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.md,
  },
  linkText: { ...typography.bodyStrong, color: colors.textOnDarkMuted },
  deleteButton: { marginTop: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
  deleteText: { color: '#FF8A8A', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
