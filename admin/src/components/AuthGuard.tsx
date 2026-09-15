'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminMe } from '@/hooks/use-session';

/**
 * Protección de rutas del lado del cliente.
 *
 * ── Por qué esto NO es la seguridad real ────────────────────────────────────
 * Este componente evita que la pantalla PARPADEE con datos antes de redirigir,
 * nada más. Cualquiera puede abrir las herramientas de desarrollo y saltárselo.
 * La seguridad de verdad está en la API: cada endpoint de `/admin/*` exige un
 * token válido (cookie httpOnly) con el tipo de principal ADMIN (`AuthGuard` +
 * `@RequireAdmin()` del backend), y sin eso el servidor devuelve 401 sin
 * importar lo que el navegador muestre. Este guard es exclusivamente
 * experiencia de usuario.
 *
 * ── Por qué depende de `/admin/auth/me` y no de un store persistido ─────────
 * La cookie de sesión es httpOnly: JavaScript no puede leerla para decidir de
 * entrada si hay sesión. Así que en vez de esperar una hidratación de
 * localStorage (como antes), se le pregunta a la API. Mientras la respuesta no
 * llega se muestra un loader — igual que antes, solo que la fuente de verdad
 * cambió de "el navegador" a "el servidor".
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: admin, isLoading, isError } = useAdminMe();

  useEffect(() => {
    if (!isLoading && (isError || !admin)) {
      router.replace('/login');
    }
  }, [isLoading, isError, admin, router]);

  if (isLoading || isError || !admin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      </div>
    );
  }

  return <>{children}</>;
}
