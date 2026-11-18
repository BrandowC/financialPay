import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GradientBackground } from '@/components/GradientBackground';
import { Select, type SelectOption } from '@/components/Select';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { createGoal, fetchGoal, updateGoal } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { suggestedCurrency } from '@/lib/countries';
import { messageFor } from '@/lib/error-messages';
import { centsToInput, GOAL_EMOJIS, monthsFromNow } from '@/lib/goal-utils';
import { useT, type TranslationKey } from '@/lib/i18n';
import { CURRENCIES, formatDate, normalizeAmount } from '@/lib/money';
import { colors, radii, spacing, typography } from '@/lib/theme';

type DeadlineChoice = 'none' | '3m' | '6m' | '1y' | '2y' | 'keep';

const DEADLINE_CHOICES: Array<{ key: Exclude<DeadlineChoice, 'keep'>; label: TranslationKey; months: number }> = [
  { key: 'none', label: 'deadlineNone', months: 0 },
  { key: '3m', label: 'deadline3m', months: 3 },
  { key: '6m', label: 'deadline6m', months: 6 },
  { key: '1y', label: 'deadline1y', months: 12 },
  { key: '2y', label: 'deadline2y', months: 24 },
];

const CURRENCY_OPTIONS: SelectOption[] = CURRENCIES.map((c) => ({ value: c, label: c }));

/** Crear una meta, o editar una existente si llega `?id=`. */
export default function GoalFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const t = useT();
  const { profile } = useAuth();
  const editing = !!id;

  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(GOAL_EMOJIS[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>(suggestedCurrency(profile?.countryCode));
  const [deadline, setDeadline] = useState<DeadlineChoice>('none');
  const [existingDeadline, setExistingDeadline] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; amount?: string; general?: string }>({});

  useEffect(() => {
    if (!id) return;
    fetchGoal(id)
      .then(({ goal }) => {
        setName(goal.name);
        setEmoji(goal.emoji || GOAL_EMOJIS[0]);
        setAmount(centsToInput(goal.targetCents));
        setCurrency(goal.currency);
        if (goal.deadline) {
          setExistingDeadline(goal.deadline);
          setDeadline('keep');
        }
      })
      .catch((err) => setErrors({ general: messageFor(err, t) }))
      .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function deadlineValue(): string | null {
    if (deadline === 'none') return null;
    if (deadline === 'keep') return existingDeadline;
    const choice = DEADLINE_CHOICES.find((c) => c.key === deadline);
    return choice ? monthsFromNow(choice.months) : null;
  }

  async function handleSave() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = t('errGoalName');
    const normalized = normalizeAmount(amount);
    if (!normalized) next.amount = t('errAmount');

    if (next.name || next.amount) {
      setErrors(next);
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      if (editing && id) {
        await updateGoal(id, {
          name: name.trim(),
          emoji,
          targetAmount: normalized!,
          deadline: deadlineValue(),
        });
        router.back();
      } else {
        const goal = await createGoal({
          name: name.trim(),
          emoji,
          targetAmount: normalized!,
          currency,
          deadline: deadlineValue() ?? undefined,
        });
        router.replace(`/(app)/goal/${goal.id}`);
      }
    } catch (err) {
      console.warn('[Metas] save goal error:', err);
      setErrors({ general: messageFor(err, t) });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <GradientBackground>
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color={colors.white} />
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.headerAction}>{t('cancel')}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{editing ? t('goalFormEditTitle') : t('goalFormNewTitle')}</Text>
            <View style={{ width: 70 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {errors.general ? (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>{errors.general}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>{t('goalIcon')}</Text>
            <View style={styles.emojiRow}>
              {GOAL_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[styles.emojiChip, emoji === e && styles.emojiChipActive]}
                >
                  <Text style={styles.emoji}>{e}</Text>
                </Pressable>
              ))}
            </View>

            <TextField
              label={t('goalName')}
              placeholder={t('goalNamePlaceholder')}
              value={name}
              maxLength={80}
              onChangeText={(v) => {
                setName(v);
                if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
              }}
              error={errors.name}
            />

            <View style={styles.amountRow}>
              <View style={styles.amountField}>
                <TextField
                  label={t('goalTarget')}
                  placeholder={t('goalTargetPlaceholder')}
                  keyboardType="decimal-pad"
                  value={amount}
                  onChangeText={(v) => {
                    setAmount(v);
                    if (errors.amount) setErrors((p) => ({ ...p, amount: undefined }));
                  }}
                  error={errors.amount}
                />
              </View>
              <View style={styles.currencyField}>
                <Text style={styles.label}>{t('goalCurrency')}</Text>
                {editing ? (
                  <View style={styles.currencyLocked}>
                    <Text style={styles.currencyLockedText}>{currency}</Text>
                  </View>
                ) : (
                  <Select
                    value={currency}
                    options={CURRENCY_OPTIONS}
                    placeholder={currency}
                    title={t('goalCurrency')}
                    onChange={setCurrency}
                  />
                )}
              </View>
            </View>
            {editing ? <Text style={styles.hint}>{t('goalCurrencyLocked')}</Text> : null}

            <Text style={[styles.label, { marginTop: spacing.lg }]}>{t('goalDeadline')}</Text>
            <View style={styles.chipsRow}>
              {existingDeadline ? (
                <Pressable
                  onPress={() => setDeadline('keep')}
                  style={[styles.chip, deadline === 'keep' && styles.chipActive]}
                >
                  <Text style={[styles.chipText, deadline === 'keep' && styles.chipTextActive]}>
                    {t('deadlineKeep')}: {formatDate(existingDeadline)}
                  </Text>
                </Pressable>
              ) : null}
              {DEADLINE_CHOICES.map((choice) => (
                <Pressable
                  key={choice.key}
                  onPress={() => setDeadline(choice.key)}
                  style={[styles.chip, deadline === choice.key && styles.chipActive]}
                >
                  <Text style={[styles.chipText, deadline === choice.key && styles.chipTextActive]}>
                    {t(choice.label)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Button
              title={saving ? t('saving') : editing ? t('saveChanges') : t('saveGoal')}
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: spacing.xxl }}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { ...typography.title, color: colors.white },
  headerAction: { ...typography.bodyStrong, color: colors.gold, width: 70 },
  content: { padding: spacing.xl, paddingBottom: 48 },
  label: { ...typography.label, color: colors.textOnDarkMuted, marginBottom: spacing.sm },
  hint: { ...typography.caption, color: colors.textOnDarkFaint, marginTop: -spacing.sm },
  banner: {
    backgroundColor: colors.dangerBg,
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  bannerText: { color: '#FFD7D7', fontSize: 14, lineHeight: 20 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.glassFill,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipActive: { borderColor: colors.gold, backgroundColor: colors.glassFillStrong },
  emoji: { fontSize: 24 },
  amountRow: { flexDirection: 'row', gap: spacing.md },
  amountField: { flex: 1 },
  currencyField: { width: 110 },
  currencyLocked: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.glassFillStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyLockedText: { ...typography.bodyStrong, color: colors.white },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.glassFill,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { borderColor: colors.gold, backgroundColor: colors.glassFillStrong },
  chipText: { ...typography.label, color: colors.textOnDarkMuted },
  chipTextActive: { color: colors.white },
});
