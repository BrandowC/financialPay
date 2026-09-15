# Sincronización con Google Sheets

Referenciado desde `api/.env.example` (`GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`). Es completamente opcional: con
`GOOGLE_SHEETS_ENABLED=false` (el valor por defecto), cada registro y cada
cambio de saldo se acumula igual en la tabla `outbox_events` y no se pierde
nada — simplemente no se copia a ninguna hoja de cálculo hasta que esto se
configure.

## 1. Crear el proyecto y la cuenta de servicio en Google Cloud

1. Entra a [console.cloud.google.com](https://console.cloud.google.com/) y
   crea un proyecto (o usa uno existente).
2. Ve a **APIs y servicios → Biblioteca**, busca "Google Sheets API" y
   habilítala para ese proyecto.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → Cuenta de
   servicio**. Dale un nombre (por ejemplo `am-cuenta-sheets-sync`) y
   termina el asistente (no hace falta asignarle ningún rol de proyecto).
4. Entra a la cuenta de servicio recién creada, pestaña **Claves → Agregar
   clave → Crear clave nueva → JSON**. Se descarga un archivo `.json` — es la
   única vez que Google entrega esa clave privada, guárdalo bien.

## 2. Compartir la hoja de cálculo con la cuenta de servicio

La cuenta de servicio no tiene acceso a nada por defecto, ni siquiera a hojas
tuyas: hay que compartirla explícitamente, igual que compartirías un Google
Sheet con otra persona.

1. Abre (o crea) la hoja de cálculo donde quieres que se copien los
   registros.
2. Botón **Compartir**, y agrega como editor el correo de la cuenta de
   servicio — es el campo `client_email` dentro del JSON descargado, con la
   forma `algo@tu-proyecto.iam.gserviceaccount.com`.
3. Copia el ID de la hoja de la URL: en
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`, es la parte
   entre `/d/` y `/edit`.

## 3. Variables de entorno

Del JSON descargado en el paso 1, estas dos van a `api/.env` (o a los
secretos de Render en producción — nunca al repositorio):

```
GOOGLE_SHEETS_ENABLED=true
GOOGLE_SHEETS_SPREADSHEET_ID=<el ID copiado en el paso 2>
GOOGLE_SHEETS_TAB_NAME=Registros
GOOGLE_SERVICE_ACCOUNT_EMAIL=<client_email del JSON>
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=<private_key del JSON, con los \n literales>
```

**Sobre `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`**: dentro del JSON, la clave
viene como una sola línea con saltos de línea escapados como `\n` — cópiala
tal cual, con las comillas y los `\n` literales incluidos. No la
"desescapes" a saltos de línea reales: `api/src/config/env.schema.ts` y el
adaptador de Google (`google-sheets.adapter.ts`) esperan exactamente ese
formato, igual que lo entrega Google.

## 4. Verificar

Con `GOOGLE_SHEETS_ENABLED=true` y las tres variables anteriores completas,
arranca la API. Si algo falta, el esquema de entorno (`env.schema.ts`) hace
fallar el arranque con un mensaje explícito — nunca arranca "a medias". Para
confirmar que la sincronización de verdad está corriendo, `GET /health`
incluye un bloque `sync` con los eventos pendientes/fallidos del outbox: si
baja a cero después de un registro nuevo, está funcionando.
