import type { Goal } from './api';
import type { TranslationKey } from './i18n';
import { daysUntil, formatMoney } from './money';

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string;

/** Lo ahorrado en todas las metas, agrupado por moneda (no se suman monedas distintas). */
export function totalsByCurrency(goals: Goal[]): Array<{ currency: string; cents: string }> {
  const totals = new Map<string, bigint>();
  for (const goal of goals) {
    totals.set(goal.currency, (totals.get(goal.currency) ?? 0n) + BigInt(goal.savedCents));
  }
  return [...totals.entries()]
    .filter(([, cents]) => cents > 0n)
    .sort((a, b) => (b[1] > a[1] ? 1 : b[1] < a[1] ? -1 : 0))
    .map(([currency, cents]) => ({ currency, cents: cents.toString() }));
}

/** Lo que falta para llegar a la meta (centavos como texto; "0" si ya se cumplió). */
export function remainingCents(goal: Goal): string {
  const left = BigInt(goal.targetCents) - BigInt(goal.savedCents);
  return (left > 0n ? left : 0n).toString();
}

/** "Faltan 12 días", "Vence hoy", "Venció hace 3 días"; null si no hay fecha límite. */
export function deadlineLabel(goal: Goal, t: T): string | null {
  if (!goal.deadline || goal.completed) return null;
  const days = daysUntil(goal.deadline);
  if (days > 1) return t('daysLeft', { n: days });
  if (days === 1) return t('dayLeft');
  if (days === 0) return t('dueToday');
  return t('daysOverdue', { n: Math.abs(days) });
}

/** "Para llegar a tiempo: $200.000 por mes"; null si no aplica. */
export function monthlyHint(goal: Goal, t: T, locale: string): string | null {
  if (!goal.deadline || goal.completed) return null;
  const days = daysUntil(goal.deadline);
  if (days <= 0) return null;

  const months = Math.max(1, Math.ceil(days / 30));
  // Se redondea hacia arriba a unidades enteras de la moneda: "$285.715 por mes"
  // se lee y se recuerda mejor que "$285.714,29".
  const perMonth = Math.ceil(Number(remainingCents(goal)) / months / 100) * 100;
  if (perMonth <= 0) return null;

  return t('perMonthHint', { amount: formatMoney(String(perMonth), goal.currency, locale) });
}

/** Centavos como texto → "2500000" o "1500.5", para precargar un campo de monto. */
export function centsToInput(cents: string): string {
  const value = BigInt(cents);
  const whole = value / 100n;
  const fraction = value % 100n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(2, '0').replace(/0$/, '')}`;
}

/** Fecha AAAA-MM-DD a N meses desde hoy. */
export function monthsFromNow(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const GOAL_EMOJIS = ['✈️', '🏠', '🚗', '🏍️', '🎓', '💍', '🛟', '📱', '💻', '🎁', '🏖️', '🏥'];
