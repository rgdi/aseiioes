# ASEIIO · sitio web

Sitio estático de la **Asociación de Enfermedades Inflamatorias Intestinales y
Ostomizados de Asturias (ASEIIO)**.

Sin framework, sin dependencias en producción, sin base de datos. Todo el
contenido editorial vive en archivos JSON: se edita, se compila y se publica.

```bash
node scripts/build.js       # genera dist/
node scripts/qa.js          # comprueba el resultado
```

> **¿Quieres publicar un artículo, una galería o cambiar un texto?**
> Todo eso se explica, paso a paso y sin código, en
> **[GUIA-CONTENIDO.md](GUIA-CONTENIDO.md)**. Es el documento para quien publica,
> no para quien desarrolla. Este README es la referencia técnica.

> ⚠️ **Antes de publicar, cambia el dominio de ejemplo.**
> En `content/site.json` hay `url: "https://www.aseiio.org"`. Aparece en el
> sitemap, en el RSS y en todas las etiquetas `canonical`: si el dominio real
> no es ese, cámbialo o la web se autonombra mal en buscadores y al compartir.
> El resto de datos de contacto y las métricas también son de relleno
> (ver §7).

---

## Estado del contenido: **es una maqueta, no la web definitiva**

Antes de que esto se use de verdad, hay trabajo que no es de código:

- **Datos de contacto de relleno.** Teléfono `985 00 00 00`, redes sociales sin
  perfil, dirección sin calle. Nada de eso es real.
- **Sin CIF, sin junta directiva, sin cuotas, sin horarios verificados.**
- **Textos legales de ejemplo.** El aviso legal, la política de privacidad y la
  nota de cookies son plantillas. Necesitan revisión jurídica.
- **Artículos de salud pendientes de revisión profesional**, sobre todo los
  de derechos administrativos y los de alimentación.
- **Fotos de galería marcadas como de ejemplo.** Los ficheros dicen
  «FOTO DE EJEMPLO» en la propia imagen, a propósito.

