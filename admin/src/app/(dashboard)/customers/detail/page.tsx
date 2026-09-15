'use client';

import Link from 'next/link';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCustomer } from '@/hooks/use-customers';
import { BalanceEditor } from '@/components/BalanceEditor';
import { BalanceHistory } from '@/components/BalanceHistory';
import { Avatar } from '@/components/ui/Avatar';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate, formatDateShort } from '@/lib/format';

/**
 * Ficha de cliente, como `?id=<uuid>` y no como segmento dinámico
 * (`/customers/[id]`).
 *
 * El panel se exporta como sitio estático (`output: 'export'`, ver
 * next.config.ts) para poder servirse desde el mismo proceso que la API. Un
 * export estático necesita conocer TODAS las rutas en tiempo de compilación
 * (`generateStaticParams`), y los ids de cliente son datos de la base — no
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
        <p className="text-lg font-semibold text-brand-950">Cliente no encontrado</p>
        <p className="mt-1 text-sm text-gray-500">Puede que haya sido eliminado.</p>
        <Link href="/customers" className="mt-4 inline-block text-sm font-medium text-brand-600">
          ← Volver al listado
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <Link href="/customers" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-brand-600">
        ← Todos los clientes
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Avatar name={customer.fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-brand-950">{customer.fullName}</h1>
            <StatusBadge status={customer.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {customer.email} · Cuenta {customer.accountNumber}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <BalanceEditor customer={customer} />

          <div className="rounded-2xl bg-white p-6 shadow-card">
            <h2 className="font-semibold text-brand-950">Datos del cliente</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Field label="Teléfono" value={customer.phone} />
              <Field label="Fecha de nacimiento" value={formatDateShort(customer.birthDate)} />
              <Field label="Registrado" value={formatDate(customer.registeredAt)} />
              <Field label="Último acceso" value={formatDate(customer.lastLoginAt)} />
            </dl>
          </div>
        </div>

        <div className="lg:col-span-2">
          <BalanceHistory customerId={customer.userId} />
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
