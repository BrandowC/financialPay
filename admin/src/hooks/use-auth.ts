import { useMutation } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { AdminSessionDto } from '@/lib/types';

interface LoginResponse {
  admin: AdminSessionDto;
}

export function useAdminLogin() {
  const setAdmin = useAuthStore((s) => s.setAdmin);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<LoginResponse, ApiError, { email: string; password: string }>({
    mutationFn: (credentials) =>
      api.post<LoginResponse>('/admin/auth/login', credentials, { skipAuthRetry: true }),

    onSuccess: (data) => {
      setAdmin(data.admin);
      // La sesión ahora vive en cookies httpOnly, no en el store persistido:
      // se refresca la caché de `useAdminMe` para que quede consistente con
      // lo que la API acaba de confirmar, sin esperar a la próxima recarga.
      queryClient.setQueryData(['admin-me'], data.admin);
      router.replace('/');
    },
  });
}

export function useAdminLogout() {
  const clear = useAuthStore((s) => s.clear);
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async () => {
      // Best-effort: si falla (red caída, cookie ya vencida), igual se cierra
      // la sesión localmente. Al usuario no le sirve de nada quedarse
      // atrapado en el panel porque el logout del servidor no respondió.
      await api.post('/admin/auth/logout').catch(() => undefined);
    },
    onSettled: () => {
      clear();
      queryClient.setQueryData(['admin-me'], null);
      router.replace('/login');
    },
  });
}
