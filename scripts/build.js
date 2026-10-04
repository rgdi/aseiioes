/**
 * build.js — genera el sitio estático completo en dist/.
 *
 *   node scripts/build.js
 *
 * Por defecto escribe en dist/, dentro del proyecto. Si el servidor web sirve
 * el sitio desde otra carpeta (por ejemplo, la carpeta que crea FastPanel), se
 * indica con DIST_DIR y se escribe directamente allí:
 *
 *   DIST_DIR=/data/sites/aseiio.org node scripts/build.js
 *
 * No necesita dependencias externas: sólo Node 18+.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadSite, loadPosts, searchIndex } from './lib/content.js';
import { hydrateArt, icon, miniMark } from './lib/layout.js';
import {
  homePage, blogPage, postPage, servicesPage,
  rightsPage, aboutPage, resourcesPage, legalPage, topicsPage, galleryPage, notFoundPage,
} from './lib/pages.js';

const ROOT = path.resolve(import.meta.dirname, '..');
// El sitio se genera donde diga DIST_DIR, o en dist/ si no se dice nada.
const OUT = process.env.DIST_DIR
  ? path.resolve(process.env.DIST_DIR)
  : path.join(ROOT, 'dist');

const t0 = Date.now();
const log = (...a) => console.log(...a);
const bytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

/* ── utilidades de escritura ─────────────────────────────────────────────── */
const written = [];
function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const html = rel.endsWith('.html') ? hydrateArt(content) : content;
  fs.writeFileSync(file, html);
  written.push({ rel, size: Buffer.byteLength(html) });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const xml = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/* ── preparación ─────────────────────────────────────────────────────────── */
log('▸ limpiando dist/');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let site;
let posts;
try {
  site = loadSite();
  posts = loadPosts({ strict: true });
} catch (e) {
  console.error(`\n✗ ${e.message}\n`);
  console.error('  Revisa content/site.json y content/posts/*.json.\n');
  process.exit(1);
}
log(`▸ contenido: ${posts.length} artículos`);

log('▸ copiando assets/');
copyDir(path.join(ROOT, 'assets'), path.join(OUT, 'assets'));

/* ── páginas ─────────────────────────────────────────────────────────────── */
log('▸ generando páginas');
write('index.html', homePage({ site, posts }));
write('blog/index.html', blogPage({ site, posts }));
write('servicios/index.html', servicesPage({ site, posts }));
write('derechos/index.html', rightsPage({ site, posts }));
write('asociacion/index.html', aboutPage({ site, posts }));
write('recursos/index.html', resourcesPage({ site }));
write('legal/index.html', legalPage({ site }));
write('temas/index.html', topicsPage({ site, posts }));

/* La galería va en su propio fichero: la edita quien gestiona las fotos y no
   tiene por qué abrir site.json. Si no existe, la página se genera vacía. */
const GALERIA = path.join(ROOT, 'content', 'galeria.json');
const galeria = fs.existsSync(GALERIA) ? JSON.parse(fs.readFileSync(GALERIA, 'utf8')) : {};
write('galeria/index.html', galleryPage({ site, galeria }));
write('404.html', notFoundPage({ site, posts }));

posts.forEach((p, i) => {
  const same = posts.filter((x) => x.slug !== p.slug);
  const sameCat = same.filter((x) => x.category === p.category);
  const related = (sameCat.length >= 3 ? sameCat : same).slice(0, 3);
  write(`blog/${p.slug}/index.html`, postPage({
    site,
    post: p,
    prev: posts[i + 1] || null,
    next: posts[i - 1] || null,
    related,
  }));
});

/* ── iconos ──────────────────────────────────────────────────────────────── */
const innerMark = () => miniMark().replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');

