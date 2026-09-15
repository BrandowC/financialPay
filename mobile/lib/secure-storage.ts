import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const REFRESH_TOKEN_KEY = 'amcuenta.refreshToken';

/**
 * Persistencia del refresh token.
 *
 * ── Por qué SecureStore y no AsyncStorage ───────────────────────────────────
 * AsyncStorage en Android es un archivo plano sin cifrar dentro del sandbox de
 * la app; en un dispositivo con root, cualquiera puede leerlo. SecureStore usa
 * Keystore en Android y Keychain en iOS — el sistema operativo cifra el valor
 * con una clave que ni siquiera la propia app puede exportar. El refresh token
 * vive 30 días: es exactamente el tipo de credencial de larga duración que
 * merece esa protección.
 *
 * El access token NUNCA se persiste aquí ni en ningún otro sitio — vive solo en
 * memoria (`AuthProvider`) y dura 15 minutos. Si la app se cierra, se pierde, y
 * se reconstruye automáticamente pidiendo uno nuevo con el refresh token al
 * volver a abrir. Esto imita lo que ya hacía el proyecto original con
 * `persistSession: false`, pero mejorado: antes también se perdía la SESIÓN
 * completa al cerrar la app; ahora solo se pierde el token de corta duración y
 * el usuario no tiene que volver a escribir su contraseña cada vez.
 *
 * ── Por qué existe el fallback de web ────────────────────────────────────────
 * SecureStore no funciona en `expo start --web` (no hay Keychain en un
 * navegador). El fallback en memoria es solo para poder probar la app en modo
 * web durante el desarrollo; nunca se usa en un build real de Android/iOS.
 */
const memoryFallback = new Map<string, string>();
const isWeb = Platform.OS === 'web';

export const secureStorage = {
  async getRefreshToken(): Promise<string | null> {
    if (isWeb) return memoryFallback.get(REFRESH_TOKEN_KEY) ?? null;
    try {
      return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  async setRefreshToken(token: string): Promise<void> {
    if (isWeb) {
      memoryFallback.set(REFRESH_TOKEN_KEY, token);
      return;
    }
    try {
      await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
    } catch {
      // Si el almacén seguro falla (dispositivo sin Keystore configurado, muy
      // raro), la sesión simplemente no persiste entre aperturas de la app en
      // vez de tumbar el flujo de login.
    }
  },

  async clearRefreshToken(): Promise<void> {
    if (isWeb) {
      memoryFallback.delete(REFRESH_TOKEN_KEY);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch {
      // No pasa nada si no había nada que borrar.
    }
  },
};
