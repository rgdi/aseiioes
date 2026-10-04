import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/blog/', { waitUntil: 'networkidle0' });
const r = await p.evaluate(() => {
  const svg = [...document.querySelectorAll('svg.art-art')].find((s) => (s.getAttribute('viewBox') || '').startsWith('0 0 900'));
  if (!svg) return null;
  const out = [];
  svg.querySelectorAll('*').forEach((el) => {
    let bb; try { bb = el.getBBox(); } catch { return; }
    if (!bb || (!bb.width && !bb.height)) return;
    if (bb.y > -50 || bb.y + bb.height > 950 || bb.x < -50 || bb.x + bb.width > 950) {
      out.push({ tag: el.tagName, cls: el.getAttribute('class') || '',
        b: [Math.round(bb.x), Math.round(bb.y), Math.round(bb.width), Math.round(bb.height)].join(','),
        dentro: bb.y >= -2 && bb.y + bb.height <= 902 && bb.x >= -2 && bb.x + bb.width <= 902 });
    }
  });
  return { total: svg.querySelectorAll('*').length, fuera: out.slice(0, 8), nFuera: out.length };
});
console.log('  elementos dentro del SVG:', r.total, '| los que sobresalen del lienzo:', r.nFuera);
r.fuera.forEach((x) => console.log('    ' + (x.dentro ? 'dentro ' : 'FUERA  ') + x.tag.padEnd(16) + (x.cls || '·').padEnd(18) + ' bbox(x,y,w,h) ' + x.b));
await b.close();
