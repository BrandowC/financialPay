# Textos para App Store Connect — AM Cuenta

Copia y pega estos textos en los campos correspondientes de App Store Connect. Los límites son los que exige Apple — no son sugerencias.

---

## 📝 Nombre de la app (max 30 caracteres)

```
AM Cuenta
```

> **Caracteres:** 9 / 30 ✅

---

## 📝 Subtítulo (max 30 caracteres)

Aparece justo debajo del nombre en la ficha. Apple no tiene "descripción corta" separada como Google Play — el subtítulo cumple ese rol.

```
Tu cuenta, siempre contigo
```

> **Caracteres:** 26 / 30 ✅

---

## 📝 Texto promocional / Promotional Text (max 170 caracteres)

Es el único campo que puedes editar **sin subir una versión nueva** — úsalo para anuncios o cambios recientes.

```
Consulta el saldo de tu cuenta AM Cuenta de forma simple, rápida y segura, desde cualquier lugar. Disponible en español e inglés.
```

> **Caracteres:** 130 / 170 ✅

---

## 📝 Descripción (max 4,000 caracteres)

Mismo contenido que en Play Store, sin los emojis de encabezado que Apple recomienda evitar en exceso:

```
AM Cuenta es la aplicación oficial para que nuestros clientes consulten el estado de su cuenta de forma simple, rápida y segura, desde cualquier lugar.

FUNCIONALIDADES

- Crear tu cuenta personal en menos de un minuto
- Iniciar sesión con tu nombre o correo y contraseña
- Consultar el valor de tu cuenta en una pantalla clara y actualizada
- Cambiar entre español e inglés con un solo toque
- Cerrar sesión en cualquier momento
- Eliminar tu cuenta y todos tus datos de forma permanente cuando quieras

IMPORTANTE — QUÉ ES Y QUÉ NO ES AM CUENTA

AM Cuenta NO es un banco, NO es una entidad financiera, NO otorga créditos ni préstamos, y NO procesa pagos, depósitos, retiros ni transferencias de ningún tipo. El valor que ves en la app es un dato administrativo que nuestro equipo gestiona manualmente para cada cliente como parte de nuestro servicio; no representa fondos bancarios y no puede canjearse ni transferirse como dinero.

PRIVACIDAD Y SEGURIDAD

Nos tomamos la privacidad en serio:

- Toda la información viaja cifrada con HTTPS/TLS
- Las contraseñas se protegen con Argon2id, un estándar moderno de seguridad
- Puedes eliminar tu cuenta y todos tus datos en cualquier momento desde la propia app
- No mostramos anuncios ni compartimos tus datos con terceros con fines de publicidad

DATOS QUE PEDIMOS AL REGISTRARTE

- Nombre completo
- Correo electrónico
- Contraseña (cifrada, nunca en texto plano)
- Fecha de nacimiento (para verificar que eres mayor de 18 años)
- Número de celular (Estados Unidos)

IDIOMAS DISPONIBLES

- Español
- Inglés

Puedes cambiar entre ambos desde cualquier pantalla, con un solo toque.

CONTACTO

Para preguntas o soporte relacionado con tu cuenta:
fronterayaite@gmail.com

POLÍTICA DE PRIVACIDAD

Disponible en el enlace de la sección "Privacy Policy" de esta ficha.
```

> **Caracteres:** ~1,750 / 4,000 ✅

---

## 📝 Palabras clave / Keywords (max 100 **bytes**, separadas por coma, sin espacios después de la coma)

Apple mide esto en bytes, no caracteres — evita acentos si te acercas al límite (aquí no hace falta):

```
cuenta,saldo,finanzas,administracion,seguridad,perfil,acceso,privado
```

> **Bytes:** ~68 / 100 ✅ — no repitas palabras que ya están en el nombre o subtítulo (Apple lo penaliza, es redundante para el buscador).

---

## 📝 Notas de la versión / What's New (max 4,000 caracteres, solo para actualizaciones — la primera versión no lo pide)

```
Primera versión de AM Cuenta: crea tu cuenta, consulta tu saldo y administra tu perfil de forma simple y segura.
```

---

## 📝 URL de soporte (Support URL) — obligatoria

Tiene que ser una página que **cargue de verdad** (Apple la visita). Si no tienes una web propia, la política de privacidad sirve como página de contacto también:

```
https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0
```

> Si más adelante tienes un sitio propio para AM Cuenta, cambia esto por esa URL — se ve más profesional que reusar la política de privacidad, pero funcionalmente cumple el requisito.

---

## 📝 URL de marketing (Marketing URL) — opcional

Déjala vacía por ahora, no es obligatoria.

---

## 📝 Copyright

```
2026 AM Cuenta Solutions & Services
```

---

## 📝 Correo de contacto (App Review Contact Information)

```
fronterayaite@gmail.com
```

---

## 📝 Categoría

- **Categoría principal:** `Finance`... **NO** — igual que en Play Store, evita "Finance": activa escrutinio extra de la Guideline 5.1.1(ix) (servicios financieros regulados) sin que la app realmente lo sea.
- **Usa en su lugar:** `Productivity` (categoría principal) — `Utilities` es la alternativa si Productivity no calza con el resto de tu catálogo.

---

## ✅ CHECK FINAL

- [ ] Nombre: `AM Cuenta`
- [ ] Subtítulo (30 chars)
- [ ] Texto promocional (170 chars)
- [ ] Descripción (~1,750 chars)
- [ ] Keywords (~68 bytes)
- [ ] URL de soporte funcional
- [ ] Copyright
- [ ] Categoría: Productivity (no Finance)
- [ ] Ícono 1024×1024 subido (`graficos/icon-1024.png`)
- [ ] Screenshots de iPhone 6.9" subidos (`graficos/`)
- [ ] App Privacy respondida (ver `app-privacy-respuestas.md`)
- [ ] Age Rating respondida (ver `age-rating-respuestas.md`)
- [ ] Cuenta de demo + notas para el revisor (ver `README.md`)
- [ ] Build compilado con Xcode 26 / SDK iOS 26 (obligatorio desde el 28 abr 2026)
