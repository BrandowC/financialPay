import { ValidationError } from '../errors/domain.error';

/**
 * Contraseña en claro, viva solo el instante que tarda en hashearse.
 *
 * ── Decisiones de política ──────────────────────────────────────────────────
 * El proyecto original pedía mínimo 6 caracteres. Se sube a 8 siguiendo la
 * NIST SP 800-63B, que es el estándar que Google Play toma como referencia
 * para apps que manejan datos personales.
 *
 * Se aplica el resto de la misma guía, que va a contracorriente de lo que se
 * hacía hace años y por buenas razones:
 *   · SÍ longitud mínima 8 y máxima 128.
 *   · SÍ lista de bloqueo de contraseñas comunes.
 *   · NO obligar a mayúscula + símbolo + número: está demostrado que empuja a
 *     la gente a "Password1!" y a escribirla en un papel. Una passphrase larga
 *     es más fuerte y más memorable.
 *   · NO caducidad forzada.
 *
 * ── Por qué existe el tope de 128 ───────────────────────────────────────────
 * Argon2 es caro por diseño. Sin tope, un atacante manda una contraseña de
 * 10 MB y nos come la CPU: es una denegación de servicio gratis.
 */
export class PlainPassword {
  static readonly MIN_LENGTH = 8;
  static readonly MAX_LENGTH = 128;

  /**
   * Las que aparecen una y otra vez en las filtraciones reales. Es una muestra
   * corta a propósito: en producción esto se reemplaza por una comprobación
   * contra la API k-anonymity de HaveIBeenPwned (ver docs/seguridad.md), que
   * no envía la contraseña sino los primeros 5 caracteres de su SHA-1.
   */
  private static readonly BLOCKLIST = new Set([
    '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
    'qwerty123', 'qwertyuiop', 'iloveyou', 'admin123', 'welcome1', 'abc12345',
    'contrasena', 'contraseña', '11111111', '00000000', 'letmein1', 'football',
    'monkey123', 'sunshine', 'princess', 'dragon123', 'baseball', 'superman',
  ]);

  private constructor(readonly value: string) {
    // Sin Object.freeze aquí: queremos poder llamar a wipe() más abajo.
  }

  static create(input: string): PlainPassword {
    if (typeof input !== 'string' || input.length === 0) {
      throw new ValidationError('La contraseña es obligatoria', 'PASSWORD_REQUIRED');
    }

    // No se hace trim: un espacio al inicio o al final es un carácter válido
    // y quitarlo silenciosamente haría que la contraseña guardada no sea la
    // que el usuario escribió.
    if (input.length < PlainPassword.MIN_LENGTH) {
      throw new ValidationError(
        `La contraseña debe tener al menos ${PlainPassword.MIN_LENGTH} caracteres`,
        'PASSWORD_TOO_SHORT',
      );
    }

    if (input.length > PlainPassword.MAX_LENGTH) {
      throw new ValidationError(
        `La contraseña no puede superar ${PlainPassword.MAX_LENGTH} caracteres`,
        'PASSWORD_TOO_LONG',
      );
    }

    if (PlainPassword.BLOCKLIST.has(input.toLowerCase())) {
      throw new ValidationError(
        'Esa contraseña es demasiado común. Elige una diferente.',
        'PASSWORD_TOO_COMMON',
      );
    }

    // Un solo carácter repetido ("aaaaaaaa") pasa la longitud pero no aporta
    // entropía real.
    if (new Set(input).size < 4) {
      throw new ValidationError(
        'La contraseña es demasiado repetitiva. Combina más caracteres distintos.',
        'PASSWORD_TOO_REPETITIVE',
      );
    }

    return new PlainPassword(input);
  }

  /**
   * Evita que la contraseña aparezca en un log, un `console.log`, un
   * `JSON.stringify` o un reporte de errores por accidente. Es una red de
   * seguridad barata que ha salvado a mucha gente.
   */
  toString(): string {
    return '[REDACTED]';
  }

  toJSON(): string {
    return '[REDACTED]';
  }

  /** Node imprime esto en `console.log(obj)` en vez del valor real. */
  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return '[REDACTED]';
  }
}
