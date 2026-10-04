#!/usr/bin/env node
/**
 * install.js — instala ASEIIO de principio a fin.
 *
 *   # Instalar y arrancar en localhost:
 *   node scripts/install.js
 *
 *   # En un servidor, escuchando en :443 con HTTPS auto-firmado:
 *   sudo ADMIN_PASSWORD='Larga-2026!' node scripts/install.js --host=0.0.0.0 --port=443
 *
 *   # Con un certificado real (Let's Encrypt) ya en el disco:
 *   sudo node scripts/install.js --host=0.0.0.0 --port=443 --cert=/etc/letsen.se/fullchain.pem --key=/etc/letsen.se/privkey.pem
 *
 *   # Crear la unidad systemd (sin iniciarla) para que arranque al reiniciar el servidor:
 *   sudo node scripts/install.js --host=0.0.0.0 --port=443 --cert=... --key=... --service
 *
 *   # Para usar FastPanel: ver README §9.1.B. Este script no toca Nginx.
 *
 * Opciones:
 *   --host=IP          IP a la que escucha          (defecto 127.0.0.1)
 *   --port=PUERTO      Puerto                       (defecto 4322 en local, 443 con --public)
 *   --public           Escuchar en todas las IPs (0.0.0.0). Implica --port=443 si no se da otro.
 *   --admin=URL        URL completa del panel, para mostrarla al final
 *   --cert=RUTA        Ruta a fullchain.pem
 *   --key=RUTA         Ruta a privkey.pem
 *   --password=TEXTO   Contraseña del panel. Si no, se pregunta o se crea una aleatoria.
 *   --no-build         No regenerar dist antes de arrancar
 *   --solo-panel       Servir SÓLO el panel. La web pública la sirve nginx/FastPanel
 *                        desde dist/. Recomendado en producción: el panel queda en
 *                        un puerto aparte y no se llega por el dominio principal.
 *   --site-dir=RUTA    Carpeta que sirve el servidor web (la de FastPanel). El
 *                        build y el panel escriben directamente ahí: al guardar
 *                        un artículo la web queda actualizada sin pasos extra.
 *   --service          Instalar como servicio systemd y salir (no arrancar)
 *   --user=USUARIO     Usuario Linux del servicio (defecto: el que ejecuta sudo)
 *   --help             Muestra esta ayuda
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const ARG = process.argv.slice(2);
const opt = (n, d) => { const i = ARG.indexOf(n); return i >= 0 ? ARG[i + 1] : d; };
const flag = (n) => ARG.includes(n);
const args = Object.fromEntries(ARG.filter((a) => a.startsWith('--')).map((a) => {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : null;
}).filter(Boolean));

if (flag('--help')) { console.log(fs.readFileSync(import.meta.filename, 'utf8').split('\n').slice(1, 30).join('\n')); process.exit(0); }

const HOST = args.host || (args.public ? '0.0.0.0' : '127.0.0.1');
const PORT = Number(args.port || (args.public && !args.port ? 443 : 4322));
const CERT = args.cert, KEY = args.key, ADMIN_PWD = args.password;
const IS_PUBLIC = !!args.public || HOST === '0.0.0.0';
const IS_SERVICE = !!args.service;
// --solo-panel: sólo el panel en este puerto; la web la sirve nginx/FastPanel
// desde dist/ como estático. Es la opción recomendada en producción.
const SOLO_PANEL = !!args['solo-panel'];
// --site-dir: carpeta que sirve el servidor web (la de FastPanel). El build y
// el panel escriben directamente ahí, así al guardar un artículo la web se
// actualiza sin pasos extra. Sin esta opción se escribe en ./dist.
const SITE_DIR = args['site-dir'] ? path.resolve(String(args['site-dir'])) : null;

const c = (s) => `\x1b[${s}m`; const C = { r: c(`0`), b: c(`1`), g: c(`32`), y: c(`33`), cy: c(`36`), di: c(`2`) };
const ok = (m) => console.log(`  ${C.g}✓${C.r} ${m}`);
const info = (m) => console.log(`  ${C.cy}·${C.r} ${m}`);
const err = (m) => console.log(`  ${C.y}✗${C.r} ${m}`);

import readline from 'node:readline';
function pregunta(prompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => rl.question(prompt, (a) => { rl.close(); res(a); }));
}

/* ── 1. Node ──────────────────────────────────────────────────────────────── */
console.log(`\n${C.b}ASEIIO · instalación${C.r}\n`);

const nodeVer = process.versions.node.split('.').map(Number);
if (nodeVer[0] < 18) {
  err(`Node ${process.versions.node} es demasiado antiguo. Necesitas Node 18 o superior.`);
  process.exit(1);
}
ok(`Node ${process.versions.node}`);

