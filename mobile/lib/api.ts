import Constants from 'expo-constants';
import { secureStorage } from './secure-storage';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };

const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? extra.apiUrl ?? 'http://localhost:3000/api/v1';

if (__DEV__ && API_URL.includes('localhost')) {
  console.warn(
    '[AMCuenta] EXPO_PUBLIC_API_URL apunta a localhost. Desde un dispositivo físico ' +
      'o un emulador eso no resuelve a tu máquina: usa tu IP de red local (ej. ' +
      'http://192.168.1.10:3000/api/v1) o revisa README.md.',
  );
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiError) return err.status === 0;
  const msg = typeof err === 'string' ? err : (err as { message?: string })?.message ?? '';
  return /network|timed out|timeout|abort|fetch|failed to fetch/i.test(msg);
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Access token en memoria pura — nunca en disco. Ver el porqué en
 * `secure-storage.ts`. Se expone un getter/setter simple porque este módulo
 * (no un componente React) es quien orquesta la renovación automática.
 */
let inMemoryAccessToken: string | null = null;
export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}
export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

/** Se notifica a `AuthProvider` cuando la sesión deja de ser recuperable, para
 *  que limpie su estado y la app vuelva a la pantalla de bienvenida. */
type SessionExpiredListener = () => void;
let onSessionExpired: SessionExpiredListener | null = null;
export function setSessionExpiredListener(listener: SessionExpiredListener | null): void {
  onSessionExpired = listener;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Igual que en el panel administrativo: una sola promesa de refresco
 * compartida, para que peticiones simultáneas (la pantalla de cuenta pidiendo
 * el perfil y el saldo a la vez, por ejemplo) no disparen dos renovaciones y
 * arriesguen que el servidor detecte "reuso" de un refresh token que en
 * realidad se estaba usando de forma legítima.
 */
let refreshPromise: Promise<string> | null = null;

async function performRefresh(): Promise<string> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) throw new ApiError('No hay sesión', 401, 'NO_SESSION');

  const response = await fetchWithTimeout(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    await secureStorage.clearRefreshToken();
    setAccessToken(null);
    onSessionExpired?.();
    throw new ApiError('Tu sesión expiró', 401, 'SESSION_EXPIRED');
  }

  const body = await response.json();
  const tokens = body.data as Tokens;

  setAccessToken(tokens.accessToken);
  await secureStorage.setRefreshToken(tokens.refreshToken);

  return tokens.accessToken;
}

function refreshAccessToken(): Promise<string> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function fetchWithTimeout(input: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** Evita el reintento automático (lo usa el propio login/registro). */
  skipAuthRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, skipAuthRetry } = options;

  const doFetch = () =>
    fetchWithTimeout(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && inMemoryAccessToken ? { Authorization: `Bearer ${inMemoryAccessToken}` } : {}),
        // El plan gratuito de ngrok intercepta la primera visita de cada
        // navegador con una página HTML de advertencia en vez de dejar pasar
        // la petición — esto rompería el `response.json()` de más abajo con
        // un error de parseo confuso. Esta cabecera le dice a ngrok que la
        // deje pasar directo. No tiene efecto en ningún otro servidor (se
        // ignora en silencio), así que es seguro dejarla siempre, incluso
        // cuando la API no está detrás de un túnel de ngrok.
        'ngrok-skip-browser-warning': 'true',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response: Response;
  try {
    response = await doFetch();
  } catch (error) {
    // Errores de red (sin conexión, DNS, timeout del AbortController) nunca
    // llegan como un objeto Response: se homogeneizan en un ApiError con
    // status 0 para que el resto del código solo tenga un formato que manejar.
    throw new ApiError(
      error instanceof Error ? error.message : 'Error de red',
      0,
      'NETWORK_ERROR',
    );
  }

  if (response.status === 401 && auth && !skipAuthRetry) {
    try {
      await refreshAccessToken();
      response = await doFetch();
    } catch {
      // Si el refresh falla, se deja caer al manejo de abajo con la respuesta
      // 401 original.
    }
  }

  // 204 No Content (logout, eliminar cuenta) no trae cuerpo: intentar
  // parsearlo como JSON lanzaría. Se detecta antes de intentarlo.
  const json = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      json?.error?.message ?? 'Ocurrió un error inesperado',
      response.status,
      json?.error?.code ?? 'UNKNOWN_ERROR',
      json?.error?.fields,
    );
  }

  return (json?.data as T) ?? (undefined as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Partial<RequestOptions>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ── Endpoints de autenticación ──────────────────────────────────────────────

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  birthDate: string;
  phone: string;
}

export interface AuthResult extends Tokens {
  customer?: { id: string; fullName: string; accountNumber: string; email: string };
}

export async function registerCustomer(payload: RegisterPayload): Promise<AuthResult> {
  const result = await api.post<AuthResult>('/auth/register', payload, {
    auth: false,
    skipAuthRetry: true,
  });
  setAccessToken(result.accessToken);
  await secureStorage.setRefreshToken(result.refreshToken);
  return result;
}

export async function loginCustomer(identifier: string, password: string): Promise<AuthResult> {
  const result = await api.post<AuthResult>(
    '/auth/login',
    { identifier, password },
    { auth: false, skipAuthRetry: true },
  );
  setAccessToken(result.accessToken);
  await secureStorage.setRefreshToken(result.refreshToken);
  return result;
}

/** Intenta recuperar una sesión existente al abrir la app. `null` si no hay. */
export async function resumeSession(): Promise<boolean> {
  const stored = await secureStorage.getRefreshToken();
  if (!stored) return false;

  try {
    await refreshAccessToken();
    return true;
  } catch {
    return false;
  }
}

export async function logoutCustomer(): Promise<void> {
  const refreshToken = await secureStorage.getRefreshToken();
  if (refreshToken) {
    // Best-effort: si el servidor no responde, la sesión igual se cierra del
    // lado del dispositivo — no tiene sentido dejar al usuario atrapado en su
    // propia cuenta porque el logout remoto falló.
    await api.post('/auth/logout', { refreshToken }).catch(() => undefined);
  }
  setAccessToken(null);
  await secureStorage.clearRefreshToken();
}

export interface MeResponse {
  id: string;
  fullName: string;
  accountNumber: string;
  email: string;
  memberSince: string;
  balance: {
    cents: string;
    decimal: string;
    formatted: string;
    currency: string;
    updatedAt: string | null;
  };
}

export function fetchMe(): Promise<MeResponse> {
  return api.get<MeResponse>('/me');
}

export function deleteMyAccount(): Promise<void> {
  return api.delete<void>('/me');
}
