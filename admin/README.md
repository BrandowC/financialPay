# AM Cuenta — Panel administrativo

Next.js. Todo el panel es cliente (`'use client'`) y habla por HTTP con la API (`../api/`). No procesa datos sensibles del lado del servidor de Next.

En producción se compila como sitio estático (`output: 'export'` en `next.config.ts`) y se sirve en `/admin` desde el mismo proceso que la API — ver el `Dockerfile` en la raíz del monorepo. No se despliega aparte.

## Arrancar en desarrollo

```bash
cp .env.example .env.local     # NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Requiere que `../api/` esté corriendo y tenga al menos un administrador (`npm run db:seed` en `api/`).

**Sobre la sesión en desarrollo:** el login guarda la sesión en cookies httpOnly (ver `src/lib/auth-store.ts`). Corriendo así — `admin` en `:3001` y `api` en `:3000` — el navegador SÍ adjunta esas cookies entre uno y otro: para efectos de `SameSite`, ambos son `localhost` (mismo "site", solo cambia el puerto), así que el login funciona igual que en producción. Lo único que cambia es que las cookies no llevan `Secure` en desarrollo (no hay HTTPS local) — eso ya lo maneja `AdminController` según `NODE_ENV`.

## Qué hace

- Login de administrador (roles `SUPER_ADMIN` / `OPERATOR` / `VIEWER`).
- Tablero con métricas generales y estado de la sincronización a Google Sheets.
- Listado de clientes con búsqueda, orden y paginación.
- Ficha de cliente: **el único lugar donde se edita el saldo**, con bloqueo optimista (si otro administrador ya guardó, se avisa y se recarga el valor real en vez de sobrescribirlo) e historial completo de cambios.
- Exportar todos los clientes a `.xlsx`.
