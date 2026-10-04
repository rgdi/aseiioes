/**
 * tests.js — batería funcional del sitio, contra el servidor local.
 *
 *   node scripts/serve.js 4321 &
 *   node .qa/tests.js
 *
 * Cada test imprime OK / FAIL. Sale con código 1 si algo falla.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.BASE || 'http://localhost:4321';
const results = [];

const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FALLO'}  ${name}${detail ? `  → ${detail}` : ''}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

/* ══ 1. Menú móvil ══════════════════════════════════════════════════════ */
console.log('\n▸ Menú móvil (390 px)');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' });

  const closedY = await p.evaluate(() => Math.round(document.querySelector('.nav').getBoundingClientRect().bottom));
  check('el menú está oculto al cargar', closedY <= 0, `borde inferior en ${closedY}px`);

  await p.click('#burger');
  await sleep(550);
  const openY = await p.evaluate(() => Math.round(document.querySelector('.nav').getBoundingClientRect().bottom));
  check('se abre al pulsar el botón', openY > 200, `borde inferior en ${openY}px`);
  check('aria-expanded pasa a true', await p.evaluate(() => document.querySelector('#burger').getAttribute('aria-expanded') === 'true'));
  check('la clase del body es menu-open', await p.evaluate(() => document.body.classList.contains('menu-open')));

  await p.keyboard.press('Escape');
  await sleep(500);
  check('Escape lo cierra', await p.evaluate(() => !document.body.classList.contains('menu-open')));
  check('el foco vuelve al botón', await p.evaluate(() => document.activeElement?.id === 'burger'));

  await p.click('#burger');
  await sleep(500);
  await p.click('.nav a[href="/blog/"]');
  await sleep(900);
  check('navegar cierra el menú', await p.evaluate(() => !document.body.classList.contains('menu-open')));
  check('navega a /blog/', await p.evaluate(() => location.pathname) === '/blog/');
  await p.close();
}

/* ══ 2. Filtros y búsqueda ═══════════════════════════════════════════════ */
console.log('\n▸ Blog: filtros y búsqueda');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  const visible = () => p.evaluate(() => [...document.querySelectorAll('.post')].filter((e) => e.offsetParent !== null).length);

  await p.goto(`${BASE}/blog/`, { waitUntil: 'networkidle0' });
  const total = await visible();
  check('se muestran los 7 artículos', total === 7, `${total} visibles`);

  const cats = await p.evaluate(() => [...document.querySelectorAll('[data-filter]')].map((b) => b.getAttribute('data-filter')));
  check('hay 5 filtros (todos + 4 categorías)', cats.length === 5, cats.join(', '));

  let sum = 0;
  for (const cat of cats.filter((c) => c !== 'all')) {
    await p.evaluate((c) => document.querySelector(`[data-filter="${c}"]`).click(), cat);
    await sleep(260);
    const n = await visible();
    sum += n;
    const pressed = await p.evaluate(() => document.querySelector('[aria-pressed="true"]')?.textContent.trim());
    check(`filtro ${cat}`, n > 0 && n < total && pressed === cat, `${n} artículos, activo: ${pressed}`);
  }
  check('las categorías particionan los artículos', sum === total, `${sum} = ${total}`);

  await p.evaluate(() => document.querySelector('[data-filter="all"]').click());
  await sleep(240);
  check('"Todos" restablece la lista', (await visible()) === total);

  await p.type('#blog-search', 'ostom', { delay: 18 });
  await sleep(420);
  const nSearch = await visible();
  check('la búsqueda filtra', nSearch > 0 && nSearch < total, `"ostom" → ${nSearch}`);
  check('la búsqueda se refleja en la URL', (await p.evaluate(() => location.search)) === '?q=ostom');

  await p.evaluate(() => {
    const s = document.querySelector('#blog-search');
    s.value = 'crohn';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(420);
  check('filtro + búsqueda se combinan', (await visible()) < nSearch, `"ostom"+crohn → ${await visible()}`);

  await p.evaluate(() => {
    const s = document.querySelector('#blog-search');
    s.value = 'zzzz';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(400);
  check('estado vacío con "zzzz"', (await visible()) === 0);
  check('se muestra el mensaje de "no encontramos"', await p.evaluate(() => {
    const e = document.querySelector('#blog-empty');
    return !!e && getComputedStyle(e).display !== 'none';
  }));

  await p.keyboard.press('Escape');
  await sleep(300);
  check('Escape vacía la búsqueda', (await visible()) === total);

  await p.goto(`${BASE}/blog/?cat=Salud&q=crohn`, { waitUntil: 'networkidle0' });
  await sleep(500);
  check('una URL filtrada se restaura al cargar', (await visible()) === 1, `?cat=Salud&q=crohn → ${await visible()}`);
  check('el buscador muestra el término', (await p.evaluate(() => document.querySelector('#blog-search').value)) === 'crohn');
  await p.close();
}

/* ══ 3. FAQ ═════════════════════════════════════════════════════════════ */
console.log('\n▸ Preguntas frecuentes');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`${BASE}/recursos/`, { waitUntil: 'networkidle0' });

  const first = await p.evaluate(() => {
    const i = document.querySelector('[data-faq]');
    return { open: i.classList.contains('is-open'), aria: i.querySelector('.faq-q').getAttribute('aria-expanded'), h: i.querySelector('.faq-a').getBoundingClientRect().height };
  });
  check('la primera FAQ viene abierta', first.open && first.aria === 'true', `aria=${first.aria}`);
  check('su respuesta es visible', first.h > 30, `${Math.round(first.h)}px`);

  const second = await p.evaluate(() => {
    const i = document.querySelectorAll('[data-faq]')[1];
    i.querySelector('.faq-q').click();
    return new Promise((r) => setTimeout(() => r({ open: i.classList.contains('is-open'), aria: i.querySelector('.faq-q').getAttribute('aria-expanded'), h: i.querySelector('.faq-a').getBoundingClientRect().height }), 500));
  });
  check('al pulsar se abre', second.open && second.aria === 'true' && second.h > 30, `${Math.round(second.h)}px`);

  const closed = await p.evaluate(() => {
    const i = document.querySelectorAll('[data-faq]')[1];
    i.querySelector('.faq-q').click();
    return new Promise((r) => setTimeout(() => r(i.querySelector('.faq-a').getBoundingClientRect().height), 500));
  });
  check('al pulsar otra vez se cierra', closed < 30, `${Math.round(closed)}px`);
  await p.close();
}

/* ══ 4. Índice del artículo ═════════════════════════════════════════════ */
console.log('\n▸ Índice del artículo');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`${BASE}/blog/ostomia-y-trabajo/`, { waitUntil: 'networkidle0' });
  const links = await p.evaluate(() => [...document.querySelectorAll('[data-toc-link]')].map((a) => a.getAttribute('data-toc-link')));
  check('el índice lista los apartados', links.length >= 4, `${links.length} entradas`);
  const anclasOk = await p.evaluate(() => [...document.querySelectorAll('[data-toc-link]')].every((a) => document.getElementById(a.getAttribute('data-toc-link'))));
  check('todas las anclas existen en la página', anclasOk);

  await p.evaluate(() => document.querySelector('[data-toc-link]').click());
  await sleep(900);
  check('el enlace salta al apartado', await p.evaluate(() => window.scrollY > 300), `scrollY=${await p.evaluate(() => Math.round(window.scrollY))}`);

  await p.evaluate(() => window.scrollTo(0, 3000));
  await sleep(1100);
  const active = await p.evaluate(() => document.querySelector('[data-toc-link].is-active')?.textContent.trim());
  check('se marca el apartado activo al hacer scroll', !!active, active || 'ninguno');
  await p.close();
}

