/**
 * tests2.js — responsive, accesibilidad y SEO.
 *
 *   node scripts/serve.js 4321 &
 *   node scripts/test-ui.js   (arranca antes el servidor)
 */
import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4321';
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FALLO'}  ${name}${detail ? `  → ${detail}` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Las páginas se descubren del sitemap, no se escriben a mano.
const PAGES = (await (await fetch(`${BASE}/sitemap.xml`)).text())
  .split('<loc>').slice(1).map((s) => s.split('</loc>')[0])
  .map((u) => u.replace(/^https?:\/\/[^/]+/, '') || '/')
  .filter((u) => !u.endsWith('.html') || u === '/404.html');

/** Chrome de Puppeteer. Si no está en la caché que espera, se busca en los
 *  navegadores de Playwright y del sistema, para no tener que bajar 300 MB en
 *  cada máquina. Se puede forzar con CHROME_PATH. */
const ABRIR = (() => {
  let ejecutable;
  if (process.env.CHROME_PATH) {
    ejecutable = process.env.CHROME_PATH;
  } else {
    const bases = ['/root/.cache/ms-playwright', '/root/.cache/puppeteer',
      `${process.env.HOME || ''}/.cache/ms-playwright`];
    for (const base of bases) {
      let dirs = [];
      try { dirs = readdirSync(base); } catch { continue; }
      for (const d of dirs) {
        for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome',
          'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          if (existsSync(`${base}/${d}/${sub}`)) ejecutable = `${base}/${d}/${sub}`;
        }
        if (ejecutable) break;
      }
      if (ejecutable) break;
    }
  }
  return { args: ['--no-sandbox', '--disable-setuid-sandbox'],
           ...(ejecutable ? { executablePath: ejecutable } : {}) };
})();
const browser = await puppeteer.launch(ABRIR);

/* ══ 1. Responsive ══════════════════════════════════════════════════════ */
console.log('\n▸ Responsive: sin desbordamiento horizontal');
{
  let total = 0; const falls = [];
  for (const [w, h] of [[1920, 1080], [1600, 900], [1440, 900], [1280, 800], [1100, 800], [1024, 768], [900, 1000], [820, 1180], [768, 1024], [640, 900], [540, 900], [430, 932], [390, 844], [360, 740], [320, 700]]) {
    const p = await browser.newPage();
    await p.setViewport({ width: w, height: h, isMobile: w < 800, hasTouch: w < 800 });
    for (const u of PAGES) {
      await p.goto(BASE + u, { waitUntil: 'domcontentloaded' });
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      total += 1;
      if (r.sw > r.cw + 1) { falls.push(`${u}@${w} (${r.sw}>${r.cw})`); }
    }
    await p.close();
    console.log(`    ${String(w).padStart(4)} px · ${PAGES.length} páginas ${falls.length ? '' : 'ok'}`);
  }
  check(`sin scroll horizontal en ${total} combinaciones`, falls.length === 0, falls.slice(0, 4).join(' · '));
}

/* ══ 2. Objetivos táctiles en móvil ═════════════════════════════════════ */
console.log('\n▸ Tamaño de los botones (móvil)');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  for (const u of ['/', '/blog/', '/recursos/', '/asociacion/']) {
    await p.goto(BASE + u, { waitUntil: 'networkidle0' });
    const chicos = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll('a.btn, button, .filter, .faq-q, #burger').forEach((el) => {
        if (el.offsetParent === null) return;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.height < 32) out.push(`${el.className || el.tagName}:${Math.round(r.height)}px`);
      });
      return out;
    });
    check(`${u} · botones con altura suficiente`, chicos.length === 0, chicos.slice(0, 3).join(' · '));
  }
  await p.close();
}

