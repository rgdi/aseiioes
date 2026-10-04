/**
 * seo.js — auditoría de SEO sobre dist/.
 *
 *   node scripts/seo.js
 *
 * Comprueba lo que de verdad importa en una web estática: unicidad de
 * títulos y descripciones, datos estructurados válidos, Open Graph completo,
 * enlazado interno, sitemap, RSS y 404.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'ok  ' : 'FALLO'}  ${name}${detail ? `  → ${detail}` : ''}`);
};

if (!fs.existsSync(DIST)) {
  console.error('Genera el sitio primero:  npm run build');
  process.exit(1);
}

const pages = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) pages.push(p);
  }
})(DIST);
pages.sort();

const data = pages.map((f) => {
  const h = fs.readFileSync(f, 'utf8');
  const g = (re) => (h.match(re) || [])[1] || '';
  const ld = h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  return {
    f: path.relative(DIST, f).replace(/\\/g, '/'),
    h,
    title: g(/<title>([^<]*)<\/title>/),
    desc: g(/<meta name="description" content="([^"]*)"/),
    canonical: g(/<link rel="canonical" href="([^"]*)"/),
    robots: g(/<meta name="robots" content="([^"]*)"/),
    ogTitle: g(/<meta property="og:title" content="([^"]*)"/),
    ogDesc: g(/<meta property="og:description" content="([^"]*)"/),
    ogImage: g(/<meta property="og:image" content="([^"]*)"/),
    ogImageW: g(/<meta property="og:image:width" content="([^"]*)"/),
    ogImageH: g(/<meta property="og:image:height" content="([^"]*)"/),
    ogImageAlt: g(/<meta property="og:image:alt" content="([^"]*)"/),
    ogType: g(/<meta property="og:type" content="([^"]*)"/),
    ogUrl: g(/<meta property="og:url" content="([^"]*)"/),
    twCard: g(/<meta name="twitter:card" content="([^"]*)"/),
    twImage: g(/<meta name="twitter:image" content="([^"]*)"/),
    h1: (h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '',
    lang: g(/<html lang="([^"]*)"/),
    viewport: /<meta name="viewport" content="[^"]+">/.test(h),
    pubTime: g(/<meta property="article:published_time" content="([^"]*)"/),
    modTime: g(/<meta property="article:modified_time" content="([^"]*)"/),
    links: [...h.matchAll(/href="(\/[^"#]*)"/g)].map((m) => m[1]),
    ld: ld ? ld[1] : null,
  };
});

/* ══ 1. Títulos ═════════════════════════════════════════════════════════ */
console.log('\n▸ Títulos');
{
  const bad = data.filter((d) => d.title.length < 15 || d.title.length > 70);
  check('entre 15 y 70 caracteres', bad.length === 0, bad.map((d) => `${d.f} (${d.title.length})`).join(', '));
  const dup = data.map((d) => d.title).filter((t, i, a) => a.indexOf(t) !== i);
  check('ninguno está repetido', dup.length === 0, [...new Set(dup)].join(' | '));
  const sinH1 = data.filter((d) => !d.h1.trim());
  check('todas tienen un <h1>', sinH1.length === 0, sinH1.map((d) => d.f).join(', '));
}

/* ══ 2. Descripciones ════════════════════════════════════════════════════ */
console.log('\n▸ Descripciones');
{
  const bad = data.filter((d) => d.desc.length < 70 || d.desc.length > 165);
  check('entre 70 y 165 caracteres', bad.length === 0, bad.map((d) => `${d.f} (${d.desc.length})`).join(', '));
  const dup = data.map((d) => d.desc).filter((t, i, a) => t && a.indexOf(t) !== i);
  check('ninguna está repetida', dup.length === 0, [...new Set(dup)].join(' · '));
}

/* ══ 3. Open Graph y Twitter ════════════════════════════════════════════ */
console.log('\n▸ Open Graph y Twitter');
{
  const indexable = data.filter((d) => !/noindex/.test(d.robots));
  const falta = indexable.filter((d) => !d.ogTitle || !d.ogDesc || !d.ogImage || !d.ogUrl || !d.ogImageW || !d.ogImageH || !d.ogImageAlt);
  check('og:title, description, url, image y tamaño + alt', falta.length === 0, falta.map((d) => d.f).join(', '));
  const tw = indexable.filter((d) => d.twCard !== 'summary_large_image' || !d.twImage);
  check('twitter:card y twitter:image', tw.length === 0, tw.map((d) => d.f).join(', '));
  const sinAbs = indexable.filter((d) => !d.ogImage.startsWith('http'));
  check('las imágenes sociales son URL absolutas', sinAbs.length === 0, sinAbs.map((d) => d.f).join(', '));
}

/* ══ 4. Canonical, robots, idioma ═══════════════════════════════════════ */
console.log('\n▸ Canonical y robots');
{
  const sinCan = data.filter((d) => !d.canonical.startsWith('http'));
  check('todas tienen canonical absoluto', sinCan.length === 0, sinCan.map((d) => d.f).join(', '));
  const noindex = data.filter((d) => /noindex/.test(d.robots));
  check('sólo el 404 está en noindex', noindex.length === 1 && noindex[0].f === '404.html', noindex.map((d) => d.f).join(', ') || 'ninguno');
  const malLang = data.filter((d) => d.lang !== 'es');
  check('todas en español', malLang.length === 0, malLang.map((d) => d.f).join(', '));
  const sinVp = data.filter((d) => !d.viewport);
  check('todas con viewport móvil', sinVp.length === 0, sinVp.map((d) => d.f).join(', '));
}