/* ══ 5. Cabecera y animaciones ═══════════════════════════════════════════ */
console.log('\n▸ Cabecera y animaciones');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  check('cabecera normal al inicio', !(await p.evaluate(() => document.querySelector('#header').classList.contains('is-stuck'))));
  await p.evaluate(() => window.scrollTo(0, 400));
  await sleep(400);
  check('cabecera compacta al bajar', await p.evaluate(() => document.querySelector('#header').classList.contains('is-stuck')));
  await p.evaluate(() => window.scrollTo(0, 0));
  await sleep(700);
  check('vuelve al estado normal', !(await p.evaluate(() => document.querySelector('#header').classList.contains('is-stuck'))));

  // Las animaciones de entrada: al cargar sólo está oculto lo que queda bajo
  // el pliegue (es lo esperado); al desplazarse se revela, y además hay una
  // red de seguridad para quien no pueda usar IntersectionObserver.
  const oculto = () => p.evaluate(() => [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length);
  const alCargar = await oculto();
  check('al cargar sólo se oculta lo que está bajo el pliegue', alCargar > 0, `${alCargar} elementos por debajo`);

  await p.evaluate(async () => {
    const h = document.documentElement.scrollHeight;
    for (let y = 0; y < h; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 45)); }
    window.scrollTo(0, 0);
  });
  await sleep(800);
  check('al desplazarse se revela todo', (await oculto()) === 0, `${await oculto()} sin revelar`);

  await p.reload({ waitUntil: 'networkidle0' });
  await sleep(3200);
  check('red de seguridad: todo visible aunque no se desplace', (await oculto()) === 0, `${await oculto()} sin revelar a los 3 s`);
  await p.close();
}

/* ══ 6. Enlaces y navegación ════════════════════════════════════════════ */
console.log('\n▸ Enlaces');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  const cta = await p.evaluate(() => {
    const a = document.querySelector('.hero__grid .btn');
    return { text: a.textContent.trim(), href: a.getAttribute('href') };
  });
  check('el botón principal apunta a una ruta interna', cta.href.startsWith('/'), `${cta.text} → ${cta.href}`);

  await p.goto(`${BASE}/blog/ostomia-y-trabajo/`, { waitUntil: 'networkidle0' });
  const nav = await p.evaluate(() => {
    const a = document.querySelector('.post-nav a');
    return a ? a.getAttribute('href') : null;
  });
  check('la navegación entre artículos funciona', !!nav && nav.startsWith('/blog/'), nav || 'sin enlace');
  const externos = await p.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].filter((a) => !a.rel.includes('noopener')).length);
  check('los enlaces externos llevan rel=noopener', externos === 0, `${externos} sin noopener`);
  const mail = await p.evaluate(() => [...document.querySelectorAll('a[href^="mailto:"]')].length);
  check('hay enlaces de correo', mail > 0, `${mail} enlaces`);
  await p.close();
}

