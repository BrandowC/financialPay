import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { AdminSessionDto } from '@/lib/types';

/**
 * "¿Quién soy?" — la única forma de saber si hay sesión al cargar la página.
 *
 * Las cookies de sesión son httpOnly a propósito (ver auth-store.ts), así que
 * JavaScript no puede leerlas para decidir si el admin sigue logueado. Este
 * hook se lo pregunta directamente a la API: si la cookie es válida (o el
 * refresh automático del cliente HTTP la renueva), responde con los datos del
 * admin; si no, `AuthGuard` interpreta el error como "no hay sesión".
 */
export function useAdminMe() {
  const setAdmin = useAuthStore((s) => s.setAdmin);

  const query = useQuery<AdminSessionDto>({
    queryKey: ['admin-me'],
    queryFn: () => api.get<AdminSessionDto>('/admin/auth/me'),
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (query.data) setAdmin(query.data);
  }, [query.data, setAdmin]);

  return query;
}
