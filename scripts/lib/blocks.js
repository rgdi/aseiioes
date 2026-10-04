/**
 * blocks.js — renderiza los bloques de un artículo.
 *
 * Tipos disponibles (ver README): lead, h2, h3, p, list, callout, quote,
 * image, gallery, art, stats, faq, steps, table, columns, divider, download, html, note.
 */
import { esc, escAttr, inline, paragraphs } from './util.js';
import { icon } from './art.js';
import { imgTag } from './imagen.js';

const TONES = {
  info: { ico: 'shield', cls: '' },
  tip: { ico: 'spark', cls: 'callout--tip' },
  warn: { ico: 'clock', cls: 'callout--warn' },
  legal: { ico: 'scales', cls: 'callout--legal' },
  urgent: { ico: 'heart', cls: 'callout--urgent' },
};

const ART = {
  digestive: 'digestiveArt',
  bag: 'bagArt',
  people: 'peopleArt',
};

const slugCount = new Map();

/** Anclas únicas para los encabezados. */
function anchor(text) {
  const base = String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'sec';
  const n = (slugCount.get(base) || 0) + 1;
  slugCount.set(base, n);
  return n === 1 ? base : `${base}-${n}`;
}

export function resetAnchors() {
  slugCount.clear();
}

/** Tabla de contenidos + HTML del artículo, en una sola pasada. */
export function renderBody(blocks = []) {
  resetAnchors();
  const toc = [];
  const html = blocks
    .map((b, i) => {
      if (b && (b.type === 'h2' || b.type === 'h3')) {
        const id = anchor(b.text);
        toc.push({ level: b.type === 'h2' ? 2 : 3, id, text: b.text });
        return b.type === 'h2'
          ? `<h2 id="${escAttr(id)}">${inline(b.text || '')}</h2>`
          : `<h3 id="${escAttr(id)}">${inline(b.text || '')}</h3>`;
      }
      return renderBlock(b, i);
    })
    .filter(Boolean)
    .join('\n');
  return { html, toc };
}

function renderBlock(b = {}, i = 0) {
  if (!b || typeof b !== 'object') return '';
  switch (b.type) {
    case 'lead':
      return `<p class="blk-lead">${inline(b.text || '')}</p>`;
    case 'p':
      return paragraphs(b.text || '');
    case 'list': {
      const style = b.style === 'check' ? 'check' : 'bul';
      const tag = b.style === 'number' ? 'ol' : 'ul';
      return `<${tag} class="${style}">${(b.items || []).map((it) => `<li>${inline(it)}</li>`).join('')}</${tag}>`;
    }
    case 'callout': {
      const t = TONES[b.tone] || TONES.info;
      return `<aside class="callout ${t.cls}">
        <span class="callout__ico">${icon(t.ico, { size: 22 })}</span>
        <div>${b.title ? `<p class="callout__t">${inline(b.title)}</p>` : ''}${paragraphs(b.text || '')}</div>
      </aside>`;
    }
    case 'quote':
      return `<figure class="quote-card">
        <p>${inline(b.text || '')}</p>
        <footer>${b.author ? `— ${esc(b.author)}` : ''}${b.role ? ` · ${esc(b.role)}` : ''}</footer>
      </figure>`;
    case 'image':
      return imgTag({
        src: b.src, alt: b.alt, caption: b.caption ? inline(b.caption) : '',
        width: b.width, height: b.height,
        sizes: '(min-width: 900px) 720px, 100vw',
      });

    /* Galería: rejilla de fotos con pie opcional. Cada foto puede abrirse a
       tamaño grande; el enlace va a la propia imagen, sin depender de
       JavaScript ni de ninguna galería de terceros. */
    case 'gallery': {
      const fotos = (b.items || []).filter((f) => f && f.src);
      if (!fotos.length) return '';
      const cols = b.columns === 2 ? 'gal--2' : b.columns === 4 ? 'gal--4' : 'gal--3';
      return `<figure class="gal ${cols}">
        <div class="gal__grid">
          ${fotos.map((f) => `<a class="gal__i" href="${escAttr(f.src)}" target="_blank" rel="noopener">
            ${imgTag({
              src: f.src, alt: f.alt || '', width: f.width, height: f.height,
              sizes: '(min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw',
            })}
            ${f.caption ? `<figcaption>${inline(f.caption)}</figcaption>` : ''}
          </a>`).join('')}
        </div>
        ${b.caption ? `<figcaption class="gal__cap">${inline(b.caption)}</figcaption>` : ''}
      </figure>`;
    }
    case 'art': {
      const fn = ART[b.which] || ART.digestive;
      return `<figure class="figure">%%ART:${fn}:a${i}%%${b.caption ? `<figcaption>${inline(b.caption)}</figcaption>` : ''}</figure>`;
    }
    case 'stats':
      return `<div class="stat-strip">${(b.items || []).map((s) => `
        <div class="stat-strip__i"><b>${esc(s.value)}</b><span>${esc(s.label)}</span>${s.note ? `<span>${esc(s.note)}</span>` : ''}</div>`).join('')}</div>`;
    case 'faq':
      return faqHtml(b.items || [], `f${i}`);
    case 'steps':
      return `<div class="steps-list">${(b.items || []).map((s) => `
        <div class="steps-list__i"><span class="steps-list__n"></span>
          <div>${s.title ? `<h3>${inline(s.title)}</h3>` : ''}${s.text ? `<p>${inline(s.text)}</p>` : ''}</div>
        </div>`).join('')}</div>`;
    case 'table':
      return `<div class="tbl-wrap"><table class="tbl">
        <thead><tr>${(b.head || []).map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>
        <tbody>${(b.rows || []).map((r) => `<tr>${r.map((c) => `<td>${inline(String(c))}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>`;
    case 'columns': {
      const n = (b.items || []).length;
      const mod = n === 2 ? 'cols--2' : n >= 3 ? 'cols--3' : '';
      return `<div class="cols ${mod}">${(b.items || []).map((c) => `
        <div class="col-card">
          ${c.icon ? `<span class="card__ico card__ico--blue">${icon(c.icon, { size: 22 })}</span>` : ''}
          ${c.title ? `<h3>${inline(c.title)}</h3>` : ''}
          ${c.text ? `<p>${inline(c.text)}</p>` : ''}
        </div>`).join('')}</div>`;
    }
    case 'download':
      return `<div class="dl-card">
        <span class="card__ico">${icon('download', { size: 22 })}</span>
        <div>
          <h3>${inline(b.title || 'Descargar')}</h3>
          <p>${inline(b.text || '')}</p>
        </div>
        ${b.file ? `<a class="btn btn--ghost btn--sm" href="${escAttr(b.file)}"${b.file.endsWith('.pdf') ? ' download' : ''} style="margin-left:auto">${icon('download', { size: 18 })} Descargar</a>` : ''}
      </div>`;
    case 'divider':
      return '<hr>';
    case 'note':
      return `<p class="small muted"><em>${inline(b.text || '')}</em></p>`;
    case 'html':
      return b.html || '';
    default:
      return '';
  }
}

/** Acordeón FAQ reutilizable. */
export function faqHtml(items = [], id = 'faq') {
  if (!items.length) return '';
  return `<div class="faq-list">${items.map((it, i) => `
    <div class="faq-item" data-faq>
      <button class="faq-q" type="button" aria-expanded="false" aria-controls="${id}-${i}">
        <span>${inline(it.q || '')}</span>
        <span class="faq-mark" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span>
      </button>
      <div class="faq-a" id="${id}-${i}"><div><p>${inline(it.a || '')}</p></div></div>
    </div>`).join('')}</div>`;
}
