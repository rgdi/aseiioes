/**
 * content.js — carga y valida el contenido JSON.
 *
 * Cada entrada de blog es UN archivo .json en content/posts/.
 * Al compilar se ordenan por fecha, se calculan slug, lectura y rutas,
 * y se validan los campos obligatorios (con errores claros en consola).
 */
import fs from 'node:fs';
import path from 'node:path';
import { slugify, parseDate, readingTime, strip, clean } from './util.js';

const ROOT = path.resolve(import.meta.dirname, '../..');
const POSTS_DIR = path.join(ROOT, 'content', 'posts');
const SITE_FILE = path.join(ROOT, 'content', 'site.json');

const BLOCK_TYPES = new Set([
  'lead', 'h2', 'h3', 'p', 'list', 'callout', 'quote', 'image', 'art',
  'stats', 'faq', 'steps', 'table', 'columns', 'divider', 'download', 'html', 'note',
]);

const REQUIRED = ['title', 'date', 'category', 'excerpt', 'blocks'];

/** Lee site.json (datos de la asociación, navegación, contacto…). */
export function loadSite() {
  const site = JSON.parse(fs.readFileSync(SITE_FILE, 'utf8'));
  if (!site.name) throw new Error('site.json: falta "name"');
  return site;
}

/** Lee todos los artículos, valida y normaliza. */
export function loadPosts({ strict = true } = {}) {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();

  const errors = [];
  const posts = files.map((file) => {
    const problems = [];

    // El JSON se lee con contexto: si está mal escrito, se dice qué pasa
    // en lugar de soltar una traza de JavaScript.
    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, file), 'utf8'));
    } catch (e) {
      return { file, broken: `${file}\n    - JSON inválido: ${e.message}`, blocks: [] };
    }

    for (const key of REQUIRED) {
      if (!raw[key]) problems.push(`falta "${key}"`);
    }
    if (!Array.isArray(raw.blocks) || !raw.blocks.length) problems.push('"blocks" debe ser un array no vacío');

    const blockTypes = new Set();
    (raw.blocks || []).forEach((b, i) => {
      if (!b || typeof b !== 'object') return problems.push(`bloque ${i}: no es un objeto`);
      blockTypes.add(b.type);
      if (!BLOCK_TYPES.has(b.type)) problems.push(`bloque ${i}: tipo "${b.type}" desconocido`);
    });

    if (raw.date && Number.isNaN(new Date(`${raw.date}T12:00:00Z`).getTime())) problems.push(`"date" inválida: ${raw.date} (usa el formato YYYY-MM-DD)`);

    const title = clean(raw.title);
    const slug = slugify(raw.slug || title);
    if (!slug) problems.push('no se pudo derivar el slug (revisa "title")');

    if (problems.length) {
      errors.push(`${file}\n    - ${problems.join('\n    - ')}`);
    }

    // Con strict=false (por ejemplo, para inspeccionar) se salta lo que no
    // se puede parsear; con strict=true ya se ha intentado y falló.
    let d = null;
    let updatedDate = null;
    try {
      if (raw.date) d = parseDate(raw.date);
      if (raw.updated) updatedDate = parseDate(raw.updated);
    } catch {
      // El motivo ya está anotado en `problems` más abajo.
    }
    const bodyText = (raw.blocks || []).map(blockText).join(' ');

    return {
      file,
      title,
      slug,
      url: `/blog/${slug}/`,
      date: d,
      dateShort: d ? d.short : '',
      dateLong: d ? d.long : '',
      dateISO: raw.date || '1970-01-01',
      updated: raw.updated || null,
      updatedDate,
      category: clean(raw.category || 'General'),
      tags: Array.isArray(raw.tags) ? raw.tags.map(clean).filter(Boolean) : [],
      author: clean(raw.author || 'Equipo ASEIIO'),
      excerpt: clean(raw.excerpt),
      cover: raw.cover || 'mix',
      accent: raw.accent || 'blue',
      featured: Boolean(raw.featured),
      art: raw.art || 'digestive',
      lang: raw.lang || 'es',
      metaTitle: raw.metaTitle || null,
      metaDescription: raw.metaDescription || raw.excerpt || '',
      blocks: raw.blocks || [],
      blockTypes,
      reading: readingTime(bodyText),
      text: strip(bodyText),
    };
  });

  const broken = posts.filter((p) => p.broken);
  const ok = posts.filter((p) => !p.broken);

  if (errors.length || broken.length) {
    const msg = `Contenido inválido:\n  ${[...broken.map((b) => b.broken), ...errors].join('\n  ')}`;
    if (strict) throw new Error(msg);
    console.warn(`⚠ ${msg}`);
  }

  return ok.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : a.slug.localeCompare(b.slug)));
}

/** Texto plano de un bloque (para lectura, búsqueda y excerpt automático). */
function blockText(b = {}) {
  const parts = [b.text, b.title, b.caption, b.alt, b.note];
  if (Array.isArray(b.items)) {
    for (const it of b.items) {
      if (typeof it === 'string') parts.push(it);
      else if (it) parts.push(it.title, it.text, it.label, it.note, it.q, it.a);
    }
  }
  if (Array.isArray(b.head)) parts.push(...b.head);
  if (Array.isArray(b.rows)) for (const r of b.rows) parts.push(...r);
  return parts.filter(Boolean).join(' ');
}

/** Índice ligero para el buscador del cliente. */
export function searchIndex(posts) {
  return posts.map((p) => ({
    t: p.title,
    u: p.url,
    c: p.category,
    d: p.dateISO,
    x: p.excerpt,
    g: p.tags,
  }));
}
