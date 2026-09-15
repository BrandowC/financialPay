import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { InfrastructureError } from '../../../shared/domain/errors/domain.error';
import { PlainPassword } from '../../../shared/domain/value-objects/password.vo';
import { PasswordHasher } from '../application/ports/password-hasher.port';

/**
 * Hasheo de contraseñas con Argon2id.
 *
 * ── Por qué Argon2id y no bcrypt ────────────────────────────────────────────
 * bcrypt sigue siendo aceptable, pero tiene dos límites reales:
 *   1. Ignora todo lo que pase de 72 bytes. Una passphrase larga se trunca en
 *      silencio y el usuario cree tener más seguridad de la que tiene.
 *   2. Usa poca memoria (4 KB), así que una GPU puede probar miles de millones
 *      de combinaciones por segundo en paralelo.
 *
 * Argon2id ganó la Password Hashing Competition en 2015 y es la recomendación
 * actual de OWASP. Es "memory-hard": obliga a reservar memoria de verdad por
 * cada intento, lo que anula la ventaja de las GPU y los ASIC.
 *
 * ── Los parámetros ──────────────────────────────────────────────────────────
 * Son los que OWASP publica como mínimo para Argon2id:
 *   memoryCost 19456 KiB (19 MiB) · timeCost 2 · parallelism 1
 *
 * Con esto un hash tarda unos 50 ms en hardware de servidor normal. Ese número
 * importa en las dos direcciones: si es mucho más rápido, es débil; si es mucho
 * más lento, un pico de logins tumba la API. A 19 MiB por hash, 20 logins
 * simultáneos consumen 380 MB — hay que tenerlo en cuenta al dimensionar el
 * contenedor (ver docs/escalabilidad.md).
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  private readonly logger = new Logger(Argon2PasswordHasher.name);

  private static readonly OPTIONS: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  };

  /**
   * Hash de una contraseña que no existe, para gastar el mismo tiempo cuando
   * el correo no está registrado. Ver `verifyDummy()`.
   * Se calcula una sola vez, de forma perezosa.
   */
  private dummyHash: string | null = null;

  async hash(password: PlainPassword): Promise<string> {
    try {
      // argon2 genera y embebe la sal automáticamente en la cadena resultante,
      // junto con los parámetros. Por eso el hash se puede verificar años
      // después aunque los parámetros hayan cambiado.
      return await argon2.hash(password.value, Argon2PasswordHasher.OPTIONS);
    } catch (error) {
      this.logger.error('Falló el hasheo de contraseña', error);
      throw new InfrastructureError(
        'No se pudo procesar la contraseña',
        'PASSWORD_HASH_FAILED',
        error,
      );
    }
  }

  async verify(hash: string, password: string): Promise<boolean> {
    try {
      // argon2.verify hace la comparación en tiempo constante internamente.
      return await argon2.verify(hash, password);
    } catch {
      // Un hash corrupto o con formato desconocido lanza. Se trata como
      // "contraseña incorrecta" en vez de como error 500: así un registro
      // dañado en la BD no revela nada al atacante.
      this.logger.warn('Verificación de contraseña fallida (¿hash corrupto?)');
      return false;
    }
  }

  /**
   * Consume el mismo tiempo que una verificación real, sin verificar nada.
   *
   * ── Por qué esto es imprescindible ────────────────────────────────────────
   * Si el login responde "correo no registrado" en 2 ms y "contraseña
   * incorrecta" en 55 ms, un atacante no necesita leer el mensaje: le basta
   * medir el tiempo para saber qué correos existen en la base. Eso es una fuga
   * de datos personales por canal lateral, y es exactamente el problema que
   * tenía la función `lookup_email` del proyecto original.
   *
   * Llamando a esto cuando el usuario no existe, ambas ramas tardan lo mismo.
   */
  async verifyDummy(): Promise<false> {
    this.dummyHash ??= await argon2.hash(
      'contraseña-que-no-existe-para-igualar-tiempos',
      Argon2PasswordHasher.OPTIONS,
    );

    await argon2.verify(this.dummyHash, 'intento-fallido').catch(() => false);
    return false;
  }

  /**
   * ¿Este hash se generó con parámetros más débiles que los actuales?
   *
   * Permite re-hashear de forma transparente en el siguiente login exitoso
   * cuando en el futuro se suban los parámetros, sin pedirle nada al usuario
   * y sin invalidar las contraseñas existentes.
   */
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, Argon2PasswordHasher.OPTIONS);
    } catch {
      // No se pudo interpretar → es de un esquema viejo → conviene rehashear.
      return true;
    }
  }
}
