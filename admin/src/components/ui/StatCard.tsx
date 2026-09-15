import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'brand' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

const TONES: Record<string, string> = {
  default: 'bg-white',
  brand: 'bg-gradient-to-br from-brand-700 to-brand-500 text-white',
  warning: 'bg-white ring-1 ring-amber-200',
  danger: 'bg-white ring-1 ring-rose-200',
};

export function StatCard({ label, value, hint, tone = 'default', icon }: StatCardProps) {
  const isBrand = tone === 'brand';

  return (
    <div className={clsx('rounded-2xl p-5 shadow-card transition-shadow hover:shadow-card-hover', TONES[tone])}>
      <div className="flex items-start justify-between">
        <p className={clsx('text-sm font-medium', isBrand ? 'text-white/80' : 'text-gray-500')}>{label}</p>
        {icon && (
          <div className={clsx('rounded-lg p-1.5', isBrand ? 'bg-white/15' : 'bg-surface-100')}>{icon}</div>
        )}
      </div>
      <p className={clsx('mt-2 text-2xl font-bold tracking-tight', isBrand ? 'text-white' : 'text-brand-950')}>
        {value}
      </p>
      {hint && (
        <p
          className={clsx(
            'mt-1 text-xs font-medium',
            isBrand ? 'text-white/70' : tone === 'danger' ? 'text-rose-600' : tone === 'warning' ? 'text-amber-600' : 'text-gray-400',
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}
