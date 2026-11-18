# App Store — publicar la versión 2.0.0 de Metas

La ficha ya existe (App Store Connect → AM Cuenta → se convierte en **Metas**). Es una **versión nueva**, no una app nueva.

## Pasos

1. **Compilar:** desde `mobile/`: `eas build --platform ios --profile production` (EAS sube el número de build solo).
2. **Enviar el build:** `eas submit --platform ios --profile production` (usa `ascAppId` de `eas.json`).
3. **App Store Connect → "+ Versión" → 2.0.0** y rellenar con:
   - Textos: [`descripciones.md`](descripciones.md)
   - Ícono: [`graficos/icon-1024.png`](graficos/icon-1024.png) (RGB, sin transparencia)
   - Capturas: carpeta [`graficos/`](graficos/) (`screenshot-*` de 1290×2796 y `-6.5in` de 1284×2778)
   - App Privacy: [`app-privacy-respuestas.md`](app-privacy-respuestas.md)
   - Clasificación por edad: [`age-rating-respuestas.md`](age-rating-respuestas.md)
   - URL de privacidad: `https://amcuenta-api.onrender.com/privacy`
4. **Información de revisión:** marcar "Sign-in required", poner una cuenta de prueba **nueva** y pegar las notas de `descripciones.md`.
5. **Enviar a revisión.** Apple suele tardar 1–3 días.

## Antes de enviar

- Probar la app en el iPhone (TestFlight) contra `https://amcuenta-api.onrender.com`.
- Que el servicio de Render esté arriba (ver `render.yaml`: la base de datos de pago).
