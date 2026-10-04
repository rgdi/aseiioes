/**
 * admin.js — panel de edición de la web de ASEIIO.
 *
 *   node scripts/admin.js 4322
 *
 * Sirve la web ya generada (dist/) y, encima, un panel para editar el contenido
 * desde el navegador. La web pública que se sube al hosting no lleva nada de
 * esto: sigue siendo estática y sin login.
 *
 * ── Qué se puede tocar desde aquí ──────────────────────────────────────────
 *   content/site.json          los textos de la web
 *   content/posts/*.json       los artículos
 *   content/galeria.json       los álbumes
 *   assets/fotos/**            las fotografías
 * Nada más. Cualquier otra ruta devuelve 403, aunque se manipule el parámetro.
 *
 * ── Antes de poner esto en internet ─────────────────────────────────────────
 *  1. HTTPS obligatorio (delante, con un proxy como Caddy o nginx).
 *  2. Una contraseña larga, distinta de la de cualquier otro sitio.
 *  3. Copias de seguridad: el panel sólo escribe archivos, no borra nada
 *     de lo que no sea una foto.
 *  4. En el servidor, atarlo a 127.0.0.1 y dejar que sólo el proxy llegue.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  hashPassword, verificarPassword, contraseñaDébil, crearSesion,
  sesionViva, tocar, cookieSesion, borrarCookie, limpiarSesiones,
  comprobarBloqueo, fallo as falloIntento, acierto,
} from './admin/auth.js';

const run = promisify(execFile);
const RAIZ = path.resolve(import.meta.dirname, '..');
const DIST = path.join(RAIZ, 'dist');
const CONTENT = path.join(RAIZ, 'content');
const POSTS = path.join(CONTENT, 'posts');
const FOTOS = path.join(RAIZ, 'assets', 'fotos');
const CLAVE = path.join(RAIZ, '.admin-clave.json');

const PUERTO = Number(process.env.PORT || process.argv[2] || 4322);
const HOST = process.env.HOST || '127.0.0.1';
const SEGURO = process.env.HTTPS === '1' || process.env.HTTPS === 'true';
const CERT = process.env.CERT_PATH;      // ruta a public.pem
const KEY = process.env.KEY_PATH;        // ruta a private.key
const CERTS_DIR = process.env.CERTS_DIR; // carpeta con cert.pem + key.pem
// --solo-panel: este proceso NO sirve la web pública, sólo el panel. La web la
// sirve nginx/FastPanel desde dist/ como estático. Así el panel cuelga de un
// puerto aparte y no se puede llegar a él por el dominio principal.
const SOLO_PANEL = process.env.SOLO_PANEL === '1' || process.argv.includes('--solo-panel');
const MAX_CUERPO = 5 * 1024 * 1024;   // 5 MB: de sobra para un JSON o una foto

const sesiones = new Map();
const intentos = new Map();
let compilando = null;

/* ── Clave ────────────────────────────────────────────────────────────────── */

function cargarClave() {
  if (!fs.existsSync(CLAVE)) {
    console.error('\n✗ No existe .admin-clave.json.\n');
    console.error('  Créalo una vez con:\n');
    console.error('    node scripts/admin.js --crear-clave\n\n');
    console.error('  Después rellena "hash" con lo que te devuelva ese comando.\n');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CLAVE, 'utf8'));
}

/* ── Utilidades ───────────────────────────────────────────────────────────── */

const BUENA_IP = /^[0-9a-f:.]{3,45}$/i;
const esLocal = (a) => !a || a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1';

/** IP real del visitante. Si hay un proxy delante (que es lo recomendado), llega
 *  por X-Real-IP o X-Forwarded-For. Sin esto, detrás de un proxy TODAS las
 *  peticiones verían la misma IP y un solo atacante bloquearía a todo el
 *  equipo. Sólo se acepta la cabecera si quien llama es local, que es el
 *  proxy: si viniera de internet, sería falsificable. */
