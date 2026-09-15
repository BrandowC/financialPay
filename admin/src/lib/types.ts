/** Formas de datos que la API devuelve. Deben reflejar exactamente los DTOs
 *  de salida del backend (ver admin.controller.ts y customer-query.service.ts). */

export interface MoneyDto {
  cents: string;
  decimal: string;
  formatted: string;
  currency: string;
}

export interface CustomerListItemDto {
  userId: string;
  fullName: string;
  email: string;
  accountNumber: string;
  phone: string;
  birthDate: string;
  registeredAt: string;
  lastLoginAt: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  balance: MoneyDto;
  balanceVersion: number;
  balanceUpdatedAt: string | null;
}

export interface PagedMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface DashboardStatsDto {
  totalCustomers: number;
  registeredToday: number;
  registeredThisMonth: number;
  totalBalance: { decimal: string; formatted: string };
  customersWithBalance: number;
  pendingSyncEvents: number;
  deadSyncEvents: number;
}

export interface BalanceHistoryEntryDto {
  id: string;
  previous: string;
  current: string;
  delta: string;
  changedBy: string | null;
  reason: string | null;
  at: string;
}

export interface AdminSessionDto {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
}
