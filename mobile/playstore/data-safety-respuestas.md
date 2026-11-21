# Data Safety — Respuestas exactas para Google Play Console

⚠️ **CRÍTICO:** Google verifica estas respuestas contra el comportamiento real de la app. Si declaras menos datos de los que realmente recoges, o si tu política de privacidad no coincide con esto, te pueden suspender la cuenta de desarrollador. Estas respuestas están sincronizadas con el backend real de AM Cuenta (API propia en PostgreSQL + sincronización opcional a Google Sheets).

---

## 🔐 Sección: Data Collection and Security

| Pregunta | Respuesta |
|---|---|
| Does your app collect or share any of the required user data types? | ✅ **Yes** |
| Is all of the user data collected by your app encrypted in transit? | ✅ **Yes** (HTTPS/TLS en todas las llamadas a la API) |
| Do you provide a way for users to request that their data is deleted? | ✅ **Yes** (botón "Eliminar mi cuenta" en la pantalla de cuenta; borra también el registro interno) |
| "I have read and agree to the Play Families Policy" | No marcar — la app no está dirigida a niños |

---

## 📋 Sección: Data Types — qué datos recoges

Marca **SOLO** los que están en esta lista.

### ✅ Personal info — MARCAR

| Tipo de dato | Marcar | Detalles |
|---|---|---|
| **Name** | ✅ Sí | Nombre completo del usuario |
| **Email address** | ✅ Sí | Para autenticación |
| **User IDs** | ✅ Sí | ID interno (UUID) generado por nuestro backend |
| **Address** | ❌ No | |
| **Phone number** | ✅ Sí | Para identificación de contacto |
| **Race and ethnicity** | ❌ No | |
| **Political or religious beliefs** | ❌ No | |
| **Sexual orientation** | ❌ No | |
| **Other info** | ✅ Sí | Fecha de nacimiento (verificación de mayoría de edad) |

### ⚠️ Financial info — NO marcar nada

| Tipo de dato | Marcar | Detalles |
|---|---|---|
| **User payment info** | ❌ No | La app NO procesa pagos |
| **Purchase history** | ❌ No | |
| **Credit score** | ❌ No | |
| **Other financial info** | ❌ No | |

> ⚠️ **NO marques nada en Financial info**, aunque la app muestre un "saldo". La app NO maneja dinero real: el valor mostrado es un dato administrativo interno que el equipo de AM Cuenta gestiona a mano para cada cliente, no una cuenta bancaria, tarjeta ni instrumento financiero. El número de cuenta (`AMC-XXXXXXXX`) es un identificador interno, no un número de cuenta real.

### El resto de categorías — NO marcar nada

Health and fitness, Messages, Photos and videos, Audio files, Files and docs, Calendar, Contacts, App activity, Web browsing, App info and performance, Device or other identifiers: **ninguna se recolecta.**

---

## 🎯 Para CADA dato marcado (Name, Email, Phone, User IDs, Other info = Birth Date)

| Pregunta | Respuesta |
|---|---|
| Is this data collected, shared, or both? | **Collected** |
| Is this data processed ephemerally? | **No** (se almacena de forma permanente mientras la cuenta exista) |
| Is this data required or optional for users? | **Required** |
| Why is this user data collected? | ✅ **App functionality**, ✅ **Account management** |

> Repite exactamente esta misma respuesta para los 5 tipos de dato marcados arriba — todos se recolectan por el mismo motivo (crear y operar la cuenta) y de la misma forma.

**Nota sobre "shared":** el equipo administrativo de AM Cuenta mantiene, de forma opcional, una copia interna de estos mismos datos en una hoja de Google Sheets privada, exclusivamente como respaldo del negocio (no es pública ni se usa con fines de publicidad). Google considera esto **procesamiento por un proveedor de servicios del propio desarrollador**, no "compartir con terceros" — no cambia las respuestas de arriba. Está documentado en la Política de Privacidad, sección 5.

---

## 🛡️ Sección: Security Practices

| Pregunta | Respuesta |
|---|---|
| Is your data encrypted in transit? | ✅ **Yes** |
| Do you have a way for users to request data deletion? | ✅ **Yes — users can delete their account directly in the app** |

---

## 🌐 Sección: Privacy Policy

