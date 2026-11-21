# Playstore — Materiales para subir AM Cuenta a Google Play

Esta carpeta tiene **todo lo que necesitas** para subir la app a Google Play Store sin que te rechacen. Actualizado para el backend propio (NestJS + PostgreSQL) — ya no depende de Supabase.

## Orden de pasos (sigue esta lista en orden)

### Antes de subir a Play Store

- [x] ~~Correr migración SQL en Supabase~~ → ya no aplica. Las migraciones viven en `api/prisma/migrations/` y se aplican con `npm run db:migrate` (ver `api/README.md`).
- [ ] **1. Publicar tu backend en un servidor real** (no `localhost`) y actualizar `mobile/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL` con esa URL.
- [x] **2. Política de Privacidad publicada** → `https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0` — **falta que la marques como pública** desde el menú de compartir (ver [`instrucciones-hosting.md`](./instrucciones-hosting.md)). Alternativa con dominio propio: `Index.html` en esta misma carpeta.
- [x] **3. Icono 512×512** → [`graficos/icon-512.png`](./graficos/icon-512.png) ya generado.
- [x] **4. Feature Graphic 1024×500** → [`graficos/feature-graphic-1024x500.png`](./graficos/feature-graphic-1024x500.png) ya generado.
- [ ] **5. Tomar 4-6 Screenshots reales de Android** → ver [`instrucciones-graficos.md`](./instrucciones-graficos.md) (los que hay ahora son de iPhone y del diseño viejo).
- [ ] **6. Crear la cuenta de prueba para el revisor de Google** contra tu backend en producción (nombre, correo, contraseña — ver el texto exacto en [`data-safety-respuestas.md`](./data-safety-respuestas.md), sección "App Access").
- [ ] **7. Generar el AAB:** `eas build --platform android --profile production` (desde `mobile/`)
- [ ] **8. Crear cuenta de Google Play Developer** ($25 USD, ojalá tipo Organización)

### En Play Console

- [ ] **9. Crear la app** "AM Cuenta"
- [ ] **10. Subir el AAB** en Production → Create new release
- [ ] **11. Llenar Store Listing** con [`descripciones.md`](./descripciones.md)
- [ ] **12. Subir Icono, Feature Graphic, Screenshots**
- [ ] **13. Llenar formulario "Data Safety"** con [`data-safety-respuestas.md`](./data-safety-respuestas.md) — presta especial atención a la sección "Financial Features", es la más delicada para esta app.
- [ ] **14. Llenar formulario "Content Rating"** con [`content-rating-respuestas.md`](./content-rating-respuestas.md)
- [ ] **15. Llenar formulario "Target audience"** → 18+ (ver `data-safety-respuestas.md`)
- [ ] **16. Pegar URL de Política de Privacidad** en App Content → Privacy Policy
- [ ] **17. Submit for review** y esperar 1-7 días

---

## Archivos en esta carpeta

| Archivo | Para qué sirve | Estado |
|---|---|---|
| `README.md` | Esta lista | — |
| `politica-privacidad.md` | Política de Privacidad, versión Markdown | ✅ actualizada |
| `Index.html` | La misma política en HTML, para hostear en tu dominio si no usas el link de Claude | ✅ actualizada |
| `descripciones.md` | Textos para Play Store (nombre, descripción corta/larga, categoría) | ✅ actualizada |
| `data-safety-respuestas.md` | Respuestas exactas para "Data Safety" y "Financial Features" | ✅ actualizada |
| `content-rating-respuestas.md` | Respuestas exactas para "Content Rating" | ✅ actualizada |
| `instrucciones-graficos.md` | Estado de ícono/feature graphic + cómo tomar los screenshots que faltan | ✅ actualizada |
| `instrucciones-hosting.md` | Cómo hostear la política (ya tienes una URL lista; opciones con dominio propio) | ✅ actualizada |
| `graficos/icon-512.png` | Ícono de la app para la ficha de Play Store | ✅ listo |
| `graficos/feature-graphic-1024x500.png` | Banner promocional de la ficha | ✅ listo |
| `graficos/screenshot-*` | Capturas de pantalla | ⏳ pendientes (son del diseño viejo, en iPhone) |
| `migracion-supabase.sql` | **Obsoleto** — de cuando la app usaba Supabase. Se puede borrar. | 🗑️ obsoleto |

---

## Datos importantes que debes anotar

- **Nombre de la app en Play Store:** `AM Cuenta`
- **Package name:** `com.amfinancial.app` (interno, no se ve, no se puede cambiar sin crear nuevo proyecto)
- **URL de Política de Privacidad:** `https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0` (hazla pública primero)
- **Email de contacto del desarrollador:** `fronterayaite@gmail.com` (cámbialo si tu cliente prefiere otro)
- **Categoría en Play Store:** `Productivity` — evita `Finance` a propósito, para no activar los formularios extra de servicios financieros que esta app no necesita.

---

## El punto más delicado de esta app: "Financial Features"

Google revisa con más cuidado cualquier app cuyo nombre o pantallas sugieran dinero — "Cuenta", "saldo", un número de cuenta con formato `AMC-XXXXXXXX`. Por eso:

1. En `descripciones.md` y en la política de privacidad se aclara explícitamente, varias veces, que **AM Cuenta no es un banco, no procesa pagos, no otorga créditos y el valor mostrado no es dinero real**.
2. En `data-safety-respuestas.md` la respuesta a "Does your app provide any financial features?" es **No**, con una justificación lista para copiar si Google pide más contexto.
3. Si aun así Google pide una aclaración o rechaza la primera vez por esto, responde con el mismo texto de la justificación y, si insisten, considera agregar dentro de la propia pantalla de cuenta un texto pequeño tipo "Valor gestionado por el equipo — no es una cuenta bancaria" (ya está en el copy de la política; agregarlo también en la UI refuerza la defensa).

---

## Si Google te rechaza

Lo más común para este tipo de app es que te pidan:
1. Aclarar más que la app no maneja dinero real (ver sección de arriba).
2. Verificar que la Política de Privacidad sea accesible sin iniciar sesión (revisa esto ANTES de enviar — ver `instrucciones-hosting.md`).
3. Justificar mejor por qué pides datos sensibles (fecha de nacimiento, celular) — ya está cubierto en `data-safety-respuestas.md`.

Arregla y reenvía. Cada reenvío tarda otros 1-3 días.
