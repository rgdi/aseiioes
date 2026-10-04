/**
 * imagen.js — lee el tamaño de una imagen del propio fichero.
 *
 *   anchoYAlto('/assets/fotos/ensayo.jpg')  →  { width: 1600, height: 1067 }
 *
 * Sirve para que quien publica una foto no tenga que escribir el ancho a mano:
 * sin width/height el navegador reserva un hueco y la página salta al cargar
 * la imagen. Formatos: PNG, JPEG, GIF, WebP y AVIF.
 */
import fs from 'node:fs';
import path from 'node:path';
import { escAttr } from './util.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const cache = new Map();

export function anchoYAlto(src) {
  if (!src || !src.startsWith('/')) return null;
  if (cache.has(src)) return cache.get(src);

  const file = path.join(ROOT, src.replace(/^\//, ''));
  let dim = null;

  try {
    const b = fs.readFileSync(file);

    // PNG: los bytes 16..24 son ancho y alto en big-endian.
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
      dim = { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
    }
    // GIF
    else if (b.length > 10 && b.slice(0, 3).toString() === 'GIF') {
      dim = { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
    }
    // JPEG: hay que recorrer los marcadores hasta el SOF.
    else if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i < b.length - 9) {
        if (b[i] !== 0xff) { i += 1; continue; }
        const m = b[i + 1];
        // SOF0..SOF15 salvo los marcadores que no llevan tamaño (DHT, JPG…)
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
          dim = { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
          break;
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
    // WebP
    else if (b.length > 30 && b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP') {
      const vp8 = b.slice(12, 16).toString();
      if (vp8 === 'VP8X') dim = { width: (b.readUIntLE(24, 3) & 0xffffff) + 1, height: (b.readUIntLE(27, 3) & 0xffffff) + 1 };
      else if (vp8 === 'VP8 ') dim = { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
      else if (vp8 === 'VP8L') {
        const n = b.readUInt32LE(21);
        dim = { width: (n & 0x3fff) + 1, height: ((n >> 14) & 0x3fff) + 1 };
      }
    }
  } catch {
    dim = null;
  }

  cache.set(src, dim);
  return dim;
}

/**
 * Etiquetas <img> completas con lo que haga falta:
 * dimensiones reales, carga diferida y un srcset si el autor ha preparado
 * Versions más pequeñas (foto-800.jpg, foto-1600.jpg…).
 */
export function imgTag({ src, alt = '', caption, className = '', sizes, eager = false, width, height }) {
  if (!src) return '';
  const d = anchoYAlto(src);
  const w = width || (d ? d.width : null);
  const h = height || (d ? d.height : null);

  // srcset automático: si existen foto-800.jpg y foto-1600.jpg junto a la original
  let srcset = '';
  const ext = path.extname(src);
  const base = src.slice(0, -ext.length);
  const candidatos = [400, 800, 1200, 1600].filter((c) => c < (w || 0));
  if (candidatos.length) {
    const hechas = candidatos.filter((c) => fs.existsSync(path.join(ROOT, `${base}-${c}${ext}`)));
    if (hechas.length) {
      srcset = ` srcset="${hechas.map((c) => `${base}-${c}${ext} ${c}w`).join(', ')}, ${src} ${w}w"`
        + ` sizes="${escAttr(sizes || '(min-width: 900px) 800px, 100vw')}"`;
    }
  }

  return `<figure${className ? ` class="${escAttr(className)}"` : ''}>
    <img src="${escAttr(src)}"${srcset} alt="${escAttr(alt)}"
         ${w ? `width="${w}"` : ''} ${h ? `height="${h}"` : ''}
         ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
    ${caption ? `<figcaption>${caption}</figcaption>` : ''}
  </figure>`;
}
