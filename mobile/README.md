# AM Cuenta — App móvil (Expo)

App móvil con 4 pantallas: **Bienvenida**, **Login**, **Registro** y **Cuenta** (solo lectura: el cliente ve su saldo, no puede modificarlo).

## Qué hace

1. **Registro**: nombre completo, fecha de nacimiento (18+), celular de EE. UU. y contraseña (mínimo 8 caracteres).
2. **Login**: con nombre completo o correo + contraseña.
3. **Cuenta**: nombre, número de cuenta (`AMC-XXXXXXXX`) y el saldo — el mismo valor que un administrador edita desde el panel web. El saldo se anima al entrar y se puede refrescar deslizando hacia abajo.
4. **Eliminar cuenta**: borra el usuario y todos sus datos de forma permanente (requisito de Google Play desde 2024).

Todo esto ya **NO** usa Supabase. El backend es la API propia en `../api/` (NestJS + PostgreSQL) — ver el README del monorepo. La app solo habla HTTP con esa API.

---

## Setup rápido (primera vez)

### 1. Levantar el backend

Sigue el README de `../api/` primero: base de datos con Docker, migraciones, y `npm run start:dev`. La API debe quedar escuchando (por defecto) en `http://localhost:3000/api/v1`.

### 2. Variables de entorno

```bash
cp .env.example .env
```

Por defecto apunta a `http://localhost:3000/api/v1`. Si pruebas desde un **celular físico** o un emulador, `localhost` no resuelve a tu PC: cambia esa URL por la IP de tu red local, por ejemplo `http://192.168.1.10:3000/api/v1`.

### 3. Instalar e iniciar

```bash
npm install
npx expo start
```

Se abrirá Metro con un QR. En tu celular:

- **Android**: abre **Expo Go** y escanea el QR.
- **iOS**: abre **Cámara**, apunta al QR y toca la notificación.

> Tu celular y tu PC deben estar en la **misma red Wi-Fi**. Si no funciona, prueba `npx expo start --tunnel`.

---

## Estructura del proyecto

```
mobile/
├── app/
│   ├── _layout.tsx          ← Layout raíz + AuthProvider + LanguageProvider
│   ├── index.tsx            ← Redirige según sesión
│   ├── welcome.tsx          ← Pantalla de bienvenida
│   ├── (auth)/
│   │   ├── _layout.tsx      ← Bloquea si ya hay sesión
│   │   ├── login.tsx
│   │   └── register.tsx
│   └── (app)/
│       ├── _layout.tsx      ← Bloquea si no hay sesión
│       └── account.tsx      ← Saldo de solo lectura, animado
├── components/
│   ├── ui/                  ← Button, TextField, AnimatedBalance, PasswordStrengthMeter
│   ├── GradientBackground.tsx
│   ├── BrandHeader.tsx
│   ├── LanguageToggle.tsx
│   └── Select.tsx
├── lib/
│   ├── theme.ts             ← Colores, tipografía, espaciados — un solo lugar
│   ├── api.ts                ← Cliente HTTP: login/registro/refresh automático
│   ├── secure-storage.ts    ← Refresh token cifrado (Keychain/Keystore)
│   ├── auth.tsx              ← Context de sesión + perfil
│   ├── error-messages.ts    ← Traduce códigos de error de la API a texto local
│   ├── i18n.tsx              ← Español/Inglés
│   └── constants.ts          ← Reglas de edad, teléfono, etc.
├── .env.example
└── app.json
```

---

## Publicar en Play Store

Toda la checklist y los textos ya redactados están en [`playstore/`](playstore/README.md). Antes de generar el build de producción, actualiza la URL de la API en `eas.json` (`build.production.env.EXPO_PUBLIC_API_URL`) para que apunte al servidor real, no a `localhost`.

```bash
eas build -p android --profile production
```
