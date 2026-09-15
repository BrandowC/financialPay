'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useAdminLogout } from '@/hooks/use-auth';
import { Avatar } from './ui/Avatar';

const NAV = [
  { href: '/', label: 'Tablero', icon: DashboardIcon },
  { href: '/customers', label: 'Clientes', icon: CustomersIcon },
];

export function Sidebar() {
  const pathname = usePathname();
  const admin = useAuthStore((s) => s.admin);
  const logout = useAdminLogout();

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-surface-200 bg-white">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-700 to-brand-500 text-lg font-black text-gold">
          A
        </div>
        <div>
          <p className="text-sm font-extrabold tracking-wide text-brand-950">AM Cuenta</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-600">Panel admin</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-500/10 text-brand-700'
                  : 'text-gray-600 hover:bg-surface-100 hover:text-brand-900',
              )}
            >
              <item.icon className={clsx('h-5 w-5', active ? 'text-brand-600' : 'text-gray-400')} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {admin && (
        <div className="border-t border-surface-200 p-4">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <Avatar name={admin.fullName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-950">{admin.fullName}</p>
              <p className="truncate text-xs text-gray-500">{roleLabel(admin.role)}</p>
            </div>
          </div>
          <button
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-500 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
          >
            {logout.isPending ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
        </div>
      )}
    </aside>
  );
}

function roleLabel(role: string): string {
  return { SUPER_ADMIN: 'Super administrador', OPERATOR: 'Operador', VIEWER: 'Solo lectura' }[role] ?? role;
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6a2.25 2.25 0 0 1 2.25-2.25h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  );
}

function CustomersIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z"
      />
    </svg>
  );
}
