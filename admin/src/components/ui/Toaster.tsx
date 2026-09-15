'use client';

import clsx from 'clsx';
import { useToastStore } from '@/lib/toast-store';

const ICONS: Record<string, string> = { success: '✓', error: '!', info: 'i' };

const STYLES: Record<string, string> = {
  success: 'border-emerald-200 bg-white',
  error: 'border-rose-200 bg-white',
  info: 'border-blue-200 bg-white',
};

const ICON_STYLES: Record<string, string> = {
  success: 'bg-emerald-500 text-white',
  error: 'bg-rose-500 text-white',
  info: 'bg-blue-500 text-white',
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-full max-w-sm flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={clsx(
            'animate-slide-up pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-card',
            STYLES[toast.variant],
          )}
        >
          <span
            className={clsx(
              'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              ICON_STYLES[toast.variant],
            )}
          >
            {ICONS[toast.variant]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-brand-950">{toast.title}</p>
            {toast.description && (
              <p className="mt-0.5 text-sm text-gray-500">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
