# Guía de contenido

Cómo publicar en la web de ASEIIO sin tocar código. Todo lo que hace falta para
**un artículo**, **una galería** y **cualquier otro contenido** está aquí.

Si algo de esta guía no coincide con lo que ves, mándame un mensaje: es más
barato arreglarlo que adivinar.

---

## 0. Lo único que necesitas recordar

```bash
node scripts/build.js
```

Ese es el botón. Escribes algo en un archivo JSON, ejecutas eso, y lo ves en
`dist/`. Si escribes mal algo, el build **se para y te dice exactamente qué
falló**, en vez de subir una página rota.

Para verlo en el ordenador:

```bash
node scripts/dev.js
```

y abres <http://localhost:4321>. Se queda mirando los archivos: si guardas un
cambio, vuelve a compilar y recarga solo.

---

## 1. Publicar un artículo

### 1.1. Copiar un artículo que ya existe

```bash
cp content/posts/2026-09-28-ostomia-y-trabajo.json content/posts/2026-11-15-mi-articulo.json
```

Copiar el más cercano a lo tuyo es la forma más rápida de acertar.

### 1.2. Los campos

```jsonc
{
  "title":    "Ostomía y trabajo: tus derechos laborales",
  "slug":     "ostomia-y-trabajo",     // la URL: /blog/ostomia-y-trabajo/
  "excerpt":  "Una o dos frases. Es lo que se ve en las tarjetas y en el
               resumen que sale al compartir en redes.",
  "date":     "2026-11-15",             // YYYY-MM-DD. Da el orden.
  "author":   "Equipo ASEIIO",          // o "Marta P." si es un testimonio
  "category": "Derechos",               // Derechos | Salud | Actualidad | Testimonios
  "tags":     ["trabajo", "ostomía"],  // se ven como etiquetas bajo el título
  "art":      "bag",                    // qué ilustración lleva
  "cover":    "mix",                    // color de fondo de la tarjeta
  "blocks":   [ … ]                     // el contenido
}
```

| Campo | ¿Obligatorio? | Para qué sirve |
|---|---|---|
| `title` | **sí** | El titular. Máx. 70 caracteres o Google lo recorta. |
| `excerpt` | **sí** | 120-160 caracteres. Es lo que se ve en Google y al compartir. |
| `date` | **sí** | `YYYY-MM-DD`. Ordena el blog y el RSS. |
| `category` | **sí** | Una de las cuatro. Decide en qué pestaña del blog aparece. |
| `blocks` | **sí** | El artículo en sí. Ver §1.4. |
| `slug` | no | Si no lo pones se genera del título. **Pónlo**: una URL corta se recuerda y no cambia si luego retitulas. |
| `author` | no | Por defecto "Equipo ASEIIO". |
| `tags` | no | Etiquetas. Ayudan a que te encuentre quien busca por ese término. |
| `art` | no | `digestive`, `bag` o `people`. Si no lo pones, `digestive`. |
| `cover` | no | `mix`, `blue`, `teal` o `sand`. Es el color de fondo de la tarjeta. |
| `metaDescription` | no | Si lo pones, es lo que sale en Google en vez del `excerpt`. |
| `updated` | no | Fecha de revisión, `YYYY-MM-DD`. Sale como "actualizado el…" y avisa a Google de que el texto está vivo. |
### 1.3. Las cuatro categorías

- **Derechos** — *trabajo, certificado, prestaciones, trámites*. Lo que se
  reclama ante la administración.
- **Salud** — síntomas, tratamiento, consultas, comida.
- **Actualidad** — lo que ha cambiado: normativa, tratamientos nuevos.
- **Testimonios** — una persona contando su caso, con su permiso.

No uses "Derechos" para un texto de salud, aunque lleve la palabra "derechos".

### 1.4. Los bloques: cómo se escribe el contenido

El artículo es una lista de bloques. Cada bloque dice qué es. Ejemplos reales
que puedes copiar:

