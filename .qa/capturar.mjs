/** Captura páginas enteras. Antes fuerza el revelado: al ampliar la ventana para
 *  la captura, el IntersectionObserver puede volver a ocultar lo que ya se
 *  había mostrado y salen huecos que no existen en la web real. */
import puppeteer from 'puppeteer';
const rutas = process.argv.slice(2);
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
for (const par of rutas) {
  const [ruta, nombre] = par.split('=');
  await p.goto('http://127.0.0.1:4321' + ruta, { waitUntil: 'networkidle0' });
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); }
    document.querySelectorAll('[data-reveal]').forEach((e) => e.classList.add('is-in'));
    window.scrollTo(0, 0);
  });
  await new Promise((r) => setTimeout(r, 900));
  const rotas = await p.evaluate(() => [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length);
  await p.screenshot({ path: '.qa/pag-' + nombre + '.png', fullPage: true });
  console.log('  ✓', nombre, rotas ? '⚠ ' + rotas + ' rotas' : '');
}
await b.close();