function ip(req) {
  const directa = (req.socket.remoteAddress || '').replace('::ffff:', '').replace(/^::1$/, '127.0.0.1');
  if (esLocal(directa)) {
    const xr = String(req.headers['x-real-ip'] || '').split(',')[0].trim();
    if (BUENA_IP.test(xr)) return xr;
    const xf = String(req.headers['x-forwarded-for'] || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (xf.length && BUENA_IP.test(xf[xf.length - 1])) return xf[xf.length - 1];
  }
  return directa;
}

/** ¿Va cifrado? Si se arranca con HTTPS=1, siempre. Si no, se mira lo que diga
 *  el proxy. La cabecera nunca puede quitar la protección: sólo añadirla. */
function vaSeguro(req) {
  if (SEGURO) return true;
  if (!esLocal((req.socket.remoteAddress || '').replace('::ffff:', ''))) return false;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}

function responder(res, codigo, cuerpo, cabeceras = {}) {
  const base = {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    ...cabeceras,
  };
  res.writeHead(codigo, base);
  res.end(cuerpo);
}

const json = (res, codigo, obj, cabeceras = {}) =>
  responder(res, codigo, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', ...cabeceras });

/** Evita que "../" o una ruta absoluta saquen del directorio permitido. */
function seguro(base, relativa) {
  const limpio = String(relativa || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (limpio.includes('\0')) return null;
  const destino = path.resolve(base, limpio);
  const conBarra = base.endsWith(path.sep) ? base : base + path.sep;
  return destino.startsWith(conBarra) ? destino : null;
}

function leerCookies(req) {
  const salida = {};
  for (const trozo of (req.headers.cookie || '').split(';')) {
    const i = trozo.indexOf('=');
    if (i > 0) salida[trozo.slice(0, i).trim()] = trozo.slice(i + 1).trim();
  }
  return salida;
}

function cuerpo(req, limite = MAX_CUERPO) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const trozos = [];
    req.on('data', (t) => {
      total += t.length;
      if (total > limite) { reject(new Error('El archivo es demasiado grande')); req.destroy(); return; }
      trozos.push(t);
    });
    req.on('end', () => resolve(Buffer.concat(trozos)));
    req.on('error', reject);
  });
}

function sesionDe(req) {
  const t = leerCookies(req).aseiio_sesion;
  if (!t) return null;
  const s = sesiones.get(t);
  if (!sesionViva(s)) { if (s) sesiones.delete(t); return null; }
  return s;
}

/* ── Compilar ─────────────────────────────────────────────────────────────── */

async function compilar() {
  if (compilando) return compilando;
  compilando = (async () => {
    const t0 = Date.now();
    try {
      const { stdout } = await run(process.execPath, [path.join(RAIZ, 'scripts', 'build.js')], {
        cwd: RAIZ, timeout: 120000, maxBuffer: 4 * 1024 * 1024,
      });
      const { stdout: qa } = await run(process.execPath, [path.join(RAIZ, 'scripts', 'qa.js')], {
        cwd: RAIZ, timeout: 60000, maxBuffer: 4 * 1024 * 1024,
      });
      return { ok: true, ms: Date.now() - t0, salida: (stdout + qa).trim() };
    } catch (e) {
      return { ok: false, ms: Date.now() - t0, salida: String(e.stdout || e.message || e) };
    } finally {
      compilando = null;
    }
  })();
  return compilando;
}

/* ── Validación antes de escribir ─────────────────────────────────────────── */

const TIPOS = new Set(['lead', 'h2', 'h3', 'p', 'list', 'callout', 'quote', 'image', 'gallery',
  'art', 'stats', 'faq', 'steps', 'table', 'columns', 'divider', 'download', 'html', 'note']);

