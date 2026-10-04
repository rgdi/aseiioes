/**
 * security.mjs — auditoría del panel de edición, contra el servidor en marcha.
 *
 *   node scripts/admin.js 4322 &
 *   node .qa/security.mjs
 *
 * Comprueba que un atacante sin contraseña no pueda tocar nada.
 */
import crypto from 'node:crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:4322';
const CLAVE = process.env.ADMIN_PASSWORD;
if (!CLAVE) { console.error('\nFalta ADMIN_PASSWORD\n'); process.exit(1); }

let ok = 0, mal = 0;
const t = (n, c, d = '') => {
  if (c) { ok += 1; console.log('  ok    ' + n); }
  else { mal += 1; console.log('  FALLO ' + n + (d ? '  → ' + d : '')); }
};

let csrf = null;
let cookie = '';
// fetch de Node no guarda cookies: hay que llevarlas a mano, como un navegador.
const cab = (h, conCookie = true) => ({
  'Content-Type': 'application/json',
  'X-CSRF': h,
  ...(conCookie && cookie ? { Cookie: cookie.split(';')[0] } : {}),
});

async function entrar() {
  const r = await fetch(BASE + '/admin/api/entrada', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: CLAVE }),
  });
  const cab2 = r.headers.get('set-cookie') || '';
  const d = await r.json();
  csrf = d.csrf;
  cookie = cab2;
  return { status: r.status, cookie: cab2, d };
}

/* ══ 1. Sin contraseña, no se puede hacer nada ═══════════════════════════ */
console.log('\n▸ Sin contraseña');
{
  const rutas = ['/admin/api/archivos', '/admin/api/archivo?tipo=site&archivo=site.json'];
  for (const r of rutas) {
    const res = await fetch(BASE + r);
    t('GET ' + r + ' pide sesión', res.status === 401, 'HTTP ' + res.status);
  }
  for (const [r, c] of [['/admin/api/guardar', { tipo: 'site', archivo: 'site.json', contenido: '{}' }],
                       ['/admin/api/nuevo', { titulo: 'Intruso' }],
                       ['/admin/api/borrar', { archivo: 'x.json' }],
                       ['/admin/api/compilar', {}],
                       ['/admin/api/foto?nombre=atacante.jpg', null]]) {
    const res = await fetch(BASE + r, { method: 'POST', headers: cab(''), body: c ? JSON.stringify(c) : 'noSoyUnaImagen' });
    t('POST ' + r.split('?')[0] + ' pide sesión', res.status === 401, 'HTTP ' + res.status);
  }
}

/* ══ 2. Contraseña incorrecta ══════════════════════════════════════════ */
console.log('\n▸ Contraseña incorrecta');
{
  const r = await fetch(BASE + '/admin/api/entrada', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'no-es-la-contraseña' }),
  });
  const d = await r.json();
  t('rechaza la contraseña', r.status === 401);
  t('no devuelve cookie', !(r.headers.get('set-cookie') || '').includes('aseiio_sesion'));
  t('no dice si el usuario existe', !/usuario|contraseña incorrecta.*usuario/i.test(d.error || ''));
}

/* ══ 3. Entrar de verdad ════════════════════════════════════════════════ */
console.log('\n▸ Acceso correcto');
{
  const e = await entrar();
  t('entra', e.status === 200);
  t('devuelve cookie HttpOnly', /HttpOnly/i.test(e.cookie));
  t('la cookie es SameSite=Strict', /SameSite=Strict/i.test(e.cookie));
  t('la cookie caduca', /Max-Age=\d+/i.test(e.cookie));
  t('devuelve token CSRF', typeof csrf === 'string' && csrf.length > 20);
  t('la cookie no lleva la contraseña', !e.cookie.includes(CLAVE));
}

/* ══ 4. CSRF ════════════════════════════════════════════════════════════ */
console.log('\n▸ Falsificación de peticiones (CSRF)');
{
  const sinToken = await fetch(BASE + '/admin/api/compilar', { method: 'POST', headers: { Cookie: cookie.split(';')[0] } });
  t('una escritura sin token se rechaza', sinToken.status === 403, 'HTTP ' + sinToken.status);
  const malToken = await fetch(BASE + '/admin/api/compilar', { method: 'POST', headers: cab('inventado') });
  t('un token inventado se rechaza', malToken.status === 403);
  const bueno = await fetch(BASE + '/admin/api/compilar', { method: 'POST', headers: cab(csrf) });
  t('con el token correcto se acepta', bueno.status === 200);
}