write('favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="ASEIIO">${innerMark()}</svg>`);

/* El PNG del isotipo es el favicon principal: los SVG no los pintan todos los
   navegadores ni las apps de móvil. El SVG queda como recurso vectorial. */
for (const size of [32, 48, 180]) {
  const from = path.join(ROOT, 'assets', 'brand', `favicon-${size}.png`);
  if (fs.existsSync(from)) {
    fs.copyFileSync(from, path.join(OUT, 'favicon-${size}.png'.replace('${size}', String(size))));
    written.push({ rel: `favicon-${size}.png`, size: fs.statSync(from).size });
  }
}

const wrap = (text, max) => {
  const out = [];
  let line = '';
  for (const w of String(text).split(/\s+/)) {
    if ((line + ' ' + w).trim().length > max && line) { out.push(line.trim()); line = w; }
    else line += ' ' + w;
  }
  if (line.trim()) out.push(line.trim());
  return out;
};

const ogLines = wrap(site.tagline || site.description || site.name, 56).slice(0, 3);

/** Isotipo oficial incrustado en el SVG: un <image href="/assets/..."> no
 *  funciona cuando el SVG se abre como fichero (es lo que hace og.js). */
const sealDataUri = () => {
  const f = path.join(ROOT, 'assets', 'brand', 'isotipo-alpha.png');
  if (!fs.existsSync(f)) return '';
  return `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
};

write('assets/og.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630" role="img" aria-label="${xml(site.shortName)}">
  <defs>
    <linearGradient id="og" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0E3A6D"/><stop offset="0.45" stop-color="#1B62B0"/><stop offset="1" stop-color="#0C817C"/>
    </linearGradient>
    <radialGradient id="og-gl" cx="0.85" cy="0.1" r="0.6">
      <stop offset="0" stop-color="#3FC9C0" stop-opacity="0.35"/><stop offset="1" stop-color="#3FC9C0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#og)"/>
  <rect width="1200" height="630" fill="url(#og-gl)"/>
  <image href="${sealDataUri()}" x="880" y="150" width="250" height="250"/>
  <text x="80" y="286" font-family="Georgia, 'Times New Roman', serif" font-size="86" font-weight="700" fill="#ffffff">${xml(site.shortName)}</text>
  <text x="80" y="352" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="36" letter-spacing="1" fill="#8FD9D4">${xml(site.region)}</text>
  ${ogLines.map((l, i) => `<text x="80" y="${438 + i * 44}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="28" fill="#D6E6F7">${xml(l)}</text>`).join('\n  ')}
  <text x="80" y="574" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="24" fill="#9FC4E8">${xml(site.legal || '')}</text>
</svg>`);

/* ── feeds e índices para buscadores ─────────────────────────────────────── */
const base = String(site.url || '').replace(/\/+$/, '');
const url = (p = '/') => `${base}${p}`;

/* Fecha del último cambio del contenido. Sin ella los buscadores asumen que
   las páginas fijas no cambian nunca y las indexan menos a menudo.

   Se lee de site.json → "updated". Antes se usaba la fecha de modificación del
   fichero, pero eso cambiaba en cada clonado o copia: el sitemap decía que
   todo se había modificado hoy aunque nadie hubiera tocado nada, y el build
   dejaba de ser reproducible. Si no está el campo, se usa la fecha del
   artículo más reciente, y si tampoco, la fecha del propio build. */
const contenidoFecha = (() => {
  const declarada = String(site.updated || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(declarada)) return declarada;
  const recientes = posts.map((p) => p.updatedDate || p.dateISO).sort();
  if (recientes.length) return recientes[recientes.length - 1];
  return new Date().toISOString().slice(0, 10);
})();
const STATIC_PAGES = [
  ['/', 'weekly', '1.0'],
  ['/servicios/', 'monthly', '0.8'],
  ['/derechos/', 'monthly', '0.8'],
  ['/asociacion/', 'monthly', '0.6'],
  ['/recursos/', 'monthly', '0.7'],
  ['/blog/', 'weekly', '0.9'],
  ['/temas/', 'weekly', '0.7'],
  ['/galeria/', 'monthly', '0.5'],
  ['/legal/', 'yearly', '0.3'],
];

write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC_PAGES.map(([p, freq, pri]) => `  <url>
    <loc>${xml(url(p))}</loc>
    <lastmod>${contenidoFecha}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`).join('\n')}
${posts.map((p) => `  <url>
    <loc>${xml(url(p.url))}</loc>
    <lastmod>${p.updatedDate ? p.updatedDate.iso : p.dateISO}</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>
`);

const rfc = (d) => new Date(`${d}T12:00:00Z`).toUTCString();

write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(site.name)}</title>
    <link>${xml(base)}</link>
    <description>${xml(site.description)}</description>
    <language>es-ES</language>
    <lastBuildDate>${rfc(posts[0]?.dateISO || '2026-01-01')}</lastBuildDate>
    <atom:link href="${xml(url('/feed.xml'))}" rel="self" type="application/rss+xml"/>
${posts.map((p) => `    <item>
      <title>${xml(p.title)}</title>
      <link>${xml(url(p.url))}</link>
      <guid isPermaLink="true">${xml(url(p.url))}</guid>
      <category>${xml(p.category)}</category>
      <pubDate>${rfc(p.dateISO)}</pubDate>
      <description>${xml(p.excerpt)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`);

write('robots.txt', `User-agent: *
Allow: /

Sitemap: ${url('/sitemap.xml')}
`);

write('blog/index.json', `${JSON.stringify({ site: site.shortName, updated: posts[0]?.dateISO || null, posts: searchIndex(posts) }, null, 0)}\n`);

/* ── informe ─────────────────────────────────────────────────────────────── */
const htmlCount = written.filter((w) => w.rel.endsWith('.html')).length;
const total = written.reduce((n, w) => n + w.size, 0);
const postCount = written.filter((w) => w.rel.startsWith('blog/') && w.rel.endsWith('index.html') && w.rel !== 'blog/index.html').length;

log(`\n✓ ${htmlCount} páginas (${postCount} artículos) · ${written.length} archivos generados · ${bytes(total)}`);
log(`  tiempo: ${((Date.now() - t0) / 1000).toFixed(2)} s`);
log(`  sitio:  dist/index.html   (abre esto o usa: npm run serve)\n`);
