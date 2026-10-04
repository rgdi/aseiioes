import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/blog/', { waitUntil: 'networkidle0' });
const r = await p.evaluate(() => {
  const svg = [...document.querySelectorAll('svg.art-art')].find((s) => (s.getAttribute('viewBox') || '').startsWith('0 0 900'));
  const filas = [];
  svg.querySelectorAll('*').forEach((el) => {
    let bb; try { bb = el.getBBox(); } catch { return; }
    if (!bb) return;
    const bajo = bb.y + bb.height;
    filas.push({ tag: el.tagName, cls: el.getAttribute('class') || '', padre: el.parentElement?.tagName || '',
      y: Math.round(bb.y), h: Math.round(bb.height), bajo: Math.round(bajo) });
  });
  return filas.sort((a, b) => b.bajo - a.bajo).slice(0, 6);
});
console.log('  elementos cuyo borde inferior llega más abajo:');
r.forEach((x) => console.log('    ' + x.tag.padEnd(15) + (x.cls || '·').padEnd(14) + ' padre=' + x.padre.padEnd(10) + ' y=' + x.y + ' alto=' + x.h + ' → llega a ' + x.bajo));
await b.close();
