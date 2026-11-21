/**
 * Utilidades de formato para la interfaz.
 *
 * Igual que en la API, aquí NUNCA se hace aritmética con los montos: solo se
 * formatean para mostrar o se leen como texto para enviar. El cálculo y la
 * validación de verdad ocurren en el servidor (clase `Money`); el panel no
 * debe fiarse de sus propias sumas para nada que importe.
 */

export function formatMoney(decimal: string, currency = 'USD'): string {
  const value = Number(decimal);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(iso),
  );
}

/**
 * "hace 3 minutos", "hace 2 horas"... Le da vida al panel: ver un saldo que
 * cambió "hace 12 segundos" transmite que el sistema está vivo, mucho más que
 * una fecha estática.
 */
export function timeAgo(iso: string | null): string {
  if (!iso) return 'nunca';

  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 5) return 'justo ahora';
  if (diffSec < 60) return `hace ${diffSec} s`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `hace ${diffHour} h`;

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `hace ${diffDay} d`;

  return formatDateShort(iso);
}

export function initialsOf(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/**
 * Convierte lo que el administrador escribió en el input a una forma que la
 * API pueda validar. Se deja que el DTO del servidor sea la fuente final de
 * verdad (acepta hasta 2 decimales, sin negativos); aquí solo se recorta lo
 * evidentemente inválido para que el mensaje de error, si lo hay, sea del
 * dominio y no un NaN de JavaScript.
 */
export function sanitizeAmountInput(raw: string): string {
  return raw.replace(/[^\d.]/g, '');
}