/* ══ 5. Recorrido de carpetas ═════════════════════════════════════════════ */
console.log('\n▸ Intento de salirse de las carpetas permitidas');
{
  const rutas = [
    '/admin/api/archivo?tipo=articulo&archivo=../../.admin-clave.json',
    '/admin/api/archivo?tipo=articulo&archivo=../../../etc/passwd',
    '/admin/api/archivo?tipo=articulo&archivo=..%2F..%2F.admin-clave.json',
    '/admin/api/archivo?tipo=articulo&archivo=/etc/passwd',
    '/admin/api/archivo?tipo=articulo&archivo=....//....//.admin-clave.json',
    '/admin/api/archivo?tipo=articulo&archivo=site.json',
  ];
  for (const r of rutas) {
    const res = await fetch(BASE + r, { headers: cab(csrf) });
    const cuerpo = await res.text();
    const limpio = res.status === 404 || res.status === 403
      || (!cuerpo.includes('scrypt') && !cuerpo.includes('root:'));
    t('bloqueado: ' + decodeURIComponent(r.split('archivo=')[1] || r).slice(0, 34), limpio, 'HTTP ' + res.status);
  }
  // Escritura fuera de content/
  for (const archivo of ['../../escape.json', '../../../tmp/escape.json', '/etc/escape.json']) {
    const res = await fetch(BASE + '/admin/api/guardar', {
      method: 'POST', headers: cab(csrf), body: JSON.stringify({ tipo: 'articulo', archivo, contenido: '{}' }),
    });
    t('no se escribe fuera: ' + archivo.slice(0, 26), res.status === 403 || res.status === 400, 'HTTP ' + res.status);
  }
}

/* ══ 6. Subida de archivos ══════════════════════════════════════════════ */
console.log('\n▸ Subida de fotos');
{
  const nombres = ['../../evil.jpg', '/etc/passwd', 'foto.html', 'foto.php', 'sin-punto', 'a.svg', 'x.exe'];
  for (const nombre of nombres) {
    const res = await fetch(BASE + '/admin/api/foto?nombre=' + encodeURIComponent(nombre), {
      method: 'POST', headers: { 'X-CSRF': csrf, Cookie: cookie.split(';')[0] }, body: Buffer.from('contenido'),
    });
    t('nombre rechazado: ' + nombre, res.status === 400, 'HTTP ' + res.status);
  }
  // Un HTML disfrazado de JPEG: el fallo grave clásico
  const falso = await fetch(BASE + '/admin/api/foto?nombre=tramposo.jpg', {
    method: 'POST', headers: { 'X-CSRF': csrf, Cookie: cookie.split(';')[0] },
    body: Buffer.from('<script>alert(1)</script>'),
  });
  t('un HTML disfrazado de .jpg se rechaza', falso.status === 415, 'HTTP ' + falso.status);
  // Un JPEG de verdad, pequeño
  const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0]);
  const bueno = await fetch(BASE + '/admin/api/foto?nombre=prueba-mini.jpg', {
    method: 'POST', headers: { 'X-CSRF': csrf, Cookie: cookie.split(';')[0] }, body: jpg,
  });
  t('un JPEG real se acepta', bueno.status === 200, 'HTTP ' + bueno.status);
  const fs = await import('node:fs');
  fs.rmSync('assets/fotos/prueba-mini.jpg', { force: true });
}

/* ══ 7. Cabeceras del panel ═════════════════════════════════════════════ */
console.log('\n▸ Cabeceras de seguridad');
{
  const res = await fetch(BASE + '/admin/', { method: 'GET' });
  const h = res.headers;
  t('prohibe cargar scripts de fuera (CSP)', (h.get('content-security-policy') || '').includes("default-src 'none'"));
  t('prohige encajarlo en un iframe', h.get('x-frame-options') === 'DENY');
  t('no adivina el tipo de archivo', h.get('x-content-type-options') === 'nosniff');
  t('no envía la URL a terceros', h.get('referrer-policy') === 'no-referrer');
  t('no se guarda en caché', (h.get('cache-control') || '').includes('no-store'));
  const cuerpo = await res.text();
  t('el panel no carga nada de internet', !/https?:\/\/(?!127\.0\.0\.1)/.test(cuerpo.replace(/127\.0\.0\.1/g, '')));
  t('no hay enlaces a scripts externos', !/<script[^>]+src=/.test(cuerpo));
}

