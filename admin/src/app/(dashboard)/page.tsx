'use client';

import Link from 'next/link';
import { useDashboardStats } from '@/hooks/use-customers';
import { StatCard } from '@/components/ui/StatCard';

export default function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  return (
    <div className="animate-fade-in">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-brand-950">Tablero</h1>
        <p className="mt-1 text-sm text-gray-500">Resumen general de AM Cuenta en tiempo real</p>
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
              label="Clientes registrados"
              value={stats.totalCustomers.toLocaleString('es-CO')}
              hint={`+${stats.registeredToday} hoy`}
              tone="brand"
            />
            <StatCard
              label="Saldo total administrado"
              value={stats.totalBalance.formatted}
              hint={`${stats.customersWithBalance} clientes con saldo`}
            />
            <StatCard
              label="Registros este mes"
              value={stats.registeredThisMonth.toLocaleString('es-CO')}
              hint="Comparado con el mes anterior próximamente"
            />
            <StatCard
              label="Sincronización a Excel"
              value={stats.pendingSyncEvents === 0 ? 'Al día' : `${stats.pendingSyncEvents} pendientes`}
              hint={stats.deadSyncEvents > 0 ? `${stats.deadSyncEvents} requieren revisión` : 'Sin incidencias'}
              tone={stats.deadSyncEvents > 0 ? 'danger' : stats.pendingSyncEvents > 0 ? 'warning' : 'default'}
            />
          </div>

          <div className="mt-8 rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-brand-950">Acciones rápidas</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  Busca un cliente y actualiza su saldo, o revisa el listado completo.
                </p>
              </div>
              <Link
                href="/customers"
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
              >
                Ver clientes →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
