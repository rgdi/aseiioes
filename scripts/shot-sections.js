/**
 * slice.js — recorta una página en tramos legibles para revisión visual.
 *   node scripts/shot-sections.js <url> <prefijo> [ancho] [altoTramo]
 */
import puppeteer from 'puppeteer';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import fs from 'node:fs';

const [url, prefix, w = '1440', chunk = '2600'] = process.argv.slice(2);
const mobile = prefix.endsWith('-m');
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
await page.setViewport({
  width: mobile ? 390 : Number(w),
  height: mobile ? 844 : 1000,
  deviceScaleFactor: 1,
  isMobile: mobile,
  hasTouch: mobile,
});
await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 });
await page.evaluate(() => document.fonts && document.fonts.ready);
await page.evaluate(async () => {
  const h = (document.body || document.documentElement).scrollHeight;
  for (let y = 0; y < h; y += window.innerHeight * 0.8) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 55));
  }
  window.scrollTo(0, 0);
});
await new Promise((r) => setTimeout(r, 1700));
const H = chunk === 'auto' ? null : Number(chunk);
const total = await page.evaluate(() => document.documentElement.scrollHeight);
const step = H || total;
fs.mkdirSync(path.dirname(path.resolve(`${prefix}-00.png`)), { recursive: true });
let i = 0;
for (let y = 0; y < total; y += step, i += 1) {
  const h = Math.min(step, total - y);
  await page.screenshot({
    path: `${prefix}-${String(i).padStart(2, '0')}.png`,
    clip: { x: 0, y, width: mobile ? 390 : Number(w), height: h },
    captureBeyondViewport: true,
  });
}
await browser.close();
console.log(`${prefix}: ${i} tramos · alto total ${total}px`);
