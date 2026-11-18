# Gráficos para App Store Connect — estado y specs exactos

## ✅ Ya listo

- [`graficos/icon-1024.png`](graficos/icon-1024.png) — copiado directo de `mobile/assets/images/icon.png`, que ya viene en **1024×1024, RGB sin canal alfa** — exactamente lo que Apple exige. **No lo recortes ni le agregues esquinas redondeadas**: Apple aplica la máscara "squircle" automáticamente: si se la entregas ya recortada, se ve mal (doble redondeo).

## ✅ Screenshots de iPhone — ya generados

Apple exige capturas reales de la app, **sin transparencia** (PNG/JPG opacos), en un tamaño exacto de una de estas tres opciones para el bucket "6.9 pulgadas" (cubre iPhone 16/17/18 Pro Max, 15/16 Plus, Air):

| Tamaño | Dispositivo de referencia |
|---|---|
| **1290 × 2796** ← el que vamos a usar | iPhone 15/16 Pro Max |
| 1320 × 2868 | iPhone 16/17 Pro Max |
| 1260 × 2736 | iPhone 16/17 Plus |

Con subir **este único set de 6.9"**, Apple escala automáticamente hacia los tamaños menores (6.5", 6.3", 6.1"...) — **no hace falta preparar varios tamaños**. El viejo requisito de "6.5 pulgadas obligatorio siempre" ya no aplica si subes 6.9".

**Cuántas:** mínimo 1, recomendado 4-6 (igual que en Play Store, reusamos las mismas 4 pantallas: bienvenida, login, registro, cuenta).

### Cómo se van a generar

Igual que hicimos para Play Store: un script headless (Puppeteer + Chrome) que navega la app corriendo localmente y toma las capturas a la resolución exacta que pide Apple — no hace falta celular ni Mac. La única diferencia con las de Android es el tamaño de salida (1290×2796 en vez de 1082×1924) y que hay que confirmar que salgan **sin canal alfa** (PNG opaco).

**Esto necesita la API y la base de datos corriendo local** (Docker + `npm run start:dev` en `api/`) para poder loguear con la cuenta de prueba y capturar la pantalla de cuenta con saldo real. Avísame cuando quieras que lo hagamos y seguimos desde ahí — las capturas de bienvenida/login/registro no necesitan login así que podrían salir sin la API, pero para tener las 4 consistentes conviene hacerlas todas de una vez.

### ⚠️ Decisión pendiente: ¿la app soporta iPad?

`mobile/app.json` tiene `"ios": { "supportsTablet": true }`. Si se mantiene así, Apple **también exige** un set de screenshots de iPad (13", 2064×2752px) — y como el diseño actual de AM Cuenta está pensado para celular (no hay un layout adaptado a pantalla grande), esas capturas se verían como un formulario angosto flotando en medio de una pantalla enorme, lo cual no se ve profesional y puede generar comentarios del revisor.

**Recomendación:** cambiar `supportsTablet` a `false` antes de compilar el build de iOS, así solo se piden assets de iPhone. Es un cambio de una palabra en `app.json` — dime si lo hago.

---

## Dónde quedan guardadas

```
mobile/appstore/graficos/
├── icon-1024.png                     ✅ ya está
├── screenshot-1-welcome.png          ✅ ya está (1290×2796)
├── screenshot-2-login.png            ✅ ya está (1290×2796)
├── screenshot-3-register.png         ✅ ya está (1290×2796)
└── screenshot-4-account.png          ✅ ya está (1290×2796)
```
