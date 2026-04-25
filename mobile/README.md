# FinancialPay — App móvil (Expo + Supabase)

App móvil sencilla con 3 pantallas: **Login**, **Registro** y **Cuenta** (estática con saldo en cero).

## Qué hace

1. **Registro**: correo, contraseña, nombre completo y fecha de nacimiento. Se crea el usuario en Supabase Auth y un perfil en la tabla `profiles` con un número de crédito aleatorio (16 dígitos, 4 bloques).
2. **Login**: correo + contraseña.
3. **Cuenta**: muestra `FinancialPay`, el nombre del usuario, el número de crédito y **$0.00 USD** como saldo (estático por ahora).

Todo está respaldado por **Supabase** (Auth + Postgres). Sin backend propio.

---

## Setup rápido (primera vez)

### 1. Configurar Supabase

1. Ve a tu proyecto en https://app.supabase.com
2. Abre **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**. Esto crea la tabla `profiles` y las políticas RLS.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → va en `EXPO_PUBLIC_SUPABASE_URL`
   - **anon public key** → va en `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. (Opcional, recomendado para probar rápido) En **Authentication → Providers → Email**, desactiva *"Confirm email"* mientras desarrollas, así los usuarios pueden entrar de inmediato sin esperar correo.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Abre `.env` y pega los valores reales.

### 3. Instalar e iniciar

```bash
npm install        # ya hecho si acabas de crear el proyecto
npx expo start
```

Se abrirá Metro con un QR. En tu celular:

- **Android**: abre **Expo Go** y escanea el QR.
- **iOS**: abre **Cámara**, apunta al QR y toca la notificación.

> Tu celular y tu PC deben estar en la **misma red Wi-Fi**. Si no funciona, prueba `npx expo start --tunnel`.

---

## Ver registros en Supabase

- **Usuarios**: Supabase → **Authentication → Users**
- **Perfiles (nombre, fecha, número de crédito)**: Supabase → **Table Editor → profiles**

---

## Estructura del proyecto

```
mobile/
├── app/
│   ├── _layout.tsx          ← Layout raíz + AuthProvider
│   ├── index.tsx            ← Redirige según sesión
│   ├── (auth)/
│   │   ├── _layout.tsx      ← Bloquea si ya hay sesión
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx      ← Bloquea si no hay sesión
│       └── account.tsx      ← Pantalla estática
├── lib/
│   ├── supabase.ts          ← Cliente Supabase
│   └── auth.tsx             ← Context de sesión + perfil
├── supabase/
│   └── schema.sql           ← Ejecutar en Supabase (1 vez)
├── .env.example
└── app.json                 ← name: FinancialPay, package: com.financialpay.app
```

---

## Publicar en Play Store (cuando esté listo)

1. Crea cuenta en https://expo.dev (gratis) y en Play Console ($25 USD una sola vez).
2. Instala EAS: `npm install -g eas-cli`
3. `eas login` y `eas build:configure`
4. Build de producción: `eas build -p android --profile production`
5. Sube el `.aab` resultante a Play Console.

El `package` ya está configurado como `com.financialpay.app` en `app.json` — cámbialo si necesitas otro.

---

## Cambiar el nombre de la app

Todo lo que necesitas tocar:

- `app.json` → `expo.name`, `expo.slug`, `expo.scheme`, `expo.android.package`
- Textos en las 3 pantallas (`login.tsx`, `register.tsx`, `account.tsx`): buscar `FinancialPay`
