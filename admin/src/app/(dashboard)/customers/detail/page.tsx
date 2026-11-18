'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCustomer } from '@/hooks/use-customers';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { countryName, formatCents, formatDate, formatDateShort } from '@/lib/format';

/**
 * Ficha de una persona, como `?id=<uuid>` y no como segmento dinámico
 * (`/customers/[id]`).
 *
 * El panel se exporta como sitio estático (`output: 'export'`, ver
 * next.config.ts) para poder servirse desde el mismo proceso que la API. Un
 * export estático necesita conocer TODAS las rutas en tiempo de compilación
 * (`generateStaticParams`), y los ids de personas son datos de la base — no
 * existen hasta que alguien se registra. Con un query param no hay ninguna
 * ruta que generar de antemano: siempre es el mismo archivo
 * `customers/detail/index.html`, y `id` se lee del lado del cliente.
 */
export default function CustomerDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <CustomerDetailContent />
    </Suspense>
  );
}

function CustomerDetailContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { data: customer, isLoading, isError } = useCustomer(id);

  if (isLoading) return <DetailSkeleton />;

  if (isError || !customer) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-card">
        <p className="text-lg font-semibold text-brand-950">Persona no encontrada</p>
        <p className="mt-1 text-sm text-gray-500">Puede que haya eliminado su cuenta.</p>
        <Link href="/customers" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-600">
        ← Todas las personas
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={customer.fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{customer.fullName}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">{customer.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-card lg:col-span-1">
          <h2 className="font-semibold text-brand-950">Datos de la persona</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <Field label="País" value={countryName(customer.countryCode)} />
            <Field label="Teléfono" value={customer.phone} />
            <Field label="Fecha de nacimiento" value={formatDateShort(customer.birthDate)} />
            <Field label="Registrada" value={formatDate(customer.registeredAt)} />
            <Field label="Último acceso" value={formatDate(customer.lastLoginAt)} />
          </dl>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card lg:col-span-2">
          <h2 className="font-semibold text-brand-950">Metas ({customer.goals.length})</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Resumen de cada meta. El detalle de los aportes lo ve solo la propia persona en la app.
          </p>

          {customer.goals.length === 0 ? (
            <p className="mt-6 text-sm text-gray-400">Todavía no ha creado ninguna meta.</p>
          ) : (
            <ul className="mt-4 divide-y divide-surface-100">
              {customer.goals.map((goal) => {
                const saved = Number(goal.savedCents);
                const target = Number(goal.targetCents);
                const pct = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

                return (
                  <li key={goal.id} className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <p className="font-medium text-brand-950">
                        {goal.emoji ? `${goal.emoji} ` : ''}
                        {goal.name}
                        {goal.archived && (
                          <span className="ml-2 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Archivada
                          </span>
                        )}
                        {goal.completed && (
                          <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            Cumplida
                          </span>
                        )}
                      </p>
                      <p className="shrink-0 text-sm text-gray-500">{pct} %</p>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-100">
                      <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      {formatCents(goal.savedCents, goal.currency)} de{' '}
                      {formatCents(goal.targetCents, goal.currency)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-48 rounded-lg" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-brand-950">{value}</dd>
    </div>
  );
}
