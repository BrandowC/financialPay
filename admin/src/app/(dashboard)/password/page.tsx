'use client';

import { useState } from 'react';
import { useChangePassword } from '@/hooks/use-auth';
import { ApiError } from '@/lib/api-client';

/**
 * Cambio de contraseña del administrador.
 *
 * Pide la actual aunque la sesión ya esté abierta, y al terminar cierra todas
 * las sesiones: hay que volver a entrar con la clave nueva.
 */
export default function PasswordPage() {
  const change = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);

    if (next.length < 8) {
      setLocalError('La contraseña nueva debe tener al menos 8 caracteres.');
      return;
    }
    if (next !== confirm) {
      setLocalError('La confirmación no coincide con la contraseña nueva.');
      return;
    }

    change.mutate({ currentPassword: current, newPassword: next });
  }

  const serverError = change.error instanceof ApiError ? change.error.message : null;
  const error = localError ?? serverError;

  return (
    <div className="animate-fade-in max-w-lg">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Cambiar contraseña</h1>
        <p className="mt-1 text-sm text-gray-500">
          Al guardar se cierran todas las sesiones y entras de nuevo con la clave nueva.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-card">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <Field label="Contraseña actual" value={current} onChange={setCurrent} autoComplete="current-password" />
        <Field label="Contraseña nueva" value={next} onChange={setNext} autoComplete="new-password" />
        <Field label="Repite la contraseña nueva" value={confirm} onChange={setConfirm} autoComplete="new-password" />

        <button
          type="submit"
          disabled={change.isPending || !current || !next || !confirm}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {change.isPending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <input
        type="password"
        required
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-brand-950 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
    </div>
  );
}
