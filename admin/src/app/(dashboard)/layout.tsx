import { AuthGuard } from '@/components/AuthGuard';
import { Sidebar } from '@/components/Sidebar';

/**
 * Grupo de rutas `(dashboard)`: todo lo que exige sesión de administrador.
 * El paréntesis en el nombre de carpeta es la convención de Next.js para
 * agrupar rutas sin que el segmento aparezca en la URL — así `/customers` no
 * se convierte en `/dashboard/customers`.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen overflow-hidden bg-surface-50">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
