/**
 * auth.js — autenticación del panel de edición.
 *
 * Sin dependencias: usa el módulo crypto de Node. Está aquí separado del
 * servidor a propósito, porque es la parte que hay que poder auditar leyendo
 * un solo archivo.
 *
 * Decisiones y por qué:
 *  · scrypt con sal por usuario. La contraseña no se guarda, ni su hash de
 *    Blowfish, ni en texto plano: sólo el resultado de derivarla con una sal
 *    aleatoria. Dos personas con la misma contraseña tienen valores distintos.
 *  · Comparación en tiempo constante. Si dos contraseñas difieren en el
 *    primer carácter, el tiempo de respuesta no lo revela.
 *  · Sesión = 32 bytes aleatorios, en cookie HttpOnly y SameSite=Strict, para
 *    que el JavaScript de la página no la pueda leer ni mandarla en otro sitio.
 *  · Límite de intentos por IP, con bloqueo creciente. Sin esto, un atacante
 *    puede probar un millón de contraseñas por segundo.
 *  · Un token CSRF por sesión, además de la cookie: así, aunque alguien
 *    conseguisse que tu navegador envíe la petición, no puede adivinar el token.
 */
import crypto from 'node:crypto';

// ── Contraseña ──────────────────────────────────────────────────────────────

const LARGO = 64;      // bytes de la clave derivada
const N = 16384;       // coste de scrypt (2^14). Sube a 32768 si el servidor va sobrado
const R = 8;
const P = 1;

export function hashPassword(password) {
  const sal = crypto.randomBytes(16);
  const clave = crypto.scryptSync(String(password), sal, LARGO, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${sal.toString('base64')}$${clave.toString('base64')}`;
}

export function verificarPassword(password, guardado) {
  try {
    const [alg, n, r, p, salB64, claveB64] = String(guardado).split('$');
    if (alg !== 'scrypt') return false;
    const esperado = Buffer.from(claveB64, 'base64');
    const calculada = crypto.scryptSync(String(password), Buffer.from(salB64, 'base64'), esperado.length, {
      N: Number(n), r: Number(r), p: Number(p),
    });
    return crypto.timingSafeEqual(esperado, calculada);
  } catch {
    return false;
  }
}

/**
 * Comprueba que una contraseña no sea de las que se rompen en un segundo.
 * No sustituye a usar una buena: sólo avisa de las evidentes.
 */
export function contraseñaDébil(password) {
  const p = String(password);
  if (p.length < 12) return 'Tiene menos de 12 caracteres.';
  if (/^(?:12345|password|contraseña|admin|aseiio|qwerty)/i.test(p)) return 'Es una palabra demasiado obvious.';
  if (/^(.)\1+$/.test(p)) return 'Es un solo carácter repetido.';
  if (new Set(p).size < 5) return 'Usa demasiados caracteres repetidos.';
  return null;
}

// ── Sesiones ────────────────────────────────────────────────────────────────

const DURACION = 8 * 60 * 60 * 1000;  // 8 horas
const MAX_SESIONES = 200;

export function crearSesion() {
  const token = crypto.randomBytes(32).toString('base64url');
  return {
    token,
    csrf: crypto.randomBytes(24).toString('base64url'),
    creada: Date.now(),
    ultima: Date.now(),
  };
}

export function sesionViva(s, ahora = Date.now()) {
  return Boolean(s) && ahora - s.ultima < DURACION;
}

export function tocar(s) {
  s.ultima = Date.now();
}

/** Si la sesión no se renueva, la cookie expira sola en el navegador. */
export function cookieSesion(token, { seguro = false, maxAge = DURACION } = {}) {
  const partes = [
    `aseiio_sesion=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ];
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

export function borrarCookie({ seguro = false } = {}) {
  const partes = ['aseiio_sesion=', 'Path=/', 'HttpOnly', 'SameSite=Strict', 'Max-Age=0'];
  if (seguro) partes.push('Secure');
  return partes.join('; ');
}

export function limpiarSesiones(mapa) {
  const ahora = Date.now();
  let n = 0;
  for (const [k, v] of mapa) {
    if (!sesionViva(v, ahora)) { mapa.delete(k); n += 1; }
  }
  // Si se han acumulado demasiadas, se descartan las más antiguas.
  if (mapa.size > MAX_SESIONES) {
    const orden = [...mapa.entries()].sort((a, b) => a[1].ultima - b[1].ultima);
    for (const [k] of orden.slice(0, mapa.size - MAX_SESIONES)) { mapa.delete(k); n += 1; }
  }
  return n;
}

// ── Límite de intentos ──────────────────────────────────────────────────────

const INTENTES = 5;
const BLOQUEO_BASE = 60_000;      // 1 minuto tras 5 intentos fallidos
const BLOQUEO_MAX = 30 * 60_000;  // nunca más de 30 minutos

export function comprobarBloqueo(registro, ahora = Date.now()) {
  if (!registro || !registro.hasta || registro.hasta <= ahora) return null;
  return Math.ceil((registro.hasta - ahora) / 1000);
}

export function fallo(registro, ahora = Date.now()) {
  const n = (registro?.n || 0) + 1;
  if (n < INTENTES) return { ...(registro || {}), n, hasta: 0 };
  const espera = Math.min(BLOQUEO_BASE * 2 ** (n - INTENTES), BLOQUEO_MAX);
  return { n, hasta: ahora + espera };
}

export function acierto() {
  return { n: 0, hasta: 0 };
}
