/**
 * util.js — utilidades de texto, fechas y marcado en línea.
 */

const AMP = /&/g;
const LT = /</g;
const GT = />/g;
const QUOT = /"/g;

/** Escapa HTML. */
export const esc = (s = '') =>
  String(s).replace(AMP, '&amp;').replace(LT, '&lt;').replace(GT, '&gt;').replace(QUOT, '&quot;');

/** Escapa para atributo entre comillas dobles (incluye comillas simples). */
export const escAttr = (s = '') => esc(s).replace(/'/g, '&#39;');

/** Normaliza texto: colapsa espacios y quita saltos duros. */
export const clean = (s = '') => String(s ?? '').replace(/\s+/g, ' ').trim();


/**
 * Marcado en línea mínimo, pensado para que redactar sea cómodo:
 * **negrita**, *cursiva*, `código`, [texto](url) y saltos de línea.
 */
export function inline(src = '') {
  let s = esc(src);
  // código primero (protege su contenido del resto)
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => `\u0001CODE${codes.push(c) - 1}\u0001`);
  // enlaces
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_, txt, url, title) => `<a href="${url}"${title ? ` title="${title}"` : ''}>${txt}</a>`);
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    (_, pre, url) => `${pre}<a href="${url}" rel="noopener">${url}</a>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/\u0001CODE(\d+)\u0001/g, (_, i) => `<code>${codes[Number(i)]}</code>`);
  return s;
}

/** Divide en párrafos (líneas en blanco) y devuelve HTML con saltos simples como <br>. */
export function paragraphs(src = '', cls = '') {
  return String(src)
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => `<p${cls ? ` class="${cls}"` : ''}>${inline(chunk).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Texto plano sin etiquetas (para excerpts, meta description, búsqueda). */
export function strip(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** '2025-03-08' → { iso, date, short, long, year } */
export function parseDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`Fecha inválida: ${iso}`);
  return {
    iso,
    isoFull: `${iso}T12:00:00+01:00`,
    date: d,
    get short() { return `${d.getUTCDate()} ${MESES[d.getUTCMonth()].slice(0, 3)} ${d.getUTCFullYear()}`; },
    get long() { return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; },
    get time() { return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; },
    year: d.getUTCFullYear(),
  };
}

/** Minutos de lectura a ~200 palabras/minuto. */
export function readingTime(text = '') {
  const words = strip(text).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const attr = (o = {}) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${escAttr(v)}"`))
    .join('');

export const classNames = (...xs) => xs.filter(Boolean).join(' ');

/** Iniciales para avatares. */
const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y', 'e']);

export function initials(name = '') {
  const parts = clean(name).split(/\s+/).filter((w) => w && !STOP.has(w.toLowerCase()));
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
