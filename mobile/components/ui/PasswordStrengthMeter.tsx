import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { estimatePasswordStrength } from '@/lib/password-strength';
import { useT } from '@/lib/i18n';
import { colors, spacing } from '@/lib/theme';

const LEVELS = ['weak', 'fair', 'good', 'strong'] as const;

const COLORS: Record<(typeof LEVELS)[number], string> = {
  weak: colors.danger,
  fair: colors.warning,
  good: '#4ADE80',
  strong: colors.success,
};

const LABEL_KEYS = {
  weak: 'passwordStrengthWeak',
  fair: 'passwordStrengthFair',
  good: 'passwordStrengthGood',
  strong: 'passwordStrengthStrong',
} as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  const t = useT();
  if (!password) return null;

  const strength = estimatePasswordStrength(password);
  const activeIndex = LEVELS.indexOf(strength);

  return (
    <Animated.View entering={FadeIn.duration(200)} layout={Layout} style={styles.wrapper}>
      <View style={styles.bars}>
        {LEVELS.map((level, i) => (
          <View
            key={level}
            style={[
              styles.bar,
              { backgroundColor: i <= activeIndex ? COLORS[strength] : colors.glassFill },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: COLORS[strength] }]}>{t(LABEL_KEYS[strength])}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  bars: { flex: 1, flexDirection: 'row', gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  label: { fontSize: 12, fontWeight: '700', minWidth: 64, textAlign: 'right' },
});