function problemaDe(contenido) {
  let d;
  try { d = JSON.parse(contenido); } catch (e) { return `El JSON no está bien escrito: ${e.message}`; }
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'La raíz tiene que ser un objeto con llaves { }.';
  const fallos = [];

  // Ojo: antes esto usaba "return" dentro de un forEach, que sólo sale del
  // bucle interior: el error se perdía y el panel guardaba bloques inventados.
  // El build sí los detectaba, pero es mejor enterarse antes de escribir.
  if (Array.isArray(d.blocks)) {
    d.blocks.forEach((b, i) => {
      if (!b || typeof b !== 'object') fallos.push(`El bloque ${i + 1} no es un objeto.`);
      else if (!TIPOS.has(b.type)) fallos.push(`El bloque ${i + 1} tiene el tipo "${b.type}" y no existe.`);
    });
  }
  return fallos.length ? fallos.join(' ') : null;
}

function validarArticulo(d) {
  const fallos = [];
  for (const campo of ['title', 'excerpt', 'date', 'category']) {
    if (!d[campo] || !String(d[campo]).trim()) fallos.push(`Falta "${campo}".`);
  }
  if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) fallos.push('La fecha tiene que ser AAAA-MM-DD.');
  if (!Array.isArray(d.blocks) || !d.blocks.length) fallos.push('El artículo no tiene bloques.');
  return fallos;
}

function validarGaleria(d) {
  const fallos = [];
  if (d.albums !== undefined && !Array.isArray(d.albums)) fallos.push('"albums" tiene que ser una lista.');
  for (const [i, a] of (d.albums || []).entries()) {
    if (!a.title) fallos.push(`El álbum ${i + 1} no tiene "title".`);
    for (const [j, f] of (a.photos || []).entries()) {
      if (!f.src) fallos.push(`La foto ${i + 1}.${j + 1} no tiene "src".`);
      else if (!f.alt) fallos.push(`La foto ${i + 1}.${j + 1} no tiene "alt" (obligatorio: describe lo que se ve).`);
      if (f.src && !f.src.startsWith('/assets/')) fallos.push(`La foto ${i + 1}.${j + 1} debe empezar por /assets/`);
    }
  }
  return fallos;
}

const VALIDADORES = {
  articulo: validarArticulo,
  galeria: validarGaleria,
  site: () => [],
};

/* ── Rutas ────────────────────────────────────────────────────────────────── */

const R = {
  '/admin/': { tipo: 'pagina' },
  '/admin/api/sesion': { tipo: 'api' },
  '/admin/api/entrada': { tipo: 'api' },
  '/admin/api/salir': { tipo: 'api' },
  '/admin/api/archivos': { tipo: 'api' },
  '/admin/api/archivo': { tipo: 'api' },
  '/admin/api/guardar': { tipo: 'api' },
  '/admin/api/nuevo': { tipo: 'api' },
  '/admin/api/borrar': { tipo: 'api' },
  '/admin/api/foto': { tipo: 'api' },
  '/admin/api/compilar': { tipo: 'api' },
};

function paginaAdmin() {
  return fs.readFileSync(path.join(import.meta.dirname, 'admin', 'panel.html'), 'utf8');
}

/* ── Servidor ─────────────────────────────────────────────────────────────── */

let clave = null;

// Lee los certificados si los hay. Sin CERT/KEY ni CERTS_DIR va en HTTP plano,
// pensado para FastPanel/Cloudflare que ya terminan TLS antes.
let sslOpts = null;
if (CERTS_DIR) {
  try { sslOpts = { cert: fs.readFileSync(path.join(CERTS_DIR, 'cert.pem')),
                   key:  fs.readFileSync(path.join(CERTS_DIR, 'key.pem')) }; }
  catch (e) { console.error('No se pudo leer el certificado de', CERTS_DIR, '·', e.message); process.exit(2); }
}
else if (CERT && KEY) {
  try { sslOpts = { cert: fs.readFileSync(CERT), key: fs.readFileSync(KEY) }; }
  catch (e) { console.error('No se pudo leer el certificado ·', e.message); process.exit(2); }
}
const usaTls = Boolean(sslOpts);

