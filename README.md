# Catálogo SaaS

Catálogo multi-tienda. Cada administradora de negocio se registra, pone el nombre de su negocio y administra sus productos por categoría.

Sitio estático (HTML + CSS + JS) para **GitHub Pages**, con **Firebase** (Authentication + Realtime Database).

## Estructura

```
index.html            Login / registro (correo + contraseña, o Google)
app.html              Panel: nombre del negocio, código de cliente, uso 0/250, 5 categorías
categoria.html        Productos de una categoría: subir foto con código, inhabilitar, borrar
css/styles.css
js/firebase-config.js ← aquí va la configuración de tu proyecto Firebase
js/firebase.js        Inicialización y utilidades
js/auth.js            Lógica del login
js/app.js             Lógica del panel
js/datos.js           Modelo de datos, códigos y límite (250)
js/categoria.js       Subir/listar/inhabilitar/borrar productos
storage.rules         Reglas para Firebase Storage (fotos)
database.rules.json   Reglas para Realtime Database
.nojekyll             Para que GitHub Pages sirva los archivos tal cual
```

## Configurar Firebase (una sola vez)

1. Crea un proyecto **nuevo** en https://console.firebase.google.com (no uses el de Carols: las reglas de abajo reemplazan las existentes).
2. **Authentication → Sign-in method**: activa **Correo electrónico/contraseña** y **Google**.
3. **Realtime Database → Reglas** → pega `database.rules.json` → Publicar.
   **Storage → Reglas** → pega `storage.rules` → Publicar.
4. **Configuración del proyecto → Tus apps → Web (`</>`)** → registra la app y copia el objeto `firebaseConfig` en `js/firebase-config.js` (debe incluir `databaseURL`).
5. **Authentication → Settings → Authorized domains**: agrega `TU-USUARIO.github.io`.

## Probar en tu PC

Los módulos JS no funcionan abriendo el archivo con doble clic. Sirve la carpeta:

```bash
npx serve .
```

y abre la dirección que muestra (localhost ya está autorizado en Firebase por defecto).

## Publicar en GitHub Pages

1. Sube el contenido de esta carpeta a un repositorio.
2. Repositorio → **Settings → Pages** → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.
3. Queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

## Datos

```
contadores/ultimoCodigoCliente     último código de cliente entregado
codigosCliente/{n}                 uid dueño del código (único)
negocios/{uid}
  nombre, contacto, creadoEn
  codigoCliente      1     → "001"
  codigoDisponible   siguiente número de producto (1 → "0001"); nunca retrocede
  totalItems         productos existentes (activos + inhabilitados); al borrar baja 1
  ultimoBorrado      lo exigen las reglas al borrar
planes/{uid}/limite  solo App Factory lo cambia desde la consola (sin él: 250)
productos/{uid}/{numero}
  numero, codigo "001-0001", categoria, precio, foto, rutaFoto, disponible, creadoEn
```

Fotos en Storage: `catalogos/{uid}/{codigo}.jpg` (la foto ya lleva el código dibujado).

### Límite del plan gratuito
- Máximo **250 productos** por negocio. Lo hacen cumplir las reglas de la base de datos, no solo la pantalla.
- **Inhabilitar** no libera espacio (el producto sigue existiendo). **Borrar** sí libera un espacio.
- Los códigos **no se reutilizan**: si se borra el 001-0005, el siguiente sigue siendo el que tocaba (evita confusiones con fotos ya compartidas por WhatsApp).
- Para dar más espacio a una clienta con suscripción: en la consola, crea `planes/{uid}/limite` = 500 (o lo que corresponda).
