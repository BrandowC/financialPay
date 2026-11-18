import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GradientBackground } from '@/components/GradientBackground';
import { AnimatedAmount } from '@/components/ui/AnimatedAmount';
import { Button } from '@/components/ui/Button';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { TextField } from '@/components/ui/TextField';
import {
  addContribution,
  deleteContribution,
  deleteGoal,
  fetchGoal,
  updateGoal,
  type Contribution,
  type Goal,
} from '@/lib/api';
import { messageFor } from '@/lib/error-messages';
import { deadlineLabel, monthlyHint, remainingCents } from '@/lib/goal-utils';
import { useLanguage } from '@/lib/i18n';
import { formatDate, formatMoney, normalizeAmount } from '@/lib/money';
import { colors, radii, shadows, spacing, typography } from '@/lib/theme';

type MovementMode = 'deposit' | 'withdrawal' | null;

export default function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language, t } = useLanguage();

  const [goal, setGoal] = useState<Goal | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [failed, setFailed] = useState(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<MovementMode>(null);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const result = await fetchGoal(id);
      setGoal(result.goal);
      setContributions(result.contributions);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [id]);

  // También se recarga al volver de editar la meta.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openMovement(next: Exclude<MovementMode, null>) {
    setAmount('');
    setNote('');
    setFormError(null);
    setMode(next);
  }

  async function submitMovement() {
    if (!mode || !goal) return;

    const normalized = normalizeAmount(amount);
    if (!normalized) {
      setFormError(t('errAmount'));
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const result = await addContribution(goal.id, {
        amount: normalized,
        type: mode,
        note: note.trim() || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode(null);
      setGoal(result.goal);
      await load();
    } catch (err) {
      setFormError(messageFor(err, t));
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteMovement(item: Contribution) {
    Alert.alert(t('deleteMovement'), t('deleteMovementMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContribution(id, item.id);
            await load();
          } catch (err) {
            Alert.alert(t('deleteMovement'), messageFor(err, t));
          }
        },
      },
    ]);
  }

  function confirmDeleteGoal() {
    setMenuOpen(false);
    Alert.alert(t('deleteGoalTitle'), t('deleteGoalMsg'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGoal(id);
            router.back();
          } catch (err) {
            Alert.alert(t('deleteGoalTitle'), messageFor(err, t));
          }
        },
      },
    ]);
  }

  async function toggleArchive() {
    if (!goal) return;
    setMenuOpen(false);
    try {
      setGoal(await updateGoal(goal.id, { archived: !goal.archived }));
    } catch (err) {
      Alert.alert(t('archiveGoal'), messageFor(err, t));
    }
  }

  if (!goal) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <BackButton onPress={() => router.back()} />
          </View>
          <View style={styles.center}>
            {failed ? (
              <>
                <Text style={styles.stateTitle}>{t('loadErrorTitle')}</Text>
                <Button title={t('retry')} onPress={load} style={{ marginTop: spacing.xl, width: 180 }} />
              </>
            ) : (
              <ActivityIndicator size="large" color={colors.white} />
            )}
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  const percent = Math.floor(goal.progress * 100);
  const deadline = deadlineLabel(goal, t);
  const hint = monthlyHint(goal, t, language);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={12} accessibilityLabel="Menu">
            <Ionicons name="ellipsis-horizontal-circle-outline" size={30} color={colors.white} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(450)}>
            <LinearGradient
              colors={[colors.brand700, colors.brand500]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View style={styles.heroTop}>
                <Text style={styles.heroEmoji}>{goal.emoji || '🎯'}</Text>
                <Text style={styles.heroName} numberOfLines={2}>
                  {goal.name}
                </Text>
              </View>

              <Text style={styles.heroLabel}>{t('saved')}</Text>
              <AnimatedAmount cents={goal.savedCents} currency={goal.currency} />
              <Text style={styles.heroTarget}>
                {t('of')} {formatMoney(goal.targetCents, goal.currency, language)}
              </Text>

              <View style={styles.barWrap}>
                <ProgressBar progress={goal.progress} completed={goal.completed} height={14} />
              </View>

              <View style={styles.heroBottom}>
                <Text style={[styles.heroPercent, goal.completed && { color: colors.gold }]}>{percent}%</Text>
                <Text style={styles.heroRemaining}>
                  {goal.completed
                    ? t('goalReached')
                    : `${t('remaining')} ${formatMoney(remainingCents(goal), goal.currency, language)}`}
                </Text>
              </View>

              {deadline ? <Text style={styles.heroMeta}>{deadline}</Text> : null}
              {hint ? <Text style={styles.heroMeta}>{hint}</Text> : null}
            </LinearGradient>
          </Animated.View>

          <View style={styles.actions}>
            <View style={styles.actionCell}>
              <Button title={`＋  ${t('contribute')}`} onPress={() => openMovement('deposit')} />
            </View>
            <View style={styles.actionCell}>
              <Button
                title={`－  ${t('withdraw')}`}
                variant="secondary"
                onPress={() => openMovement('withdrawal')}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('history')}</Text>

          {contributions.length === 0 ? (
            <Text style={styles.empty}>{t('noHistory')}</Text>
          ) : (
            contributions.map((item) => {
              const isWithdrawal = item.amountCents.startsWith('-');
              const absolute = isWithdrawal ? item.amountCents.slice(1) : item.amountCents;
              return (
                <View key={item.id} style={styles.row}>
                  <View style={[styles.rowIcon, isWithdrawal ? styles.rowIconOut : styles.rowIconIn]}>
                    <Ionicons
                      name={isWithdrawal ? 'arrow-up' : 'arrow-down'}
                      size={18}
                      color={isWithdrawal ? colors.danger : colors.success}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle}>{isWithdrawal ? t('withdrawal') : t('deposit')}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {formatDate(item.madeOn, language)}
                      {item.note ? ` · ${item.note}` : ''}
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, isWithdrawal ? styles.out : styles.in]}>
                    {isWithdrawal ? '−' : '+'}
                    {formatMoney(absolute, goal.currency, language)}
                  </Text>
                  <Pressable onPress={() => confirmDeleteMovement(item)} hitSlop={10} style={styles.rowDelete}>
                    <Ionicons name="trash-outline" size={18} color={colors.textOnDarkFaint} />
                  </Pressable>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Menú de la meta */}
        <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
            <View style={styles.menu}>
              <MenuItem
                label={t('editGoal')}
                onPress={() => {
                  setMenuOpen(false);
                  router.push({ pathname: '/(app)/goal-form', params: { id: goal.id } });
                }}
              />
              <MenuItem label={goal.archived ? t('unarchiveGoal') : t('archiveGoal')} onPress={toggleArchive} />
              <MenuItem label={t('deleteGoal')} danger onPress={confirmDeleteGoal} />
            </View>
          </Pressable>
        </Modal>

        {/* Hoja para registrar un aporte o un retiro */}
        <Modal visible={mode !== null} transparent animationType="slide" onRequestClose={() => setMode(null)}>
          <KeyboardAvoidingView
            style={styles.sheetWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <Pressable style={styles.sheetBackdrop} onPress={() => setMode(null)} />
            <View style={styles.sheet}>
              <Text style={styles.sheetTitle}>{mode === 'withdrawal' ? t('withdrawal') : t('deposit')}</Text>

              {formError ? (
                <View style={styles.banner}>
                  <Text style={styles.bannerText}>{formError}</Text>
                </View>
              ) : null}

              <TextField
                label={`${t('amount')} (${goal.currency})`}
                placeholder="0"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(v) => {
                  setAmount(v);
                  setFormError(null);
                }}
                autoFocus
              />
              <TextField
                label={t('note')}
                placeholder={t('notePlaceholder')}
                value={note}
                maxLength={200}
                onChangeText={setNote}
              />

              <Button
                title={saving ? t('saving') : mode === 'withdrawal' ? t('addWithdrawal') : t('addDeposit')}
                onPress={submitMovement}
                loading={saving}
              />
              <Pressable onPress={() => setMode(null)} style={styles.sheetCancel}>
                <Text style={styles.sheetCancelText}>{t('cancel')}</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityLabel="Back">
      <Ionicons name="chevron-back" size={30} color={colors.white} />
    </Pressable>
  );
}

