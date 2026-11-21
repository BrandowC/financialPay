# Google Play — publicar la versión 2.0.0 de Metas

La ficha ya existe. Es una **versión nueva**, no una app nueva.

## Pasos

1. **Compilar:** desde `mobile/`: `eas build --platform android --profile production` (genera el `.aab`).
2. **Play Console → tu app → Versiones → Producción (o Pruebas cerradas, si la cuenta es nueva) → Crear versión** y subir el `.aab`.
3. **Ficha de la tienda:** textos en [`descripciones.md`](descripciones.md); ícono 512×512 y capturas en [`graficos/`](graficos/).
4. **Contenido de la app** (hay que actualizar cada formulario):
   - Seguridad de los datos: [`data-safety-respuestas.md`](data-safety-respuestas.md)
   - Clasificación de contenido: [`content-rating-respuestas.md`](content-rating-respuestas.md)
   - Política de privacidad: `https://amcuenta-api-phi2.onrender.com/privacy`
   - Funciones financieras: "ninguna" (ver `descripciones.md`)
5. **Enviar a revisión.**

> Las cuentas personales nuevas de Google Play deben pasar una **prueba cerrada con 12 testers durante 14 días** antes de publicar en producción.
