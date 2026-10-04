/**
 * slice.js — recorta una página en tramos legibles para revisión visual.
 *   node .qa/slice.js <url> <prefijo> [ancho] [altoTramo]
 */
import puppeteer from 'puppeteer';
import path from 'node:path';
import fs from 'node:fs';

const [url, prefix, w = '1440', chunk = '2600'] = process.argv.slice(2);
const mobile = prefix.endsWith('-m');
const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
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
