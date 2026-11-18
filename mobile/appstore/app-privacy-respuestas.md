# App Privacy ("nutrition label") — Respuestas exactas para App Store Connect

⚠️ **CRÍTICO igual que en Play Store:** Apple también verifica esto contra el comportamiento real de la app durante la revisión. Declarar de menos es causa de rechazo o suspensión. Estas respuestas están sincronizadas con el backend real de AM Cuenta.

Se llena en: **App Store Connect → tu app → App Privacy**.

---

## Paso 1 — "Do you collect data from this app?"

✅ **Yes**

---

## Paso 2 — Tipos de dato a declarar

Apple organiza los datos en categorías (grupos). Marca **solo** estas, todas dentro del grupo **Contact Info**:

| Tipo de dato (categoría de Apple) | ¿Marcar? | Por qué |
|---|---|---|
| **Name** | ✅ Sí | Nombre completo pedido en el registro |
| **Email Address** | ✅ Sí | Identificador de cuenta y autenticación |
| **Phone Number** | ✅ Sí | Celular pedido en el registro |
| Physical Address | ❌ No | No se recolecta |
| Other User Contact Info | ❌ No | No aplica |

### Fecha de nacimiento — dónde declararla

Apple **no tiene** una categoría explícita "Date of Birth" en su lista oficial. Usa:

| Tipo de dato | ¿Marcar? | Por qué |
|---|---|---|
| **Other Data → Other Data Types** | ✅ Sí | Fecha de nacimiento, usada únicamente para verificar mayoría de edad (18+) |

### Categorías que NO debes marcar

| Grupo | ¿Marcar? | Por qué |
|---|---|---|
| **Financial Info** (Payment Info, Credit Info, Other Financial Info) | ❌ No | La app no recolecta medios de pago reales — el saldo mostrado es un dato administrativo interno, no una transacción financiera. Marcar esto sería declarar de más. |
| Health & Fitness | ❌ No | No aplica |
| Location (Precise / Coarse) | ❌ No | No se pide ni se usa ubicación |
| Sensitive Info | ❌ No | No aplica |
| Contacts | ❌ No | No se accede a la agenda del teléfono |
| User Content (fotos, audio, mensajes...) | ❌ No | No aplica |
| Browsing/Search History | ❌ No | No aplica |
| Identifiers (User ID, Device ID) | ⚠️ Ver nota | Internamente se genera un UUID por usuario — ver abajo |
| Purchases | ❌ No | No hay compras dentro de la app |
| Usage Data | ❌ No | No se hace tracking de comportamiento ni analítica de terceros |
| Diagnostics | ❌ No | No se usa ningún SDK de crash reporting de terceros |

**Sobre "Identifiers → User ID":** el backend sí genera un UUID interno por cliente para identificar su fila en la base de datos (uso puramente técnico, nunca visible al usuario ni usado para publicidad). Si Apple te pide ser exhaustivo, decláralo así:

| Tipo de dato | ¿Marcar? | Detalle |
|---|---|---|
| **User ID** | ✅ Sí (opcional pero más seguro declarar) | UUID interno para identificar la cuenta en la base de datos. Nunca se usa para rastreo publicitario ni se comparte con terceros. |

---

## Paso 3 — Para CADA dato marcado (Name, Email Address, Phone Number, Other Data Types, User ID)

Apple pregunta lo mismo para cada tipo de dato que marques:

| Pregunta | Respuesta |
|---|---|
| **Is this data used for tracking purposes?** | ❌ **No** (ninguno de estos datos se usa para rastrear al usuario entre apps/sitios de terceros — ver definición de "tracking" de Apple: vincular datos con identificadores de terceros con fines publicitarios. AM Cuenta no hace esto.) |
| **Is this data linked to the user's identity?** | ✅ **Yes** (la cuenta está identificada por nombre/correo, así que técnicamente todo está vinculado a la identidad del usuario) |
| **Purpose** (elige una o más) | ✅ **App Functionality** (para Name, Email, Phone, User ID) · ✅ **App Functionality** también para Other Data Types (fecha de nacimiento, verificación de edad) |

> Repite exactamente esto para los 4-5 tipos de dato marcados — todos tienen el mismo patrón: no-tracking, sí-vinculado a identidad, propósito "App Functionality".

---

## Resumen visual esperado en el resumen final de Apple

Al terminar, la ficha pública de tu app en el App Store debería mostrar algo como:

> **Data Used to Track You:** Data Not Collected
> **Data Linked to You:** Contact Info (Name, Email Address, Phone Number), Other Data Types (User ID)
> **Data Not Linked to You:** —

Esto es coherente con lo que dice la Política de Privacidad (sección 2 y 3) — no debería haber contradicciones entre ambos documentos.

---

## ✅ CHECKLIST

- [ ] Declarado: Name, Email Address, Phone Number (bajo Contact Info)
- [ ] Declarado: Other Data Types = fecha de nacimiento
- [ ] Declarado (opcional pero recomendado): User ID
- [ ] NO declarado nada bajo Financial Info
- [ ] Para cada dato: Tracking = No, Linked to identity = Yes, Purpose = App Functionality
- [ ] La ficha pública generada por Apple coincide con la Política de Privacidad
