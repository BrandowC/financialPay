import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "es" | "en";

const STORAGE_KEY = "amfinancial.language";

const translations = {
  es: {
    // Branding
    brandTagline: "Solutions & Services",
    appSubtitle: "Tu cuenta, siempre contigo",
    welcomeMessage: "Maneja tu dinero de forma simple,\nrápida y segura.",
    welcomeHighlight1: "Acceso protegido",
    welcomeHighlight2: "Datos cifrados",
    welcomeHighlight3: "Soporte dedicado",

    // Welcome
    start: "Comenzar",
    haveAccount: "Ya tengo cuenta",

    // Login
    loginTitle: "Bienvenido de nuevo",
    loginSubtitle: "Ingresa tus datos para continuar",
    fullName: "Nombre completo",
    fullNamePlaceholder: "Juan Pérez",
    identifierLabel: "Nombre completo o correo",
    identifierPlaceholder: "Juan Pérez o tu@correo.com",
    password: "Contraseña",
    passwordPlaceholder: "••••••••",
    enter: "Entrar",
    entering: "Entrando…",
    noAccount: "¿No tienes cuenta? ",
    createAccount: "Crear cuenta",

    // Register
    registerTitle: "Crea tu cuenta",
    registerSubtitle: "Toma menos de un minuto",
    birthDate: "Fecha de nacimiento",
    birthDateHint: "Debes ser mayor de 18 años",
    day: "Día",
    month: "Mes",
    year: "Año",
    phoneLabel: "Celular (Estados Unidos)",
    phonePlaceholder: "3015551234",
    email: "Correo electrónico",
    emailPlaceholder: "tu@correo.com",
    passwordHint: "Mínimo 8 caracteres",
    create: "Crear cuenta",
    creating: "Creando cuenta…",
    haveAccountQ: "¿Ya tienes cuenta? ",
    passwordStrengthWeak: "Débil",
    passwordStrengthFair: "Aceptable",
    passwordStrengthGood: "Buena",
    passwordStrengthStrong: "Fuerte",

    // Account
    hello: "Hola,",
    accountLabel: "Cuenta",
    availableBalance: "Saldo disponible",
    balanceUpdated: "Actualizado",
    balanceNeverUpdated: "Aún sin movimientos",
    balanceDisclaimer: "",
    pullToRefresh: "Desliza hacia abajo para actualizar",
    refreshing: "Actualizando…",
    memberSince: "Cliente desde",
    signOut: "Cerrar sesión",
    deleteAccount: "Eliminar mi cuenta",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountMsg:
      "¿Estás seguro? Esta acción es permanente y eliminará todos tus datos. No podrás recuperarlos.",
    deleteAccountConfirm: "Sí, eliminar",
    deleteAccountCancel: "Cancelar",
    deleteAccountError: "No pudimos eliminar la cuenta. Intenta de nuevo.",
    copyAccountNumber: "Número copiado",

    // Errores de validación local (antes de enviar al servidor)
    errCompleteFields: "Completa los campos marcados en rojo.",
    errEnterFullName: "Escribe tu nombre completo.",
    errEnterPassword: "Escribe tu contraseña.",
    errEnterEmail: "Escribe tu correo.",
    errInvalidEmail: "Correo no válido.",
    errEnterDate: "Completa día, mes y año.",
    errEnterPhone: "Escribe tu número de celular.",
    errInvalidUsPhone: "Solo aceptamos números de Estados Unidos (10 dígitos).",
    errPasswordMin: "Mínimo 8 caracteres.",
    errUnderage: "Debes ser mayor de 18 años para crear una cuenta.",

    // Errores devueltos por el servidor (mapeados por código, ver error-messages.ts)
    errAccountNotFound:
      "Los datos no coinciden. Revisa tu nombre o correo y tu contraseña.",
    errSignIn:
      "Los datos no coinciden. Revisa tu nombre o correo y tu contraseña.",
    errAccountSuspended: "Tu cuenta está suspendida. Comunícate con soporte.",
    errAccountLocked:
      "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.",
    errRateLimited:
      "Demasiados intentos. Espera un momento y vuelve a intentar.",
    errNetwork:
      "Sin conexión o internet muy lento. Revisa tu Wi-Fi y vuelve a intentar.",
    errSomething: "Algo salió mal. Intenta de nuevo.",
    errEmailExists: "Este correo ya tiene una cuenta. Intenta iniciar sesión.",
    errCantCreate: "No pudimos crear tu cuenta. Revisa tus datos.",
    errPasswordTooCommon:
      "Esa contraseña es demasiado común. Elige una diferente.",
    errPasswordRepetitive:
      "La contraseña es demasiado repetitiva. Usa más caracteres distintos.",
    errPhoneReserved: "Ese número parece de prueba. Escribe tu número real.",
    errPhoneServiceCode: "Ese código de área no corresponde a un celular.",
    errSessionExpired: "Tu sesión expiró. Inicia sesión de nuevo.",

    // Cuenta creada
    accountCreatedTitle: "¡Cuenta creada!",
    accountCreatedMsg:
      "Revisa tu correo para confirmar la cuenta y luego inicia sesión.",

    // Error de perfil
    profileErrorTitle: "No pudimos cargar tu perfil",
    profileErrorMsg:
      "Cierra sesión e intenta entrar de nuevo. Si el problema continúa, avísale al administrador.",
    retry: "Reintentar",

    // Selector de idioma
    languageLabel: "Idioma",
    languageEs: "Español",
    languageEn: "English",
  },

  en: {
    // Branding
    brandTagline: "Solutions & Services",
    appSubtitle: "Your account, always with you",
    welcomeMessage: "Manage your money simply,\nquickly and securely.",
    welcomeHighlight1: "Protected access",
    welcomeHighlight2: "Encrypted data",
    welcomeHighlight3: "Dedicated support",

    // Welcome
    start: "Get started",
    haveAccount: "I already have an account",

    // Login
    loginTitle: "Welcome back",
    loginSubtitle: "Enter your details to continue",
    fullName: "Full name",
    fullNamePlaceholder: "John Smith",
    identifierLabel: "Full name or email",
    identifierPlaceholder: "John Smith or you@email.com",
    password: "Password",
    passwordPlaceholder: "••••••••",
    enter: "Sign in",
    entering: "Signing in…",
    noAccount: "Don't have an account? ",
    createAccount: "Create account",

    // Register
    registerTitle: "Create your account",
    registerSubtitle: "Takes less than a minute",
    birthDate: "Date of birth",
    birthDateHint: "You must be 18 or older",
    day: "Day",
    month: "Month",
    year: "Year",
    phoneLabel: "Phone (United States)",
    phonePlaceholder: "3015551234",
    email: "Email",
    emailPlaceholder: "you@email.com",
    passwordHint: "Minimum 8 characters",
    create: "Create account",
    creating: "Creating account…",
    haveAccountQ: "Already have an account? ",
    passwordStrengthWeak: "Weak",
    passwordStrengthFair: "Fair",
    passwordStrengthGood: "Good",
    passwordStrengthStrong: "Strong",

    // Account
    hello: "Hello,",
    accountLabel: "Account",
    availableBalance: "Available balance",
    balanceUpdated: "Updated",
    balanceNeverUpdated: "No activity yet",
    balanceDisclaimer: "",
    pullToRefresh: "Pull down to refresh",
    refreshing: "Refreshing…",
    memberSince: "Customer since",
    signOut: "Sign out",
    deleteAccount: "Delete my account",
    deleteAccountTitle: "Delete account",
    deleteAccountMsg:
      "Are you sure? This action is permanent and will delete all your data. You will not be able to recover it.",
    deleteAccountConfirm: "Yes, delete",
    deleteAccountCancel: "Cancel",
    deleteAccountError: "We could not delete the account. Try again.",
    copyAccountNumber: "Number copied",

    // Local validation errors
    errCompleteFields: "Fill in the fields marked in red.",
    errEnterFullName: "Enter your full name.",
    errEnterPassword: "Enter your password.",
    errEnterEmail: "Enter your email.",
    errInvalidEmail: "Invalid email.",
    errEnterDate: "Complete day, month, and year.",
    errEnterPhone: "Enter your phone number.",
    errInvalidUsPhone: "We only accept US phone numbers (10 digits).",
    errPasswordMin: "Minimum 8 characters.",
    errUnderage: "You must be 18 or older to create an account.",

    // Server-returned errors (mapped by code, see error-messages.ts)
    errAccountNotFound:
      "The details don't match. Check your name or email and your password.",
    errSignIn:
      "The details don't match. Check your name or email and your password.",
    errAccountSuspended: "Your account is suspended. Contact support.",
    errAccountLocked:
      "Too many failed attempts. Wait a few minutes before trying again.",
    errRateLimited: "Too many attempts. Wait a moment and try again.",
    errNetwork:
      "No connection or very slow internet. Check your Wi-Fi and try again.",
    errSomething: "Something went wrong. Try again.",
    errEmailExists: "This email already has an account. Try signing in.",
    errCantCreate: "We couldn't create your account. Check your details.",
    errPasswordTooCommon:
      "That password is too common. Choose a different one.",
    errPasswordRepetitive:
      "The password is too repetitive. Use more distinct characters.",
    errPhoneReserved:
      "That number looks like a test number. Enter your real number.",
    errPhoneServiceCode: "That area code isn't a real mobile number.",
    errSessionExpired: "Your session expired. Sign in again.",

    // Account created
    accountCreatedTitle: "Account created!",
    accountCreatedMsg:
      "Check your email to confirm your account and then sign in.",

    // Profile error
    profileErrorTitle: "We couldn't load your profile",
    profileErrorMsg:
      "Sign out and try again. If the problem persists, contact the administrator.",
    retry: "Retry",

    // Language toggle
    languageLabel: "Language",
    languageEs: "Español",
    languageEn: "English",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["es"];

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined,
);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("es");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "es" || stored === "en") {
        setLanguageState(stored);
      }
    });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  }, []);

  const toggleLanguage = useCallback(() => {
    setLanguage(language === "es" ? "en" : "es");
  }, [language, setLanguage]);

  const t = useCallback(
    (key: TranslationKey) => translations[language][key],
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, toggleLanguage, t }),
    [language, setLanguage, toggleLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLanguage debe usarse dentro de <LanguageProvider>");
  return ctx;
}

export function useT() {
  return useLanguage().t;
}
