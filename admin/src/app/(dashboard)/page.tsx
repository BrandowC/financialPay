'use client';

import Link from 'next/link';
import { useDashboardStats } from '@/hooks/use-customers';
import { StatCard } from '@/components/ui/StatCard';
import { countryName, formatCents } from '@/lib/format';

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Tablero</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen general de Metas en tiempo real</p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
      ) : stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Personas registradas"
              value={stats.totalCustomers.toLocaleString('es-CO')}
              hint={`+${stats.registeredToday} hoy`}
              tone="brand"
            />
            <StatCard
              label="Registros este mes"
              value={stats.registeredThisMonth.toLocaleString('es-CO')}
            />
            <StatCard
              label="Metas creadas"
              value={stats.totalGoals.toLocaleString('es-CO')}
              hint={`${stats.customersWithGoals} personas con al menos una meta`}
            />
            <StatCard
              label="Metas cumplidas"
              value={stats.completedGoals.toLocaleString('es-CO')}
              hint={
                stats.totalGoals > 0
                  ? `${Math.round((stats.completedGoals / stats.totalGoals) * 100)} % del total`
                  : 'Aún no hay metas'
              }
            />
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="font-semibold text-brand-950">Ahorrado por moneda</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Cada moneda va por separado: no se suman pesos con dólares.
              </p>
              {stats.savedByCurrency.length === 0 ? (
                <p className="mt-6 text-sm text-gray-400">Todavía nadie ha registrado aportes.</p>
              ) : (
                <ul className="mt-4 divide-y divide-surface-100">
                  {stats.savedByCurrency.map((row) => (
                    <li key={row.currency} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-gray-500">
                        {row.currency} · {row.goals} meta(s)
                      </span>
                      <span className="font-semibold text-brand-950">
                        {formatCents(row.savedCents, row.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-card">
              <h2 className="font-semibold text-brand-950">Personas por país</h2>
              <p className="mt-0.5 text-sm text-gray-500">Los 8 países con más registros.</p>
              {stats.byCountry.length === 0 ? (
                <p className="mt-6 text-sm text-gray-400">Aún no hay registros.</p>
              ) : (
                <ul className="mt-4 divide-y divide-surface-100">
                  {stats.byCountry.map((row) => (
                    <li key={row.countryCode ?? 'none'} className="flex items-center justify-between py-3 text-sm">
                      <span className="text-gray-600">{countryName(row.countryCode)}</span>
                      <span className="font-semibold text-brand-950">{row.customers.toLocaleString('es-CO')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-brand-950">Acciones rápidas</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Busca a una persona o descarga el listado completo en Excel.
                </p>
              </div>
              <Link
                href="/customers"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Ver personas →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
