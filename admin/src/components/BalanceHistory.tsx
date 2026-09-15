'use client';

import { useState } from 'react';
import { useCustomerHistory } from '@/hooks/use-customers';
import { formatDate, formatMoney } from '@/lib/format';

export function BalanceHistory({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const { data: entries, isLoading } = useCustomerHistory(customerId, page);

  return (
    <div className="rounded-2xl bg-white p-6 shadow-card">
      <h2 className="font-semibold text-brand-950">Historial de cambios</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        Cada cambio de saldo queda registrado por un disparador de la base de datos: es
        imposible modificar el saldo sin dejar rastro, incluso si alguien escribiera
        directamente en la base.
      </p>

      <div className="mt-4 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}

        {!isLoading && entries?.length === 0 && (
          <p className="rounded-lg bg-surface-100 px-4 py-6 text-center text-sm text-gray-400">
            Todavía no hay cambios registrados para este cliente.
          </p>
        )}

        {entries?.map((entry) => {
          const delta = BigInt(entry.delta);
          const increased = delta > 0n;

          return (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-surface-100 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-brand-950">
                  {formatMoney(entry.previous)} → {formatMoney(entry.current)}
                </p>
                {entry.reason && <p className="mt-0.5 truncate text-xs text-gray-500">{entry.reason}</p>}
                <p className="mt-1 text-xs text-gray-400">
                  {entry.changedBy ?? 'Sistema'} · {formatDate(entry.at)}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  increased ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}
              >
                {increased ? '+' : ''}
                {(Number(delta) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          );
        })}
      </div>

      {entries && entries.length > 0 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={entries.length < 15}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
