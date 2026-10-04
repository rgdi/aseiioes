/**
 * qa.js — comprobaciones automáticas sobre dist/.
 *
 *   node scripts/qa.js
 *
 * No necesita servidor: trabaja sobre los archivos generados.
 * Sale con código 1 si encuentra cualquier problema.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
// Se mira la misma carpeta que genera el build: si se despliega con DIST_DIR,
// las comprobaciones tienen que ir al sitio que de verdad se sirve.
const DIST = process.env.DIST_DIR ? path.resolve(process.env.DIST_DIR) : path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error(`No existe ${DIST}. Genera el sitio primero:  npm run build`);
  process.exit(1);
}

const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
})(DIST);

const exists = (u) => {
  let p = u.split('#')[0].split('?')[0];
  if (!p) p = '/';
  if (p.endsWith('/')) p += 'index.html';
  return fs.existsSync(path.join(DIST, p));
};

let broken = 0;
let links = 0;
let issues = 0;
const problems = [];

const check = (file, cond, msg) => {
  if (!cond) { issues += 1; problems.push(`  ✗ ${path.relative(DIST, file)} → ${msg}`); }
};

for (const f of htmlFiles) {
  const h = fs.readFileSync(f, 'utf8');

  for (const m of h.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (!u.startsWith('/')) continue;
    links += 1;
    if (!exists(u)) { broken += 1; problems.push(`  ✗ ${path.relative(DIST, f)} → enlace roto: ${u}`); }
  }

  check(f, /<html lang="es"/.test(h), 'sin lang="es"');
  check(f, /<h1[\s>]/.test(h), 'sin <h1>');
  check(f, /<title>[^<]{5,}<\/title>/.test(h), 'title vacío o demasiado corto');
  check(f, /name="description" content="[^"]{30,}"/.test(h), 'meta description ausente o corta');
  check(f, /rel="canonical"/.test(h), 'sin canonical');
  check(f, /property="og:image"/.test(h), 'sin og:image');
  check(f, /<main id="main">/.test(h), 'sin <main id="main">');
  check(f, /<nav[^>]*aria-label=/.test(h), 'sin navegación etiquetada');
  check(f, !/\[object Object\]|undefined|NaN/.test(h), 'valor corrupto en el HTML');
  check(f, !/%%ART:/.test(h), 'ilustración sin hidratar (%%ART:)');
  check(f, !/[\u00A0\u200B-\u200D\u2060\uFEFF]/.test(h), 'carácter invisible');
  check(f, !/(TODO|FIXME|PENDIENTE)/.test(h), 'marca de trabajo sin resolver');

  for (const m of h.matchAll(/<img\b[^>]*>/g)) check(f, /\balt=/.test(m[0]), 'imagen sin alt');
  for (const m of h.matchAll(/<button\b[^>]*>/g)) check(f, /type="/.test(m[0]), 'button sin type');
  for (const m of h.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) check(f, /rel="[^"]*noopener/.test(m[0]), 'enlace externo sin rel=noopener');

  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { JSON.parse(m[1]); } catch { check(f, false, 'JSON-LD inválido'); }
  }
}

/* ── archivos de salida obligatorios ─────────────────────────────────────── */
const required = [
  'index.html', '404.html', 'blog/index.html', 'feed.xml', 'sitemap.xml',
  'robots.txt', 'blog/index.json', 'favicon.svg', 'assets/styles.css',
  'assets/app.js', 'assets/og.png', 'assets/brand/isotipo.png',
  'favicon-32.png', 'favicon-48.png', 'favicon-180.png',
];
for (const r of required) {
  if (!fs.existsSync(path.join(DIST, r))) { issues += 1; problems.push(`  ✗ falta dist/${r}`); }
}

/* ── coherencia del sitemap con lo generado ──────────────────────────────── */
const sitemap = fs.readFileSync(path.join(DIST, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!locs.length) { issues += 1; problems.push('  ✗ sitemap.xml sin <loc>'); }
for (const loc of locs) {
  const rel = loc.replace(/^https?:\/\/[^/]+/, '') || '/';
  if (!exists(rel)) { issues += 1; problems.push(`  ✗ sitemap apunta a una ruta inexistente: ${rel}`); }
}

/* ── informe ─────────────────────────────────────────────────────────────── */
console.log(`\n${htmlFiles.length} páginas · ${links} enlaces internos · ${locs.length} URLs en sitemap`);
if (problems.length) {
  console.log(`\n${broken} enlaces rotos · ${issues} avisos:\n`);
  problems.forEach((p) => console.log(p));
  console.log('');
  process.exit(1);
}
console.log('✓ sin enlaces rotos y todas las páginas pasan las comprobaciones de calidad\n');
