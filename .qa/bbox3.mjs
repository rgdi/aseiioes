import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/blog/', { waitUntil: 'networkidle0' });
const r = await p.evaluate(() => {
  const svg = [...document.querySelectorAll('svg.art-art')].find((s) => (s.getAttribute('viewBox') || '').startsWith('0 0 900'));
  const raiz = svg.getBBox();
  // Unión real de lo que se pinta: hijos directos, saltando <defs>
  let uni = null;
  for (const hijo of [...svg.children]) {
    if (hijo.tagName === 'defs') continue;
    let bb; try { bb = hijo.getBBox(); } catch { continue; }
    if (!bb || (!bb.width && !bb.height)) continue;
    uni = uni ? { x: Math.min(uni.x, bb.x), y: Math.min(uni.y, bb.y),
      r: Math.max(uni.r, bb.x + bb.width), b: Math.max(uni.b, bb.y + bb.height) } : { x: bb.x, y: bb.y, r: bb.x + bb.width, b: bb.y + bb.height };
  }
  return { raiz: [raiz.x, raiz.y, raiz.width, raiz.height].map(Math.round),
    union: [Math.round(uni.x), Math.round(uni.y), Math.round(uni.r - uni.x), Math.round(uni.b - uni.y)] };
});
console.log('  getBBox() de la raíz :', r.raiz.join(', '), ' (lo que 首 medía antes)');
console.log('  unión de lo pintado  :', r.union.join(', '), ' (lo que se ve de verdad)');
console.log();
const [x, y, w, h] = r.union;
const vb = [0, 0, 900, 900];
const dx = Math.round(((x + w / 2) - (vb[0] + vb[2] / 2)) / vb[2] * 100);
const dy = Math.round(((y + h / 2) - (vb[1] + vb[3] / 2)) / vb[3] * 100);
console.log('  descentrado real: ' + dx + '% en horizontal, ' + dy + '% en vertical');
await b.close();