/* ── 2. Genera dist si hace falta ─────────────────────────────────────────── */
if (!flag('--no-build')) {
  info('Generando el sitio…');
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'build.js')],
      { stdio: 'inherit', cwd: ROOT, env: SITE_DIR ? { ...process.env, DIST_DIR: SITE_DIR } : process.env });
    ok(SITE_DIR ? `Sitio generado en ${SITE_DIR}` : 'Sitio generado');
  } catch (e) {
    err('Falló la generación del sitio.');
    process.exit(1);
  }
}

/* ── 3. Contraseña del panel ─────────────────────────────────────────────── */
let password = ADMIN_PWD;
const claveFile = path.join(ROOT, '.admin-clave.json');
if (fs.existsSync(claveFile)) {
  info('.admin-clave.json ya existe: se conserva.');
} else if (!password && process.stdin.isTTY && process.stdout.isTTY && !process.env.ADMIN_PASSWORD) {
  const a = await pregunta(`  ${C.b}Contraseña del panel${C.r} (mín 20 caracteres, o Enter para generar una): `);
  password = a || crypto.randomBytes(15).toString('base64url');
} else if (!password) {
  password = crypto.randomBytes(15).toString('base64url');
}
if (!fs.existsSync(claveFile)) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'admin.js'), '--nueva-clave'], {
      env: { ...process.env, ADMIN_PASSWORD: password }, stdio: 'inherit', cwd: ROOT,
    });
  } catch (e) {
    err('No se pudo crear la clave: ' + (e.message || e));
    process.exit(1);
  }
  ok('.admin-clave.json creada');
  info(`Contraseña: ${C.b}${password}${C.r}`);
  info(`Guárdala. Si la pierdes, puedes cambiarla con:`);
  info(`  ADMIN_PASSWORD='…' node scripts/admin.js --nueva-clave`);
}

/* ── 4. Servicio systemd ──────────────────────────────────────────────────── */
if (IS_SERVICE) {
  if (!fs.existsSync('/etc/systemd/system')) {
    err('No se detecta systemd. Inicia con `node scripts/admin.js` a mano.');
    process.exit(1);
  }
  const user = args.user || (process.env.SUDO_USER || process.env.USER || 'root');
  const certEnv = CERT ? `Environment=CERT_PATH=${CERT}\n` : '';
  const keyEnv = KEY ? `Environment=KEY_PATH=${KEY}\n` : '';
  const panelEnv = SOLO_PANEL ? 'Environment=SOLO_PANEL=1\n' : '';
  const distEnv = SITE_DIR ? `Environment=DIST_DIR=${SITE_DIR}\n` : '';
  const unit = `[Unit]
Description=ASEIIO · web y panel
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${ROOT}
Environment=HOST=${HOST}
Environment=PORT=${PORT}
Environment=HTTPS=${CERT ? 1 : 0}
${certEnv}${keyEnv}${panelEnv}${distEnv}ExecStart=/usr/bin/env node ${path.join(ROOT, 'scripts', 'admin.js')}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;
  fs.writeFileSync('/etc/systemd/system/aseiio.service', unit, { mode: 0o644 });
  ok('Unidad /etc/systemd/system/aseiio.service creada');
  try {
    execFileSync('systemctl', ['daemon-reload'], { stdio: 'inherit' });
    execFileSync('systemctl', ['enable', 'aseiio'], { stdio: 'inherit' });
    ok('Servicio activado para arrancar al iniciar el servidor');
    info('Arrancarlo ahora:  sudo systemctl start aseiio');
    info('Ver logs:           sudo journalctl -u aseiio -f');
  } catch (e) {
    err('No pude activar el servicio con systemctl.');
  }
  process.exit(0);
}

/* ── 5. Arrancar ──────────────────────────────────────────────────────────── */
const env = { ...process.env, HOST, PORT };
if (SITE_DIR) env.DIST_DIR = SITE_DIR;
if (SOLO_PANEL) env.SOLO_PANEL = '1';
if (CERT) env.CERT_PATH = CERT;
if (KEY) env.KEY_PATH = KEY;
if (CERT) env.HTTPS = '1';

const proto = CERT ? 'https' : 'http';
const shownHost = HOST === '0.0.0.0' ? 'este servidor' : HOST;
console.log(`
${C.b}Listo${C.r}
  Web      ${proto}://${shownHost}:${PORT}/
  Panel    ${proto}://${shownHost}:${PORT}/admin/
${SOLO_PANEL ? '  Web      la sirve nginx/FastPanel desde dist/ (esta instalación no la sirve)' : ''}

  Para entrar en el panel, escribe la contraseña del paso anterior.
${SOLO_PANEL ? '\n  Desde tu navegador, con túnel SSH:\n    ssh -L ' + PORT + ':127.0.0.1:' + PORT + ' usuario@TU-SERVIDOR\n  y abre http://127.0.0.1:' + PORT + '/admin/' : ''}

  Para parar el servidor, ${C.di}Ctrl+C${C.r}.
`);

import('node:child_process').then(({ spawn }) => {
  const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'admin.js'), String(PORT)], { env, stdio: 'inherit' });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}).catch((e) => { err(e.message); process.exit(1); });
