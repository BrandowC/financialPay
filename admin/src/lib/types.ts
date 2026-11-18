/** Formas de datos que la API devuelve. Deben reflejar exactamente los DTOs
 *  de salida del backend (ver admin.controller.ts y customer-query.service.ts). */

export interface CustomerListItemDto {
  userId: string;
  fullName: string;
  email: string;
  /** País de residencia (ISO). Nulo en las cuentas anteriores a Metas. */
  countryCode: string | null;
  phone: string;
  birthDate: string;
  registeredAt: string;
  lastLoginAt: string | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  goalsCount: number;
  completedGoalsCount: number;
}

export interface CustomerGoalDto {
  id: string;
  name: string;
  emoji: string | null;
  currency: string;
  /** Centavos como texto. */
  targetCents: string;
  savedCents: string;
  completed: boolean;
  archived: boolean;
  createdAt: string;
}

export interface CustomerDetailDto extends CustomerListItemDto {
  goals: CustomerGoalDto[];
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
  customersWithGoals: number;
  totalGoals: number;
  completedGoals: number;
  /** Lo ahorrado por moneda: sumar monedas distintas no tiene sentido. */
  savedByCurrency: Array<{ currency: string; savedCents: string; goals: number }>;
  byCountry: Array<{ countryCode: string | null; customers: number }>;
}

export interface AdminSessionDto {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
}
