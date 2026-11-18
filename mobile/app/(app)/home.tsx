import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { GoalCard } from '@/components/GoalCard';
import { GradientBackground } from '@/components/GradientBackground';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { Button } from '@/components/ui/Button';
import { fetchGoals, type Goal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { totalsByCurrency } from '@/lib/goal-utils';
import { useT } from '@/lib/i18n';
import { colors, radii, shadows, spacing, typography } from '@/lib/theme';

export default function HomeScreen() {
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();

  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchGoals();
      setGoals(result.goals);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  // Se recarga cada vez que la pantalla vuelve a estar a la vista: así, al
  // volver del detalle de una meta, los totales ya reflejan el aporte nuevo.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = (goals ?? []).filter((g) => !g.archived);
  const archived = (goals ?? []).filter((g) => g.archived);
  const completedCount = active.filter((g) => g.completed).length;
  const totals = totalsByCurrency(active);
  const firstName = profile?.fullName.split(' ')[0] ?? '';

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greeting}>{t('hello')}</Text>
            <Text style={styles.name} numberOfLines={1}>
              {firstName}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/profile')}
            hitSlop={10}
            style={styles.profileButton}
            accessibilityLabel={t('profile')}
          >
            <Ionicons name="person-circle-outline" size={34} color={colors.white} />
          </Pressable>
        </View>

        {goals === null && !failed ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.white} />
          </View>
        ) : goals === null && failed ? (
          <View style={styles.center}>
            <Text style={styles.stateTitle}>{t('loadErrorTitle')}</Text>
            <Text style={styles.stateMsg}>{t('loadErrorMsg')}</Text>
            <Button title={t('retry')} onPress={load} style={{ marginTop: spacing.xl, width: 180 }} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
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
            <Animated.View entering={FadeInDown.duration(500)}>
              <LinearGradient
                colors={[colors.brand700, colors.brand500]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summary}
              >
                <Text style={styles.summaryLabel}>{t('totalSaved')}</Text>

                {totals.length === 0 ? (
                  <Text style={styles.summaryEmpty}>{t('totalSavedNone')}</Text>
                ) : (
                  totals.slice(0, 3).map((row, index) => (
                    <AnimatedAmount
                      key={row.currency}
                      cents={row.cents}
                      currency={row.currency}
                      style={index === 0 ? undefined : styles.secondaryAmount}
                    />
                  ))
                )}

                <Text style={styles.summaryMeta}>
                  {active.length === 1 ? t('goalsCountOne') : t('goalsCount', { n: active.length })}
                  {completedCount > 0 ? ` · ${t('completedCount', { n: completedCount })}` : ''}
                </Text>
              </LinearGradient>
            </Animated.View>

            {goals.length === 0 ? (
              <Animated.View entering={FadeIn.delay(200).duration(500)} style={styles.empty}>
                <Text style={styles.emptyEmoji}>🎯</Text>
                <Text style={styles.stateTitle}>{t('noGoalsTitle')}</Text>
                <Text style={styles.stateMsg}>{t('noGoalsMsg')}</Text>
              </Animated.View>
            ) : active.length === 0 ? null : (
              <>
                <Text style={styles.sectionTitle}>{t('myGoals')}</Text>
                {active.map((goal, index) => (
                  <Animated.View key={goal.id} entering={FadeInDown.delay(80 + index * 50).duration(450)}>
                    <GoalCard goal={goal} onPress={() => router.push(`/(app)/goal/${goal.id}`)} />
                  </Animated.View>
                ))}
              </>
            )}

            {archived.length > 0 && (
              <>
                <Pressable onPress={() => setShowArchived((v) => !v)} style={styles.archivedToggle}>
                  <Text style={styles.archivedToggleText}>
                    {t('archivedGoals')} ({archived.length}) {showArchived ? '▴' : '▾'}
                  </Text>
                </Pressable>
                {showArchived &&
                  archived.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} onPress={() => router.push(`/(app)/goal/${goal.id}`)} />
                  ))}
              </>
            )}
          </ScrollView>
        )}

        {goals !== null && (
          <View style={styles.footer}>
            <Button title={`＋  ${t('newGoal')}`} onPress={() => router.push('/(app)/goal-form')} />
          </View>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  greetingWrap: { flex: 1 },
  greeting: { ...typography.body, color: colors.textOnDarkMuted },
  name: { ...typography.display, fontSize: 26, color: colors.white, marginTop: 2 },
  profileButton: { padding: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 110 },
  summary: { borderRadius: radii.xl, padding: spacing.xxl, ...shadows.card },
  summaryLabel: {
    color: colors.textOnDarkMuted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  summaryEmpty: { ...typography.title, color: colors.white },
  secondaryAmount: { fontSize: 22, opacity: 0.9, marginTop: 2 },
  summaryMeta: { ...typography.caption, color: colors.textOnDarkMuted, marginTop: spacing.md },
  sectionTitle: { ...typography.title, color: colors.white, marginTop: spacing.xxl, marginBottom: spacing.md },
  empty: { alignItems: 'center', marginTop: spacing.xxxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  stateTitle: { ...typography.title, color: colors.white, textAlign: 'center', marginBottom: spacing.sm },
  stateMsg: { ...typography.body, color: colors.textOnDarkMuted, textAlign: 'center', lineHeight: 22 },
  archivedToggle: { paddingVertical: spacing.md, marginTop: spacing.sm },
  archivedToggleText: { ...typography.bodyStrong, color: colors.textOnDarkMuted },
  footer: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
});