function MenuItem({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.menuItem}>
      <Text style={[styles.menuText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
  stateTitle: { ...typography.title, color: colors.white, textAlign: 'center' },
  hero: { borderRadius: radii.xl, padding: spacing.xxl, ...shadows.card },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  heroEmoji: { fontSize: 34 },
  heroName: { ...typography.title, color: colors.white, flex: 1 },
  heroLabel: {
    color: colors.textOnDarkMuted,
    fontSize: 13,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  heroTarget: { ...typography.body, color: colors.textOnDarkMuted, marginTop: 2 },
  barWrap: { marginTop: spacing.lg },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: spacing.sm },
  heroPercent: { ...typography.title, color: colors.white },
  heroRemaining: { ...typography.bodyStrong, color: colors.white },
  heroMeta: { ...typography.caption, color: colors.textOnDarkMuted, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  actionCell: { flex: 1 },
  sectionTitle: { ...typography.title, color: colors.white, marginTop: spacing.xxl, marginBottom: spacing.md },
  empty: { ...typography.body, color: colors.textOnDarkMuted, lineHeight: 22 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.glassFill,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowIconIn: { backgroundColor: 'rgba(34,197,94,0.16)' },
  rowIconOut: { backgroundColor: colors.dangerBg },
  rowBody: { flex: 1 },
  rowTitle: { ...typography.bodyStrong, color: colors.white, fontSize: 15 },
  rowSub: { ...typography.caption, color: colors.textOnDarkMuted, marginTop: 2 },
  rowAmount: { ...typography.bodyStrong, fontSize: 15 },
  in: { color: colors.success },
  out: { color: colors.danger },
  rowDelete: { paddingLeft: spacing.xs },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'flex-end', paddingTop: 90, paddingRight: spacing.lg },
  menu: { backgroundColor: colors.white, borderRadius: radii.md, minWidth: 210, overflow: 'hidden', ...shadows.card },
  menuItem: { paddingHorizontal: spacing.xl, paddingVertical: 15 },
  menuText: { ...typography.bodyStrong, color: colors.ink },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.midnight,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  sheetTitle: { ...typography.title, color: colors.white, marginBottom: spacing.lg },
  sheetCancel: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  sheetCancelText: { ...typography.bodyStrong, color: colors.textOnDarkMuted },
  banner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: '#FFD7D7', fontSize: 14, lineHeight: 20 },
});
