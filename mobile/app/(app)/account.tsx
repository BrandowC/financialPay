import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { LanguageToggle } from '@/components/LanguageToggle';
import { AnimatedBalance } from '@/components/ui/AnimatedBalance';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth';
import { deleteMyAccount } from '@/lib/api';
import { messageFor } from '@/lib/error-messages';
import { useT } from '@/lib/i18n';
import { colors, radii, shadows, spacing, typography } from '@/lib/theme';

const LOGO = require('../../assets/images/Logo.png');

export default function AccountScreen() {
  const { profile, loading, signOut, refreshProfile } = useAuth();
  const t = useT();
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await refreshProfile();
    setRefreshing(false);
  }, [refreshProfile]);

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
      console.warn('[AMCuenta] delete account error:', err);
      Alert.alert(t('deleteAccountTitle'), messageFor(err, t));
    } finally {
      setDeleting(false);
    }
  }

  function copyAccountNumber() {
    if (!profile) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setStringAsync(profile.accountNumber);
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  if (!profile) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.loader}>
            <Text style={styles.errorTitle}>{t('profileErrorTitle')}</Text>
            <Text style={styles.errorMsg}>{t('profileErrorMsg')}</Text>
            <Button title={t('retry')} onPress={refreshProfile} style={{ marginTop: spacing.xl, width: 160 }} />
            <Pressable onPress={signOut} style={{ marginTop: spacing.lg }}>
              <Text style={styles.footerLink}>{t('signOut')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const balanceDate = profile.balance.updatedAt ? new Date(profile.balance.updatedAt) : null;

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.white}
              title={refreshing ? t('refreshing') : t('pullToRefresh')}
              titleColor={colors.textOnDarkFaint}
            />
          }
        >
          <View style={styles.topBar}>
            <LanguageToggle />
          </View>

          <Animated.View entering={FadeIn.duration(500)} style={styles.logoWrap}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(500)} style={styles.greetingWrap}>
            <Text style={styles.greeting}>{t('hello')}</Text>
            <Text style={styles.name}>{profile.fullName}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(550)}>
            <LinearGradient
              colors={[colors.brand700, colors.brand500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardLabel}>{t('accountLabel')}</Text>
                <Text style={styles.cardChip}>AM Cuenta</Text>
              </View>

              <Pressable onPress={copyAccountNumber} hitSlop={8}>
                <Text style={styles.cardNumber} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {profile.accountNumber}
                </Text>
              </Pressable>

              <View style={styles.divider} />

              <Text style={styles.balanceLabel}>{t('availableBalance')}</Text>
              <AnimatedBalance cents={profile.balance.cents} currency={profile.balance.currency} />

              <Text style={styles.balanceUpdated}>
                {balanceDate
                  ? `${t('balanceUpdated')} ${formatRelative(balanceDate)}`
                  : t('balanceNeverUpdated')}
              </Text>
            </LinearGradient>
          </Animated.View>

          {/* Descargo de responsabilidad: deja explícito que esto no es una
              cuenta bancaria. No es solo texto legal — es la defensa más
              concreta ante la revisión de "Financial Features" de Google
              Play, que mira con lupa cualquier app cuyo nombre o pantallas
              sugieran dinero real. Ver mobile/playstore/README.md. */}
          <Animated.View entering={FadeIn.delay(300).duration(500)} style={styles.disclaimerWrap}>
            <Text style={styles.disclaimerText}>{t('balanceDisclaimer')}</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(240).duration(500)} style={styles.memberSince}>
            <Text style={styles.memberSinceText}>
              {t('memberSince')} {new Date(profile.memberSince).toLocaleDateString()}
            </Text>
          </Animated.View>

          <View style={styles.spacer} />

          <Animated.View entering={FadeInDown.delay(320).duration(500)}>
            <Button title={t('signOut')} onPress={signOut} variant="secondary" />

            <Pressable
              onPress={confirmDeleteAccount}
              disabled={deleting}
              style={styles.deleteButton}
              hitSlop={8}
            >
              {deleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <Text style={styles.deleteButtonText}>{t('deleteAccount')}</Text>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/** "hace 3 minutos" / "3 minutes ago" — sin librería, es solo aritmética simple. */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `hace ${diffDays} d`;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: spacing.xl, paddingTop: spacing.md },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.xs },
  logoWrap: { alignItems: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  logo: { width: 110, height: 110 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  errorTitle: { ...typography.title, color: colors.white, marginBottom: spacing.md, textAlign: 'center' },
  errorMsg: { ...typography.body, color: colors.textOnDarkMuted, textAlign: 'center', lineHeight: 22 },
  greetingWrap: { marginTop: spacing.xs, marginBottom: spacing.lg },
  greeting: { ...typography.body, color: colors.textOnDarkMuted },
  name: { ...typography.display, fontSize: 26, color: colors.white, marginTop: 4 },
  card: { borderRadius: radii.xl, padding: spacing.xxl, ...shadows.card },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardLabel: { color: colors.textOnDarkMuted, fontSize: 13, letterSpacing: 1.4, textTransform: 'uppercase' },
  cardChip: { color: colors.gold, fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  cardNumber: { color: colors.white, fontSize: 19, fontWeight: '700', letterSpacing: 1.5, marginTop: 14 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.22)', marginVertical: 20 },
  balanceLabel: { color: colors.textOnDarkMuted, fontSize: 14 },
  balanceUpdated: { color: colors.textOnDarkFaint, fontSize: 12, marginTop: spacing.sm },
  disclaimerWrap: { paddingHorizontal: spacing.sm, marginTop: spacing.md },
  disclaimerText: { color: colors.textOnDarkFaint, fontSize: 11.5, lineHeight: 16, textAlign: 'center' },
  memberSince: { alignItems: 'center', marginTop: spacing.lg },
  memberSinceText: { color: colors.textOnDarkFaint, fontSize: 12 },
  spacer: { flex: 1, minHeight: spacing.xxl },
  deleteButton: { marginTop: spacing.md, paddingVertical: spacing.md, alignItems: 'center' },
  deleteButtonText: { color: '#FF8A8A', fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  footerLink: { ...typography.bodyStrong, color: colors.white },
});