```jsonc
{ "type": "lead",  "text": "La primera frase, la que resume todo." },

{ "type": "h2",    "text": "Un apartado" },
{ "type": "h3",    "text": "Un subapartado" },
{ "type": "p",     "text": "Un párrafo. **En negrita** y [un enlace](https://ejemplo.es) funcionan." },

{ "type": "list",  "style": "check", "items": [
    "Con palomita",
    "Otra cosa"
]},
{ "type": "list",  "style": "plain", "items": [ "Sin palomita", "…" ] },

{ "type": "callout", "tone": "warn", "title": "Ojo con esto",
  "text": "El aviso en recuadro." },
// tone: info (azul) · tip (verde) · warn (ámbar) · legal (gris) · urgent (rojo)

{ "type": "quote", "text": "Lo que dijo alguien.",
  "author": "Marta P.", "role": "Socia desde 2021" },

{ "type": "table", "head": ["Qué", "Cómo", "Cuándo"],
  "rows": [ ["Fila 1", "Dato", "Dato"], ["Fila 2", "Dato", "Dato"] ] },

{ "type": "steps", "items": [
    { "title": "Primer paso", "text": "Lo que hay que hacer." },
    { "title": "Segundo paso", "text": "…" }
]},

{ "type": "columns", "items": [
    { "icon": "heart", "title": "Un título", "text": "Una idea." },
    { "icon": "spark", "title": "Otro",    "text": "Otra idea." }
]},
// icon: heart · spark · shield · scales · clock · doc · quote · card · mail · download

{ "type": "stats", "items": [
    { "value": "20+", "label": "años acompañando" },
    { "value": "1.200", "label": "personas socias" }
]},

{ "type": "faq", "items": [
    { "q": "¿Puedo pedirlo si no estoy de alta?", "a": "Sí, si…" }
]},

{ "type": "art", "which": "people", "caption": "Pie de la ilustración." },
// which: digestive (intestino) · bag (bolsa) · people (grupo de personas)

{ "type": "image", "src": "/assets/fotos/encuentro.jpg",
  "alt": "Qué se ve", "caption": "Pie de foto." },

{ "type": "gallery", "columns": 3, "caption": "Pie de la galería", "items": [
    { "src": "/assets/fotos/una.jpg", "alt": "Qué se ve en la primera",
      "caption": "Pie corto" },
    { "src": "/assets/fotos/dos.jpg",  "alt": "Qué se ve en la segunda" }
]},

{ "type": "divider" },
{ "type": "note", "text": "Aviso final: esto es orientación, no asesoramiento." }
```

**El orden de los encabezados importa.** Empieza con `lead`, sigue con `h2`, y
dentro de un `h2` usa `h3`. No saltes del `h2` al `h4`: es un problema para
quien navega con lector de pantalla y `npm test` lo detecta.

**Negrita y enlaces** funcionan dentro de `text`: `**negrita**`,
`[texto del enlace](https://…)`.

### 1.5. Elegir ilustración

| Valor | Dibujo | Cuándo |
|---|---|---|
| `digestive` | El intestino con la bolsa | Salud, diagnóstico, tratamiento |
| `bag` | La bolsa de ostomía | Ostomía, material, adaptación |
| `people` | Grupo de personas | Comunidad, testimonios, asociación |

No es obligatorio: si no pones `art`, sale el intestino. Pero elegido a mano la
portada queda más variada.

### 1.6. Publicar

```bash
node scripts/build.js
node scripts/qa.js
```

El primero compila. El segundo te dice si algo ha quedado roto: enlaces que no
llevan a ningún sitio, fotos que faltan, metadatos incompletos. **Ejecútalo
siempre**: es la red de seguridad antes de subir.

### 1.7. Retirar un artículo

Borra el archivo y reconstruye. Desaparece de la portada, del blog, de la
galería de temas, del RSS, del sitemap y del buscador. No queda rastro.

