import type { Request } from 'express';

/**
 * IP real del cliente detrás de proxies y balanceadores.
 *
 * ── Por qué no basta con request.ip ────────────────────────────────────────
 * En producción la API no recibe conexiones directas: delante hay un balanceador
 * (Railway, Render, Nginx, Cloudflare). Sin configurar nada, `request.ip`
 * devuelve la IP del PROXY, que es la misma para todos los usuarios. Con eso,
 * el rate limiting por IP bloquearía a todo el mundo a la vez en cuanto un solo
 * usuario pasara el límite.
 *
 * ── Por qué hay que tener cuidado con X-Forwarded-For ──────────────────────
 * Esa cabecera la puede escribir cualquiera. Si se confía a ciegas, un atacante
 * manda `X-Forwarded-For: 1.2.3.4` y salta el rate limiting cambiando el valor
 * en cada petición.
 *
 * La forma correcta es configurar `trust proxy` en Express con el número exacto
 * de proxies de confianza que hay delante (ver main.ts). Express entonces toma
 * la IP correcta contando desde la derecha e ignora lo que el cliente haya
 * inventado a la izquierda. Esta función se apoya en eso y solo lee la cabecera
 * como último recurso.
 */
export function clientIp(request: Request): string | null {
  // Express ya resolvió esto correctamente si `trust proxy` está bien puesto.
  if (request.ip) return normalize(request.ip);

  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return normalize(forwarded.split(',')[0].trim());
  }

  return request.socket?.remoteAddress ? normalize(request.socket.remoteAddress) : null;
}

/** Quita el prefijo IPv4-mapeado que añaden algunos balanceadores. */
function normalize(ip: string): string {
  return ip.replace(/^::ffff:/i, '');
}