Todo eso está listado en [§8](#8-️-antes-de-publicar-lista-de-pendientes).

---

## 1. Requisitos

| | |
|---|---|
| **Node.js** | 18 o superior (probado con 22) |
| **Dependencias de producción** | ninguna |
| **Dependencias de desarrollo** | sólo `puppeteer`, para `npm run shot` y `npm run og` |

```bash
node -v            # debe ser v18.0.0 o superior
npm install        # opcional: sólo para las utilidades de captura
```

---

## 2. Instalación: un solo comando

### 2.1. Lo más sencillo — sin tocar nada del servidor

Si quieres arrancar la web y el panel en tu máquina o en cualquier servidor
con Node 18+ y puertos disponibles, sólo necesitas este comando, en la carpeta
del proyecto:

```bash
npm install   # la primera vez
npm run install
```

El instalador:

1. Comprueba que tienes Node 18 o superior.
2. Genera el sitio estático (lo mismo que `npm run build`).
3. Crea una contraseña aleatoria para el panel y la guarda con hash.
4. Arranca el servidor en `http://127.0.0.1:4322/` con `/admin/` incluido.

La contraseña aleatoria se imprime al final: cópiala en tu gestor de claves.
Para cambiarla:

```bash
ADMIN_PASSWORD='Mi-otra-Clave-a-larga-2026' npm run install -- --no-build
```

### 2.2. En un servidor, accesible desde internet

```bash
# 1. Sube el proyecto a una ruta fija (por ejemplo /opt/aseiio)
# 2. Genera o consigue un certificado (ver §2.4)
# 3. Arranca el servidor
sudo npm run install -- --host=0.0.0.0 --port=443 \
     --cert=/ruta/a/fullchain.pem --key=/ruta/a/privkey.pem
```

### 2.3. Como servicio del sistema (arranca al reiniciar el servidor)

```bash
sudo npm run install -- --host=0.0.0.0 --port=443 \
     --cert=/ruta/a/fullchain.pem --key=/ruta/a/privkey.pem --service
sudo systemctl start aseiio
sudo journalctl -u aseiio -f   # para ver logs en vivo
```

Para parar / desinstalar:

```bash
sudo systemctl stop aseiio
sudo systemctl disable aseiio
sudo rm /etc/systemd/system/aseiio.service /opt/aseiio
```

### 2.4. Certificados

El instalador sirve HTTPS nativo si le pasas `--cert` y `--key`. Si no, va por
HTTP y depende de un proxy que termine TLS (Cloudflare, Caddy, FastPanel).

**Let's Encrypt con certbot** (gratis, recomendado):

```bash
sudo apt install certbot   # o el equivalente de tu distribución
sudo certbot certonly --standalone -d aseiio.org
sudo npm run install -- --host=0.0.0.0 --port=443 \
     --cert=/etc/letsencrypt/live/aseiio.org/fullchain.pem \
     --key=/etc/letsencrypt/live/aseiio.org/privkey.pem --service
```

Renovación: certbot renueva los certs y los servicios con `--reload`; o añade
un cron que reinicie el servicio tras renovar.

### 2.5. Opciones

```
--host=IP          IP a la que escucha (defecto 127.0.0.1; con --public, 0.0.0.0)
--port=PUERTO      Puerto (defecto 4322)
--public           Escuchar en 0.0.0.0 (todas las interfaces)
--cert=RUTA        Ruta a fullchain.pem
--key=RUTA         Ruta a privkey.pem
--password=TEXTO   Contraseña del panel; si no, pregunta o genera una
--service          Instala la unidad systemd y sale (no arranca)
--user=USUARIO     Usuario Linux del servicio
--no-build         No regenerar el sitio antes de arrancar
```

### 2.6. Si usas FastPanel

Si tu servidor ya tiene Nginx con FastPanel y prefieres que Nginx sirva la web,
lee **§9.1.B**. La instalación rápida de arriba sigue siendo válida y útil para
pruebas en local, pero en producción en FastPanel el flujo ideal es:

- Servidor estático: FastPanel → static → `DIST_DIR=/data/sites/.../public_html`.
- Panel: systemd con `HOST=127.0.0.1 PORT=4322 HTTPS=1`.
- Nginx vhost: `location ^~ /admin/` → proxy.

---

## 3. Comandos

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila el sitio completo en `dist/`. |
| `npm run qa` | Comprueba `dist/` sin navegador: enlaces rotos, metadatos, JSON-LD, caracteres inválidos. |
| `npm test` | **141 comprobaciones**: 57 de interacción, 52 de responsive/accesibilidad/SEO y 32 de SEO puro. Sale con error si algo falla. |
| `npm run test:ui` | Menú móvil, filtros, búsqueda, FAQ, índice, cabecera, 404, sin JavaScript, impresión. |
| `npm run test:a11y` | 15 anchos × 18 páginas, contraste WCAG, jerarquía de encabezados, SEO. |
| `npm run seo` | Auditoría de SEO sobre `dist/`: títulos, descripciones, Open Graph, datos estructurados, enlazado, sitemap y RSS. |
| `npm run shot:sections` | Recorta una página en tramos para revisar el diseño sección a sección. |
| `npm run fotos` | Redimensiona las fotos de `assets/fotos/` y crea sus versiones pequeñas. Necesita `pip3 install Pillow`. |
| `npm run dev` | Compila y levanta un servidor en <http://localhost:4321>. |
| `npm run serve` | Sirve `dist/` sin recompilar. Acepta puerto: `node scripts/serve.js 8080`. |
| `npm run shot` | Capturas de pantalla con Chrome (ver §8). |
| `npm test` | Requiere el servidor en marcha: `node scripts/serve.js 4321 &` |
| `npm run og` | Regenera la imagen social PNG de 1200×630. |

---

### Panel de edición (opcional)

```bash
# Crear la clave, una sola vez (guárdala bien: es una contraseña)
ADMIN_PASSWORD='una-frase-larga-y-única-de-más-de-20-caracteres' npm run admin:nueva-clave

# Arrancar el panel: web pública en / y administración en /admin/
npm run admin
```

Requiere un servidor Node siempre encendido. **No funciona en Netlify ni en
Cloudflare Pages.** Ver las secciones 9.1 y 9.2.

---

## 4. Estructura

```
.
├── content/                  ← TODO LO QUE SE EDITA
│   ├── site.json             datos de la asociación, textos, servicios, FAQ…
│   ├── galeria.json          los álbumes de fotos (ver GUIA-CONTENIDO.md §3)
│   └── posts/                un archivo JSON por artículo
├── assets/
│   ├── styles.css            sistema de diseño completo
│   ├── app.js                menú, filtros, buscador, animaciones
│   ├── og.png / og.svg       imagen para redes sociales
│   ├── brand/                logotipo oficial recortado (sello, favicon)
│   └── fonts/                Sora + Inter autoalojadas
├── scripts/
│   ├── fotos.py              redimensiona fotos y crea sus versiones pequeñas
│   ├── build.js              compila todo
│   ├── qa.js                 comprobaciones sobre dist/ (sin navegador)
│   ├── seo.js                auditoría de SEO sobre dist/
│   ├── test-ui.js            57 tests de interacción con Chrome
│   ├── test-a11y.js          52 tests de responsive, contraste, a11y y SEO
│   ├── dev.js  serve.js      servidores locales
│   ├── shot.js               captura de una página
│   ├── shot-sections.js      captura por tramos (revisión de diseño)
│   └── og.js                 imagen social
│   └── lib/
│       ├── content.js        carga + validación del JSON
│       ├── blocks.js         tipos de bloque de los artículos
│       ├── pages.js          cada página del sitio
│       ├── layout.js         cabecera, pie, SEO, JSON-LD, arte
│       ├── art.js            ilustraciones SVG procedurales
│       └── util.js           utilidades de texto y fechas
└── dist/                     ← resultado del build, NO se edita a mano
```

> `dist/` se regenera por completo en cada build. **La fuente editable es
> siempre `content/` + `assets/` + `scripts/`.**

---

## 5. Publicar un artículo

Copia cualquier archivo de `content/posts/` como plantilla, cámbialo y guarda.
El build lo valida, lo indexa en la portada, lo añade al blog, al RSS, al
sitemap y al buscador. **No hay que tocar nada más.**

```jsonc
{
  "title":    "Ostomía y trabajo: tus derechos laborales, punto por punto",
  "slug":     "ostomia-y-trabajo",        // opcional: si no, se genera del título
  "excerpt":  "Una frase de 120-160 caracteres. Es lo que se ve en las tarjetas.",
  "date":     "2026-09-28",                // YYYY-MM-DD
  "updated":  "2026-10-05",                // opcional
  "author":   "Equipo ASEIIO",
  "category": "Derechos",                  // Derechos | Salud | Actualidad | Testimonios
  "tags":     ["trabajo", "ostomía", "laboral"],
  "art":      "bag",                       // digestive | bag | people
  "featured": true,                        // si aparece o no en la portada
  "blocks":   [ /* ver §5 */ ]
}
```

Campos obligatorios: `title`, `excerpt`, `date`, `category`, `blocks`.
El nombre del archivo (`2026-09-28-ostomia-y-trabajo.json`) es convención: ordena
el directorio y no afecta al orden del blog, que siempre es por fecha.

Si un JSON está mal, el build **falla con un mensaje claro** en lugar de generar
una página rota:

```
✗ content/posts/mi-articulo.json
  · falta "excerpt"
  · "date" no tiene formato YYYY-MM-DD: 28/09/2026
  · bloque 7 de tipo "faq": falta la propiedad "items"
```

---

## 6. Bloques disponibles

Dentro de `"blocks"`, cada elemento es `{"type": "...", ...}`:

| Tipo | Para qué | Propiedades |
|---|---|---|
| `lead` | Entradilla destacada | `text` |
| `h2` / `h3` | Apartados | `text` |
| `p` | Párrafo | `text` |
| `list` | Lista | `items[]`, `style`: `check` \| `plain` |
| `callout` | Aviso destacado | `tone`: `info` \| `warn` \| `legal` \| `tip` · `title`, `text` |
| `quote` | Testimonio | `text`, `author`, `role` |
| `art` | Ilustración | `which`: `digestive` \| `bag` \| `people`, `caption` |
| `image` | Foto real | `src`, `alt`, `caption` |
| `gallery` | Rejilla de fotos que se abren a grande | `items[]`: `src`, `alt`, `caption`; `columns`: 2, 3 o 4; `caption` |
| `stats` | Tres cifras | `items[]`: `{value, label, note}` |
| `faq` | Preguntas frecuentes | `items[]`: `{q, a}` |
| `steps` | Pasos numerados | `items[]`: `{title, text}` |
| `table` | Tabla | `head[]`, `rows[][]` |
| `columns` | Tarjetas en paralelo | `items[]`: `{icon, title, text}` |
| `divider` | Separador | — |
| `download` | Recurso descargable | `title`, `href`, `note` |
| `note` | Nota legal o sanitaria final | `text` |
| `html` | Escape de emergencia | `html` |

En los textos funciona `**negrita**` y los saltos de línea en blanco generan
párrafos. Un `p` con `\n\n` dentro genera varios párrafos.

---

## 7. Editar el resto de la web

Casi todo está en `content/site.json`:

- `nav` — menú superior
- `hero`, `proof` — portada: titular, botones, métricas
- `services`, `steps` — qué hacemos y cómo trabajamos
- `rights` — tarjetas de derechos
- `resources` — guías y descargas
- `faq` — preguntas frecuentes
- `team`, `valores`, `story` — la asociación
- `contact` → `email`, `phone`, `address`, `hours`, `social` — pie de página

### Logotipo

`assets/brand/` contiene el material de marca:

| Fichero | Para qué |
|---|---|
| `aseiio-logo.png` | El logotipo oficial completo (600×600). **Fuente de verdad**: si hay que regenerar los derivados, se empieza por aquí. |
| `isotipo.png` | El sello circular sin el texto curvo. Es lo que aparece en la cabecera y en el pie, donde el nombre ya está escrito al lado. |
| `isotipo-alpha.png` | Lo mismo con canal alfa, para fondos de color. |
| `favicon-32/48/180.png` | Iconos del navegador y de iOS. |

La web usa el **PNG oficial** en la cabecera, el pie, el favicon y la imagen
social. La cabecera carga la versión de 128 px (5,8 KB) en vez de la grande: a 42
px de pantalla no se nota la diferencia.

**Centrado de las ilustraciones.** Cada dibujo declara un `viewBox` ajustado a
donde cae realmente su geometría, medido sobre el navegador. Sin eso el colon
quedaba 42 px a la izquierda del centro y la bolsa 15 px por debajo. Para
comprobarlo: `node .qa/centrado.mjs` mide el desplazamiento de cada tipo y tiene
que dar 0 % en horizontal y en vertical.

Ojo con `getBBox()`: sobre la raíz de un SVG devuelve también lo que hay dentro
de `<defs>`, así que da cifras que no cuadran con lo que se ve. Hay que unir a
mano los hijos visibles. Para volver al dibujo vectorial (más nítido en pantallas grandes y
editables en `scripts/lib/art.js`), añade esto a `content/site.json`:

```json
"brand": { "mark": "svg" }
```

### Colores y tipografías

En `assets/styles.css`, al principio:

```css
:root {
  --blue: #1b62b0;   --blue-d: #12447f;
  --teal: #12a29c;   --teal-d: #0c817c;
  --sand: #f1eae2;   --red: #d9534f;   --ink: #0b2a45;
}
```

Cambiar esas seis variables repinta el sitio entero, ilustraciones incluidas.

### Ilustraciones

No hay stock ni fotografías. Las ilustraciones de intestino, ostomías y
personas se **dibujan por código** en `scripts/lib/art.js` (curvas Catmull-Rom
y geometría), de modo que siempre están nítidas, pesan poco y comparten paleta
con la marca. Para cambiar su aspecto se edita ese archivo; no hace falta
ningún programa de dibujo.

---

## 8. ⚠️ Antes de publicar: lista de pendientes

Este proyecto se entrega con **datos de ejemplo**. Hay que revisarlo todo.

### 7.1 Identidad y contacto (`content/site.json`)

- [ ] `url` → dominio real. **Hoy es `https://www.aseiio.org` y está en el sitemap, el RSS y las etiquetas canonical.** Si el dominio no es ese, cámbialo antes de publicar o la web se autonombra mal.
- [ ] `email`, `phone`, `address`, `hours` → **valores de relleno** (`info@aseiio.org`, `985 00 00 00`, Oviedo).
- [ ] `social` → los tres enlaces están vacíos. Rellenar o borrar.
- [ ] `proof` (métricas) → **cifras inventadas** para la maqueta. Poner las reales o quitarlas.
- [ ] `team` → los cuatro nombres son «Nombre de la presidenta»… etc.
- [ ] `legal` → «Entidad de interés sanitario y social». Confirmar la denominación oficial y el CIF, y añadirlo.
- [ ] Cuota de socio: hoy el texto dice «cuesta poco». Poner el importe y la forma de pago.
- [ ] La página `/legal/` es **texto de ejemplo**. Sustituir por el de la asesoría jurídica, con CIF, domicilio fiscal, titular del banco de datos y enlaces a la LOPDGDD.

### 7.2 Revisión editorial y profesional

| # | Qué | Qué hay que hacer |
|---|---|---|
| 1 | Artículos de **derechos**: trabajo, certificado de discapacidad, tarjeta de ostomizado | Revisión de **asesoría jurídica** antes de publicar. |
| 2 | Artículos de **salud**: alimentación con Crohn, novedades terapéuticas | Revisión de un **profesional sanitario**. |
| 3 | Cifras y datos | **No queda ninguna cifra clínica o estadística sin fuente.** Los porcentajes que tenía el borrador se han retirado. Si se añaden datos nuevos, deben ir con la fuente citada y su fecha. |
| 4 | `/blog/certificado-de-discapacidad/` | Cita el **Real Decreto 888/2022** (baremo vigente) y el umbral del **33 %** de reconocimiento legal. Confirmarlo con la asesoría. |
| 5 | `/blog/mi-historia/` | **El testimonio es ficticio**, está como maqueta. Sustituir por uno real con autorización escrita y revisión del texto, o eliminar el artículo. |
| 6 | Fechas | Los artículos están fechados en 2026 para que la portada se vea poblada. Ajustar a fechas reales. |


### 7.3 Antes de añadir cifras

Si en algún momento se quieren recuperar los datos que tenía el borrador
(porcentajes de deshidratación, tiempos de respuesta, socias que trabajan),
**no basta con ponerlos**: hay que citar su fuente y la fecha. En una web
de una asociación de pacientes, una cifra sin fuente hace más daño que no
tenerla.

### 7.4 Recursos descargables

- [ ] En `/recursos/` todos los documentos son **solicitudes por correo**: no hay archivos falsos. Cuando existan, subirlos a `assets/recursos/` y cambiar `href` en `content/site.json`.

### 7.5 Antes del primer despliegue

- [ ] Asesoramiento jurídico y sanitario.
- [ ] Revisión de accesibilidad (contraste, navegación por teclado, lectores de pantalla).
- [ ] Copia de seguridad de `content/` en control de versiones.
- [ ] **Confirmar que el logotipo usado es la versión vigente** de la asociación. El sello está recortado de la imagen facilitada; si hay una versión oficial en SVG o con el texto del aro completo, conviene usarla.

---

## 9. QA: capturas y tests

```bash
npm install                            # instala puppeteer (sólo desarrollo)
node scripts/serve.js 4321 &           # en otra terminal

# Página entera
node scripts/shot.js http://localhost:4321/            .qa/home.png  1440 --full
node scripts/shot.js http://localhost:4321/blog/       .qa/blog.png  1440 --full
node scripts/shot.js http://localhost:4321/ --mobile   .qa/home-m.png --mobile --full

# Por tramos, para revisar sección a sección sin que la página sea ilegible
node scripts/shot-sections.js http://localhost:4321/ .qa/home 1440 2350
```

Firmas:

```
shot.js            <url> <salida.png> [ancho] [--mobile] [--full] [--alto=N]
shot-sections.js   <url> <prefijo> [ancho] [altoPorTramo]
```

Y los tests, en cualquier momento:

```bash
npm test          # 139 comprobaciones: interacción, a11y, responsive y SEO
```

---

## 10. Despliegue

`dist/` es estático puro: cualquier servidor de ficheros lo sirve.

**Antes de subir, cambia `url` en `content/site.json` por el dominio real.**

### Netlify / Cloudflare Pages

```
Build command:  node scripts/build.js
Publish dir:    dist
```

Sin dependencias que instalar. Para regenerar la imagen social en cada build:
`npm install && node scripts/og.js && node scripts/build.js`.

### GitHub Pages

```bash
npm run build
# copia dist/ a la rama gh-pages, o configura Actions con dist/ como carpeta
```

### Servidor propio (nginx)

```nginx
server {
    listen 80;
    server_name www.aseiio.org;
    root /var/www/aseiio;
    index index.html;

    error_page 404 /404.html;

    location ~* \.(css|js|svg|png|jpg|woff2)$ { expires 30d; add_header Cache-Control "public"; }
    location / { try_files $uri $uri/ =404; }
}

# y para regenerar cuando haya cambios:
#   cd /var/www/aseiio-src && node scripts/build.js
#   rsync -a --delete dist/ /var/www/aseiio/
```

En Cloudflare se puede además transformar `/blog/mi-articulo` en
`/blog/mi-articulo/` automáticamente; en nginx, `try_files` ya resuelve la
carpeta.

---

### 9.0. La opción más simple: web estática + panel en su propio puerto

Esta es la que recomiendo. **No hay que tocar el vhost de Nginx ni configurar
un proxy**: FastPanel sirve los ficheros estáticos como lo haría con cualquier
web, y el panel se queda en un puerto aparte al que sólo se llega por túnel SSH.

```
Internet ──→ :443  nginx/FastPanel ──→ dist/  (HTML, robots.txt, sitemap, RSS…)
                    └ NO pasa nada al panel

Túnel SSH ──→ :4322  panel ──→ sólo /admin/
```

Nadie que escriba una dirección en el navegador llega al panel. Ni por
confusión, ni por olvidarse de la contraseña, ni porque alguien adivine que
existe. El puerto ni siquiera está abierto al exterior.

**Paso 1 — la web, como cualquier sitio estático**

Panel → **Crear sitio** → tipo **Static content** → tu dominio.
**Settings → HTTPS** → Let's Encrypt. Eso es todo.

**Paso 2 — generar el sitio en la carpeta que sirve FastPanel**

```bash
cd /opt/aseiio
DIST_DIR=/data/sites/TU-DOMINIO/public_html node scripts/build.js
```

A partir de aquí, cada vez que compiles, la web se actualiza sola.

**Paso 3 — el panel, en su puerto, sin tocar Nginx**

```bash
cd /opt/aseiio
ADMIN_PASSWORD='Tu-clave-muy-larga-de-mas-de-20-caracteres' \
  npm run install -- --solo-panel --host=127.0.0.1 --port=4322 \
                    --site-dir=/data/sites/TU-DOMINIO/public_html \
                    --user=TU-USUARIO-LINUX --service
sudo systemctl start aseiio
```

`--site-dir` es lo que hace que al guardar un artículo la web quede
actualizada sin pasos extra: el panel compila **directamente en la carpeta que
sirve FastPanel**. Sin esta opción compila en `./dist` y habría que subirlo a
mano.

`--solo-panel` significa que ese proceso **sólo** responde a `/admin/`. Cualquier
otra ruta da 404: no sirve la web, ni `package.json`, ni `content/`, ni los
ficheros de `assets/`.

**Paso 4 — entrar**

Desde tu ordenador, en otra terminal:

```bash
ssh -L 4322:127.0.0.1:4322 usuario@TU-SERVIDOR
```

Y en el navegador: `http://127.0.0.1:4322/admin/`

Ya está. Sin HTTPS en el panel, y sin embargo la contraseña no viaja por
internet: por el túnel SSH va cifrada.

**Qué pasa si cierras el túnel:** el panel deja de ser accesible, incluso desde
el propio servidor. Eso no es un fallo; es justo lo que se quiere.

**No abras el puerto 4322 al exterior.** Si algún día de verdad necesitas
acceder al panel desde el navegador sin túnel, entonces sí: `--host=0.0.0.0`,
HTTPS con certificado real y los dos factores que ya trae (contraseña con
`scrypt` y bloqueo por intentos). Pero el túnel SSH es más simple y más
seguro. Si aun así lo haces, no abras el puerto: deja que Nginx lo deje sólo en
`127.0.0.1` y pon delante un proxy con HTTPS.

**Contenido y copias de seguridad**

Todo lo publicado está en `content/`. Copia esa carpeta, y sólo esa, con
cierta frecuencia, y ten una copia fuera del servidor.

---

### 9.1. Desplegar en FastPanel

FastPanel sirve el sitio con Nginx. Lo que hay que decidir es **quién sirve los
ficheros estáticos**: Nginx (más rápido, y si Node se cae la web sigue online) o
el propio Node del panel (más simple de montar, pero la web entera depende de
que Node esté vivo).

#### A. Solo la web, sin panel — la más sencilla

1. Panel → **Crear sitio** → tipo **Static content** → tu dominio.
2. Panel → **Settings → HTTPS** → pide el certificado de Let's Encrypt.
3. Sube por SFTP el contenido de `dist/` dentro de la carpeta del sitio.

Listo. No hace falta Node ni licencia de nada. Para actualizar, vuelves a
generar y subir `dist/`.

#### B. Web y panel en el mismo dominio (con proxy en el vhost)

Sólo si necesitas el panel en `tudominio.org/admin/` en vez de en un puerto
aparte. Nginx sirve `dist/` y sólo manda `/admin/` al panel. Hay que editar el
vhost a mano.

1. Deja el proyecto en una carpeta fija, por ejemplo `/opt/aseiio`.
2. Genera el sitio directamente en la carpeta que sirve FastPanel:

   ```bash
   cd /opt/aseiio
   DIST_DIR=/data/sites/aseiio.org/public_html node scripts/build.js
   ```

3. En **Settings → Backend**, pon el sitio en **Static content** apuntando a esa
   carpeta.
4. Crea la clave y arranca el panel en local:

   ```bash
   ADMIN_PASSWORD='una-frase-larga-y-única-de-más-de-20-caracteres' node scripts/admin.js --nueva-clave
   sudo npm run install -- --host=127.0.0.1 --port=4322 --service
   sudo systemctl start aseiio
   ```

   Aquí **no** se pone `--solo-panel`: ese proceso también sirve la web, por si
   el vhost se rompe.

5. En el vhost de Nginx, dentro del `server` que ya tiene `listen 443 ssl` y
   **antes** de la regla de estáticos:

   ```nginx
   location ^~ /admin/ {
       proxy_pass http://127.0.0.1:4322;
       proxy_set_header Host              $host;
       proxy_set_header X-Real-IP         $remote_addr;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
   }
   ```

   Las dos cabeceras de abajo no son opcionales: sin `X-Real-IP` el bloqueo
   por intentos trataría a todos los visitantes como la misma IP y un solo
   atacante cerraría el paso al equipo entero; sin `X-Forwarded-Proto` la
   cookie saldría sin `Secure`.

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

**Más simple que esto: el §9.0.** Ahí no se toca Nginx en absoluto y el panel no
es alcanzable desde internet.

#### C. Todo detrás del panel (lo más corto, lo menos recomendable)

Crear el sitio con backend **Reverse proxy** → `http://127.0.0.1:4322`, SSL,
y arrancar `admin.js`. Tres pasos, pero la web pública entera la sirve Node: si
Node se cae, cae la web, y el radio de impacto de cualquier fallo es mayor.

#### Notas de FastPanel

- **Node.js necesita licencia Extended** (backend `NodeJS`). La unidad
  `systemd` de la opción B no la necesita, por eso es la que uso.
- Instalar Node: **Settings → Applications → Node.js → Install**. Usa la
  22 o superior; el proyecto no necesita nada instalado con `npm install` para
  funcionar, ni siquiera el panel.
- Si usas el backend `NodeJS` de FastPanel en vez de systemd, la aplicación
  debe escuchar en `$SERVICE_PORT`; para eso arranca con
  `PORT=$SERVICE_PORT node scripts/admin.js`.
- **Copia de seguridad**: todo el contenido está en `content/`. Configura un
  plan de backup de FastPanel o, al menos, un `tar` de esa carpeta.
- `.admin-clave.json` **no** va al sitio público ni a un repositorio. Está en
  `.gitignore`.

---

### 9.2. Desplegar el panel de edición fuera de FastPanel

El panel es un servicio Node aparte: **no** se copia a `dist/` ni se publica
con la web estática. En Netlify o Cloudflare Pages no se puede ejecutar, así
que allí el contenido se edita con archivos (`GUIA-CONTENIDO.md`, sección 1).

En un servidor propio (VPS con Node 22):

```bash
# 1. el panel, escuchando sólo en local
HOST=127.0.0.1 node scripts/admin.js 4322

# 2. nginx delante, con HTTPS
```

```nginx
server {
  server_name aseiio.example.org;
  ssl_certificate     /etc/letsencrypt/live/aseiio.example.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/aseiio.example.org/privkey.pem;

  # El panel: sólo por HTTPS y con contraseña
  location /admin/ {
    proxy_pass http://127.0.0.1:4322;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;   # sin esto no hay bloqueo por IP
    proxy_set_header X-Forwarded-Proto $scheme;        # sin esto no se pone Secure
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
  }

  # El panel llama por /admin/api/ también
  location /admin/api/ {
    proxy_pass http://127.0.0.1:4322;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # La web pública, como esté montada (dist/, Netlify, nginx...)
  location / {
    root /var/www/aseiio;
  }
}
```

Con el proxy delante, nginx manda `X-Forwarded-Proto: https` y el panel
añade `Secure` a la cookie y sirve todo por HTTPS. La clave se guarda en
`.admin-clave.json` (scrypt + salt), que **no se sube a Git ni al ZIP**;
ya está en `.gitignore`.

Copia de seguridad: todo el contenido editorial vive en `content/`.

```bash
tar czf copia-$(date +%F).tgz content/
```

Cosas que **no** hacer:

- `HOST=0.0.0.0` sin HTTPS delante: la contraseña iría en claro.
- Publicar el panel en un alojamiento estático.
- Compartir la contraseña: una sesión por persona, y avisar a quien usa
  "salir" al terminar.
- Editar `content/` a mano mientras alguien usa el panel: el panel carga,
  valida y compila en memoria, pero el trabajo se perderá.

### 9.3. Comprobaciones del panel

```bash
npm run test:auth        # 27 · contraseña, sesiones, cookies, bloqueo
ADMIN_PASSWORD='…' npm run test:seguridad   # 48 · CSRF, traversal, ficheros
ADMIN_PASSWORD='…' npm run test:panel       # 32 · navegador real de punta a punta
```

Los tres necesitan el panel arrancado y **uno cada vez**: el bloqueo por IP que
prueban deja la dirección un rato restringida, así que encadenarlos contra el
mismo servidor da falsos negativos. El script `sh .qa/ejecutar-panel.sh <test>`
ya se encarga: levanta el panel, ejecuta uno, lo para y muestra el resumen.

```bash
sh .qa/ejecutar-panel.sh test-auth      # 27/27 · modo combinado
sh .qa/ejecutar-panel.sh security       # 52/52 · modo combinado
sh .qa/ejecutar-panel.sh panel          # 32/32 · navegador
sh .qa/ejecutar-panel-solo.sh security  # 67/67 · modo sólo-panel (§9.0)
```

Si instalas Puppeteer, los tests usan su Chrome. Si no lo tienes, buscan el
navegador de Playwright o el del sistema; se puede forzar con `CHROME_PATH`.

---

## 11. Comprobaciones automáticas

```bash
npm run build && npm run qa
```

`qa` recorre `dist/` y falla si encuentra:

- enlaces internos que apuntan a una ruta inexistente,
- páginas sin `lang`, `<h1>`, `<title>`, description, canonical u Open Graph,
- `og:image` o navegación sin etiquetar,
- imágenes sin `alt`, botones sin `type` o enlaces `target="_blank"` sin `rel="noopener"`,
- JSON-LD que no se puede parsear,
- restos de la generación: `[object Object]`, `undefined`, `%%ART:` sin hidratar,
  caracteres invisibles (nbsp, zero-width, BOM) o marcas `TODO`/`PENDIENTE`,
- archivos de salida que faltan o URLs del `sitemap.xml` inexistentes.

Estado actual del proyecto:

```
15 páginas · 476 enlaces internos · 14 URLs en sitemap
✓ sin enlaces rotos y todas las páginas pasan las comprobaciones de calidad
```

---

## 12. Verificaciones ejecutadas

Todo lo siguiente se ejecutó sobre el proyecto final, no es una lista de
intenciones. Para reproducirlo: `npm run build && npm run serve`.

```bash
npm run build && npm run qa
node scripts/serve.js 4321 &
npm test
```

| Comprobación | Resultado |
|---|---|
| `node --check` en los 17 `.js` | sin errores de sintaxis |
| JSON válido (`site.json` + artículos) | todos |
| `node scripts/build.js` | 18 páginas, 26 archivos |
| `node scripts/qa.js` | 18 páginas, 709 enlaces internos, 17 URLs en sitemap, 0 rotos, 0 avisos |
| Rutas por HTTP (44 comprobadas) | todas 200; ruta inexistente → 404 |
| Desbordamiento horizontal | **6 anchos × 11 páginas = 66 renders, 0 fallos** |
| Tamaño de botones en móvil (390 px) | ninguno por debajo de 32 px de alto |
| Contraste de texto (WCAG AA) | 5 páginas, 0 textos por debajo de 4,5:1 |
| Accesibilidad estructural | todas las páginas: 1 solo `h1`, sin saltos de nivel, `lang`, `main`, enlace de salto y 4 landmarks |
| Errores de consola y excepciones JS | 0 en todos los renders |
| Imágenes rotas o sin `alt` | 0 |
| Menú móvil | abre, `aria-expanded`, Escape devuelve el foco, navegar cierra |
| Filtros del blog | las 4 categorías particionan los 8 artículos, `aria-pressed` correcto |
| `npm test` (UI 58 + a11y 52 + SEO 32) | **142/142** |
| `npm run test:auth` | 27/27 · scrypt, sesiones, cookies, bloqueo por intentos |
| `npm run test:seguridad` | 52/52 · CSRF, path traversal, ficheros disfrazados, proxy |
| `sh .qa/ejecutar-panel-solo.sh security` | 67/67 · el puerto del panel no sirve la web ni ficheros del proyecto |
| `ADMIN_PASSWORD=… npm run test:panel` | 32/32 · navegador real de punta a punta |
| Ida y vuelta por el modo fácil | un artículo vuelve **idéntico**: no pierde bloques, tonos ni ilustraciones |
| Cookie `Secure` con `X-Forwarded-Proto: https` | sí, y sin ella no aparece |
| Bloqueo por IP detrás de proxy | va por visitante real, no arrastra al resto |
| Búsqueda | filtra, se combina con el filtro, estado vacío, Escape limpia, `?q=` en la URL |
| URL compartible `?cat=Salud&q=crohn` | se restaura al cargar |
| FAQ | abre y cierra; se leen también **sin JavaScript** |
| Índice del artículo | 4 anclas, salto correcto, apartado activo al hacer scroll |
| Animaciones de entrada | se revelan al desplazarse y con red de seguridad a los 2,5 s |
| Impresión | cabecera y pie ocultos, artículo presente |
| Sitemap | todas las URLs del sitio responden 200 |
| RSS | un artículo por cada entrada del índice |
| Validación de contenido | fecha inválida, campo ausente, JSON malformado y bloque desconocido → **el build falla con un mensaje claro** |
| Alta y baja de un artículo | aparece y desaparece de portada, blog, RSS, sitemap, buscador e `index.json` |
| El ZIP se extrae y compila aparte | build idéntico, sin diferencias |

Capturas: `node scripts/shot.js` (página entera) y `node scripts/shot-sections.js`
(tramos). Se dejan en `.qa/`, fuera del ZIP.

---

## 13. SEO

`npm run seo` audita 32 puntos sobre `dist/`. Estado actual: los 32 pasan.

**Datos estructurados.** Cada página lleva un único `<script>` con `@graph` de
schema.org, en lugar de varios scripts sueltos:

| Tipo | Dónde |
|---|---|
| `NGO` | en todas, con `@id` estable para poder referenciarla |
| `WebSite` + `SearchAction` | en todas; la búsqueda apunta a `/blog/?q=` |
| `BlogPosting` | artículos, con `image`, `wordCount`, `author`, `publisher`, `mainEntityOfPage` |
| `BreadcrumbList` | todas menos la portada |
| `FAQPage` | portada, qué hacemos y recursos |
| `CollectionPage` | qué hacemos, recursos y temas |
| `Blog` | el índice de artículos, con los posts listados |

**Open Graph y Twitter.** `og:image` con `width`, `height`, `type` y `alt`;
`article:published_time`, `modified_time`, `section`, `tag` y `author` en los
artículos; `twitter:image` y `twitter:image:alt` en todas.

**Sitemap.** Todas las URL llevan `lastmod` (la fecha se toma de
`content/site.json`, así que cambia sola al editar contenido), `changefreq` y
`priority`. El RSS lleva `lastBuildDate` y es autodetectable desde el HTML.

**Velocidad.** Sin dependencias externas, 7 peticiones por página y fuentes
autoalojadas con `preload`. Medido en Chrome:

Medido en Chrome con la red limitada a propósito, en móvil (390 px):

| Conexión | La pantalla se ve | Página completa | Se mueve al cargar |
|---|---|---|---|
| Fibra / 4G rápida | 304 ms | 304 ms | 0,000 |
| 4G normal | 551 ms | 551 ms | 0,000 |
| 3G mala (400 kbps, CPU ×4) | 3,9 s | 3,9 s | 0,000 |

Peso de una visita, comprimido con gzip: **114 KB** (HTML + CSS + JS + fuentes +
logo). Antes de esta revisión eran 202 KB. Las dos reducciones principales:

- el logo ocupaba 94 KB para mostrarse a 42 px → 5,8 KB;
- el HTML de portada llevaba 47 definiciones de gradiente repetidas y la
  geometría del intestino duplicada dentro de los `clipPath` → 243 KB de HTML
  en crudo, 149 KB.

Nota: sin `brotli` no se pueden recortar las tipografías variables, que siguen
siendo 72 KB (Sora 25 + Inter 47). Con `brotli` instalado, `python3 -m pip
install brotli` y un paso de subsetting bajarían esa cifra a la mitad.

**Índice por temas.** `/temas/` agrupa los artículos por categoría. Antes el pie
tenía un enlace «Artículos por tema» que llevaba al blog, duplicando el de al
lado; ahora lleva a su sitio y cada bloque tiene contenido propio.

---

## 14. Alcance: a quién representa la web

La asociación se llama *Enfermedades Inflamatorias Intestinales **y
Ostomizados***, así que la web cubre a las dos cosas. La clasificación de la
EII que se usa en el contenido: enfermedad de Crohn, colitis ulcerosa, proctitis
ulcerosa, colitis izquierda, colitis indeterminada y colitis microscópica.

**Pouchitis se ha quitado del texto visible** por decisión de la asociación. La
clasificación clínica de la EII (AEGASTRO) sí lo incluye, pero no aparece ni en
el titular, ni en la entradilla, ni en el listado de temas, ni en los datos
estructurados. Si alguna vez hace falta volver a incluirlo, se recupera en tres
sitios: `marquee` y `alcance.eii` de `content/site.json`, y el `knowsAbout` de
`scripts/lib/layout.js`.

Eso se refleja en:

- el **titular de portada**, que no menciona sólo Crohn;
- los **temas del marquee**, que incluyen colitis indeterminada;
- un bloque **«A quién acompañamos»** en `/asociacion/` que explica, en lenguaje
  llano, en qué se diferencian y que ninguna persona ostomizada tiene que tener
  una EII para venir a la asociación;
- los **ocho artículos**: ninguno lleva Crohn en el título, y hay uno propio de
  colitis ulcerosa;
- un **aviso en los artículos de alimentación y de certificado** que aclara que
  valen para toda EII, no sólo para Crohn.

Si en algún momento se añade un artículo muy específico de una sola enfermedad,
conviene revisarlo aquí: la tendencia natural de este contenido es volver a caer en
Crohn porque es el diagnóstico más visible, y eso deja fuera a la mitad de las
socias.

---

## 16. Páginas nuevas

Hay siete páginas fijas además del blog: portada, blog, temas, galería, qué
hacemos, derechos, asociación, recursos y aviso legal. Para añadir una nueva hay
que tocar tres sitios, y no es algo que se haga a menudo:

1. una función `xxxPage()` en `scripts/lib/pages.js` que devuelva el HTML;
2. `write('xxx/index.html', xxxPage({ site }))` en `scripts/build.js`;
3. la URL en `STATIC_PAGES` de `scripts/build.js`, para que entre en el sitemap.

Para meter fotos nuevas hay un camino más corto: el bloque `gallery` dentro de
un artículo, que no necesita ningún cambio de código. Está en
`GUIA-CONTENIDO.md` §1.4.

---

## 17. Lo que genera el build

```
dist/
├── index.html · servicios/ · derechos/ · asociacion/ · recursos/ · legal/
├── temas/ · galeria/
├── 404.html
├── blog/index.html
├── blog/<slug>/index.html        × 7
├── blog/index.json               índice para buscadores externos
├── feed.xml                      RSS
├── sitemap.xml
├── robots.txt
├── favicon.svg
└── assets/                       estilos, JS, fuentes, og.png
```

Cada página lleva `<title>`, meta description, canonical, Open Graph, Twitter
Card y JSON-LD (`Organization`, `WebSite`, `Blog`, `BlogPosting`, `AboutPage`).
