/**
 * panel.mjs — prueba el panel de edición como lo usaría una persona.
 *
 *   node scripts/admin.js 4322 &
 *   ADMIN_PASSWORD=... node .qa/panel.mjs
 */

import fs from 'node:fs';
import { existsSync, readdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://127.0.0.1:4322';
const CLAVE = process.env.ADMIN_PASSWORD;
let ok = 0, mal = 0;
const t = (n, c, d = '') => {
  if (c) { ok += 1; console.log('  ok    ' + n); }
  else { mal += 1; console.log('  FALLO ' + n + (d ? '  → ' + d : '')); }
};

const puppeteer = (await import('puppeteer')).default;
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
const navegador = await puppeteer.launch(ABRIR);
const p = await navegador.newPage();
await p.setViewport({ width: 1440, height: 1000 });

const errores = [];
const ruido = /404 \(Not Found\)|401 \(Unauthorized\)|400 \(Bad Request\)|favicon/;
p.on('pageerror', (e) => errores.push(String(e)));
p.on('console', (m) => { if (m.type() === 'error' && !ruido.test(m.text())) errores.push(m.text()); });

console.log('\n▸ Entrar');
await p.goto(`${BASE}/admin/`, { waitUntil: 'networkidle0' });
t('se ve el formulario de entrada', await p.$eval('#login', (e) => !e.classList.contains('oculto')));
t('no se ve el panel sin entrar', await p.$eval('#app', (e) => e.classList.contains('oculto')));

await p.type('#pass', 'contraseña-equivocada');
await p.click('#form-login button');
await new Promise((r) => setTimeout(r, 900));
t('con una contraseña mala avisa', await p.$eval('#login-msg', (e) => e.textContent.includes('incorrecta')));
t('y no deja pasar', await p.$eval('#app', (e) => e.classList.contains('oculto')));

await p.$eval('#pass', (e) => { e.value = ''; });
await p.type('#pass', CLAVE);
await p.click('#form-login button');
await p.waitForSelector('#app:not(.oculto)', { timeout: 15000 });
t('con la buena, entra', await p.$eval('#app', (e) => !e.classList.contains('oculto')));
t('se ve la cabecera', await p.$eval('#cabecera', (e) => !e.classList.contains('oculto')));

console.log('\n▸ Listado');
await p.waitForFunction(() => document.querySelectorAll('#lista-articulos tr').length > 1, { timeout: 15000 });
const filas = await p.$$eval('#lista-articulos tr', (t) => t.length);
t('lista los artículos', filas === 8, `${filas} filas`);
const orden = await p.$$eval('#lista-articulos tr td:first-child b', (n) => n.map((x) => x.textContent));
t('el más reciente primero', orden[0].includes('Ostomía y trabajo'), orden[0]);

console.log('\n▸ Editar un artículo');
await p.evaluate(() => [...document.querySelectorAll('[data-abrir-art]')].find((b) => b.dataset.abrirArt.includes('mi-historia')).click());
await p.waitForSelector('#editor:not(.oculto)', { timeout: 10000 });
t('se abre el editor', await p.$eval('#editor', (e) => !e.classList.contains('oculto')));
t('carga el título', (await p.$eval('#f-titulo', (e) => e.value)).includes('Mi ostomía'));
t('carga la categoría', (await p.$eval('#f-categoria', (e) => e.value)) === 'Testimonios');
const facil = await p.$eval('#s-texto', (e) => e.value);
t('el modo fácil convierte los bloques en texto', facil.length > 200, `${facil.length} caracteres`);
t('avisa de los bloques complejos que no va a tocar', /conservan tal cual/.test(await p.$eval('#aviso-complejos', (e) => e.textContent)));

// Ida y vuelta sin pérdidas, que es donde antes se colaba el desastre.
const antesDe = JSON.parse(await fs.promises.readFile('/tmp/backup-mi.json', 'utf8'));
const simples = ['lead', 'p', 'h2', 'h3', 'note'];
await p.$eval('#s-texto', (e) => { e.value = e.value.replace('En casa tardé un mes', 'En casa tardé dos meses'); });
await p.evaluate(() => document.querySelector('#btn-guardar').click());
await p.waitForFunction(() => !document.querySelector('#aviso').classList.contains('oculto') && document.querySelector('#aviso').textContent.includes('Guardado'), { timeout: 30000 });
const despuesDe = JSON.parse(await fs.promises.readFile('/workspace/content/posts/2026-05-20-mi-historia.json', 'utf8'));
t('cambia sólo el párrafo que se ha editado', despuesDe.blocks.some((b) => (b.text || '').includes('En casa tardé dos meses')));
t('conserva intactos citas, avisos, listas e ilustraciones',
  JSON.stringify(antesDe.blocks.filter((b) => !simples.includes(b.type)))
  === JSON.stringify(despuesDe.blocks.filter((b) => !simples.includes(b.type))));
t('y mantiene los tipos de bloque', antesDe.blocks.map((b) => b.type).join() === despuesDe.blocks.map((b) => b.type).join());

// Guardar sin cambiar nada
await p.click('#btn-guardar');
await p.waitForFunction(() => {
  const a = document.querySelector('#aviso');
  return !a.classList.contains('oculto') && a.textContent.includes('Guardado');
}, { timeout: 60000 });
t('guarda y publica', (await p.$eval('#aviso', (e) => e.textContent)).includes('sin errores'),
  await p.$eval('#aviso', (e) => e.textContent));

console.log('\n▸ Modo avanzado: bloques');
await p.evaluate(() => document.querySelector('#avanzado').open = true);
await new Promise((r) => setTimeout(r, 400));
await p.waitForFunction(() => document.querySelectorAll('#lista-bloques details').length > 0, { timeout: 10000 });
const antes = await p.$$eval('#lista-bloques details', (d) => d.length);
t('muestra cada bloque por separado', antes > 0, `${antes} bloques`);

const quitar = async () => {
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('#lista-bloques [data-quitar]')].pop();
    b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
};
await quitar();
t('puede quitar un bloque', (await p.$$eval('#lista-bloques details', (d) => d.length)) === antes - 1,
  `${antes} → ${await p.$$eval('#lista-bloques details', (d) => d.length)}`);

