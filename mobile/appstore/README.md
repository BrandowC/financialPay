# App Store — Materiales para subir AM Cuenta a Apple

Equivalente a `mobile/playstore/`, pero para iOS. Los requisitos de Apple son distintos a los de Google en varios puntos importantes — están investigados y verificados contra la documentación oficial de developer.apple.com (septiembre 2026).

## Orden de pasos (sigue esta lista en orden)

### Antes de compilar/subir

- [ ] **1. Cuenta de Apple Developer Program** ($99 USD/año), tipo **Individual/Personal** (decisión tomada — más rápida de crear que Organization, verificación de identidad personal en vez de D-U-N-S Number, normalmente lista en pocos días). Como es cuenta Personal y no Organization, es **todavía más importante** dejar clarísimas las Notas de App Review del punto 15 — la Guideline 5.1.1(ix) de Apple pide que servicios "en campos altamente regulados (banca, servicios financieros...)" se sometan por una entidad legal; con cuenta Personal, si el revisor interpreta que AM Cuenta se parece demasiado a un servicio financiero real, puede pedir que la reenvíes desde una cuenta Organization. El texto de las notas (ver más abajo, sección "El punto más delicado") es tu defensa principal contra esto.
- [x] **2. Política de Privacidad pública** → misma URL que ya usas para Play Store, ya verificada como pública: `https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0`
- [x] **3. Ícono 1024×1024** → [`graficos/icon-1024.png`](graficos/icon-1024.png) ya generado (RGB, sin transparencia, sin esquinas redondeadas).
- [ ] **4. Decidir si la app soporta iPad** → ver la nota en [`instrucciones-graficos.md`](instrucciones-graficos.md). Recomendado: no (cambiar `supportsTablet` a `false` en `app.json`), para no necesitar assets de iPad que el diseño actual no contempla. **Pospuesto a propósito** — no tocar `app.json` todavía, hazlo recién cuando vayas a compilar el build de iOS (mientras tanto sigues con Play Store sin que nada de esto interfiera, porque `supportsTablet` solo afecta a iOS).
- [x] **5. Screenshots reales de iPhone (1290×2796)** → ya generados en `graficos/` (bienvenida, login, registro, cuenta).
- [x] **6. Crear la cuenta de prueba para el revisor de Apple** → ya existe en producción (la misma que se creó para Google Play): `reviewer@amcuenta.com` / `ReviewerDemo2026`.
- [ ] **7. Confirmar que el build se compila con Xcode 26 / SDK iOS 26** — obligatorio desde el 28 de abril de 2026 para cualquier build nuevo subido a App Store Connect. EAS Build se encarga de esto automáticamente si tu cuenta de Expo tiene acceso al image builder actualizado; lo confirmamos al momento de compilar.
- [ ] **8. Generar el build de iOS:** `eas build --platform ios --profile production` (desde `mobile/`) — a diferencia de Android, esto requiere tener ya la cuenta de Apple Developer creada (EAS necesita generar certificados/perfiles de firma contra tu cuenta).

### En App Store Connect

- [ ] **9. Crear el registro de la app** "AM Cuenta" (App Store Connect → My Apps → +)
- [ ] **10. Subir el build** (vía EAS Submit o Transporter)
- [ ] **11. Llenar la ficha (App Information + Version Information)** con [`descripciones.md`](descripciones.md) — nombre, subtítulo, descripción, keywords, texto promocional, URL de soporte, copyright
- [ ] **12. Subir el ícono y los screenshots**
- [ ] **13. Llenar "App Privacy"** con [`app-privacy-respuestas.md`](app-privacy-respuestas.md) — el equivalente de Apple al "Data Safety" de Google, pero con categorías distintas
- [ ] **14. Llenar "Age Ratings"** con [`age-rating-respuestas.md`](age-rating-respuestas.md) — sistema nuevo de Apple (4+/9+/13+/16+/18+), vigente desde enero 2026
- [ ] **15. Rellenar "App Review Information"**: contacto + marcar "Sign-in required" + pegar las credenciales de la cuenta de prueba + notas explicando que la app no es una entidad financiera real (mismo texto que usaste para Google, está en `app-privacy-respuestas.md` y en el checklist de abajo)
- [ ] **16. Pegar la URL de Política de Privacidad** en App Privacy → Privacy Policy URL
- [ ] **17. Submit for Review** y esperar — Apple suele tardar entre 24 horas y 3 días (más rápido que Google en general, salvo que pidan aclaraciones)

