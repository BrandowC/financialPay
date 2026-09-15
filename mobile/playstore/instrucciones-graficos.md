# Gráficos para Google Play — estado y pasos que faltan

## ✅ Ya listos (generados con el logo y colores reales de la marca)

- [`graficos/icon-512.png`](graficos/icon-512.png) — 512×512, fondo sólido azul marino con degradado, sin transparencia. Listo para subir tal cual.
- [`graficos/feature-graphic-1024x500.png`](graficos/feature-graphic-1024x500.png) — 1024×500, logo + "AM Cuenta" + "Solutions & Services". Listo para subir tal cual.

No hace falta tocar Photopea ni Canva para estos dos — ya cumplen las especificaciones exactas de Play Console (resolución, formato PNG, sin texto excesivo).

---

## ⏳ Lo que falta: 4-6 screenshots reales de Android

Los que hay ahora en `graficos/` (`screenshot-1-welcome...`, etc.) son de un iPhone y de la versión **anterior** del diseño — hay que reemplazarlos por capturas del rediseño actual, tomadas en Android. Dos formas de hacerlo, de más fácil a más completa:

### Opción A — Rápida, con Expo Go en tu celular Android (recomendada)

No necesitas el backend corriendo para las pantallas de **bienvenida**, **login** y **registro** — son solo formularios. Para la pantalla de **cuenta** sí necesitas haber levantado la API (ver el README de `api/`) y tener una cuenta registrada.

1. En la carpeta `mobile/`, corre:
   ```bash
   npx expo start
   ```
2. Abre **Expo Go** en tu celular Android y escanea el QR (celular y PC en la misma red Wi-Fi).
3. Navega a cada pantalla y toma la captura con el botón de encendido + volumen abajo (o el gesto de tu modelo):
   - **Bienvenida** — la primera pantalla que carga.
   - **Login** — toca "Comenzar".
   - **Registro** — toca "¿No tienes cuenta? Crear cuenta".
   - **Cuenta** — regístrate con datos reales (o los tuyos de prueba) y entra; verás el saldo animado.
4. Las capturas quedan en la galería del celular. Pásalas a la PC y ponlas en `mobile/playstore/graficos/`, reemplazando las viejas. Nómbralas por ejemplo:
   ```
   screenshot-1-welcome.png
   screenshot-2-login.png
   screenshot-3-register.png
   screenshot-4-account.png
   ```

### Opción B — Con un emulador de Android Studio (si no tienes celular Android a mano)

1. Abre Android Studio → **Device Manager** → crea un dispositivo (ej. Pixel 7).
2. En `mobile/`, corre:
   ```bash
   npx expo start --android
   ```
   (con el emulador ya encendido, Expo lo detecta solo).
3. Navega las 4 pantallas igual que en la Opción A y usa el botón de captura del panel lateral del emulador.

### Requisitos de Play Console para los screenshots

| Requisito | Valor |
|---|---|
| Formato | PNG o JPG |
| Mínimo | 2 capturas (mínimo recomendado: 4) |
| Proporción | Entre 16:9 y 9:16 (una captura normal de celular ya cumple) |
| Resolución | Mínimo 320px, máximo 3840px en el lado más largo |

No necesitas editarlas ni ponerles marcos de celular — Play Store las muestra tal cual, a pantalla completa.

---

## Dónde guardarlas

```
mobile/playstore/graficos/
├── icon-512.png                      ✅ ya está
├── feature-graphic-1024x500.png      ✅ ya está
├── screenshot-1-welcome.png          ⏳ reemplazar
├── screenshot-2-login.png            ⏳ reemplazar
├── screenshot-3-register.png         ⏳ reemplazar
└── screenshot-4-account.png          ⏳ reemplazar
```