const servidor = (usaTls ? https : http).createServer(sslOpts || undefined, async (req, res) => {
  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return responder(res, 400, 'Petición no válida');
  }
  const ruta = decodeURIComponent(url.pathname);

  // Cabeceras de seguridad en TODO, también en la web pública.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  try {
    if (ruta === '/' || ruta === '') {
      // Raíz: en modo panel redirige al propio panel, para no delatar que es un
      // puerto de administración; si no, la web.
      return SOLO_PANEL
        ? responder(res, 302, '', { Location: '/admin/' })
        : await estatico(req, res, ruta);
    }
    if (ruta.startsWith('/admin')) return await admin(req, res, url, ruta);
    // Fuera del panel, en modo sólo-panel no se sirve nada: ni la web, ni
    // ficheros sueltos. Menos superficie de ataque y menos riesgo de que alguien
    // descubra el contenido del proyecto.
    if (SOLO_PANEL) return responder(res, 404, 'No encontrado');
    return await estatico(req, res, ruta);
  } catch (e) {
    console.error('✗', e);
    return responder(res, 500, 'Error interno');
  }
});

/* ── Panel ────────────────────────────────────────────────────────────────── */

async function admin(req, res, url, ruta) {
  limpiarSesiones(sesiones);

  // ---------- entrar ----------
  if (ruta === '/admin/api/entrada' && req.method === 'POST') {
    const direccion = ip(req);
    const espera = comprobarBloqueo(intentos.get(direccion));
    if (espera) return json(res, 429, { error: `Demasiados intentos. Prueba en ${espera} segundos.` });

    const b = await cuerpo(req, 8 * 1024);
    let d;
    try { d = JSON.parse(b.toString('utf8')); } catch { return json(res, 400, { error: 'Petición no válida' }); }

    const buena = verificarPassword(d.password || '', clave.hash);
    // Siempre se deriva la clave, salga bien o mal: si fallara rápido quien
    // espera, el tiempo de respuesta revelaría cuáles contraseñas existen.
    if (!buena) {
      intentos.set(direccion, falloIntento(intentos.get(direccion)));
      return json(res, 401, { error: 'Contraseña incorrecta.' });
    }
    intentos.set(direccion, acierto());

    const s = crearSesion();
    sesiones.set(s.token, s);
    console.log(`  acceso desde ${direccion} · ${new Date().toLocaleTimeString('es-ES')}`);
    return json(res, 200, { ok: true, csrf: s.csrf }, { 'Set-Cookie': cookieSesion(s.token, { seguro: vaSeguro(req) }) });
  }

  // ---------- salir ----------
  if (ruta === '/admin/api/salir' && req.method === 'POST') {
    const t = leerCookies(req).aseiio_sesion;
    if (t) sesiones.delete(t);
    return json(res, 200, { ok: true }, { 'Set-Cookie': borrarCookie({ seguro: vaSeguro(req) }) });
  }

  // ---------- comprobar sesión ----------
  if (ruta === '/admin/api/sesion') {
    const s = sesionDe(req);
    return json(res, 200, { dentro: Boolean(s), csrf: s ? s.csrf : null });
  }

  // ---------- servir el panel ----------
  if (ruta === '/admin/' || ruta === '/admin') {
    return responder(res, 200, paginaAdmin(), {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      // El panel no carga nada de fuera: todo va incrustado.
      'Content-Security-Policy':
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
  }

  // ---------- a partir de aquí, todo exige sesión ----------
  const s = sesionDe(req);
  if (!s) return json(res, 401, { error: 'Sesión caducada. Vuelve a entrar.' });
  tocar(s);

  // ---------- proteger contra CSRF ----------
  if (req.method === 'POST') {
    const enviado = req.headers['x-csrf'] || url.searchParams.get('csrf') || '';
    const a = Buffer.from(String(enviado));
    const b = Buffer.from(s.csrf);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return json(res, 403, { error: 'Token de seguridad incorrecto. Recarga la página.' });
    }
  }

  // ---------- listar ----------
  if (ruta === '/admin/api/archivos' && req.method === 'GET') {
    const articulos = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json')).map((f) => {
      const d = JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8'));
      return { archivo: f, titulo: d.title || '(sin título)', fecha: d.date, categoria: d.category, borrador: false };
    }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));

    const fotos = [];
    (function recorrer(dir) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (/\.(jpe?g|png|webp|avif|gif)$/i.test(e.name)) {
          const st = fs.statSync(p);
          fotos.push({
            nombre: path.relative(FOTOS, p).split(path.sep).join('/'),
            kb: Math.round(st.size / 1024),
            modificada: st.mtime.toISOString().slice(0, 10),
          });
        }
      }
    })(FOTOS);
    fotos.sort((a, b) => b.modificada.localeCompare(a.modificada));

    return json(res, 200, {
      articulos,
      fotos,
      tieneGaleria: fs.existsSync(path.join(CONTENT, 'galeria.json')),
      articulosTotal: articulos.length,
    });
  }

  // ---------- leer un archivo ----------
  if (ruta === '/admin/api/archivo' && req.method === 'GET') {
    const tipo = url.searchParams.get('tipo') || 'articulo';
    const archivo = url.searchParams.get('archivo') || '';
    const destino = tipo === 'site'
      ? (archivo === 'site.json' ? path.join(CONTENT, 'site.json') : null)
      : tipo === 'galeria'
        ? (archivo === 'galeria.json' ? path.join(CONTENT, 'galeria.json') : null)
        : seguro(POSTS, archivo);

    if (!destino || !destino.endsWith('.json') || !fs.existsSync(destino)) {
      return json(res, 404, { error: 'Ese archivo no existe.' });
    }
    if (fs.statSync(destino).size > 2 * 1024 * 1024) {
      return json(res, 413, { error: 'El archivo es demasiado grande para el editor.' });
    }
    return json(res, 200, { tipo, contenido: fs.readFileSync(destino, 'utf8') });
  }

  // ---------- guardar ----------
  if (ruta === '/admin/api/guardar' && req.method === 'POST') {
    const b = await cuerpo(req);
    let peticion;
    try { peticion = JSON.parse(b.toString('utf8')); } catch { return json(res, 400, { error: 'Petición no válida' }); }

    const { tipo, archivo, contenido } = peticion;
    const errorJson = problemaDe(contenido || '');
    if (errorJson) return json(res, 400, { error: errorJson });

    let destino;
    let datos;
    try { datos = JSON.parse(contenido); } catch { return json(res, 400, { error: 'El JSON no está bien escrito.' }); }

    if (tipo === 'site') {
      destino = path.join(CONTENT, 'site.json');
    } else if (tipo === 'galeria') {
      destino = path.join(CONTENT, 'galeria.json');
    } else {
      const seguroPath = seguro(POSTS, archivo || '');
      if (!seguroPath || !seguroPath.endsWith('.json')) return json(res, 403, { error: 'Ruta no permitida.' });
      destino = seguroPath;
    }

    const fallos = (VALIDADORES[tipo] || (() => []))(datos);
    if (fallos.length) return json(res, 400, { error: fallos.join(' ') });

    // Copia de seguridad antes de sobrescribir: si alguien guarda un texto a
    // medias, siempre se puede volver atrás.
    const copia = `${destino}.bak`;
    if (fs.existsSync(destino)) fs.copyFileSync(destino, copia);

    fs.writeFileSync(destino, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
    const resultado = await compilar();

    return json(res, 200, {
      ok: true,
      publicado: resultado.ok,
      ms: resultado.ms,
      salida: resultado.salida,
      copia,
    });
  }

  // ---------- artículo nuevo ----------
  if (ruta === '/admin/api/nuevo' && req.method === 'POST') {
    const b = await cuerpo(req, 32 * 1024);
    let p;
    try { p = JSON.parse(b.toString('utf8')); } catch { return json(res, 400, { error: 'Petición no válida' }); }

    const titulo = String(p.titulo || '').trim();
    if (titulo.length < 5) return json(res, 400, { error: 'El título es demasiado corto.' });

    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') ? p.fecha : new Date().toISOString().slice(0, 10);
    const nombre = `${fecha}-${titulo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 45)}.json`;

    const destino = seguro(POSTS, nombre);
    if (!destino) return json(res, 403, { error: 'Nombre no válido.' });
    if (fs.existsSync(destino)) return json(res, 409, { error: 'Ya existe un artículo con ese nombre.' });

    fs.writeFileSync(destino, `${JSON.stringify({
      title: titulo,
      excerpt: String(p.excerpt || '').trim() || 'Resumen por escribir.',
      date: fecha,
      author: 'Equipo ASEIIO',
      category: p.categoria || 'Salud',
      tags: [],
      art: 'digestive',
      cover: 'mix',
      blocks: [
        { type: 'lead', text: 'La primera frase, la que resume todo el artículo.' },
        { type: 'h2', text: 'Un apartado' },
        { type: 'p', text: 'El texto.' },
      ],
    }, null, 2)}\n`, 'utf8');

    await compilar();
    return json(res, 200, { ok: true, archivo: nombre });
  }

  // ---------- borrar artículo ----------
  if (ruta === '/admin/api/borrar' && req.method === 'POST') {
    const b = await cuerpo(req, 8 * 1024);
    let p;
    try { p = JSON.parse(b.toString('utf8')); } catch { return json(res, 400, { error: 'Petición no válida' }); }
    const destino = seguro(POSTS, p.archivo || '');
    if (!destino || !destino.endsWith('.json')) return json(res, 403, { error: 'Ruta no permitida.' });
    if (!fs.existsSync(destino)) return json(res, 404, { error: 'No existe.' });
    fs.renameSync(destino, `${destino}.borrado`);   // no se borra: se aparta
    await compilar();
    return json(res, 200, { ok: true });
  }

  // ---------- subir foto ----------
  if (ruta === '/admin/api/foto' && req.method === 'POST') {
    const nombre = String(url.searchParams.get('nombre') || '');
    // Sólo nombre de fichero: nada de carpetas, nada de rutas.
    if (!/^[\w][\w .-]{2,80}\.(jpe?g|png|webp|avif|gif)$/i.test(nombre)) {
      return json(res, 400, { error: 'Nombre de foto no válido. Ejemplo: jornada-2026.jpg' });
    }
    const destino = path.join(FOTOS, nombre);
    const b = await cuerpo(req, MAX_CUERPO);
    if (!b.length) return json(res, 400, { error: 'No llegó el archivo.' });

    // Comprobar que es de verdad una imagen y no, por ejemplo, un HTML con
    // una extensión .jpg (lo usaría un atacante para ejecutar algo).
    const firma = b.subarray(0, 12);
    const esJpg = firma[0] === 0xff && firma[1] === 0xd8;
    const esPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
    const esGif = b.subarray(0, 3).toString() === 'GIF';
    const esWebp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
    if (![esJpg, esPng, esGif, esWebp].some(Boolean)) {
      return json(res, 415, { error: 'Ese archivo no es una imagen (se espera JPG, PNG, GIF o WebP).' });
    }

    fs.mkdirSync(FOTOS, { recursive: true });
    fs.writeFileSync(destino, b);
    return json(res, 200, { ok: true, nombre, kb: Math.round(b.length / 1024) });
  }

  // ---------- compilar ----------
  if (ruta === '/admin/api/compilar' && req.method === 'POST') {
    return json(res, 200, await compilar());
  }

  return json(res, 404, { error: 'Ruta no encontrada.' });
}