/* ══ 8. La web pública no filtra nada ═══════════════════════════════════ */
console.log('\n▸ La web pública sigue sin login');
{
  // redirect: 'manual' porque en modo sólo-panel la raíz redirige al panel, y
  // si se sigue la redirección acabaría leyéndose la página del panel.
  const res = await fetch(BASE + '/', { redirect: 'manual' });
  if (process.env.SOLO_PANEL === '1') {
    // La web no se sirve por este puerto: eso ya lo comprueba el bloque de más
    // arriba. Aquí sólo se confirma que tampoco hay HTML con enlaces al panel.
    t('la raíz no devuelve la web', res.status === 302, `${res.status}`);
  } else {
    t('la portada se sirve sin contraseña', res.status === 200);
  }
  const cuerpo = await res.text();
  t('no menciona el panel', !cuerpo.includes('/admin'));
  const xml = await fetch(BASE + '/admin/../package.json', { redirect: 'manual' });
  t('no se leen ficheros fuera de dist/', !String(await xml.text()).includes('"aseiio-web"'));
}

/* ══ 7.b Modo sólo-panel: la web no debe salir por el puerto del panel ════ */
// Con el panel en su propio puerto, este proceso no debe servir la web. Es la
// configuración recomendada en producción: nginx/FastPanel sirve dist/, y aquí
// sólo vive el panel.
if (process.env.SOLO_PANEL === '1') {
  console.log('\n▸ Modo sólo-panel (puerto aparte)');
  const r = await fetch(BASE + '/', { redirect: 'manual' });
  t('la raíz no sirve la web', r.status === 302, `${r.status}`);
  t('y redirige al panel', (r.headers.get('location') || '') === '/admin/');
  for (const ruta of ['/blog/', '/galeria/', '/temas/', '/index.html', '/assets/styles.css',
    '/package.json', '/content/site.json', '/scripts/admin.js', '/sitemap.xml', '/robots.txt']) {
    const r2 = await fetch(BASE + ruta, { redirect: 'manual' });
    t(`no sirve ${ruta}`, r2.status === 404, `${r2.status}`);
  }
  const panel = await fetch(BASE + '/admin/');
  t('pero el panel sí responde', panel.status === 200, `${panel.status}`);
  const html = await panel.text();
  t('y la entrada no enlaza a la web', !html.includes('href="/blog"'));
  t('ni expone rutas del proyecto', !/\/content\/|package\.json|\.admin-clave/.test(html));
}

/* ══ 8. Detrás de un proxy ═══════════════════════════════════════════════ */
// En producción el panel va detrás de nginx. Si no entendiera sus cabeceras,
// la cookie saldría sin Secure y el bloqueo por IP affectaría a todo el
// equipo a la vez: bastaría un atacante para cerrarle el paso a todos.
// Va antes del test que bloquea la IP real, que es la última de la tanda.
console.log('\n▸ Detrás de un proxy (nginx)');

const entraCon = async (headers) => {
  const r = await fetch(BASE + '/admin/api/entrada', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ password: CLAVE }),
  });
  return r.headers.get('set-cookie') || '';
};

t('X-Forwarded-Proto: https pone Secure en la cookie',
  (await entraCon({ 'X-Forwarded-Proto': 'https' })).includes('Secure'));
t('sin HTTPS la cookie no lleva Secure',
  !(await entraCon({})).includes('Secure'));

/** Cada visitante de verdad debe tener su propio contador: si no, un atacante
 *  podría agotar el de todo el equipo y dejar la web sin poder publicar nada. */
const seisFallos = async (ip) => {
  const codigos = [];
  for (let i = 0; i < 6; i += 1) {
    const r = await fetch(BASE + '/admin/api/entrada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
      body: JSON.stringify({ password: 'no-es-la-buena' }),
    });
    codigos.push(r.status);
  }
  const buena = await fetch(BASE + '/admin/api/entrada', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Real-IP': ip },
    body: JSON.stringify({ password: CLAVE }),
  });
  return { ultima: codigos[codigos.length - 1], conBuena: buena.status };
};

const ipUno = await seisFallos('203.0.113.7');
t('con proxy, el bloqueo es por visitante real',
  ipUno.ultima === 429 && ipUno.conBuena === 429, `intentos ${ipUno.ultima}, buena ${ipUno.conBuena}`);
const ipDos = await seisFallos('198.51.100.9');
t('y no arrastra a los demás visitantes',
  ipDos.ultima === 429
  && (await fetch(BASE + '/admin/api/entrada', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '192.0.2.55' },
    body: JSON.stringify({ password: CLAVE }),
  })).status === 200);

/* ══ 9. Límite de intentos ══════════════════════════════════════════════ */
console.log('\n▸ Fuerza bruta');
{
  let bloqueado = 0;
  for (let i = 0; i < 7; i += 1) {
    const res = await fetch(BASE + '/admin/api/entrada', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'intento-' + i }),
    });
    if (res.status === 429) bloqueado = res.status;
  }
  t('a los 5 intentos bloquea la IP', bloqueado === 429, 'nunca devolvió 429');
}

console.log(`\n${ok} correctos · ${mal} fallidos\n`);
