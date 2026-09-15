import { create } from 'zustand';

export interface AdminSession {
  id: string;
  email: string;
  fullName: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'VIEWER';
}

interface AuthState {
  admin: AdminSession | null;
  setAdmin: (admin: AdminSession | null) => void;
  clear: () => void;
}

/**
 * Sesión del administrador.
 *
 * ── Por qué ya no hay tokens aquí ────────────────────────────────────────────
 * Antes el panel vivía en un dominio aparte y guardaba `accessToken`/
 * `refreshToken` en `localStorage` (accesibles por JavaScript, y por tanto
 * robables por XSS). Ahora que el panel se sirve desde el mismo origen que la
 * API (ver ServeStaticModule en api/src/app.module.ts), la API entrega los
 * tokens como cookies httpOnly: el navegador los adjunta solo, y este código
 * nunca los ve ni los toca. Este store solo guarda los datos NO sensibles
 * (nombre, correo, rol) para pintar la interfaz.
 *
 * ── De dónde sale `admin` entonces ───────────────────────────────────────────
 * Como las cookies httpOnly no se pueden leer desde JS, no hay forma de saber
 * "quién está logueado" al recargar la página sin preguntarle al servidor.
 * Por eso ya no hay `persist`: al cargar, `AuthGuard` llama a
 * `GET /admin/auth/me` (ver use-session.ts) y ese resultado es lo que llena
 * este store — la fuente de verdad es siempre la cookie, nunca el navegador.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  admin: null,
  setAdmin: (admin) => set({ admin }),
  clear: () => set({ admin: null }),
}));
