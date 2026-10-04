/**
 * serve.js — servidor estático mínimo para previsualizar dist/.
 *
 *   node scripts/serve.js [puerto]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.argv[2] || process.env.PORT || 4321);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

if (!fs.existsSync(DIST)) {
  console.error('No existe dist/. Ejecuta antes:  npm run build');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.join(DIST, path.normalize(url).replace(/^(\.\.[/\\])+/, ''));

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`;

  if (!file.startsWith(DIST) || !fs.existsSync(file)) {
    const nf = path.join(DIST, '404.html');
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return fs.createReadStream(fs.existsSync(nf) ? nf : file).pipe(res);
  }

  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Servidor en marcha →  http://localhost:${PORT}\n  (Ctrl+C para parar)\n`);
});