---

## Archivos en esta carpeta

| Archivo | Para qué sirve | Estado |
|---|---|---|
| `README.md` | Esta lista | — |
| `descripciones.md` | Textos para App Store Connect (nombre, subtítulo, descripción, keywords, categoría) | ✅ listo |
| `app-privacy-respuestas.md` | Respuestas exactas para la "nutrition label" de privacidad | ✅ listo |
| `age-rating-respuestas.md` | Respuestas exactas para el cuestionario nuevo de Age Ratings | ✅ listo |
| `instrucciones-graficos.md` | Estado del ícono + specs y plan para los screenshots que faltan | ✅ listo |
| `graficos/icon-1024.png` | Ícono de la app para la ficha de App Store | ✅ listo |
| `graficos/screenshot-*` | Capturas de pantalla de iPhone (1290×2796) | ✅ listas |

---

## Diferencias clave vs. el proceso de Google Play (para no confundirte entre las dos carpetas)

| | Google Play | App Store |
|---|---|---|
| Costo de cuenta | $25 USD **una sola vez** | $99 USD **al año** |
| Tipo de cuenta elegida | — | **Personal/Individual** (decisión tomada) — más rápida, pero exige notas de App Review muy claras por el rubro financiero-adyacente |
| Restricción para cuentas nuevas | Prueba cerrada: 12 testers × 14 días | Ninguna equivalente |
| Formulario de privacidad | "Data Safety" | "App Privacy" (categorías distintas, ninguna "Financial Info" que marcar aquí tampoco) |
| Clasificación por edad | Cuestionario propio de Google | Cuestionario propio de Apple (4+/9+/13+/16+/18+, distinto sistema) |
| Ícono | 512×512 | 1024×1024, sin transparencia, sin esquinas redondeadas |
| Screenshots | Cualquier proporción entre 16:9 y 9:16, 320-3840px | Tamaños EXACTOS por dispositivo (1290×2796 para 6.9") |
| Tiempo de revisión | 1-7 días | 24 horas - 3 días (generalmente más rápido) |
| Build | `.aab` vía `eas build --platform android` | `.ipa` vía `eas build --platform ios` (necesita cuenta de Apple Developer ya creada primero) |

---

## El punto más delicado, igual que en Android: "servicios financieros regulados"

Aplica la misma lógica que documentaste para Google, pero con la guideline específica de Apple:

> **Guideline 5.1.1(ix):** *"Apps that provide services in highly regulated fields (such as banking and financial services...) or that require sensitive user information should be submitted by a legal entity that provides the services, and not by an individual developer."*

Por eso la recomendación de cuenta **Organization** en el punto 1, y por eso las **Notas de App Review** (punto 15) deben dejar clarísimo, con el mismo texto que usaste para Google:

```
AM Cuenta muestra un valor administrativo de cuenta que el equipo del negocio
gestiona manualmente para cada cliente, con fines de registro y control interno.
La aplicación NO permite depositar, retirar, transferir, invertir, pedir
préstamos, ni realizar ningún tipo de pago o transacción. No se conecta con
cuentas bancarias, tarjetas ni proveedores de pago. El valor mostrado no es
canjeable por dinero.
```

## Si Apple rechaza la primera vez

Lo más común para este tipo de app:
1. Piden aclarar que no es una entidad financiera real (usa el texto de arriba).
2. Piden verificar que la cuenta de demo funcione — pruébala tú mismo antes de enviar.
3. Piden justificar mejor los datos sensibles (fecha de nacimiento, celular) — ya está cubierto en `app-privacy-respuestas.md`.
4. Si declaraste cuenta Individual y Apple pide que sea Organization por la Guideline 5.1.1(ix) — para evitarlo desde el principio, sigue la recomendación del punto 1.

Corrige y reenvía — Apple no penaliza tanto por reenvíos como Google, pero cada ciclo de revisión vuelve a tardar 24h-3 días.