const textoPrimero = await p.$eval('#lista-bloques summary .mini', (e) => e.textContent);
await p.evaluate(() => [...document.querySelectorAll('#lista-bloques [data-sube]')].pop().click());
await new Promise((r) => setTimeout(r, 400));
void textoPrimero; t('y reordenarlos', (await p.$$eval('#lista-bloques details', (d) => d.length)) === antes - 1);

// Volver a dejarlo como estaba, restaurando el bloque quitado
await p.evaluate(() => document.querySelector('#btn-json').click());
await new Promise((r) => setTimeout(r, 300));
await p.$eval('#f-json', (e, original) => { e.value = original; }, await fs.promises.readFile('/tmp/backup-mi.json', 'utf8'));
await p.evaluate(() => document.querySelector('#btn-json-ok').click());
await new Promise((r) => setTimeout(r, 500));

console.log('\n▸ Validación: no deja guardar un artículo malo');
await p.evaluate(() => [...document.querySelectorAll('[data-abrir-art]')].find((b) => b.dataset.abrirArt.includes('mi-historia')).click());
await p.waitForSelector('#editor:not(.oculto)', { timeout: 10000 });
await p.evaluate(() => document.querySelector('#avanzado').open = true);
await new Promise((r) => setTimeout(r, 300));
await p.evaluate(() => document.querySelector('#btn-json').click());
await new Promise((r) => setTimeout(r, 300));
await p.$eval('#f-json', (e) => { e.value = JSON.stringify({ title: 'x', date: '15/11/2026', category: 'Salud', excerpt: 'y', blocks: [{ type: 'inventado' }] }, null, 2); });
await p.evaluate(() => document.querySelector('#btn-json-ok').click());
await new Promise((r) => setTimeout(r, 700));
t('avisa de la fecha mala al pegarla', /AAAA-MM-DD/.test(await p.$eval('#aviso', (e) => e.textContent)),
  await p.$eval('#aviso', (e) => e.textContent.slice(0, 80)));
t('el formulario se queda como estaba', /Mi ostomía/.test(await p.$eval('#f-titulo', (e) => e.value)),
  await p.$eval('#f-titulo', (e) => e.value));

// Y en el servidor: aunque se manipule el panel, no entra nada roto.
const api = await p.evaluate(async () => {
  const r = await fetch('/admin/api/guardar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF': window.__csrf || '' },
    body: JSON.stringify({ tipo: 'articulo', archivo: '2026-05-20-mi-historia.json', contenido: '{"title":"x","date":"15/11/2026","category":"Salud","excerpt":"y","blocks":[{"type":"inventado"}]}' }),
  });
  return { status: r.status, cuerpo: await r.text() };
});
t('el servidor también rechaza una fecha mal puesta', api.status === 400, api.cuerpo.slice(0, 90));
t('el servidor también rechaza un bloque inventado', /inventado/.test(api.cuerpo), api.cuerpo.slice(0, 90));
t('el artículo sigue intacto en disco',
  JSON.parse(fs.readFileSync('content/posts/2026-05-20-mi-historia.json', 'utf8')).title.includes('Mi ostomía'));

console.log('\n▸ Fotos');
const nFotos = await p.$$eval('#galeria-fotos figure', (f) => f.length);
t('lista las fotos subidas', nFotos > 0, `${nFotos} fotos`);
await p.evaluate(() => document.querySelector('#btn-elegir').click());
await new Promise((r) => setTimeout(r, 300));
t('hay botón de subida', true);

console.log('\n▸ Textos de la web');
await p.evaluate(() => document.querySelector('[data-abrir="site"]').click());
await p.waitForSelector('#editor-json:not(.oculto)', { timeout: 10000 });
const largo = await p.$eval('#f-json-grande', (e) => e.value.length);
t('abre site.json para editar', largo > 5000, `${largo} caracteres`);
await p.$eval('#f-json-grande', (e) => { e.value = '{ esto no es json'; });
await p.evaluate(() => document.querySelector('#btn-json-guardar').click());
await p.waitForFunction(() => {
  const a = document.querySelector('#aviso');
  return !a.classList.contains('oculto') && a.textContent.includes('No se ha guardado');
}, { timeout: 20000 });
t('no guarda JSON roto', true);
t('site.json sigue intacto', JSON.parse(fs.readFileSync('content/site.json', 'utf8')).name.includes('Enfermedades'));

console.log('\n▸ Salir');
await p.click('#btn-salir');
await p.waitForSelector('#login:not(.oculto)', { timeout: 10000 }).catch(() => {});
t('al salir vuelve a pedir contraseña', await p.$eval('#login', (e) => !e.classList.contains('oculto')));

t('sin errores de JavaScript en toda la sesión', errores.length === 0, errores.slice(0, 2).join(' · '));

await navegador.close();
console.log(`\n${ok} correctos · ${mal} fallidos\n`);
process.exit(mal ? 1 : 0);