### 1.8. Programar para más adelante

Si pones una fecha futura, el artículo se publica en cuanto llegue el día: el
build lo genera y el sitemap ya lo incluye. Para que Google no lo indexe antes
de tiempo, mira §6.

---

## 2. Fotografías

### 2.1. Dónde van

```
assets/fotos/
├── 2026/
│   ├── jornada-robineras.jpg
│   └── reunion-grupo-sur.jpg
└── 2027/
```

Las subcarpetas son sólo para que te ordenes tú.

### 2.2. Prepararlas

```bash
pip3 install Pillow          # sólo la primera vez
python3 scripts/fotos.py     # procesa todo assets/fotos/
```

Qué hace con cada foto:

- la **reduce** si es más grande de 2000 px (un móvil no mejora con más);
- crea las versiones `-400`, `-800`, `-1200` y `-1600`, que la web usa solas
  para que nadie descargue la grande;
- te dice cuánto ha ahorrado cada una.

**No hace falta que copies nada a mano.** Al poner en el JSON el nombre de la
foto grande (`/assets/fotos/2026/jornada.jpg`), la web encuentra sola las
versiones pequeñas y monta el `srcset`.

Si no tienes Python, ábrela en cualquier editor de imágenes y exporta una copia
de 1600 px y otra de 800 px con los nombres `jornada-1600.jpg` y
`jornada-800.jpg`. Funciona igual.

### 2.3. El texto de la foto

- **`alt` es obligatorio.** Describe lo que se ve, no lo que significa:
  `alt: "Grupo de personas sentadas en una charla"` está bien;
  `alt: "buena vuelta"` no, porque no sirve si la imagen no carga.
- **`caption` es opcional** y sale sobre la foto.
- Si alguien aparece reconocible, **la foto es suya**. Sin permiso, fuera.

---

## 3. La galería

La galería es una página entera (`/galeria/`) y tiene su propio archivo:
`content/galeria.json`. Lo edita quien gestione las fotos, sin tocar nada más.

```jsonc
{
  "eyebrow": "Galería",
  "h1": "lo que ha pasado",
  "title": "Galería",                    // el título de la pestaña
  "desc": "Una frase de 70-160 caracteres para Google.",
  "lead": "Jornadas, grupos y encuentros.",
  "note": "Aviso sobre derechos de imagen (aparece al final).",

  "albums": [
    {
      "title": "Primera jornada de robinera",
      "date": "2026-05-16",              // sale como "16 de mayo de 2026"
      "intro": "Una frase sobre el día.",
      "columns": 3,                      // 2, 3 o 4 fotos por fila
      "photos": [
        { "src": "/assets/fotos/2026/jornada-1.jpg",
          "alt": "Qué se ve en la foto",
          "caption": "Pie corto, opcional" }
      ]
    },
    { "title": "Otro encuentro", "date": "2026-03-04", "photos": [ … ] }
  ]
}
```

Los álbumes salen en el orden en que están escritos, de arriba abajo.

**Un álbum vacío** se muestra con un aviso que explica cómo añadir el primero.
Si no existe el archivo, la página se genera igualmente con ese texto.

### 3.1. Quitar una foto que ya no puedes publicar

Bórrala del JSON, reconstruye, desaparece. No queda en ninguna copia anterior
porque `dist/` se rehace entero cada vez.

---

## 4. Los textos de la web (todo lo que no es un artículo)

Todo está en **`content/site.json`**, en un solo archivo. Los apartados:

