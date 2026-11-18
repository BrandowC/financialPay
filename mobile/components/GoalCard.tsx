import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '@/components/ui/ProgressBar';
import type { Goal } from '@/lib/api';
import { deadlineLabel } from '@/lib/goal-utils';
import { useLanguage } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { colors, radii, spacing, typography } from '@/lib/theme';

type Props = {
  goal: Goal;
  onPress: () => void;
};

/** Tarjeta de una meta en la lista de inicio: nombre, avance y lo que falta. */
export function GoalCard({ goal, onPress }: Props) {
  const { language, t } = useLanguage();
  const percent = Math.floor(goal.progress * 100);
  const deadline = deadlineLabel(goal, t);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, goal.archived && styles.archived, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <View style={styles.emojiWrap}>
          <Text style={styles.emoji}>{goal.emoji || '🎯'}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {goal.name}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {goal.completed ? t('goalReached') : deadline ?? `${percent} %`}
          </Text>
        </View>
        <Text style={[styles.percent, goal.completed && styles.percentDone]}>{percent}%</Text>
      </View>

      <View style={styles.bar}>
        <ProgressBar progress={goal.progress} completed={goal.completed} />
      </View>

      <View style={styles.amounts}>
        <Text style={styles.saved}>{formatMoney(goal.savedCents, goal.currency, language)}</Text>
        <Text style={styles.target}>
          {t('of')} {formatMoney(goal.targetCents, goal.currency, language)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.glassFill,
    borderColor: colors.glassBorder,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  archived: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.glassFillStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  titleWrap: { flex: 1 },
  name: { ...typography.bodyStrong, color: colors.white },
  sub: { ...typography.caption, color: colors.textOnDarkMuted, marginTop: 2 },
  percent: { ...typography.title, color: colors.white },
  percentDone: { color: colors.gold },
  bar: { marginTop: spacing.md },
  amounts: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: spacing.sm },
  saved: { ...typography.bodyStrong, color: colors.white },
  target: { ...typography.caption, color: colors.textOnDarkMuted },
});
