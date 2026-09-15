import clsx from 'clsx';

const STYLES: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  SUSPENDED: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  DELETED: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

const LABELS: Record<string, string> = {
  ACTIVE: 'Activa',
  SUSPENDED: 'Suspendida',
  DELETED: 'Eliminada',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        STYLES[status] ?? STYLES.DELETED,
      )}
    >
      <span
        className={clsx(
          'h-1.5 w-1.5 rounded-full',
          status === 'ACTIVE' ? 'bg-emerald-500' : status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-gray-400',
        )}
      />
      {LABELS[status] ?? status}
    </span>
  );
}