| Clave | Qué controla |
|---|---|
| `nav` | El menú de arriba |
| `hero` | Titular, entradilla y botones de la portada |
| `marquee` | La cinta de temas que se desplazan |
| `proof` | Las cuatro cifras de la portada |
| `services` | Los seis programas de "Qué hacemos" |
| `steps` | Los cuatro pasos de "Cómo trabajamos" |
| `rights` | Las seis tarjetas de la página de Derechos |
| `resources` | Los documentos de la página de Recursos |
| `faq` | Las preguntas frecuentes (aparecen en 4 páginas y en Google) |
| `alcance` | El bloque "A quién acompañamos" |
| `team` | La junta directiva |
| `valores` | Las cuatro cosas en las que creéis |
| `story` | La historia de una socia en la portada |
| `cta` | El botón "Hazte socia/o" |
| `email`, `phone`, `address`, `hours`, `social` | Contacto, también en el pie |
| `url` | **El dominio. Cámbialo antes de publicar.** |

### 4.1. Una cosa de cada vez

Un ejemplo real, el bloque de hero:

```jsonc
"hero": {
  "eyebrow": "Asturias · más de 20 años acompañando",
  "title": "crohn, colitis\nu ostomía:\ntus *derechos*\nno se comen",
  "lead": "La entradilla. Un párrafo.",
  "badges": ["Asesoría jurídica gratuita", "Acompañamiento entre pares"],
  "stats": [ { "value": "20+", "label": "años acompañando" } ],
  "ctaPrimary":   { "label": "Hazte socia/o", "url": "/asociacion/#hazte" },
  "ctaSecondary": { "label": "Consulta tus derechos", "url": "/derechos/" }
}
```

Ojo con el titular: los saltos de línea son reales, y cada línea tiene que
caber en la columna. Si una línea es muy larga, se parte sola y queda feo. Se
mide en 72 px de letra sobre una columna de 525 px: **unos 15 caracteres por
línea**.

### 4.2. Cifras: con fuente o no van

Las cuatro cifras de la portada y las de "proof" son datos reales. Si no
tenéis la fuente a mano, **no las pongáis**: una cifra sin fuente en una web de
pacientes hace más daño que no tenerla. En su lugar, quita el bloque entero y
el espacio se ajusta solo.

---

## 5. Cambiar el aspecto

### 5.1. Colores

Al principio de `assets/styles.css`:

```css
:root {
  --blue:   #1b62b0;   --blue-d: #12447f;
  --teal:   #12a29c;   --teal-d: #0a6e69;
  --sand:   #f1eae2;   --red:  #d9534f;   --ink: #0b2a45;
}
```

Cambiar esas seis líneas repinta botones, títulos, fondos, enlaces y las
ilustraciones. **No uses colores con menos de 4,5:1 de contraste sobre blanco**,
o el texto dejará de leerse. `npm run test:a11y` lo comprueba.

### 5.2. El logotipo

`assets/brand/`:

| Fichero | Para qué |
|---|---|
| `aseiio-logo.png` | El logo oficial. **Fuente de verdad.** |
| `isotipo-128.png` | El sello que sale en la cabecera y el pie. |
| `isotipo.png` | El grande, para la imagen de redes. |
| `favicon-32/48/180.png` | El icono del navegador y del móvil. |

Si cambias el logo: deja el nuevo como `aseiio-logo.png`, y genera las
versiones pequeñas a 128 px. El sitio carga la de 128 px, así que pesa poco.

Para volver al dibujo vectorial en vez del PNG:

```json
"brand": { "mark": "svg" }
```

### 5.3. Las ilustraciones de intestinos, bolsas y personas

Se dibujan por código en `scripts/lib/art.js`. No hay fotos de stock ni
diseñador de por medio. Si quieres cambiar la forma de una, se edita ese
archivo. Si quieres cambiar el color, en §5.1.

---

## 6. Antes de subir

```bash
node scripts/build.js
node scripts/qa.js
node scripts/serve.js 4321 &      # y ábrelo en el móvil de verdad
npm test                           # 139 comprobaciones
```

`npm test` tarda unos minutos porque abre un navegador real. Antes de una
publicación grande, merece la pena.

Lista manual, para el día que publicéis:

- [ ] ¿Se lee bien en el móvil? Abre la página en el teléfono, no sólo en el
      ordenador.
- [ ] ¿El titular de portada dice la verdad hoy?
- [ ] ¿Los enlaces de contacto son los reales? Teléfono, correo, dirección.
- [ ] ¿El dominio de `url` es el bueno?
- [ ] ¿Los artículos de derechos los ha visto la asesoría jurídica?
- [ ] ¿Los de salud, alguien sanitario?
- [ ] ¿Las fotos tienen permiso?
- [ ] ¿El aviso legal está firmado por la asesoría?

---

## 7. Si algo falla

### El build se para

Se para **a propósito**, antes de generar nada roto. El mensaje dice el archivo
y el campo:

```
✗ Contenido inválido:
  2026-11-15-mi-articulo.json
    - "date" inválida: 15/11/2026 (usa el formato YYYY-MM-DD)
    - bloque 7: tipo "imagen" desconocido
```

Corre lo que diga y repite. Lo más habitual:

| Mensaje | Qué hacer |
|---|---|
| `falta "excerpt"` | Añade el campo. |
| `"date" inválida` | Usa `YYYY-MM-DD`, con guiones. |
| `tipo "…" desconocido` | Copia el nombre exacto de §1.4. |
| `JSON inválido` | Te falta una coma o una comilla. Pide que te lo mire quien lo escribió. |

### `qa.js` avisa de un enlace roto

Casi siempre es una foto que has renombrado. O el `slug` de un artículo que has
cambiado. Busca el nombre viejo y cámbialo.

### Una imagen sale diminuta o rota

Comprueba que la foto está **dentro de `assets/fotos/`** y que la ruta empieza
por `/`. Las mayúsculas cuentan: `Jornada.jpg` no es `jornada.jpg`.

### He escrito `**negrita**` y sale literal

Sólo funciona dentro de los campos `text` y `caption`. En `title` o `label` sale
tal cual.

### El artículo no aparece en el blog

Mira la `category`. Si es `Testimonios` y la pestaña que miras es `Salud`, ahí
está. Comprueba también la fecha: si es futura, todavía no ha salido.

---

## 8. Dudas frecuentes

**¿Puedo publicar sin pedirle permiso a nadie?**
Puedes. Antes de subir, avisa a la asociación en el canal que uséis.

**¿Quién decide los textos de los artículos?**
Tú, libremente. Lo único que no es opcional son las autorizaciones de imagen y
la revisión legal de los artículos de derechos.

**¿Hay riesgo de que alguien entre a tocar la web?**
No. Es un sitio de ficheros estáticos: no hay panel, ni contraseñas, ni base de
datos. Lo único que se puede editar es el repositorio del proyecto.

**¿Cuánto tarda?**
Menos de un segundo. Añadir un artículo es copiar un archivo, cambiar un par de
cosas y ejecutar un comando.

**¿Se puede volver atrás?**
Sí, si el proyecto está en Git. Si no lo está, copia la carpeta antes de
empezar. Es lo único que te recomiendo.

---

## 9. Resumen en una pantalla

| Quiero… | Toco… | Luego… |
|---|---|---|
| Publicar un artículo | `content/posts/nuevo.json` | `node scripts/build.js` |
| Retirar un artículo | borro el JSON | `node scripts/build.js` |
| Añadir fotos a la galería | `content/galeria.json` | `node scripts/build.js` |
| Subir fotos nuevas | `assets/fotos/` → `python3 scripts/fotos.py` | `node scripts/build.js` |
| Cambiar un texto de la web | `content/site.json` | `node scripts/build.js` |
| Cambiar colores | 6 líneas en `assets/styles.css` | `node scripts/build.js` |
| Cambiar el logo | `assets/brand/` | `node scripts/build.js` |
| Publicar en internet | — | subir la carpeta `dist/` al hosting |
| Comprobar que nada está roto | — | `npm test` |