/* ══ 3. Contraste ═══════════════════════════════════════════════════════ */
console.log('\n▸ Contraste de texto');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  const lum = ([r, g, b]) => {
    const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  for (const u of ['/', '/blog/', '/derechos/', '/recursos/', '/legal/']) {
    await p.goto(BASE + u, { waitUntil: 'networkidle0' });
    const malos = await p.evaluate(() => {
      const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const l = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      // Si algún ancestro tiene degradado o imagen de fondo, el color sólido
      // no es representativo: se omite y se revisa aparte.
      const bgOf = (el) => {
        let n = el;
        while (n && n !== document.documentElement) {
          const st = getComputedStyle(n);
          if (st.backgroundImage && st.backgroundImage !== 'none') return null;
          const c = st.backgroundColor;
          const p = (c.match(/[\d.]+/g) || []).map(Number);
          if (p.length >= 3 && (p[3] === undefined || p[3] > 0.85)) return p.slice(0, 3);
          n = n.parentElement;
        }
        return [255, 255, 255];
      };
      const out = [];
      document.querySelectorAll('p, a, span, h1, h2, h3, h4, li, button, small, td, th, label').forEach((el) => {
        if (el.offsetParent === null) return;
        if (!el.textContent.trim() || el.children.length > 0) return;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const grande = size >= 24 || (size >= 18.66 && bold);
        const fg = (cs.color.match(/[\d.]+/g) || []).map(Number).slice(0, 3);
        if (fg.length < 3) return;
        const bg = bgOf(el);
        if (!bg) return;
        const l1 = l(fg), l2 = l(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const min = grande ? 3 : 4.5;
        if (ratio < min) out.push({ txt: el.textContent.trim().slice(0, 28), ratio: +ratio.toFixed(2), min, size: Math.round(size) });
      });
      return out;
    });
    // deduplicar por texto
    const uniq = [...new Map(malos.map((m) => [m.txt, m])).values()];
    check(`${u} · contraste AA`, uniq.length === 0, uniq.slice(0, 3).map((m) => `"${m.txt}" ${m.ratio}:1 (mín ${m.min})`).join(' · '));
  }
  await p.close();
}

/* ══ 4. Accesibilidad estructural ═══════════════════════════════════════ */
console.log('\n▸ Accesibilidad');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  for (const u of PAGES) {
    await p.goto(BASE + u, { waitUntil: 'networkidle0' });
    const a = await p.evaluate(() => {
      const h1 = document.querySelectorAll('h1').length;
      const h = [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => +e.tagName[1]);
      let salto = 0;
      for (let i = 1; i < h.length; i += 1) if (h[i] - h[i - 1] > 1) salto += 1;
      const focus = [...document.querySelectorAll('a,button,input,summary,[tabindex]')].filter((e) => e.offsetParent !== null || e.tagName === 'A');
      const sinNombre = focus.filter((e) => !(e.innerText || '').trim() && !e.getAttribute('aria-label') && !e.getAttribute('title') && e.tagName !== 'INPUT');
      return {
        h1,
        salto,
        sinNombre: sinNombre.length,
        main: !!document.querySelector('main#main'),
        skip: !!document.querySelector('a.skip'),
        lang: document.documentElement.lang,
        landmarks: ['header', 'main', 'footer', 'nav'].filter((t) => document.querySelector(t)).length,
      };
    });
    const prob = [];
    if (a.h1 !== 1) prob.push(`${a.h1} h1`);
    if (a.salto) prob.push(`${a.salto} saltos de nivel`);
    if (a.sinNombre) prob.push(`${a.sinNombre} sin nombre`);
    if (!a.main) prob.push('sin <main id="main">');
    if (!a.skip) prob.push('sin enlace de salto');
    if (a.lang !== 'es') prob.push('lang=' + a.lang);
    if (a.landmarks < 4) prob.push(`${a.landmarks} landmarks`);
    check(`${u}`, prob.length === 0, prob.join(' · '));
  }
  await p.close();
}

