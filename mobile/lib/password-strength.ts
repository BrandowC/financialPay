/**
 * Medidor de fortaleza puramente visual — le da al usuario una señal
 * inmediata mientras escribe, en vez de enterarse de que su contraseña es
 * débil recién al enviar el formulario.
 *
 * La validación que de verdad importa (longitud mínima, lista de contraseñas
 * comunes, repetición excesiva) vive en el servidor — ver
 * `PlainPassword.create` en la API — porque es la única que no se puede
 * evadir. Esta función nunca debe usarse para BLOQUEAR el envío, solo para
 * mostrar el indicador de color.
 */
export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export function estimatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) return 'weak';

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (new Set(password).size < 4) score = Math.max(0, score - 2); // penaliza "aaaaaaaa"

  if (score <= 1) return 'weak';
  if (score === 2) return 'fair';
  if (score === 3) return 'good';
  return 'strong';
}
