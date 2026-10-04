/**
 * art.js — Generador de ilustración vectorial procedural para ASEIIO.
 *
 * Nada de stock ni raster: el intestino, la ostomía y las figuras se calculan
 * matemáticamente (curvas catmull-rom + radio variable) para que salgan
 *haustras orgánicas y con volumen, igual que el logotipo de la asociación.
 *
 * Salida: strings SVG listos para inyectar en el HTML.
 */

/* ───────────────────────── utilidades geométricas ───────────────────────── */

const r2 = (n) => Math.round(n * 100) / 100;
const f = (n) => {
  const v = r2(n);
  return Number.isInteger(v) ? `${v}` : `${v}`;
};
const P = (p) => `${f(p[0])} ${f(p[1])}`;

/** Catmull-Rom → polilínea densa (tensión 0.5). */
function catmullRom(pts, per = 14) {
  if (pts.length < 2) return pts.slice();
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    for (let j = 0; j < per; j++) {
      const t = j / per;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Re-muestreo por longitud de arco: n puntos equidistantes. */
function resample(poly, n) {
  const acc = [0];
  for (let i = 1; i < poly.length; i++) {
    const dx = poly[i][0] - poly[i - 1][0];
    const dy = poly[i][1] - poly[i - 1][1];
    acc.push(acc[i - 1] + Math.hypot(dx, dy));
  }
  const total = acc[acc.length - 1];
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const target = (i / (n - 1)) * total;
    while (k < acc.length - 2 && acc[k + 1] < target) k++;
    const seg = acc[k + 1] - acc[k] || 1;
    const t = (target - acc[k]) / seg;
    out.push([
      poly[k][0] + (poly[k + 1][0] - poly[k][0]) * t,
      poly[k][1] + (poly[k + 1][1] - poly[k][1]) * t,
    ]);
  }
  return out;
}

/**
 * Convierte una línea central en un tubo cerrado con radio variable.
 * Devuelve { d, hi } donde `hi` es el brillo interior.
 */
function tube(centerline, opts = {}) {
  const {
    radius = 40,
    amp = 0.18,       // amplitud de las haustras (0-0.3)
    pouches = 18,     // número de pliegues a lo largo del tubo
    samples = 520,
    phase = 0,
    taper = 0,        // estrechamiento en los extremos (0-1)
    wobble = 0.06,    // ondulación lenta de calibre
    hiWidth = 0.42,   // grosor del brillo
    profile = 'wave', // 'wave' (senoidal) | 'pouch' (haustra real)
  } = opts;

  const dense = resample(catmullRom(centerline, 20), samples);
  const n = dense.length;
  const left = [];
  const right = [];
  const hi = [];
  const radii = [];

  for (let i = 0; i < n; i++) {
    const a = dense[Math.max(0, i - 1)];
    const b = dense[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len;
    const ny = tx / len;
    const u = i / (n - 1);

    const mod =
      profile === 'pouch'
        ? pouchWave(u, pouches, phase)
        : Math.sin(u * Math.PI * 2 * pouches + phase);
    let r = radius * (1 + amp * mod);
    r *= 1 + wobble * Math.sin(u * Math.PI * 2 * 1.7 + phase * 1.3);
    if (taper > 0) {
      const edge = Math.min(u, 1 - u) / 0.18;
      r *= 1 - taper * (1 - Math.min(1, edge));
    }
    radii.push(r);

    const c = dense[i];
    left.push([c[0] + nx * r, c[1] + ny * r]);
    right.push([c[0] - nx * r, c[1] - ny * r]);
    hi.push([c[0] + nx * r * (1 - hiWidth) - tx / len * 0, c[1] + ny * r * (1 - hiWidth)]);
  }

  const cap = (center, nrm, r, steps = 16) => {
    const pts = [];
    for (let s = 1; s < steps; s++) {
      const phi = (s / steps) * Math.PI;
      pts.push([
        center[0] + Math.cos(phi) * nrm[0] * r - Math.sin(phi) * (nrm[1] * -1) * 0 + Math.sin(phi) * 0,
        center[1] + Math.sin(phi) * nrm[1] * r,
      ]);
    }
    return pts;
  };

  // tapa final: de +n a -n pasando por delante (+tangente)
  const nEnd = normAt(dense, n - 1);
  const tEnd = tangAt(dense, n - 1);
  const endCap = [];
  for (let s = 1; s < 20; s++) {
    const phi = (s / 20) * Math.PI;
    endCap.push([
      dense[n - 1][0] + Math.cos(phi) * nEnd[0] * radii[n - 1] + Math.sin(phi) * tEnd[0] * radii[n - 1],
      dense[n - 1][1] + Math.cos(phi) * nEnd[1] * radii[n - 1] + Math.sin(phi) * tEnd[1] * radii[n - 1],
    ]);
  }
  const startCap = [];
  for (let s = 1; s < 20; s++) {
    const phi = (s / 20) * Math.PI;
    const j = Math.max(0, n - 1 - s);
    const nS = normAt(dense, j);
    const tS = tangAt(dense, j);
    startCap.push([
      dense[0][0] - Math.cos(phi) * nS[0] * radii[0] - Math.sin(phi) * tS[0] * radii[0],
      dense[0][1] - Math.cos(phi) * nS[1] * radii[0] - Math.sin(phi) * tS[1] * radii[0],
    ]);
  }
  void cap;

  const d = [
    `M${P(left[0])}`,
    ...left.slice(1).map((p) => `L${P(p)}`),
    ...endCap.map((p) => `L${P(p)}`),
    ...right.slice().reverse().map((p) => `L${P(p)}`),
    ...startCap.map((p) => `L${P(p)}`),
    'Z',
  ].join('');

  const hiD = `M${P(hi[0])} ${hi.slice(1).map((p) => `L${P(p)}`).join('')}`;

  return { d, hi: hiD, maxR: Math.max(...radii), minR: Math.min(...radii) };
}

/** Perfil de haustra: tramo ancho y redondeado con cuello estrecho entre bolsas. */
function smoothstep(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}
function pouchWave(u, k, phase) {
  const t = u * k + phase / (Math.PI * 2);
  const ph = ((t % 1) + 1) % 1;
  const tri = ph < 0.5 ? ph * 2 : (1 - ph) * 2;   // 0 → 1 → 0
  return smoothstep((tri - 0.34) / 0.32) * 2 - 1;  // meseta suave
}

function normAt(poly, i) {
  const a = poly[Math.max(0, i - 1)];
  const b = poly[Math.min(poly.length - 1, i + 1)];
  const tx = b[0] - a[0];
  const ty = b[1] - a[1];
  const l = Math.hypot(tx, ty) || 1;
  return [-ty / l, tx / l];
}
function tangAt(poly, i) {
  const a = poly[Math.max(0, i - 1)];
  const b = poly[Math.min(poly.length - 1, i + 1)];
  const tx = b[0] - a[0];
  const ty = b[1] - a[1];
  const l = Math.hypot(tx, ty) || 1;
  return [tx / l, ty / l];
}

/** Rectángulo redondeado recorrido en reloj desde el lado derecho. */
function roundedRect(cx, cy, w, h, r, per = 10) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  r = Math.min(r, w / 2 - 0.01, h / 2 - 0.01);
  const pts = [];
  const arc = (ccx, ccy, a0, a1) => {
    for (let i = 0; i <= per; i++) {
      const a = a0 + ((a1 - a0) * i) / per;
      pts.push([ccx + Math.cos(a) * r, ccy + Math.sin(a) * r]);
    }
  };
  // derecha hacia abajo
  for (let i = 0; i <= per; i++) pts.push([x1, y0 + r + ((h - 2 * r) * i) / per]);
  arc(x1 - r, y1 - r, 0, Math.PI / 2);
  for (let i = 0; i <= per; i++) pts.push([x1 - r - ((w - 2 * r) * i) / per, y1]);
  arc(x0 + r, y1 - r, Math.PI / 2, Math.PI);
  for (let i = 0; i <= per; i++) pts.push([x0, y1 - r - ((h - 2 * r) * i) / per]);
  arc(x0 + r, y0 + r, Math.PI, Math.PI * 1.5);
  for (let i = 0; i <= per; i++) pts.push([x0 + r + ((w - 2 * r) * i) / per, y0]);
  arc(x1 - r, y0 + r, Math.PI * 1.5, Math.PI * 2);
  return pts;
}

/* ─────────────────────────── Digestivo (logo → héroe) ───────────────────── */

const COLON_PATH = [
  [294, 682], [287, 636], [283, 580], [282, 518], [283, 458],
  [287, 408], [297, 366], [322, 336], [362, 314], [412, 301],
  [462, 297], [510, 302], [550, 316], [580, 340], [597, 374],
  [606, 414], [608, 462], [606, 512], [600, 560], [590, 604],
  [574, 644], [546, 678], [508, 702], [468, 716], [436, 730],
  [416, 752], [406, 778],
];

/** Lazadas horizontales unidas por curvas de retorno (aspecto de íleo). */
function serpentine({ x0, x1, yTop, yBottom, rows, wave = 7 }) {
  const pts = [];
  const dy = (yBottom - yTop) / (rows - 1);
  const arc = (cx, cy, r, a0, a1, steps = 9) => {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  for (let r = 0; r < rows; r++) {
    const y = yTop + dy * r;
    const right = r % 2 === 0;
    const xa = right ? x0 : x1;
    const xb = right ? x1 : x0;
    const N = 12;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      pts.push([xa + (xb - xa) * t, y + Math.sin(t * Math.PI * 2 + r) * wave]);
    }
    if (r < rows - 1) {
      // la vuelta se traza en el extremo final de la lazada (xb)
      if (right) arc(xb, y + dy / 2, dy / 2, -Math.PI / 2, Math.PI / 2);
      else arc(xb, y + dy / 2, dy / 2, -Math.PI / 2, -Math.PI * 1.5);
    }
  }
  return pts;
}

const ILEUM = serpentine({ x0: 352, x1: 548, yTop: 386, yBottom: 588, rows: 3, wave: 11 });

/**
 * Ilustración principal: colon + intestino delgado + ostomía, tal y como
 * aparece en el logotipo, con volumen y luz.
 */
export function digestiveArt({ id = 'digestive' } = {}) {
  const colon = tube(COLON_PATH, { radius: 35, amp: 0.25, pouches: 15.5, phase: 0.6, wobble: 0.03 });
  const ileum = tube(ILEUM, { radius: 15, amp: 0.2, pouches: 15, phase: 0.4, wobble: 0.04, hiWidth: 0.55 });

  return `
<svg class="art-art" viewBox="-42 -6 900 900" role="img" aria-label="Ilustración del intestino con una ostomía, en el estilo del logotipo de ASEIIO" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${id}-colon" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#2E7FD0"/>
      <stop offset="0.5" stop-color="#1B62B0"/>
      <stop offset="1" stop-color="#12447F"/>
    </linearGradient>
    <linearGradient id="${id}-ileum" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="#3FC9C0"/>
      <stop offset="1" stop-color="#12A29C"/>
    </linearGradient>
    <linearGradient id="${id}-ring" x1="0" y1="0.1" x2="1" y2="0.9">
      <stop offset="0" stop-color="#12A29C"/>
      <stop offset="0.45" stop-color="#1B62B0"/>
      <stop offset="1" stop-color="#0E5A8A"/>
    </linearGradient>
    <linearGradient id="${id}-bag" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#F1E9E1"/>
      <stop offset="1" stop-color="#D8CABD"/>
    </linearGradient>
    <radialGradient id="${id}-stoma" cx="0.4" cy="0.35" r="0.8">
      <stop offset="0" stop-color="#E9706A"/>
      <stop offset="1" stop-color="#C23B36"/>
    </radialGradient>
    <radialGradient id="${id}-glow" cx="0.5" cy="0.45" r="0.6">
      <stop offset="0" stop-color="#3FC9C0" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#3FC9C0" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-lit" cx="0.3" cy="0.22" r="0.85">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/>
      <stop offset="0.55" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="${id}-shade" cx="0.72" cy="0.88" r="0.8">
      <stop offset="0" stop-color="#06284A" stop-opacity="0.26"/>
      <stop offset="1" stop-color="#06284A" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="${id}-clipColon"><use href="#${id}-shapeColon"/></clipPath>
    <clipPath id="${id}-clipIleum"><use href="#${id}-shapeIleum"/></clipPath>
  </defs>

  <circle cx="450" cy="450" r="380" fill="url(#${id}-glow)"/>

  <circle class="art-ring" cx="450" cy="450" r="372" fill="none"
          stroke="url(#${id}-ring)" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="1500 840" transform="rotate(-96 450 450)"/>

  <g class="art-colon">
    <path id="${id}-shapeColon" d="${colon.d}" fill="url(#${id}-colon)"/>
    <g clip-path="url(#${id}-clipColon)">
      <rect x="150" y="150" width="620" height="720" fill="url(#${id}-lit)"/>
      <rect x="150" y="150" width="620" height="720" fill="url(#${id}-shade)"/>
    </g>
  </g>

  <g class="art-ileum">
    <path id="${id}-shapeIleum" d="${ileum.d}" fill="url(#${id}-ileum)"/>
    <g clip-path="url(#${id}-clipIleum)">
      <rect x="280" y="300" width="380" height="380" fill="url(#${id}-lit)"/>
      <rect x="280" y="300" width="380" height="380" fill="url(#${id}-shade)" opacity="0.6"/>
    </g>
  </g>

  <g class="art-bag" transform="translate(604 470) scale(0.88)">
    <path d="M62 26 C112 26 138 66 138 126 L138 196 C138 244 108 272 62 272 C16 272 -14 244 -14 196 L-14 126 C-14 66 12 26 62 26 Z" fill="url(#${id}-bag)"/>
    <path d="M112 78 C128 96 132 132 128 168" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="9" stroke-linecap="round"/>
    <rect x="34" y="262" width="56" height="30" rx="13" fill="#C4B4A5"/>
    <rect x="34" y="262" width="56" height="12" rx="6" fill="#B4A294" opacity="0.7"/>
    <circle cx="62" cy="52" r="34" fill="#ffffff"/>
    <circle cx="62" cy="52" r="25" fill="url(#${id}-stoma)"/>
    <path d="M62 42 v20 M52 52 h20" stroke="#ffffff" stroke-opacity="0.85" stroke-width="5" stroke-linecap="round"/>
  </g>

  <g class="art-plus" opacity="0.5">
    <path d="M266 236 h26 M279 223 v26" stroke="#12A29C" stroke-width="6" stroke-linecap="round"/>
    <path d="M646 704 h20 M656 694 v20" stroke="#1B62B0" stroke-width="5" stroke-linecap="round"/>
  </g>
  <g fill="#3FC9C0">
    <circle cx="176" cy="392" r="7"/>
    <circle cx="748" cy="318" r="5" opacity="0.7"/>
    <circle cx="212" cy="700" r="4" opacity="0.6"/>
  </g>
</svg>`;
}

/** Versión plana y pequeña para favicon / marca. */
export function miniMark() {
  return `
<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="64" height="64" rx="16" fill="#12447F"/>
  <path d="M20 46V30a12 12 0 0 1 24 0v16" fill="none" stroke="#3FC9C0" stroke-width="7" stroke-linecap="round"/>
  <circle cx="32" cy="20" r="6" fill="#F1E9E1"/>
  <circle cx="32" cy="20" r="3" fill="#C23B36"/>
</svg>`;
}

/* ─────────────────────────── Ostomía aislada ───────────────────────────── */

/* Tres siluetas de bolsa y tres acentos: se eligen con el `id`, de forma que
   dos tarjetas con la misma ilustración no se ven idénticas. */
const BAG_SHAPES = [
  'M110 34 C162 34 190 76 190 138 L190 210 C190 262 158 292 110 292 C62 292 30 262 30 210 L30 138 C30 76 58 34 110 34 Z',
  'M110 40 C168 40 186 82 186 144 L186 214 C186 264 154 290 110 290 C66 290 34 264 34 214 L34 144 C34 82 52 40 110 40 Z',
  'M110 30 C156 30 192 72 192 132 L192 206 C192 262 156 296 110 296 C64 296 28 262 28 206 L28 132 C28 72 64 30 110 30 Z',
];
const BAG_ACCENTS = ['#D9534F', '#12A29C', '#1B62B0'];

const hash = (s = '') => {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 100003;
  return h;
};

export function bagArt({ id = 'bag' } = {}) {
  const n = hash(id);
  const shape = BAG_SHAPES[n % BAG_SHAPES.length];
  const accent = BAG_ACCENTS[n % BAG_ACCENTS.length];
  const flip = n % 2 === 1;

  return `
<svg viewBox="0 15.5 220 320" role="img" aria-label="Bolsa de ostomía" xmlns="http://www.w3.org/2000/svg" class="art-art art-bag-only">
  <defs>
    <linearGradient id="${id}-g" x1="0.1" y1="0" x2="0.9" y2="1">
      <stop offset="0" stop-color="#F4EDE5"/><stop offset="1" stop-color="#D6C8BB"/>
    </linearGradient>
  </defs>
  <path d="${shape}" fill="url(#${id}-g)"/>
  <path d="${flip ? 'M62 88 C46 108 42 146 46 184' : 'M162 88 C178 108 182 146 178 184'}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="10" stroke-linecap="round"/>
  <rect x="80" y="282" width="60" height="32" rx="14" fill="#C4B4A5"/>
  <ellipse cx="110" cy="46" rx="26" ry="9" fill="#C4B4A5"/>
  <ellipse cx="110" cy="44" rx="18" ry="6" fill="${accent}"/>
  <path d="${flip ? 'M156 120 C172 150 176 196 170 236' : 'M64 120 C48 150 44 196 50 236'}" fill="none" stroke="#ffffff" stroke-opacity="0.5" stroke-width="7" stroke-linecap="round"/>
  <path d="${flip ? 'M64 236 C52 216 48 186 52 156' : 'M156 236 C168 216 172 186 168 156'}" fill="none" stroke="#B9A897" stroke-opacity="0.6" stroke-width="4" stroke-linecap="round"/>
</svg>`;
}

/* ──────────────────── Figuras de personas ostomizadas ──────────────────── */

const FIGURES = [
  { x: 66, h: 196, c1: '#2E7FD0', c2: '#12447F', bag: true, flip: false },
  { x: 186, h: 236, c1: '#3FC9C0', c2: '#0C817C', bag: false, flip: true },
  { x: 302, h: 212, c1: '#5B8FE0', c2: '#1B62B0', bag: true, flip: false },
  { x: 420, h: 246, c1: '#6FD0C6', c2: '#12A29C', bag: false, flip: false },
  { x: 538, h: 200, c1: '#8FB4EA', c2: '#2E7FD0', bag: true, flip: true },
];

const BASELINE = 244;

function person({ x, h, c1, c2, bag, flip }, i) {
  const id = `pp${i}`;
  const headR = h * 0.108;
  const headCy = BASELINE - h + headR;
  const ty = headCy + headR * 0.94;                 // hombro (pegado a la cabeza)
  const torsoH = BASELINE - ty - h * 0.05;
  const wTop = h * 0.155;
  const wBot = h * 0.215;
  const botR = wBot * 0.66;

  // torso: hombros redondeados + cuerpo que se ensancha y remata en curva
  const torso =
    `M${f(-wTop + wTop * 0.5)} ${f(ty - headR * 0.1)}` +
    `C${f(-wTop - wTop * 0.06)} ${f(ty + wTop * 0.3)} ${f(-wBot + botR * 0.2)} ${f(ty + torsoH * 0.55)} ${f(-wBot)} ${f(ty + torsoH - botR * 0.55)}` +
    `C${f(-wBot)} ${f(ty + torsoH + botR * 0.5)} ${f(-wBot * 0.5)} ${f(ty + torsoH + botR * 0.66)} 0 ${f(ty + torsoH + botR * 0.66)}` +
    `C${f(wBot * 0.5)} ${f(ty + torsoH + botR * 0.66)} ${f(wBot)} ${f(ty + torsoH + botR * 0.5)} ${f(wBot)} ${f(ty + torsoH - botR * 0.55)}` +
    `C${f(wBot - botR * 0.2)} ${f(ty + torsoH * 0.55)} ${f(wTop + wTop * 0.06)} ${f(ty + wTop * 0.3)} ${f(wTop - wTop * 0.5)} ${f(ty - headR * 0.1)}` +
    `C${f(wTop * 0.42)} ${f(ty - headR * 0.34)} ${f(-wTop * 0.42)} ${f(ty - headR * 0.34)} ${f(-wTop + wTop * 0.5)} ${f(ty - headR * 0.1)} Z`;

  const bw = headR * 0.66;            // media anchura de la bolsa
  const bh = headR * 1.12;            // media altura
  const by = ty + torsoH * 0.5;       // centro vertical de la bolsa
  const bagG = `<g class="person-bag">
      <path d="M${f(-bw)} ${f(by - bh * 0.62)}
               C${f(-bw)} ${f(by - bh * 1.06)} ${f(bw)} ${f(by - bh * 1.06)} ${f(bw)} ${f(by - bh * 0.62)}
               L${f(bw)} ${f(by + bh * 0.42)}
               C${f(bw)} ${f(by + bh * 1.02)} ${f(-bw)} ${f(by + bh * 1.02)} ${f(-bw)} ${f(by + bh * 0.42)} Z"
            fill="#F6F0E9" stroke="#BCAB9C" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="${f(-bw * 0.4)}" y="${f(by + bh * 0.96)}" width="${f(bw * 0.8)}" height="${f(bh * 0.34)}" rx="${f(bh * 0.17)}" fill="#BCAB9C"/>
      <circle cx="0" cy="${f(by - bh * 0.66)}" r="${f(headR * 0.19)}" fill="#D9534F"/>
    </g>`;

  return `
<g class="person" transform="translate(${x} ${BASELINE}) scale(${flip ? -1 : 1} 1)">
  <defs>
    <linearGradient id="${id}-g" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient>
  </defs>
  <g transform="translate(0 ${-BASELINE})">
    <path d="${torso}" fill="url(#${id}-g)"/>
    <path d="M${f(-wTop * 0.55)} ${f(ty + torsoH * 0.2)} C${f(-wTop * 0.92)} ${f(ty + torsoH * 0.6)} ${f(-wBot * 0.82)} ${f(ty + torsoH * 0.92)} ${f(-wBot * 0.58)} ${f(ty + torsoH * 0.98)}"
          fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="${f(headR * 0.3)}" stroke-linecap="round"/>
    ${bag ? bagG : `<circle class="person-dot" cx="0" cy="${f(ty + torsoH * 0.5)}" r="${f(headR * 0.3)}" fill="#F6F0E9" stroke="#BCAB9C" stroke-width="2.2"/><circle cx="0" cy="${f(ty + torsoH * 0.5)}" r="${f(headR * 0.14)}" fill="#D9534F"/>`}
    <circle cx="0" cy="${f(headCy)}" r="${f(headR)}" fill="url(#${id}-g)"/>
    <path d="M${f(-headR * 0.6)} ${f(headCy - headR * 0.32)} a ${f(headR * 0.64)} ${f(headR * 0.64)} 0 0 1 ${f(headR * 0.46)} ${f(-headR * 0.58)}"
          fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="${f(headR * 0.14)}" stroke-linecap="round"/>
  </g>
</g>`;
}

/** Banda de personas: representa la comunidad sin fotos de stock. */
export function peopleArt({ id = 'people' } = {}) {
  return `
<svg viewBox="0 0 600 280" role="img" aria-label="Grupo de personas de la comunidad de ASEIIO" xmlns="http://www.w3.org/2000/svg" class="art-people">
  <defs>
    <linearGradient id="${id}-base" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#E4EFF8"/><stop offset="1" stop-color="#FAF6F1"/>
    </linearGradient>
    <radialGradient id="${id}-sh" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#12447F" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#12447F" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="600" height="280" rx="36" fill="url(#${id}-base)"/>
  <ellipse cx="300" cy="${BASELINE + 20}" rx="258" ry="22" fill="url(#${id}-sh)"/>
  ${FIGURES.map((cfg, i) => person(cfg, i)).join('')}
</svg>`;
}

/* ───────────────────────────── Iconografía ──────────────────────────────── */

const ICONS = {
  scales: `<path d="M12 3v18M7 21h10M12 6l-6 2M12 6l6 2"/><path d="M6 8l-3 6a3 3 0 0 0 6 0L6 8zM18 8l-3 6a3 3 0 0 0 6 0l-3-6z"/>`,
  heart: `<path d="M12 20s-7-4.3-7-9.3A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.7C19 15.7 12 20 12 20z"/>`,
  bag: `<path d="M8 4h8a4 4 0 0 1 4 4v9a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8a4 4 0 0 1 4-4z"/><circle cx="12" cy="9" r="2.4"/><path d="M10 22h4"/>`,
  card: `<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>`,
  flask: `<path d="M9 3h6M10 3v6l-5 8.5A2.5 2.5 0 0 0 7.2 21h9.6a2.5 2.5 0 0 0 2.2-3.5L14 9V3"/><path d="M7.5 14h9"/>`,
  people: `<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.6"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 14.8c2.7.2 5 2.2 5 5.2"/>`,
  chat: `<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/><path d="M9 11h6M9 14.5h4"/>`,
  book: `<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>`,
  doc: `<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>`,
  plane: `<path d="M10.5 13.5 3 11l1.5-1.5L11 10l4.5-4.5a2 2 0 0 1 3 3L14 13l.5 6.5L13 21l-2.5-7.5z"/>`,
  spark: `<path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>`,
  phone: `<path d="M6 3h3l2 5-2.5 1.5a12 12 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4 5.2 2 2 0 0 1 6 3z"/>`,
  pin: `<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>`,
  shield: `<path d="M12 3l7.5 3v6c0 4.6-3.2 8-7.5 9.5C7.7 20 4.5 16.6 4.5 12V6z"/><path d="m9 12 2 2 4-4"/>`,
  check: `<path d="m4 12.5 5 5L20 6.5"/>`,
  arrow: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
  download: `<path d="M12 3v12M7 11l5 5 5-5M4 20h16"/>`,
  clock: `<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>`,
};

export function icon(name, { size = 24, cls = '' } = {}) {
  const body = ICONS[name] || ICONS.check;
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const iconNames = Object.keys(ICONS);