---

## 8. Publicar sin tocar código: el panel del navegador

Si no quieres editar archivos de texto, hay un **panel** donde se escribe
todo desde una página web: artículos, fotografías, galería y los textos de la
web.

> **Dónde se puede usar.** El panel necesita un servidor Node siempre
> encendido. Si tu alojamiento es Netlify o Cloudflare Pages, el panel **no**
> funcionará ahí: usa el método de archivos de esta guía. Para el panel hace
> falta un servidor propio (VPS) o un alojamiento que ejecute Node.

### 8.1. Poner en marcha por primera vez

En un servidor propio, una sola vez, se crea la clave de acceso:

```bash
# Sustituye la contraseña por una tuya, larga y que no uses en ningún sitio
ADMIN_PASSWORD='una-frase-larga-y-única-de-más-de-20-caracteres' npm run admin:nueva-clave
```

Se guarda en `.admin-clave.json`, en la raíz del proyecto. **Ese archivo es
una contraseña: no lo subas a Git, ni a un ZIP, ni a la nube.**

Arranca el panel:

```bash
npm run admin
```

Abre `http://127.0.0.1:4322/admin/` (en un servidor, detrás del proxy: el
dominio real + `/admin/`).

### 8.2. Publicar un artículo

1. Entra con tu contraseña.
2. **Nuevo artículo**.
3. Pon el **título**, la **fecha** y elige la **categoría**.
4. Escribe el texto en el modo fácil:

   ```
   Este es el primer párrafo.

   ## Un apartado

   Y aquí otro párrafo.
   ```

   Las líneas en blanco separan párrafos. `## ` hace un apartado y
   `### ` un subapartado. `**así**` pone texto en negrita.

5. Debajo verás algo como *«3 bloques (citas, avisos, ilustraciones) se
   conservan tal cual al guardar»*. No te preocupes: significa que las
   tablas, las citas, los avisos con su color y las imágenes **no se
   tocan**, aunque no se vean en el cuadro de texto.
6. **Guardar y publicar**.

Al terminar sale el tiempo que tardó y si la web quedó sin errores. Si
algo falla, no se guarda nada y te lo dice con el motivo.

> Antes de sobrescribir cualquier archivo, el panel guarda una copia
> `.bak`. Si algo sale mal, se recupera sustituyendo el archivo por su
> `.bak`.

### 8.3. Editar un artículo que ya existe

En la lista, pulsa el artículo. Se abre con todo el texto dentro de un
cuadro. Cambias lo que quieras y guardas.

Si necesitas tocar la estructura —añadir una tabla, cambiar una
ilustración, poner una foto dentro del artículo—, abre el desplegable
**avanzado** y edita los bloques uno a uno. El bloque JSON de cada uno
está a la derecha; escribe el JSON sin la línea `"type"`.

### 8.4. Retirar un artículo

En la lista, **Retirar**. El archivo no se borra: se marca como retirado y
desaparece de la web. Para volver a publicarlo, quita la marca.

### 8.5. Subir fotografías

Sección **Fotos**:

1. **Subir fotos** → elige uno o varios archivos.
2. Se guardan en `assets/fotos/`.
3. **Añadir a la galería** para que aparezcan en `/galeria/`.

Se aceptan JPG, PNG, GIF y WebP. Si la foto es muy grande, mira la
sección 2.2 de esta guía.

### 8.6. Los textos de la web

Sección **Textos de la web**: ahí se cambian la portada, los menús, el
pie de página, los teléfonos, los horarios, los textos de las secciones y
lo de la galería, sin tocar código. Cada bloque tiene un botón para
**guardar** y otro para **descargar una copia** antes de tocarlo.

### 8.7. Seguridad: lo que hay que hacer sí o sí

El panel tiene contraseña y va cifrado por debajo, pero eso **no
sustituye** a estas cuatro cosas:

1. **HTTPS obligatorio.** La contraseña viaja en claro por HTTP.
   Nginx o Caddy delante, con certificado. Nunca `http://` en producción.
   Con HTTPS, el panel marca la cookie como `Secure` automáticamente.
2. **No abrirlo a internet sin proxy.** Arranca siempre en
   `127.0.0.1` y deja que el proxy sea lo único que escuche desde fuera.
3. **Copias de seguridad de `content/`.** Es todo tu contenido. Copia la
   carpeta entera cada cierto tiempo.
4. **Una contraseña de verdad.** El panel avisa y se niega si es corta o
  too fácil. No la compartas: una sesión por persona, y avisa a quien
   salga al usar "salir".

Cambiar la contraseña:

```bash
ADMIN_PASSWORD='la-nueva-que-sea' npm run admin:nueva-clave
```

### 8.8. Errores del panel

| Qué pasa | Qué hacer |
|---|---|
| "Contraseña incorrecta" | O está mal escrita, o llevas demasiados intentos. Espera unos minutos: el panel bloquea la IP un rato para frenar a quien prueba palabras. |
| "No se ha guardado. Falta…" | Falta un campo obligatorio (fecha, título, categoría o bloques). El mensaje dice cuál. |
| "La fecha tiene que ser AAAA-MM-DD" | Fecha mal escrita. Debe ser `2026-09-22`, no `22/09/2026`. |
| "El bloque N tiene el tipo X y no existe" | En el JSON has puesto un tipo de bloque que no está en la lista de la sección 1.4. |
| "El JSON no está bien escrito" | Falta una llave, una coma o una comilla al pegar. |
| Se ha cerrado la sesión sola | Las sesiones duran unas horas. Vuelve a entrar. |
| "413, archivo demasiado grande" | La foto pesa demasiado. Bájale el peso antes de subirla (sección 2.2). |

---

## 9. Dónde está publicado: FastPanel

Si la web está en un servidor con **FastPanel**, esto es lo que necesitas saber
para publicar.

### 9.1. Publicar un artículo

Desde el panel de edición (`https://TU-DOMINIO/admin/`): escribir, **Guardar y
publicar**, y listo. No hay que hacer nada más: la web se regenera sola y queda
actualizada en el momento.

Si editas archivos a mano en lugar de usar el panel, entonces sí hay que
regenerar y subir:

```bash
cd /opt/aseiio
DIST_DIR=/data/sites/TU-DOMINIO/public_html node scripts/build.js
```

Si el proyecto está configurado con `DIST_DIR` como servicio, este paso no hace
falta: el panel ya escribe donde toca.

### 9.2. Lo que **no** debes subir a la carpeta del sitio

Sólo va el contenido de `dist/`. Nunca:

- `.admin-clave.json` (es la contraseña del panel)
- `content/` (el código fuente, no hace falta en producción)
- `scripts/`, `assets/`, `package.json`

Cada vez que se publica se sobreescribe la carpeta del sitio. Si copias a mano,
copia **el contenido** de `dist/`, no la carpeta en sí.

### 9.3. Copias de seguridad

Todo lo que has escrito está en **una sola carpeta**: `content/`. Si pierdes esa
carpeta, pierdes el sitio. Copia esa carpeta, y solo esa, con cierta frecuencia.

En FastPanel se puede configurar un plan de backup. O a mano:

```bash
tar czf copia-$(date +%F).tgz content/
```

Conviene tener **una copia fuera del servidor**: en tu ordenador o en un
almacenamiento aparte. Un backup que está en el mismo servidor no protege de
que se caiga el servidor.

### 9.4. HTTPS

Sin HTTPS, la contraseña del panel viaja en claro por la red. Compruébalo:
si al entrar en `https://TU-DOMINIO/admin/` el navegador pone «no seguro» o te
avisa, no publiques nada por ahí hasta tener el certificado.
