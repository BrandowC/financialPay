import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  AuthResult,
  MeResponse,
  fetchMe,
  loginCustomer,
  logoutCustomer,
  registerCustomer,
  RegisterPayload,
  resumeSession,
  setSessionExpiredListener,
} from './api';

type AuthContextValue = {
  profile: MeResponse | null;
  loading: boolean;
  /** true mientras se ejecuta login/registro, para deshabilitar el botón. */
  authenticating: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<{ needsEmailCheck: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      setProfile(await fetchMe());
    } catch (error) {
      // Un 401 aquí significa que la sesión ya no es válida (el listener de
      // abajo también la limpia); cualquier otro error de red simplemente dej
      // a el perfil como estaba y la pantalla de cuenta mostrará su propio
      // estado de error.
      if (error instanceof ApiError && error.status === 401) {
        setProfile(null);
      }
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Si el refresh token deja de servir en cualquier momento (expiró, fue
    // revocado por reuso detectado), se limpia el perfil y la app vuelve sola
    // a la pantalla de bienvenida — sin esto, la pantalla de cuenta se
    // quedaría mostrando datos viejos indefinidamente tras una sesión muerta.
    setSessionExpiredListener(() => {
      if (mounted) setProfile(null);
    });

    (async () => {
      const recovered = await resumeSession();
      if (!mounted) return;

      if (recovered) {
        await loadProfile();
      }
      setLoading(false);
    })();

    return () => {
      mounted = false;
      setSessionExpiredListener(null);
    };
  }, [loadProfile]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      setAuthenticating(true);
      try {
        await loginCustomer(identifier, password);
        await loadProfile();
      } finally {
        setAuthenticating(false);
      }
    },
    [loadProfile],
  );

  const register = useCallback(
    async (payload: RegisterPayload): Promise<{ needsEmailCheck: boolean }> => {
      setAuthenticating(true);
      try {
        const result: AuthResult = await registerCustomer(payload);
        if (result.customer) {
          await loadProfile();
        }
        return { needsEmailCheck: false };
      } finally {
        setAuthenticating(false);
      }
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await logoutCustomer();
    setProfile(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      profile,
      loading,
      authenticating,
      isAuthenticated: profile !== null,
      login,
      register,
      signOut,
      refreshProfile: loadProfile,
    }),
    [profile, loading, authenticating, login, register, signOut, loadProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
