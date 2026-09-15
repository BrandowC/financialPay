import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { BrandHeader } from '@/components/BrandHeader';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Button } from '@/components/ui/Button';
import { useT } from '@/lib/i18n';
import { colors, spacing, typography } from '@/lib/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const t = useT();

  const highlights = [t('welcomeHighlight1'), t('welcomeHighlight2'), t('welcomeHighlight3')];

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <LanguageToggle />
        </View>

        <View style={styles.spacer} />

        <Animated.View entering={FadeIn.duration(800)}>
          <BrandHeader subtitle={t('appSubtitle')} />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(250).duration(700)} style={styles.tagline}>
          <Text style={styles.taglineText}>{t('welcomeMessage')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(450).duration(600)} style={styles.chipsRow}>
          {highlights.map((label) => (
            <View key={label} style={styles.chip}>
              <View style={styles.chipDot} />
              <Text style={styles.chipText}>{label}</Text>
            </View>
          ))}
        </Animated.View>

        <View style={styles.spacer} />

        <Animated.View entering={FadeInDown.delay(550).duration(700)}>
          <Button title={t('start')} onPress={() => router.push('/(auth)/login')} />
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: spacing.xl, paddingBottom: spacing.xxl },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 4 },
  spacer: { flex: 1 },
  tagline: { marginTop: spacing.sm, alignItems: 'center' },
  taglineText: {
    ...typography.body,
    color: colors.textOnDarkMuted,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.glassFill,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success },
  chipText: { color: colors.textOnDarkMuted, fontSize: 12, fontWeight: '600' },
});
