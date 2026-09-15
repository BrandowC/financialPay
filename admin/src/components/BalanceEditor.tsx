'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { useUpdateBalance } from '@/hooks/use-customers';
import { formatMoney, sanitizeAmountInput } from '@/lib/format';
import { toast } from '@/lib/toast-store';
import { CustomerListItemDto } from '@/lib/types';

interface Props {
  customer: CustomerListItemDto;
}

/**
 * Editor del saldo — la operación más sensible de todo el panel.
 *
 * ── El conflicto de versión, explicado para quien lo use ────────────────────
 * Este formulario manda `expectedVersion` (la versión que tenía en pantalla) en
 * cada guardado. Si la API responde 409, significa que OTRO administrador ya
 * cambió este mismo saldo entre que esta pantalla se cargó y que se pulsó
 * "Guardar". En vez de fallar con un error genérico, se muestra el valor
 * ACTUAL (que vino en el error) y se ofrece recargar — nunca se reintenta el
 * guardado a ciegas, porque eso sería exactamente el "última escritura gana"
 * que el bloqueo optimista existe para evitar.
 */
export function BalanceEditor({ customer }: Props) {
  const role = useAuthStore((s) => s.admin?.role);
  const canEdit = role === 'SUPER_ADMIN' || role === 'OPERATOR';

  const [amount, setAmount] = useState(customer.balance.decimal);
  const [reason, setReason] = useState('');
  const [hasConflict, setHasConflict] = useState(false);

  const updateBalance = useUpdateBalance();
  const queryClient = useQueryClient();

  // Si la ficha se recarga desde fuera (React Query invalidó tras un guardado
  // exitoso en otra pestaña, por ejemplo), el campo sigue el valor del servidor
  // mientras el administrador no esté escribiendo activamente.
  useEffect(() => {
    if (!updateBalance.isPending) {
      setAmount(customer.balance.decimal);
      setHasConflict(false);
    }
  }, [customer.balance.decimal, customer.balanceVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasChanges = amount !== customer.balance.decimal;
  const parsedPreview = /^\d+(\.\d{1,2})?$/.test(amount) ? formatMoney(amount) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHasConflict(false);

    updateBalance.mutate(
      { customerId: customer.userId, amount, expectedVersion: customer.balanceVersion, reason: reason || undefined },
      {
        onSuccess: (result) => {
          setReason('');
          toast({
            variant: 'success',
            title: result.changed ? 'Saldo actualizado' : 'Sin cambios',
            description: result.changed ? `Nuevo saldo: ${result.formatted}` : 'El valor ya era ese.',
          });
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'BALANCE_VERSION_CONFLICT') {
            setHasConflict(true);

            // La versión y el monto que este formulario tenía ya están
            // obsoletos. Se fuerza a traer el estado real del servidor —
            // NUNCA se reintenta el guardado a ciegas con el valor anterior,
            // porque eso sería exactamente el "última escritura gana" que el
            // bloqueo optimista existe para evitar.
            queryClient.invalidateQueries({ queryKey: ['customer', customer.userId] });

            toast({
              variant: 'error',
              title: 'Otro administrador ya guardó un cambio',
              description: 'Se actualizó la ficha con el valor más reciente.',
            });
            return;
          }

          toast({
            variant: 'error',
            title: 'No se pudo actualizar el saldo',
            description: error instanceof ApiError ? error.message : undefined,
          });
        },
      },
    );
  }

  if (!canEdit) {
    return (
      <div className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="font-semibold text-brand-950">Saldo actual</h2>
        <p className="mt-3 text-3xl font-bold text-brand-950">{customer.balance.formatted}</p>
        <p className="mt-3 rounded-lg bg-surface-100 px-3 py-2 text-xs text-gray-500">
          Tu rol es de solo lectura. Un administrador u operador puede modificar este valor.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-950">Editar saldo</h2>
        <span className="rounded-full bg-surface-100 px-2.5 py-1 text-xs font-medium text-gray-500">
          v{customer.balanceVersion}
        </span>
      </div>

      {hasConflict && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Este cliente cambió mientras editabas. Ya se cargó el valor más reciente arriba —
          revísalo antes de volver a guardar.
        </div>
      )}

      <div className="mt-4">
        <label htmlFor="amount" className="mb-1.5 block text-sm font-medium text-gray-700">
          Nuevo valor
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
            $
          </span>
          <input
            id="amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
            className="w-full rounded-lg border border-gray-300 py-2.5 pl-7 pr-16 text-lg font-semibold text-brand-950 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="0.00"
          />
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-400">
            {customer.balance.currency}
          </span>
        </div>
        {parsedPreview && hasChanges && (
          <p className="mt-1.5 text-xs text-gray-400">Se guardará como {parsedPreview}</p>
        )}
      </div>

      <div className="mt-4">
        <label htmlFor="reason" className="mb-1.5 block text-sm font-medium text-gray-700">
          Motivo <span className="font-normal text-gray-400">(opcional, queda en el historial)</span>
        </label>
        <input
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          placeholder="Ej: Ajuste mensual autorizado"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <button
        type="submit"
        disabled={!hasChanges || updateBalance.isPending || !amount}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {updateBalance.isPending && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {updateBalance.isPending ? 'Guardando…' : 'Guardar cambio'}
      </button>
    </form>
  );
}