/* ══ 5. SEO técnico ════════════════════════════════════════════════════ */
console.log('\n▸ SEO');
{
  const p = await browser.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  for (const u of PAGES) {
    await p.goto(BASE + u, { waitUntil: 'networkidle0' });
    const s = await p.evaluate(() => {
      const g = (sel, attr) => {
        const el = document.querySelector(sel);
        if (!el) return '';
        return el.getAttribute(attr || (el.tagName === 'LINK' ? 'href' : 'content')) || '';
      };
      let jsonld = 0; let jsonldMal = 0;
      document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
        jsonld += 1;
        try { JSON.parse(el.textContent); } catch { jsonldMal += 1; }
      });
      return {
        title: document.title,
        desc: g('meta[name="description"]'),
        canonical: g('link[rel="canonical"]'),
        og: g('meta[property="og:image"]'),
        tw: g('meta[name="twitter:card"]'),
        robots: g('meta[name="robots"]'),
        jsonld, jsonldMal,
        h1: document.querySelector('h1')?.textContent.trim().length || 0,
      };
    });
    const prob = [];
    if (s.title.length < 10 || s.title.length > 70) prob.push(`title ${s.title.length} car.`);
    if (s.desc.length < 50 || s.desc.length > 165) prob.push(`desc ${s.desc.length} car.`);
    if (!s.canonical.startsWith('http')) prob.push('sin canonical');
    if (!/^https?:\/\//.test(s.og)) prob.push('sin og:image');
    if (s.jsonld === 0) prob.push('sin JSON-LD');
    if (s.jsonldMal) prob.push(`${s.jsonldMal} JSON-LD inválidos`);
    if (s.h1 < 5) prob.push('h1 demasiado corto');
    check(`${u} · metadatos`, prob.length === 0, prob.join(' · '));
  }
  await p.close();
}

/* ══ 6. Ficheros para buscadores ════════════════════════════════════════ */
console.log('\n▸ Ficheros para buscadores');
{
  const p = await browser.newPage();
  for (const [f, tipo] of [['/sitemap.xml', 'xml'], ['/feed.xml', 'xml'], ['/robots.txt', 'txt'], ['/blog/index.json', 'json']]) {
    const r = await p.goto(BASE + f, { waitUntil: 'domcontentloaded' });
    const body = await r.text();
    const ok = r.status() === 200 && body.length > 30;
    check(`${f}`, ok, `HTTP ${r.status()}, ${body.length} bytes`);
    if (ok && f === '/blog/index.json') {
      try { const j = JSON.parse(body); check('  → índice con todos los artículos', j.posts?.length > 0, `${j.posts?.length}`); }
      catch { check('  → JSON válido', false); }
    }
    if (ok && f === '/sitemap.xml') {
      const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      check(`  → ${PAGES.length} URLs en el sitemap`, locs.length === PAGES.length, `${locs.length}`);
      const rutas = locs.map((l) => l.replace(/^https?:\/\/[^/]+/, '') || '/');
      let rotas = 0;
      for (const ruta of rutas) { const x = await p.goto(BASE + ruta, { waitUntil: 'domcontentloaded' }); if (x.status() !== 200) rotas += 1; }
      check('  → todas las URLs responden 200', rotas === 0, `${rotas} rotas`);
    }
    if (ok && f === '/feed.xml') {
      const n = await (await fetch(`${BASE}/blog/index.json`)).json().then((j) => j.posts.length);
      check('  → un artículo por entrada del índice', (body.match(/<item>/g) || []).length === n, `${(body.match(/<item>/g) || []).length} de ${n}`);
    }
  }
  await p.close();
}

const ok = results.filter((r) => r.ok).length;
const fail = results.length - ok;
console.log(`\n${'═'.repeat(52)}`);
console.log(`${ok} correctos · ${fail} fallidos · ${results.length} comprobaciones`);
if (fail) { console.log('\nFallos:'); results.filter((r) => !r.ok).forEach((r) => console.log(`  · ${r.name}${r.detail ? ` → ${r.detail}` : ''}`)); }
await browser.close();
process.exit(fail ? 1 : 0);
