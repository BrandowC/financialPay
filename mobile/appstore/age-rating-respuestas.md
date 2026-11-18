# Age Ratings — Respuestas para App Store Connect

Apple renovó este cuestionario (vigente desde el 31 de enero de 2026): las bandas ahora son **4+, 9+, 13+, 16+, 18+** — ya no existen las viejas 12+/17+. Se llena en **App Store Connect → App Information → Age Ratings**.

---

## Preguntas de contenido (todas son "None" para AM Cuenta)

AM Cuenta no tiene ningún tipo de contenido generado por usuarios, violencia, temas para adultos, apuestas, ni redes sociales — es un formulario de registro/login y una pantalla de saldo. Responde **"None"** (o el equivalente "No" según cómo lo presente el formulario) a TODAS estas categorías:

| Categoría | Respuesta |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Information | None |
| Gambling and Contests (simulado) | None |
| **Unrestricted Web Access** | **No** — la app no tiene un navegador embebido ni enlaces a contenido web abierto sin control |
| **Contests** | No |

## Preguntas nuevas (capacidades / social, agregadas en la actualización 2025-2026)

| Pregunta | Respuesta |
|---|---|
| ¿La app permite chat, mensajería o interacción social entre usuarios? | **No** |
| ¿La app permite compartir contenido generado por el usuario con otros? | **No** |
| ¿La app tiene compras dentro de la app (in-app purchases)? | **No** |
| ¿La app usa apuestas simuladas o de dinero real (gambling)? | **No** |

## Gambling and Contests — Real Money

| Pregunta | Respuesta |
|---|---|
| ¿La app ofrece apuestas o loterías con dinero/premios reales? | **No** — el "saldo" que muestra la app es un valor administrativo interno, no dinero real ni un premio |

---

## Resultado esperado del cuestionario

Con todas las respuestas en "None"/"No", el cálculo automático de Apple va a dar **4+** (la banda más baja, sin restricciones de contenido).

### ⚠️ Recomendación: súbela manualmente a 17+ (o 18+ si el sistema lo permite)

Aunque el **contenido** de AM Cuenta es apto para todo público, el **servicio en sí solo está disponible para mayores de 18 años** (la app rechaza el registro de menores, ver `politica-privacidad.md` sección 7). Apple permite fijar una calificación **más alta** que la calculada automáticamente cuando la política de negocio lo exige, y es justo tu caso — igual que en Play Store donde declaraste "Target audience: 18 and over".

Hazlo así en App Store Connect: después de responder el cuestionario y ver el resultado automático (probablemente 4+), busca la opción de **ajustar manualmente la calificación final** y súbela a la banda de mayor edad disponible (17+/18+ según cómo la presente tu versión de App Store Connect). Esto evita cualquier fricción con el revisor por una app "de finanzas" mostrada como apta para niños.

---

## ✅ CHECKLIST

- [ ] Todas las preguntas de contenido: None/No
- [ ] Preguntas de apuestas/dinero real: No
- [ ] Calificación final ajustada manualmente a la banda más alta (17+/18+), no dejarla en el 4+ automático
