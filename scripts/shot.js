#!/usr/bin/env node
/**
 * shot.js — captura de pantalla para QA visual.
 *
 *   node scripts/shot.js <url|fichero> <salida.png> [ancho] [--mobile] [--full] [--alto=N]
 *
 * Opciones:
 *   --mobile   emula un móvil (390 px, deviceScaleFactor 2, isMobile)
 *   --full     captura la página entera
 *   --alto=N   alto de la ventana (por defecto 1000)
 */
import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const pos = argv.filter((a) => !a.startsWith('--'));
const height = Number((argv.find((a) => a.startsWith('--alto=')) || '--alto=1000').split('=')[1]);

const [target, out, width = '1440'] = pos;
if (!target || !out) {
  console.error('uso: node scripts/shot.js <url|fichero> <salida.png> [ancho] [--mobile] [--full] [--alto=N]');
  process.exit(1);
}

const mobile = flags.has('--mobile');
const full = flags.has('--full');
const url = /^https?:\/\//.test(target) ? target : pathToFileURL(path.resolve(target)).href;

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
const browser = await puppeteer.launch({
  ...ABRIR, args: [...ABRIR.args, '--font-render-hinting=none'],
});
const page = await browser.newPage();
await page.setViewport({
  width: mobile ? 390 : Number(width),
  height: mobile ? 844 : height,
  deviceScaleFactor: mobile ? 2 : 1,
  isMobile: mobile,
  hasTouch: mobile,
});
await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
// Recorre la página para disparar las animaciones de entrada antes de capturar.
await page.evaluate(async () => {
  const h = (document.body || document.documentElement).scrollHeight;
  for (let y = 0; y < h; y += window.innerHeight * 0.8) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 60));
  }
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 1800));
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log('✓', out);
