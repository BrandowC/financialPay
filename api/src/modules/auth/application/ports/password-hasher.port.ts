import { PlainPassword } from '../../../../shared/domain/value-objects/password.vo';

/**
 * Puerto de hasheo de contraseñas.
 *
 * ── Por qué una interfaz y no usar argon2 directamente ─────────────────────
 * Esto es el Principio de Inversión de Dependencias (la D de SOLID). Los casos
 * de uso dependen de ESTA interfaz, no de la librería. Consecuencias prácticas:
 *
 *   · Los tests unitarios inyectan un doble que hashea con `'hash:' + valor`.
 *     Sin esto, cada test de registro tardaría 50 ms reales calculando Argon2 y
 *     la suite completa pasaría de 2 segundos a varios minutos.
 *   · Si mañana hay que migrar a scrypt o a un HSM, se escribe una clase nueva
 *     y se cambia una línea en el módulo. Ningún caso de uso se entera.
 *
 * El token de inyección es una constante porque las interfaces de TypeScript
 * desaparecen al compilar: en runtime no existen y Nest no puede usarlas como
 * identificador.
 */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

export interface PasswordHasher {
  /** Devuelve la cadena completa de Argon2 (incluye sal y parámetros). */
  hash(password: PlainPassword): Promise<string>;

  /** Comparación en tiempo constante. `false` también si el hash es inválido. */
  verify(hash: string, password: string): Promise<boolean>;

  /**
   * Gasta el mismo tiempo que `verify` sin comprobar nada.
   * Se llama cuando el usuario NO existe, para que el login tarde igual en
   * ambos casos y no se pueda enumerar correos midiendo la respuesta.
   */
  verifyDummy(): Promise<false>;

  /** `true` si el hash usa parámetros más débiles que los configurados hoy. */
  needsRehash(hash: string): boolean;
}
