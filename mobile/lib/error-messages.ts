import { ApiError, isNetworkError } from './api';
import type { TranslationKey } from './i18n';

/**
 * Traduce un código de error del backend a una clave de traducción.
 *
 * ── Por qué existe esta capa ─────────────────────────────────────────────
 * La API nunca debe decidir en qué idioma habla el usuario ni el tono exacto
 * del mensaje — eso es responsabilidad de la app. Por eso el backend responde
 * con un `code` estable (`INVALID_CREDENTIALS`, `EMAIL_ALREADY_REGISTERED`…) y
 * un mensaje en español que sirve de respaldo; esta función es la que decide
 * qué le muestra la app al usuario, en el idioma que tenga activo.
 *
 * Si aparece un código nuevo que esta tabla no conoce (por ejemplo, se agrega
 * una regla de validación nueva en el backend y se nos olvida mapearla aquí),
 * se cae a `errSomething` en vez de mostrar el código crudo o un texto en
 * inglés técnico sin traducir.
 */
const CODE_TO_KEY: Partial<Record<string, TranslationKey>> = {
  INVALID_CREDENTIALS: 'errSignIn',
  ACCOUNT_SUSPENDED: 'errAccountSuspended',
  ACCOUNT_TEMPORARILY_LOCKED: 'errAccountLocked',
  RATE_LIMITED: 'errRateLimited',

  EMAIL_ALREADY_REGISTERED: 'errEmailExists',
  EMAIL_INVALID: 'errInvalidEmail',
  EMAIL_REQUIRED: 'errEnterEmail',

  PASSWORD_REQUIRED: 'errEnterPassword',
  PASSWORD_TOO_SHORT: 'errPasswordMin',
  PASSWORD_TOO_COMMON: 'errPasswordTooCommon',
  PASSWORD_TOO_REPETITIVE: 'errPasswordRepetitive',

  NAME_REQUIRED: 'errEnterFullName',
  NAME_TOO_SHORT: 'errEnterFullName',
  NAME_INVALID_CHARACTERS: 'errEnterFullName',

  PHONE_REQUIRED: 'errEnterPhone',
  PHONE_INVALID_LENGTH: 'errInvalidUsPhone',
  PHONE_INVALID_AREA_CODE: 'errInvalidUsPhone',
  PHONE_SERVICE_CODE: 'errPhoneServiceCode',
  PHONE_RESERVED_FICTIONAL: 'errPhoneReserved',

  BIRTH_DATE_INVALID_FORMAT: 'errEnterDate',
  BIRTH_DATE_NOT_REAL: 'errEnterDate',
  BIRTH_DATE_IN_FUTURE: 'errEnterDate',
  BIRTH_DATE_UNDERAGE: 'errUnderage',
  BIRTH_DATE_TOO_OLD: 'errEnterDate',

  SESSION_EXPIRED: 'errSessionExpired',
  ACCESS_TOKEN_EXPIRED: 'errSessionExpired',
  ACCESS_TOKEN_INVALID: 'errSessionExpired',
};

/** Mensaje final a mostrar en pantalla para cualquier error atrapado. */
export function messageFor(error: unknown, t: (key: TranslationKey) => string): string {
  if (isNetworkError(error)) return t('errNetwork');

  if (error instanceof ApiError) {
    const key = CODE_TO_KEY[error.code];
    if (key) return t(key);

    // Sin mapeo conocido: se usa el mensaje del servidor si parece seguro
    // (ya viene filtrado por el backend para no exponer detalles internos),
    // y si no hay ninguno, el genérico.
    return error.message || t('errSomething');
  }

  return t('errSomething');
}
