# Instrucciones — Hostear la Política de Privacidad GRATIS

Google Play exige una **URL pública** de la política de privacidad. No se puede subir un PDF, debe ser una **página web** accesible desde cualquier navegador.

## ✅ Ya tienes una URL pública lista, sin hacer nada

```
https://claude.ai/code/artifact/8513bc71-3218-4924-b475-f4d1c58f9ed0
```

Antes de usarla: ábrela con tu sesión de Claude y usa el menú de compartir para marcarla como **pública** (por defecto es privada). Luego pruébala en una ventana de incógnito — si carga sin pedir inicio de sesión, ya sirve para pegar en Play Console tal cual. Con esto **puedes saltarte todo lo demás de este archivo.**

Si prefieres tu propio dominio (por ejemplo para que se vea más "de marca" o para no depender de un enlace de claude.ai), usa `Index.html` de esta misma carpeta con cualquiera de las 3 opciones de abajo — ya tiene el contenido actualizado y correcto.

---

# Opción 1 — GitHub Pages (gratis y en tu propio dominio)

Gratis para siempre. URL bonita. Tu cuenta de GitHub que ya tienes funciona.

## Pasos

### 1. Crear un repo nuevo en GitHub

1. Entra a [github.com](https://github.com) con tu cuenta
2. Click en el botón **"+"** arriba a la derecha → **"New repository"**
3. Nombre del repo: `am-cuenta-policy` (o como quieras)
4. **Public** (debe ser público para que GitHub Pages funcione gratis)
5. ✅ Marca **"Add a README file"**
6. Click **"Create repository"**

### 2. Subir el archivo HTML

1. En el repo nuevo, click **"Add file"** → **"Upload files"**
2. Arrastra el archivo `Index.html` desde `mobile/playstore/`
3. **Renómbralo a `index.html`** antes de hacer commit. Para esto: en GitHub, después de subirlo, click en el archivo → ícono de lápiz (✏️) → cambia el nombre arriba de `Index.html` a `index.html`
4. Scroll abajo → **"Commit changes"**

> Otra opción más rápida: súbelo ya con el nombre `index.html`. Renombra el archivo en tu PC antes de subirlo.

### 3. Activar GitHub Pages

1. En el repo, ve a **Settings** (arriba)
2. En el menú lateral izquierdo: **Pages**
3. En **"Source"**: selecciona **"Deploy from a branch"**
4. **Branch:** `main` / `(root)` → **Save**
5. Espera 1-2 minutos. GitHub te genera una URL.

### 4. Verificar tu URL

GitHub te dará una URL así:

```
https://[tu-usuario-github].github.io/am-cuenta-policy/
```

Por ejemplo, si tu usuario es `gregorioaz`:

```
https://gregorioaz.github.io/am-cuenta-policy/
```

Abre esa URL en tu navegador. Debes ver la política de privacidad bonita con los colores azules y dorados.

### 5. Copiar la URL

Esta URL es la que pegas en Play Console en el campo **"Privacy Policy URL"**.

---

# Opción 2 — Netlify Drop (más rápido, sin crear cuenta)

Si no quieres lidiar con GitHub:

1. Entra a [app.netlify.com/drop](https://app.netlify.com/drop)
2. Crea una carpeta en tu PC con SOLO este archivo: `Index.html` renombrado a `index.html`
3. Arrastra esa carpeta a la página de Netlify Drop
4. Espera 10 segundos. Te dan una URL así: `https://abcd1234-amazing.netlify.app`
5. ⚠️ **Esa URL es temporal y se borra después de 24 horas si no creas cuenta.**
6. Para que sea permanente: click en "Claim this site" → crear cuenta gratis → la URL queda fija para siempre

---

# Opción 3 — Vercel (igual de bueno que GitHub Pages)

1. Entra a [vercel.com](https://vercel.com) con tu cuenta de GitHub
2. **Add new → Project**
3. Importa el repo `am-cuenta-policy` que creaste arriba (Opción 1)
4. Vercel detecta que es HTML estático y te da una URL bonita: `https://am-cuenta-policy.vercel.app/`

---

# Opción 4 — Si tu cliente tiene un dominio propio

Si tu cliente tiene `amfinancialsolutions.com` o cualquier sitio web:

1. Pídele que ponga el archivo `Index.html` en una subruta de su sitio
2. URL final: `https://amfinancialsolutions.com/privacidad`

Este es el camino MÁS profesional pero requiere que tu cliente coopere.

---

# 🎯 Mi recomendación

**Usa la Opción 1 (GitHub Pages)** porque:
- Gratis para siempre, sin límites
- URL profesional y permanente
- Si necesitas actualizar la política, solo subes el archivo nuevo y se actualiza
- Es lo que usan los desarrolladores serios

Total tiempo: **5 minutos** para tener la URL lista.

---

# ⚠️ IMPORTANTE — Verifica antes de submit a Play Store

Antes de pegar la URL en Play Console:

1. ✅ Abre la URL en tu navegador → debes ver la política completa
2. ✅ Abre la URL en tu **celular** → debe verse responsive y legible
3. ✅ Verifica que la URL **NO tiene "?" o caracteres raros** al final
4. ✅ Confirma que **NO requiere login** para ver la página (debe ser pública)

Google verifica que la URL funcione antes de aprobar tu app. Si la URL está rota o requiere login, te rechazan.

---

# 📋 Checklist final

- [ ] Subí `Index.html` (renombrado a `index.html`) a GitHub Pages
- [ ] Esperé 2 min y se generó la URL
- [ ] Probé la URL en navegador y se ve bien
- [ ] Probé la URL en celular y se ve bien
- [ ] Anoté la URL en `playstore/README.md` para tenerla a mano
- [ ] Listo para pegarla en Play Console
