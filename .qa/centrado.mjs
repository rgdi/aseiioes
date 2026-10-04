/**
 * centrado.mjs — mide el descentrado real de cada ilustración.
 * getBBox() sobre la raíz incluye los <defs> y da cifras que no cuadran;
 * hay que unir a mano sólo lo que se pinta.
 */
import puppeteer from 'puppeteer';

const b = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const vistos = new Set();

for (const u of ['/', '/blog/', '/asociacion/', '/derechos/', '/temas/']) {
  await p.goto('http://localhost:4321' + u, { waitUntil: 'networkidle0' });
  const r = await p.evaluate(() => {
    const out = [];
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
      out.push({ vb: vb.join(' '), w: Math.round(uni.r - uni.x), h: Math.round(uni.b - uni.y),
        dx: +(((uni.x + (uni.r - uni.x) / 2) - (vb[0] + vb[2] / 2)) / vb[2] * 100).toFixed(1),
        dy: +(((uni.y + (uni.b - uni.y) / 2) - (vb[1] + vb[3] / 2)) / vb[3] * 100).toFixed(1) });
    });
    return out;
  });

  for (const x of r) {
    const k = x.vb;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const malo = Math.abs(x.dx) > 3 || Math.abs(x.dy) > 3;
    console.log('  ' + (malo ? 'DESCENTRADO' : 'ok         ') +
      ' lienzo ' + k.padEnd(14) + ' dibujo ' + String(x.w + 'x' + x.h).padEnd(10) +
      ' → ' + String((x.dx > 0 ? '+' : '') + x.dx + '%').padStart(6) + ' H / ' +
      String((x.dy > 0 ? '+' : '') + x.dy + '%').padStart(6) + ' V');
  }
}
await b.close();
