import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { CustomerDetailDto, CustomerListItemDto, DashboardStatsDto } from '@/lib/types';

export interface CustomerListParams {
  search?: string;
  page: number;
  pageSize: number;
  sortBy: 'registeredAt' | 'fullName' | 'goalsCount' | 'lastLoginAt';
  sortDir: 'asc' | 'desc';
  /** Solo personas que ya crearon al menos una meta. */
  onlyWithGoals?: boolean;
  /** Solo personas que todavía no crearon ninguna. */
  onlyWithoutGoals?: boolean;
  /** Atajo para "solo quienes se registraron hoy". */
  period?: 'today';
}

function buildQuery(params: CustomerListParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set('search', params.search);
  q.set('page', String(params.page));
  q.set('pageSize', String(params.pageSize));
  q.set('sortBy', params.sortBy);
  q.set('sortDir', params.sortDir);
  if (params.onlyWithGoals) q.set('onlyWithGoals', 'true');
  if (params.onlyWithoutGoals) q.set('onlyWithoutGoals', 'true');
  if (params.period) q.set('period', params.period);
  return q.toString();
}

/**
 * Lista de personas registradas.
 *
 * `placeholderData` evita el parpadeo de "cargando…" al cambiar de página o al
 * escribir en el buscador: la tabla mantiene los datos anteriores visibles
 * hasta que llega la respuesta nueva.
 */
export function useCustomers(params: CustomerListParams) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => api.getPaged<CustomerListItemDto[]>(`/admin/customers?${buildQuery(params)}`),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<CustomerDetailDto>(`/admin/customers/${id}`),
    enabled: !!id,
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStatsDto>('/admin/dashboard'),
    // Se refresca cada 30s sola: el tablero se siente vivo sin que el
    // administrador tenga que recargar la página a mano.
    refetchInterval: 30_000,
  });
}