| Pregunta | Respuesta |
|---|---|
| Privacy Policy URL | `https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0` (hazla pública primero — ver `descripciones.md`) |

---

# 🎯 Target Audience and Content

| Pregunta | Respuesta |
|---|---|
| What age group is your app targeted at? | ✅ **18 and over** |
| Could the app appeal to children? | ❌ **No** |
| Did you take measures to ensure your app is not appealing to children? | ✅ **Yes** — el registro exige y verifica fecha de nacimiento; se rechaza a cualquier persona menor de 18 años. Sin personajes animados, sin colores ni mecánicas dirigidas a menores. |

---

# 📰 / 🦠 / 🏛️ Declaraciones simples

| Pregunta | Respuesta |
|---|---|
| Is this a news app? | ❌ No |
| Is this a COVID-19 contact tracing or status app? | ❌ No |
| Is this a government-affiliated app? | ❌ No |

---

# 💰 Financial Features (⚠️ la sección más importante — léela completa)

Esta es la sección que Google revisa con más cuidado porque el nombre de la app incluye "Cuenta" y la pantalla principal muestra un saldo.

| Pregunta | Respuesta |
|---|---|
| Does your app provide any financial features? | ❌ **No** |

**Justificación que puedes usar si Google pide más contexto** (cópiala en el campo de notas si aparece uno):

```
AM Cuenta muestra un valor administrativo de cuenta que el equipo del negocio
gestiona manualmente para cada cliente, con fines de registro y control interno.
La aplicación NO permite depositar, retirar, transferir, invertir, pedir
préstamos, ni realizar ningún tipo de pago o transacción. No se conecta con
cuentas bancarias, tarjetas ni proveedores de pago. El valor mostrado no es
canjeable por dinero. Por estos motivos, la app no ofrece funciones
financieras según la definición de Google Play.
```

Si aparecen sub-preguntas, todas son **No**:
- Loans → **No**
- Investment apps → **No**
- Money transfer → **No**
- Insurance → **No**
- Banking apps → **No**
- Cryptocurrency exchanges → **No**
- Digital wallets → **No**

---

# 🛒 Ads

| Pregunta | Respuesta |
|---|---|
| Does your app contain ads? | ❌ **No** |

---

# 📵 App Access (¿requiere login?)

| Pregunta | Respuesta |
|---|---|
| All or some functionality is restricted? | ✅ **Yes — login required** |

**Texto para el campo de instrucciones al reviewer** (actualizado a las reglas reales del formulario: contraseña mínimo 8 caracteres, celular de EE. UU. de 10 dígitos, mayor de 18 años):

```
Para revisar la app, puede crear una cuenta nueva desde la pantalla de registro:

1. Toque "Comenzar" en la pantalla de bienvenida
2. Toque "¿No tienes cuenta? Crear cuenta"
3. Complete: nombre completo, fecha de nacimiento (debe indicar 18 años o más),
   número de celular de 10 dígitos (formato EE. UU., por ejemplo 3015551234),
   correo electrónico y una contraseña de al menos 8 caracteres
4. Toque "Crear cuenta" — el acceso es inmediato, no requiere verificar el correo

Alternativamente, puede usar esta cuenta de prueba ya creada:
Correo: reviewer@amcuenta.com
Contraseña: ReviewerDemo2026

(Esta cuenta de prueba se crea antes de enviar la app a revisión — ver
checklist al final de este documento.)
```

> ⚠️ **Antes de hacer submit**, crea de verdad esa cuenta de prueba contra tu backend en producción (`POST /auth/register` o desde la app) para que el revisor pueda entrar.

---

# ✅ CHECKLIST FINAL del formulario

- [ ] Data Safety: declaré Name, Email, Phone, User IDs, Other (birth date) — todos como Required
- [ ] Data Safety: NO marqué nada en Financial info
- [ ] Data Safety: "Yes" para encryption in transit y para data deletion
- [ ] Privacy Policy URL pegada y **verificada en ventana de incógnito** (debe cargar sin iniciar sesión)
- [ ] Target audience: 18 and over
- [ ] Financial features: No, con la justificación de arriba si Google la pide
- [ ] News, COVID, Government: todos No · Ads: No
- [ ] App Access: login required + cuenta de prueba real ya creada en producción
