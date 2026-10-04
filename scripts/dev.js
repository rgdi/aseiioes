/**
 * dev.js — reconstruye y sirve en un solo proceso.
 *
 *   node scripts/dev.js [puerto]
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.argv[2] || process.env.PORT || '4321';

const run = (cmd, args) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} terminó con código ${code}`))));
  });

try {
  await run(process.execPath, [path.join(ROOT, 'scripts', 'build.js')]);
} catch {
  process.exit(1);
}

const server = spawn(process.execPath, [path.join(ROOT, 'scripts', 'serve.js'), PORT], {
  cwd: ROOT,
  stdio: 'inherit',
});

process.on('SIGINT', () => { server.kill('SIGINT'); process.exit(0); });
