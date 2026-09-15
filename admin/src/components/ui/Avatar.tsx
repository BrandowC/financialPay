import { initialsOf } from '@/lib/format';

/**
 * Avatar con iniciales y color derivado del nombre.
 *
 * ── Por qué el color se deriva del nombre y no es aleatorio ────────────────
 * Un color aleatorio en cada render haría que el avatar de "María González"
 * cambiara de color cada vez que la lista se refresca — se vería roto. Un hash
 * simple sobre el texto del nombre da un color estable siempre: la misma
 * persona siempre tiene el mismo color, sin guardar nada en la base de datos.
 */
const PALETTE = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-fuchsia-100 text-fuchsia-700',
];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length]!;
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-16 w-16 text-xl' };

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizes[size]} ${colorFor(name)}`}
    >
      {initialsOf(name) || '?'}
    </div>
  );
}
