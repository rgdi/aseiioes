/**
 * og.js — exporta la imagen social de 1200x630 a PNG.
 * Uso:  node scripts/og.js
 *
 * Necesita Puppeteer (dependencia de desarrollo). Es un paso opcional:
 * la web funciona igual con el SVG; el PNG es sólo para que las redes
 * sociales muestren la vista previa.
 */
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'node:fs';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = path.join(ROOT, 'dist', 'assets', 'og.svg');
const out = path.join(ROOT, 'assets', 'og.png');

if (!fs.existsSync(src)) {
  console.error('Genera primero el sitio:  npm run build');
  process.exit(1);
}

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
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(src).href, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 400));
fs.mkdirSync(path.dirname(out), { recursive: true });
await page.screenshot({ path: out });
await browser.close();
console.log('✓', path.relative(ROOT, out), `(${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
