'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useCustomers } from '@/hooks/use-customers';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useExportExcel } from '@/hooks/use-export';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { countryName, formatDateShort, timeAgo } from '@/lib/format';
import { toast } from '@/lib/toast-store';

const PAGE_SIZE = 20;

type SortColumn = 'registeredAt' | 'fullName' | 'goalsCount' | 'lastLoginAt';

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortColumn>('registeredAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [onlyWithGoals, setOnlyWithGoals] = useState(false);
  const [onlyWithoutGoals, setOnlyWithoutGoals] = useState(false);
  const [onlyToday, setOnlyToday] = useState(false);

  const debouncedSearch = useDebouncedValue(search);

  const { data, isLoading, isFetching } = useCustomers({
    search: debouncedSearch || undefined,
    page,
    pageSize: PAGE_SIZE,
    sortBy,
    sortDir,
    onlyWithGoals,
    onlyWithoutGoals,
    period: onlyToday ? 'today' : undefined,
  });

  const exportExcel = useExportExcel();

  function toggleSort(column: typeof sortBy) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
    setPage(1);
  }

  function handleExport() {
    exportExcel.mutate(undefined, {
      onSuccess: () => toast({ variant: 'success', title: 'Excel descargado' }),
      onError: () => toast({ variant: 'error', title: 'No se pudo generar el archivo' }),
    });
  }

  const customers = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="animate-fade-in">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-950">Personas</h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta ? `${meta.total.toLocaleString('es-CO')} persona(s) registrada(s)` : 'Cargando…'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleExport}
            disabled={exportExcel.isPending}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-brand-950 shadow-sm transition-colors hover:bg-surface-100 disabled:opacity-50"
          >
            {exportExcel.isPending ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
            ) : (
              <ExcelIcon className="h-4 w-4 text-emerald-600" />
            )}
            {exportExcel.isPending ? 'Generando…' : 'Descargar Excel'}
          </button>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[280px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre, correo o teléfono…"
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
        </div>

        <label className="flex select-none items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyWithGoals}
            onChange={(e) => {
              setOnlyWithGoals(e.target.checked);
              // Mutuamente excluyente con "Sin metas": ambos a la vez no
              // devolverían a nadie.
              if (e.target.checked) setOnlyWithoutGoals(false);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30"
          />
          Con metas
        </label>

        <label className="flex select-none items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyWithoutGoals}
            onChange={(e) => {
              setOnlyWithoutGoals(e.target.checked);
              if (e.target.checked) setOnlyWithGoals(false);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30"
          />
          Sin metas
        </label>

        <label className="flex select-none items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onlyToday}
            onChange={(e) => {
              setOnlyToday(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/30"
          />
          Registrados hoy
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-surface-200 text-xs uppercase tracking-wide text-gray-400">
                <SortableHeader label="Persona" column="fullName" current={sortBy} dir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3 font-medium">País</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <SortableHeader label="Metas" column="goalsCount" current={sortBy} dir={sortDir} onSort={toggleSort} align="right" />
                <SortableHeader label="Registro" column="registeredAt" current={sortBy} dir={sortDir} onSort={toggleSort} />
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="skeleton h-8 rounded-lg" />
                      </td>
                    </tr>
                  ))
                : customers.map((customer) => (
                    <tr
                      key={customer.userId}
                      className={`group cursor-pointer transition-colors hover:bg-surface-50 ${isFetching ? 'opacity-60' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <Link href={`/customers/detail?id=${customer.userId}`} className="flex items-center gap-3">
                          <Avatar name={customer.fullName} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-brand-950 group-hover:text-brand-600">
                              {customer.fullName}
                            </p>
                            <p className="truncate text-xs text-gray-400">{customer.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{countryName(customer.countryCode)}</td>
                      <td className="px-5 py-3 text-gray-600">{customer.phone}</td>
                      <td className="px-5 py-3 text-right font-semibold text-brand-950">
                        {customer.goalsCount}
                        {customer.completedGoalsCount > 0 && (
                          <span className="ml-1 text-xs font-medium text-emerald-600">
                            ({customer.completedGoalsCount} cumplida{customer.completedGoalsCount === 1 ? '' : 's'})
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-500" title={formatDateShort(customer.registeredAt)}>
                        {timeAgo(customer.registeredAt)}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={customer.status} />
                      </td>
                    </tr>
                  ))}

              {!isLoading && customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-gray-400">
                    No se encontraron personas{debouncedSearch ? ` para "${debouncedSearch}"` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-200 px-5 py-3">
            <p className="text-xs text-gray-400">
              Página {meta.page} de {meta.totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  current,
  dir,
  onSort,
  align = 'left',
}: {
  label: string;
  column: SortColumn;
  current: string;
  dir: 'asc' | 'desc';
  onSort: (c: SortColumn) => void;
  align?: 'left' | 'right';
}) {
  const active = current === column;

  return (
    <th className={`px-5 py-3 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      <button
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 hover:text-brand-600 ${active ? 'text-brand-600' : ''}`}
      >
        {label}
        {active && <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>}
      </button>
    </th>
  );
}

function SearchIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function ExcelIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m-7 5h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