/* ══ 7. 404 ═════════════════════════════════════════════════════════════ */
console.log('\n▸ Página 404');
{
  const p = await browser.newPage();
  const res = await p.goto(`${BASE}/ruta-que-no-existe/`, { waitUntil: 'networkidle0' });
  check('devuelve código 404', res.status() === 404, `HTTP ${res.status()}`);
  check('ofrece salidas', (await p.evaluate(() => document.querySelectorAll('main a').length)) >= 3);
  await p.close();
}

/* ══ 8. Sin JavaScript ══════════════════════════════════════════════════ */
console.log('\n▸ Sin JavaScript');
{
  const p = await browser.newPage();
  await p.setJavaScriptEnabled(false);
  await p.setViewport({ width: 1280, height: 900 });
  for (const [url, label] of [['/blog/', 'blog'], ['/recursos/', 'recursos'], ['/', 'portada']]) {
    await p.goto(BASE + url, { waitUntil: 'domcontentloaded' });
    const r = await p.evaluate(() => ({
      ocultos: [...document.querySelectorAll('[data-reveal]')].filter((e) => getComputedStyle(e).opacity === '0').length,
      faqCerradas: [...document.querySelectorAll('.faq-a')].filter((e) => e.getBoundingClientRect().height < 10).length,
      articulos: [...document.querySelectorAll('.post')].filter((e) => e.offsetParent !== null).length,
    }));
    check(`${label}: el contenido se lee entero`, r.ocultos === 0, `${r.ocultos} ocultos`);
    check(`${label}: las FAQ son legibles`, r.faqCerradas === 0, `${r.faqCerradas} plegadas`);
  }
  await p.goto(`${BASE}/blog/`, { waitUntil: 'domcontentloaded' });
  check('blog: los 7 artículos se ven sin JS', (await p.evaluate(() => [...document.querySelectorAll('.post')].filter((e) => e.offsetParent !== null).length)) === 7);
  await p.close();
}

/* ══ 9. Imágenes y recursos ═════════════════════════════════════════════ */
console.log('\n▸ Imágenes y recursos');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  const fallos = [];
  p.on('requestfailed', (r) => fallos.push(r.url()));
  p.on('response', (r) => { if (r.status() >= 400) fallos.push(`${r.status()} ${r.url()}`); });
  const pages = ['/', '/blog/', '/servicios/', '/derechos/', '/asociacion/', '/recursos/', '/legal/', '/blog/ostomia-y-trabajo/', '/blog/mi-historia/'];
  for (const u of pages) await p.goto(BASE + u, { waitUntil: 'networkidle0' });
  check('ningún recurso falla al cargar', fallos.length === 0, fallos.slice(0, 3).join(' · '));

  let sinAlt = 0;
  let rotas = 0;
  for (const u of pages) {
    await p.goto(BASE + u, { waitUntil: 'networkidle0' });
    const r = await p.evaluate(() => ({
      a: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      b: [...document.querySelectorAll('img')].filter((i) => !i.complete || i.naturalWidth === 0).length,
    }));
    sinAlt += r.a; rotas += r.b;
  }
  check('todas las imágenes tienen alt', sinAlt === 0, `${sinAlt} sin alt`);
  check('todas las imágenes cargan', rotas === 0, `${rotas} rotas`);
  await p.close();
}

/* ══ 10. Impresión ══════════════════════════════════════════════════════ */
console.log('\n▸ Impresión');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  await p.goto(`${BASE}/blog/ostomia-y-trabajo/`, { waitUntil: 'networkidle0' });
  await p.emulateMediaType('print');
  await sleep(400);
  const r = await p.evaluate(() => ({
    header: getComputedStyle(document.querySelector('.header')).display,
    footer: getComputedStyle(document.querySelector('.footer')).display,
    prose: getComputedStyle(document.querySelector('.prose')).display,
  }));
  check('al imprimir se ocultan cabecera y pie', r.header === 'none' && r.footer === 'none', `header=${r.header} footer=${r.footer}`);
  check('el artículo sigue presente', r.prose !== 'none');
  await p.close();
}

/* ══ Resumen ═══════════════════════════════════════════════════════════ */
const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.log(`\n${'═'.repeat(52)}`);
console.log(`${ok} correctos · ${fail} fallidos · ${results.length} comprobaciones`);
if (fail) {
  console.log('\nFallos:');
  results.filter((r) => !r.ok).forEach((r) => console.log(`  · ${r.name}${r.detail ? ` → ${r.detail}` : ''}`));
}
await browser.close();
process.exit(fail ? 1 : 0);
