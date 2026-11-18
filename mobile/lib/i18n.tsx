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

const STORAGE_KEY = "metas.language";

const translations = {
  es: {
    // Branding
    brandTagline: "Ahorro por metas",
    appSubtitle: "Junta para lo que de verdad importa",
    welcomeMessage: "Define tu meta, registra cada aporte\ny mira cómo creces.",
    welcomeHighlight1: "Barra de progreso",
    welcomeHighlight2: "Historial de aportes",
    welcomeHighlight3: "Tus datos, solo tuyos",

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
    countryLabel: "País",
    searchCountry: "Buscar país",
    noCountryResults: "No encontramos ese país",
    phoneLabel: "Celular",
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

    // Inicio
    hello: "Hola,",
    totalSaved: "Total ahorrado",
    totalSavedNone: "Aún no has ahorrado nada",
    myGoals: "Mis metas",
    goalsCount: "{n} metas",
    goalsCountOne: "1 meta",
    completedCount: "{n} cumplidas",
    completedCountOne: "1 cumplida",
    noGoalsTitle: "Crea tu primera meta",
    noGoalsMsg:
      "Un viaje, una moto, un fondo de emergencia. Ponle un nombre y un monto, y empieza a registrar lo que ahorras.",
    newGoal: "Nueva meta",
    archivedGoals: "Archivadas",
    saved: "Ahorrado",
    of: "de",
    remaining: "Te faltan",
    goalReached: "¡Meta cumplida!",
    pullToRefresh: "Desliza hacia abajo para actualizar",
    refreshing: "Actualizando…",
    loadErrorTitle: "No pudimos cargar tus metas",
    loadErrorMsg: "Revisa tu conexión e intenta de nuevo.",
    retry: "Reintentar",

    // Formulario de meta
    goalFormNewTitle: "Nueva meta",
    goalFormEditTitle: "Editar meta",
    goalName: "¿Para qué estás ahorrando?",
    goalNamePlaceholder: "Viaje a Cartagena",
    goalIcon: "Ícono",
    goalTarget: "¿Cuánto quieres juntar?",
    goalTargetPlaceholder: "2.500.000",
    goalCurrency: "Moneda",
    goalCurrencyLocked: "La moneda no se puede cambiar una vez creada la meta.",
    goalDeadline: "Fecha límite (opcional)",
    deadlineNone: "Sin fecha",
    deadline3m: "3 meses",
    deadline6m: "6 meses",
    deadline1y: "1 año",
    deadline2y: "2 años",
    deadlineKeep: "La actual",
    saveGoal: "Guardar meta",
    saveChanges: "Guardar cambios",
    saving: "Guardando…",
    cancel: "Cancelar",
    errGoalName: "Ponle un nombre a tu meta.",
    errAmount: "Escribe un monto válido, mayor que cero.",

    // Detalle de meta
    contribute: "Aportar",
    withdraw: "Retirar",
    history: "Historial",
    noHistory: "Todavía no hay movimientos. Registra tu primer aporte.",
    deposit: "Aporte",
    withdrawal: "Retiro",
    amount: "Monto",
    note: "Nota (opcional)",
    notePlaceholder: "Ej. prima de diciembre",
    addDeposit: "Registrar aporte",
    addWithdrawal: "Registrar retiro",
    deleteMovement: "Borrar movimiento",
    deleteMovementMsg: "¿Borrar este movimiento? El total ahorrado se recalcula.",
    editGoal: "Editar meta",
    archiveGoal: "Archivar meta",
    unarchiveGoal: "Reactivar meta",
    deleteGoal: "Eliminar meta",
    deleteGoalTitle: "Eliminar meta",
    deleteGoalMsg: "Se borrará la meta y todo su historial. No se puede deshacer.",
    deleteConfirm: "Sí, eliminar",
    daysLeft: "Faltan {n} días",
    dayLeft: "Falta 1 día",
    dueToday: "Vence hoy",
    daysOverdue: "Venció hace {n} días",
    perMonthHint: "Para llegar a tiempo: {amount} por mes",

    // Perfil
    profile: "Perfil",
    country: "País",
    memberSince: "En Metas desde",
    signOut: "Cerrar sesión",
    privacyPolicy: "Política de privacidad",
    deleteAccount: "Eliminar mi cuenta",
    deleteAccountTitle: "Eliminar cuenta",
    deleteAccountMsg:
      "¿Estás seguro? Esta acción es permanente y eliminará todos tus datos, metas y aportes. No podrás recuperarlos.",
    deleteAccountConfirm: "Sí, eliminar",
    deleteAccountCancel: "Cancelar",
    deleteAccountError: "No pudimos eliminar la cuenta. Intenta de nuevo.",
    back: "Atrás",

    // Errores de validación local (antes de enviar al servidor)
    errCompleteFields: "Completa los campos marcados en rojo.",
    errEnterFullName: "Escribe tu nombre completo.",
    errEnterPassword: "Escribe tu contraseña.",
    errEnterEmail: "Escribe tu correo.",
    errInvalidEmail: "Correo no válido.",
    errEnterDate: "Completa día, mes y año.",
    errEnterPhone: "Escribe tu número de celular.",
    errInvalidPhone: "Escribe un número válido (mínimo 7 dígitos).",
    errChooseCountry: "Elige tu país.",
    errPasswordMin: "Mínimo 8 caracteres.",
    errUnderage: "Debes ser mayor de 18 años para crear una cuenta.",

    // Errores devueltos por el servidor (mapeados por código, ver error-messages.ts)
    errAccountNotFound:
      "Los datos no coinciden. Revisa tu nombre o correo y tu contraseña.",
    errSignIn:
      "Los datos no coinciden. Revisa tu nombre o correo y tu contraseña.",
    errAccountSuspended: "Tu cuenta está suspendida. Escríbenos para ayudarte.",
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
    errPhoneRepeated: "Ese número no parece real. Escribe tu número verdadero.",
    errSessionExpired: "Tu sesión expiró. Inicia sesión de nuevo.",
    errWithdrawTooMuch: "No puedes retirar más de lo que has ahorrado en esta meta.",
    errGoalsLimit: "Llegaste al máximo de metas. Archiva o elimina alguna para crear otra.",
    errGoalNotFound: "Esa meta ya no existe.",
    errAmountTooLarge: "Ese monto es demasiado grande.",
    errMovementNeeded:
      "No puedes borrar este aporte porque hay retiros que dependen de él. Borra primero esos retiros.",

    // Selector de idioma
    languageLabel: "Idioma",
    languageEs: "Español",
    languageEn: "English",
  },

  en: {
    // Branding
    brandTagline: "Savings goals",
    appSubtitle: "Save for what really matters",
    welcomeMessage: "Set your goal, log every deposit\nand watch yourself grow.",
    welcomeHighlight1: "Progress bar",
    welcomeHighlight2: "Deposit history",
    welcomeHighlight3: "Your data, only yours",

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
    countryLabel: "Country",
    searchCountry: "Search country",
    noCountryResults: "We couldn't find that country",
    phoneLabel: "Phone",
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

    // Home
    hello: "Hello,",
    totalSaved: "Total saved",
    totalSavedNone: "You haven't saved anything yet",
    myGoals: "My goals",
    goalsCount: "{n} goals",
    goalsCountOne: "1 goal",
    completedCount: "{n} completed",
    completedCountOne: "1 completed",
    noGoalsTitle: "Create your first goal",
    noGoalsMsg:
      "A trip, a motorbike, an emergency fund. Give it a name and an amount, and start logging what you save.",
    newGoal: "New goal",
    archivedGoals: "Archived",
    saved: "Saved",
    of: "of",
    remaining: "Remaining",
    goalReached: "Goal reached!",
    pullToRefresh: "Pull down to refresh",
    refreshing: "Refreshing…",
    loadErrorTitle: "We couldn't load your goals",
    loadErrorMsg: "Check your connection and try again.",
    retry: "Retry",

    // Goal form
    goalFormNewTitle: "New goal",
    goalFormEditTitle: "Edit goal",
    goalName: "What are you saving for?",
    goalNamePlaceholder: "Trip to Cartagena",
    goalIcon: "Icon",
    goalTarget: "How much do you want to save?",
    goalTargetPlaceholder: "2,500",
    goalCurrency: "Currency",
    goalCurrencyLocked: "The currency can't be changed once the goal is created.",
    goalDeadline: "Deadline (optional)",
    deadlineNone: "No date",
    deadline3m: "3 months",
    deadline6m: "6 months",
    deadline1y: "1 year",
    deadline2y: "2 years",
    deadlineKeep: "Current",
    saveGoal: "Save goal",
    saveChanges: "Save changes",
    saving: "Saving…",
    cancel: "Cancel",
    errGoalName: "Give your goal a name.",
    errAmount: "Enter a valid amount greater than zero.",

    // Goal detail
    contribute: "Add money",
    withdraw: "Withdraw",
    history: "History",
    noHistory: "No activity yet. Log your first deposit.",
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    amount: "Amount",
    note: "Note (optional)",
    notePlaceholder: "e.g. December bonus",
    addDeposit: "Log deposit",
    addWithdrawal: "Log withdrawal",
    deleteMovement: "Delete entry",
    deleteMovementMsg: "Delete this entry? The total saved will be recalculated.",
    editGoal: "Edit goal",
    archiveGoal: "Archive goal",
    unarchiveGoal: "Reactivate goal",
    deleteGoal: "Delete goal",
    deleteGoalTitle: "Delete goal",
    deleteGoalMsg: "The goal and all of its history will be deleted. This can't be undone.",
    deleteConfirm: "Yes, delete",
    daysLeft: "{n} days left",
    dayLeft: "1 day left",
    dueToday: "Due today",
    daysOverdue: "Overdue by {n} days",
    perMonthHint: "To get there on time: {amount} per month",

    // Profile
    profile: "Profile",
    country: "Country",
    memberSince: "On Metas since",
    signOut: "Sign out",
    privacyPolicy: "Privacy policy",
    deleteAccount: "Delete my account",
    deleteAccountTitle: "Delete account",
    deleteAccountMsg:
      "Are you sure? This action is permanent and will delete all your data, goals and deposits. You will not be able to recover them.",
    deleteAccountConfirm: "Yes, delete",
    deleteAccountCancel: "Cancel",
    deleteAccountError: "We could not delete the account. Try again.",
    back: "Back",

    // Local validation errors
    errCompleteFields: "Fill in the fields marked in red.",
    errEnterFullName: "Enter your full name.",
    errEnterPassword: "Enter your password.",
    errEnterEmail: "Enter your email.",
    errInvalidEmail: "Invalid email.",
    errEnterDate: "Complete day, month, and year.",
    errEnterPhone: "Enter your phone number.",
    errInvalidPhone: "Enter a valid number (at least 7 digits).",
    errChooseCountry: "Choose your country.",
    errPasswordMin: "Minimum 8 characters.",
    errUnderage: "You must be 18 or older to create an account.",

    // Server-returned errors (mapped by code, see error-messages.ts)
    errAccountNotFound:
      "The details don't match. Check your name or email and your password.",
    errSignIn:
      "The details don't match. Check your name or email and your password.",
    errAccountSuspended: "Your account is suspended. Write to us and we'll help.",
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
    errPhoneRepeated: "That number doesn't look real. Enter your actual number.",
    errSessionExpired: "Your session expired. Sign in again.",
    errWithdrawTooMuch: "You can't withdraw more than you've saved in this goal.",
    errGoalsLimit: "You've reached the goal limit. Archive or delete one to create another.",
    errGoalNotFound: "That goal no longer exists.",
    errAmountTooLarge: "That amount is too large.",
    errMovementNeeded:
      "You can't delete this deposit because withdrawals depend on it. Delete those withdrawals first.",

    // Language toggle
    languageLabel: "Language",
    languageEs: "Español",
    languageEn: "English",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["es"];

type TranslateVars = Record<string, string | number>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKey, vars?: TranslateVars) => string;
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

  // `{n}`, `{amount}`… se reemplazan con las variables recibidas.
  const t = useCallback(
    (key: TranslationKey, vars?: TranslateVars) => {
      let text: string = translations[language][key];
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.replace(`{${name}}`, String(value));
        }
      }
      return text;
    },
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
