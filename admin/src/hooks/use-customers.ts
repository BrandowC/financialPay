import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api-client';
import { BalanceHistoryEntryDto, CustomerListItemDto, DashboardStatsDto } from '@/lib/types';

export interface CustomerListParams {
  search?: string;
  page: number;
  pageSize: number;
  sortBy: 'registeredAt' | 'fullName' | 'amountCents';
  sortDir: 'asc' | 'desc';
  onlyWithBalance?: boolean;
  /** Solo clientes con saldo en cero. */
  onlyWithoutBalance?: boolean;
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
  if (params.onlyWithBalance) q.set('onlyWithBalance', 'true');
  if (params.onlyWithoutBalance) q.set('onlyWithoutBalance', 'true');
  if (params.period) q.set('period', params.period);
  return q.toString();
}

/**
 * Lista de clientes.
 *
 * `placeholderData` evita el parpadeo de "cargando…" al cambiar de página o al
 * escribir en el buscador: la tabla mantiene los datos anteriores visibles
 * hasta que llega la respuesta nueva. Sin esto, cada tecleo en el buscador
 * provocaría un parpadeo completo de la tabla, que se siente tosco.
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
    queryFn: () => api.get<CustomerListItemDto>(`/admin/customers/${id}`),
    enabled: !!id,
  });
}

export function useCustomerHistory(id: string | null, page: number, pageSize = 15) {
  return useQuery({
    queryKey: ['customer-history', id, page, pageSize],
    queryFn: () =>
      api.get<BalanceHistoryEntryDto[]>(
        `/admin/customers/${id}/history?page=${page}&pageSize=${pageSize}`,
      ),
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

interface UpdateBalanceVariables {
  customerId: string;
  amount: string;
  expectedVersion: number;
  reason?: string;
}

export interface UpdateBalanceResult {
  changed: boolean;
  previous: string;
  current: string;
  formatted: string;
  version: number;
  updatedAt: string;
}

export function useUpdateBalance() {
  const queryClient = useQueryClient();

  return useMutation<UpdateBalanceResult, ApiError, UpdateBalanceVariables>({
    mutationFn: ({ customerId, ...body }) =>
      api.patch<UpdateBalanceResult>(`/admin/customers/${customerId}/balance`, body),

    onSuccess: (_, variables) => {
      // Se invalida en vez de escribir el caché a mano: así la próxima
      // lectura trae el estado real del servidor, versión incluida, y el
      // formulario no puede quedar desincronizado del backend.
      queryClient.invalidateQueries({ queryKey: ['customer', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer-history', variables.customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