/* ── Web estática ─────────────────────────────────────────────────────────── */

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

async function estatico(req, res, ruta) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return responder(res, 405, 'Método no permitido');

  const destino = seguro(DIST, ruta === '/' ? 'index.html' : ruta);
  if (!destino) return responder(res, 403, 'Ruta no permitida');

  let archivo = destino;
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) {
    archivo = path.join(archivo, 'index.html');
  }
  if (!fs.existsSync(archivo)) {
    const cuatro = path.join(DIST, '404.html');
    if (fs.existsSync(cuatro)) {
      const cuerpo404 = fs.readFileSync(cuatro, 'utf8');
      return responder(res, 404, cuerpo404, { 'Content-Type': 'text/html; charset=utf-8' });
    }
    return responder(res, 404, 'No encontrado');
  }

  const ext = path.extname(archivo).toLowerCase();
  const conCache = /\.(woff2?|png|jpe?g|svg|webp|avif|ico|css|js)$/i.test(archivo);
  return responder(res, 200, fs.readFileSync(archivo), {
    'Content-Type': TIPOS_MIME[ext] || 'application/octet-stream',
    'Cache-Control': conCache ? 'public, max-age=604800' : 'no-cache',
  });
}

/* ── Crear clave ──────────────────────────────────────────────────────────── */

