import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
console.log('  ancho   menú        hueco libre hasta el borde');
for (const w of [1440, 1280, 1100, 1024, 980, 900, 860, 820, 768, 720, 640, 480]) {
  await p.setViewport({ width: w, height: 900 });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => {
    const dentro = document.querySelector('.header__in');
    if (!dentro) return null;
    const nav = document.querySelector('.nav');
    const burger = document.querySelector('.burger');
    return {
      hamburguesa: getComputedStyle(burger).display !== 'none',
      nav: Math.round(nav.getBoundingClientRect().width),
      borde: Math.round(dentro.getBoundingClientRect().right),
      navDerecha: Math.round(nav.getBoundingClientRect().right),
    };
  });
  if (!r) { console.log('  ' + w + '  (sin cabecera)'); continue; }
  console.log('  ' + String(w).padStart(5) + '   ' + (r.hamburguesa ? 'hamburguesa' : 'completo ').padEnd(11) + (r.borde - r.navDerecha) + ' px');
}
await b.close();
