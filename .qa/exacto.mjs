import puppeteer from 'puppeteer';
const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto('http://localhost:4321/blog/', { waitUntil: 'networkidle0' });
const r = await p.evaluate(() => {
  const out = {};
  document.querySelectorAll('svg.art-art').forEach((svg) => {
    const vb = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    if (vb.length !== 4) return;
    let uni = null;
    for (const h of [...svg.children]) {
      if (h.tagName === 'defs') continue;
      let bb; try { bb = h.getBBox(); } catch { continue; }
      if (!bb || (!bb.width && !bb.height)) continue;
      uni = uni
        ? { x: Math.min(uni.x, bb.x), y: Math.min(uni.y, bb.y), r: Math.max(uni.r, bb.x + bb.width), b: Math.max(uni.b, bb.y + bb.height) }
        : { x: bb.x, y: bb.y, r: bb.x + bb.width, b: bb.y + bb.height };
    }
    if (!uni) return;
    const k = vb.join(' ');
    if (out[k]) return;
    out[k] = { vb, x: uni.x, y: uni.y, r: uni.r, b: uni.b, w: uni.r - uni.x, h: uni.b - uni.y };
  });
  return out;
});
for (const [k, v] of Object.entries(r)) {
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2;
  const lx = v.vb[0] + v.vb[2] / 2, ly = v.vb[1] + v.vb[3] / 2;
  console.log('  lienzo ' + k.padEnd(14) + ' contenido x ' + v.x.toFixed(1) + '..' + v.r.toFixed(1) +
    '  y ' + v.y.toFixed(1) + '..' + v.b.toFixed(1) +
    '  | centro ' + cx.toFixed(1) + ',' + cy.toFixed(1) + ' vs ' + lx + ',' + ly +
    '  | corregir viewBox a: ' + (lx - v.w / 2).toFixed(1) + ' ' + (ly - v.h / 2).toFixed(1) + ' ' + v.vb[2] + ' ' + v.vb[3]);
}
await b.close();