if (process.argv.includes('--crear-clave')) {
  const clave = hashPassword(crypto.randomBytes(18).toString('base64url'));
  fs.writeFileSync(CLAVE, `${JSON.stringify({ hash: clave, creado: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  console.log('\n✓ Creada .admin-clave.json\n');
  console.log('  Guarda este valor como contraseña en un sitio seguro:\n');
  console.log(`    ${clave.split('$').pop().slice(0, 20)}…\n`);
  console.log('  El archivo contiene el hash. Para cambiar la contraseña:\n');
  console.log('    node scripts/admin.js --nueva-clave\n');
  process.exit(0);
}

if (process.argv.includes('--nueva-clave')) {
  const pregunta = process.env.ADMIN_PASSWORD;
  if (!pregunta) {
    console.error('\n  ADMIN_PASSWORD="tu-contraseña-larga" node scripts/admin.js --nueva-clave\n');
    process.exit(1);
  }
  const debil = contraseñaDébil(pregunta);
  if (debil) { console.error(`\n✗ Contraseña demasiado débil: ${debil}\n`); process.exit(1); }
  fs.writeFileSync(CLAVE, `${JSON.stringify({ hash: hashPassword(pregunta), creado: new Date().toISOString() }, null, 2)}\n`, { mode: 0o600 });
  console.log('\n✓ Contraseña cambiada.\n');
  process.exit(0);
}

clave = cargarClave();

const proto = usaTls ? 'https' : 'http';
servidor.listen(PUERTO, HOST, () => {
  const base = `${proto}://${HOST === '0.0.0.0' || HOST === '::' ? 'localhost' : HOST}:${PUERTO}`;
  console.log(`\n  Panel de edición  ${base}/admin/`);
  if (SOLO_PANEL) {
    console.log('  Modo              sólo panel (la web pública la sirve nginx/FastPanel)');
  } else {
    console.log(`  Web               ${base}/`);
  }
  console.log(`  HTTPS             ${usaTls ? 'activo (nativo, certificado local)' : (SEGURO ? 'activo (cookie Secure tras proxy)' : 'INACTIVO — sin TLS: sólo en local o detrás de un proxy con HTTPS')}`);
  console.log('  Permitido escribir content/*.json y assets/fotos/');
  if (SOLO_PANEL) {
    console.log('\n  Para entrar desde tu navegador, haz túnel SSH:');
    console.log('    ssh -L 4322:127.0.0.1:4322 usuario@TU-SERVIDOR');
    console.log('  y abre http://127.0.0.1:4322/admin/');
  }
  console.log('');
});