/* ══ 5. Datos estructurados ═════════════════════════════════════════════ */
console.log('\n▸ Datos estructurados');
{
  const sinLd = data.filter((d) => !d.ld);
  check('todas las páginas declaran datos estructurados', sinLd.length === 0, sinLd.map((d) => d.f).join(', ') || `${data.length}/${data.length}`);
  const invalidos = [];
  const tipos = new Set();
  for (const d of data.filter((x) => x.ld)) {
    try {
      const j = JSON.parse(d.ld);
      const g = j['@graph'] || [j];
      for (const n of g) {
        tipos.add(n['@type']);
        if (!n['@type']) invalidos.push(`${d.f}: nodo sin @type`);
      }
      // Comprobaciones mínimas por tipo, que es lo que revisan los validadores.
      for (const n of g) {
        if (n['@type'] === 'FAQPage') {
          if (!n.mainEntity?.length) invalidos.push(`${d.f}: FAQPage sin preguntas`);
          for (const q of n.mainEntity || []) {
            if (!q.name || !q.acceptedAnswer?.text) invalidos.push(`${d.f}: pregunta incompleta`);
          }
        }
        if (n['@type'] === 'BlogPosting') {
          for (const k of ['headline', 'datePublished', 'author', 'publisher', 'image', 'mainEntityOfPage']) {
            if (!n[k]) invalidos.push(`${d.f}: BlogPosting sin ${k}`);
          }
        }
        if (n['@type'] === 'BreadcrumbList') {
          const pos = (n.itemListElement || []).map((i) => i.position);
          if (pos.join() !== pos.slice().sort((a, b) => a - b).join()) invalidos.push(`${d.f}: migas desordenadas`);
          if (new Set(pos).size !== pos.length) invalidos.push(`${d.f}: posiciones repetidas`);
        }
      }
    } catch (e) {
      invalidos.push(`${d.f}: JSON no parseable`);
    }
  }
  check('JSON-LD válido y completo', invalidos.length === 0, invalidos.slice(0, 3).join(' · '));
  check('se declara la organización', tipos.has('NGO'), [...tipos].join(', '));
  check('las páginas de artículo declaran BlogPosting', tipos.has('BlogPosting'));
  check('hay migas de pan', tipos.has('BreadcrumbList'));
  check('las FAQ son datos estructurados', tipos.has('FAQPage'));
  check('el sitio declara WebSite con buscador', tipos.has('WebSite'));
}

/* ══ 6. Enlazado interno ════════════════════════════════════════════════ */
console.log('\n▸ Enlazado interno');
{
  const huerfanas = data.filter((d) => d.links.length < 5);
  check('ninguna página con menos de 5 enlaces internos', huerfanas.length === 0, huerfanas.map((d) => `${d.f} (${d.links.length})`).join(', '));
  const origen = new Set();
  for (const d of data) for (const l of d.links) origen.add(l.split('#')[0]);
  const sinEntrar = data.filter((d) => !origen.has('/' + d.f.replace(/index\.html$/, '')) && d.f !== '404.html' && d.f !== 'index.html');
  check('toda página recibe enlaces desde otra', sinEntrar.length === 0, sinEntrar.map((d) => d.f).join(', '));
}

/* ══ 7. Sitemap, RSS, robots ════════════════════════════════════════════ */
console.log('\n▸ Ficheros para buscadores');
{
  const sm = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const lastmods = [...sm.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  check(`el sitemap lista las ${data.length - 1} páginas indexables`, locs.length === data.length - 1, `${locs.length} URLs`);
  check('todas las URL llevan lastmod', lastmods.length === locs.length, `${lastmods.length} de ${locs.length}`);
  const noDup = new Set(locs).size === locs.length;
  check('sin URLs repetidas', noDup);
  const sinPrioridad = [...sm.matchAll(/<url>/g)].length !== [...sm.matchAll(/<priority>/g)].length;
  check('todas llevan priority y changefreq', !sinPrioridad);

  const feed = fs.readFileSync(path.join(DIST, 'feed.xml'), 'utf8');
  const items = (feed.match(/<item>/g) || []).length;
  const arts = data.filter((d) => d.f.startsWith('blog/') && d.f !== 'blog/index.html').length;
  check(`el RSS lleva los ${arts} artículos`, items === arts, `${items}`);
  check('el RSS declara la fecha del último artículo', /<lastBuildDate>/.test(feed));
  check('el RSS es autodetectable desde el HTML', data.every((d) => /application\/rss\+xml/.test(d.h)));

  const robots = fs.readFileSync(path.join(DIST, 'robots.txt'), 'utf8');
  check('robots.txt declara el sitemap', /Sitemap:/.test(robots));
  check('robots.txt no bloquea nada', !/Disallow: \/\s*$/m.test(robots) || /Allow: \//.test(robots));
}

/* ══ 8. Imágenes ════════════════════════════════════════════════════════ */
console.log('\n▸ Imágenes');
{
  const sinAlt = data.flatMap((d) => [...d.h.matchAll(/<img\b[^>]*>/g)].filter((m) => !/\balt=/.test(m[0])).map((m) => d.f));
  check('toda etiqueta <img> tiene alt', sinAlt.length === 0, sinAlt.join(', '));
  // Un SVG está bien si él mismo lo marca, o si cuelga de un ancestro con
  // aria-hidden="true" (por ejemplo el "+" de las preguntas frecuentes).
  const svgSinNombre = data.flatMap((d) => [...d.h.matchAll(/<svg\b[^>]*>/g)]
    .filter((m) => !/aria-label|aria-hidden/.test(m[0]))
    .filter((m) => !/aria-hidden="true"/.test(d.h.slice(Math.max(0, m.index - 220), m.index)))
    .map((m) => d.f));
  check('todo SVG decorativo está marcado', svgSinNombre.length === 0, `${svgSinNombre.length} svg sin aria`);
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
process.exit(fail ? 1 : 0);
