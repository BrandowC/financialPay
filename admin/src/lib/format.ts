/**
 * Utilidades de formato para la interfaz.
 *
 * Igual que en la API, aquí NUNCA se hace aritmética con los montos: solo se
 * formatean para mostrar o se leen como texto para enviar. El cálculo y la
 * validación de verdad ocurren en el servidor (clase `Money`); el panel no
 * debe fiarse de sus propias sumas para nada que importe.
 */

/** Centavos (texto) → "$1,234.56" / "COP 2.500.000,00" según la moneda. Solo para
 *  mostrar: no se hace aritmética con esto. */
export function formatCents(cents: string, currency = 'USD'): string {
  const value = Number(cents) / 100;
  try {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** "CO" → "Colombia" (en español); el código tal cual si el navegador no lo sabe. */
export function countryName(code: string | null): string {
  if (!code) return '—';
  try {
    return new Intl.DisplayNames(['es'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
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
 * "hace 3 minutos", "hace 2 horas"... Le da vida al panel: ver un registro
 * de "hace 12 segundos" transmite que el sistema está vivo, mucho más que una
 * fecha estática.
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
