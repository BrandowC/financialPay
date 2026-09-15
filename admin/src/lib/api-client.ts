import { env } from './env';
import { useAuthStore } from './auth-store';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  success: false;
  error: { code: string; message: string; fields?: Record<string, string[]> };
  meta: { requestId: string };
}

/**
 * Cliente HTTP con renovación automática de sesión.
 *
 * ── Cookies, no headers ──────────────────────────────────────────────────────
 * Los tokens viven en cookies httpOnly que la API fija (`Set-Cookie`) y que el
 * navegador adjunta solo con `credentials: 'include'` — este código nunca ve
 * el valor de ningún token, así que no hay nada que un XSS pudiera robar de
 * aquí. Por lo mismo, ya no hace falta pasar `Authorization: Bearer …` a mano.
 *
 * ── Por qué una sola promesa compartida para refrescar ──────────────────────
 * Si el administrador tiene tres paneles cargando datos a la vez y el token
 * expiró, las tres peticiones reciben 401 casi simultáneamente. Sin
 * coordinación, las tres intentarían refrescar por su cuenta: la primera
 * rotaría el refresh token y las otras dos llegarían con el token YA usado,
 * lo que el servidor interpreta como robo de sesión y cierra todo (ver
 * JwtTokenService.rotate). `refreshPromise` asegura que solo se refresque una
 * vez y las demás esperen ese mismo resultado.
 */
let refreshPromise: Promise<void> | null = null;

async function refreshAccessToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/admin/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      // El refresh también falló: la sesión ya no es recuperable. Se limpia
      // todo para que la próxima petición mande de vuelta al login en vez de
      // reintentar en bucle.
      useAuthStore.getState().clear();
      throw new ApiError('Tu sesión expiró. Inicia sesión de nuevo.', 401, 'SESSION_EXPIRED');
    }
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Evita el reintento automático (lo usa el propio flujo de login). */
  skipAuthRetry?: boolean;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuthRetry, headers, ...rest } = options;

  const doFetch = () =>
    fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response = await doFetch();

  if (response.status === 401 && !skipAuthRetry) {
    try {
      await refreshAccessToken();
      response = await doFetch();
    } catch {
      // Si el refresh falló, se deja caer al manejo de error de abajo, que
      // ya habrá limpiado la sesión.
    }
  }

  const json = await response.json();

  if (!response.ok) {
    const errorBody = json as ErrorBody;
    throw new ApiError(
      errorBody.error?.message ?? 'Ocurrió un error inesperado',
      response.status,
      errorBody.error?.code ?? 'UNKNOWN_ERROR',
      errorBody.error?.fields,
      errorBody.meta?.requestId,
    );
  }

  // El envoltorio completo se devuelve tal cual para que `getPaged` pueda leer
  // `meta`; los demás métodos se quedan solo con `data`, que es lo que la
  // inmensa mayoría de las pantallas necesita.
  return json as T;
}

export interface Paged<T> {
  data: T;
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

export const api = {
  get: async <T>(path: string, options?: RequestOptions): Promise<T> =>
    (await request<{ data: T }>(path, { ...options, method: 'GET' })).data,

  /** Como `get`, pero conserva `meta` — para listados paginados. */
  getPaged: <T>(path: string, options?: RequestOptions): Promise<Paged<T>> =>
    request<Paged<T>>(path, { ...options, method: 'GET' }),

  post: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    (await request<{ data: T }>(path, { ...options, method: 'POST', body })).data,

  patch: async <T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> =>
    (await request<{ data: T }>(path, { ...options, method: 'PATCH', body })).data,

  delete: async <T>(path: string, options?: RequestOptions): Promise<T> =>
    (await request<{ data: T }>(path, { ...options, method: 'DELETE' })).data,

  /**
   * Para descargas binarias (el Excel). Solo GET, sin cuerpo: por eso no
   * comparte la firma de `RequestOptions` de los demás métodos (que incluye
   * `body` y `skipAuthRetry`, campos que no tienen sentido aquí y que no son
   * compatibles con `RequestInit` de `fetch`).
   */
  rawBlob: async (path: string): Promise<Blob> => {
    const response = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new ApiError('No se pudo descargar el archivo', response.status, 'DOWNLOAD_FAILED');
    }

    return response.blob();
  },
};
