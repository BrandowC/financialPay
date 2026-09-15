import type { NextConfig } from 'next';

/**
 * El panel es enteramente cliente: todas las pantallas son componentes 'use
 * client' que hablan por fetch con la API de NestJS. No hay Server Actions ni
 * datos sensibles procesados en el servidor de Next, así que se compila como
 * export estático (`output: 'export'`) y esa carpeta (`out/`) se copia dentro
 * de la imagen de la API, que la sirve en `/admin` desde el mismo proceso —
 * ver Dockerfile en la raíz del monorepo y `ServeStaticModule` en
 * `api/src/app.module.ts`. Ya no se despliega aparte en Vercel.
 *
 * `trailingSlash: true` es necesario para que cada ruta exporte como
 * `carpeta/index.html` en vez de `carpeta.html`: así Express (vía
 * ServeStaticModule) sirve el HTML correcto tanto en la navegación normal
 * como al recargar la página directamente en, por ejemplo, `/admin/customers/`.
 *
 * `images.unoptimized` es obligatorio en export estático: el optimizador de
 * `next/image` necesita un servidor Node en tiempo real, que un export no
 * tiene. El panel no usa `next/image` hoy, pero se deja explícito para que no
 * sea una sorpresa el día que alguien lo use.
 *
 * `basePath: '/admin'` es imprescindible en el build de producción: sin
 * esto, el HTML exportado referencia sus propios scripts y estilos como
 * `/_next/static/...` (absolutos desde la raíz del dominio), pero
 * `ServeStaticModule` los sirve bajo `/admin/_next/static/...` — sin
 * `basePath` el navegador pide esos archivos en la ruta equivocada y todo el
 * panel carga en blanco. Se deja condicionado a `next build` (producción)
 * para que `next dev` (puerto 3001, sin subruta) siga funcionando tal como
 * está documentado en el README.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  ...(process.env.NODE_ENV === 'production' ? { basePath: '/admin' } : {}),
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
