'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminLogin } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/auth-store';
import { ApiError } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const admin = useAuthStore((s) => s.admin);
  const login = useAdminLogin();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Si ya hay sesión (p. ej. se navegó a /login manualmente), se manda al
  // tablero directo en vez de mostrar el formulario de nuevo.
  useEffect(() => {
    if (admin) router.replace('/');
  }, [admin, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  const errorMessage =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? login.error.message
        : 'Correo o contraseña incorrectos.'
      : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-brand-500 px-4">
      {/* Adornos decorativos: dan profundidad sin distraer del formulario. */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />

      <div className="animate-fade-in relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-3xl font-black text-gold shadow-card ring-1 ring-white/20 backdrop-blur">
            A
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">AM Cuenta</h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.2em] text-gold/80">
            Panel administrativo
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-black/5"
        >
          <h2 className="text-lg font-bold text-brand-950">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-gray-500">Acceso exclusivo para administradores</p>

          {errorMessage && (
            <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          )}

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                Correo
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-brand-950 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                placeholder="admin@amcuenta.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 pr-10 text-sm text-brand-950 outline-none transition-shadow focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={login.isPending}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {login.isPending && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {login.isPending ? 'Verificando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-white/60">
          Todo acceso queda registrado con fecha, hora e IP.
        </p>
      </div>
    </div>
  );
}
