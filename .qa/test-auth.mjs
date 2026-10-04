/** Prueba la parte de autenticación sin levantar el servidor. */
import { hashPassword, verificarPassword, contraseñaDébil, crearSesion, sesionViva,
         fallo, acierto, comprobarBloqueo, cookieSesion } from '../scripts/admin/auth.js';

let ok = 0, mal = 0;
const t = (nombre, cond, extra = '') => {
  if (cond) { ok += 1; console.log('  ok    ' + nombre); }
  else { mal += 1; console.log('  FALLO ' + nombre + (extra ? '  → ' + extra : '')); }
};

console.log('\n▸ Contraseñas');
const h = hashPassword('una-frase-larga-y-aleatoria');
t('el hash no contiene la contraseña', !h.includes('una-frase'));
t('dos personas con la misma contraseña tienen hashes distintos', hashPassword('una-frase-larga-y-aleatoria') !== h);
t('la contraseña correcta verifica', verificarPassword('una-frase-larga-y-aleatoria', h));
t('una contraseña parecida NO verifica', !verificarPassword('una-frase-larga-y-alratona', h));
t('una contraseña vacía NO verifica', !verificarPassword('', h));
t('un hash corrupto NO revienta', verificarPassword('x', 'basura') === false);
t('otro algoritmo se rechaza', verificarPassword('x', 'md5$a$b$c$d$e') === false);

console.log('\n▸ Contraseñas débiles');
t('"12345" es débil', !!contraseñaDébil('12345'));
t('"admin12345678" es débil', !!contraseñaDébil('admin12345678'));
t('"aaaaaaaaaaaa" es débil', !!contraseñaDébil('aaaaaaaaaaaa'));
t('una buena no se marca', contraseñaDébil('Ch4-m&-Ola-2026-oviedo') === null);

console.log('\n▸ Sesiones');
const s = crearSesion();
t('el token es largo', s.token.length > 40, s.token.length);
t('dos sesiones son distintas', crearSesion().token !== s.token);
t('el CSRF es distinto del token', s.csrf !== s.token);
t('una sesión nueva está viva', sesionViva(s));
t('una sesión de hace 9 h caduca', !sesionViva({ ...s, ultima: Date.now() - 9 * 3600e3 }));
t('una sesión de hace 7 h sigue viva', sesionViva({ ...s, ultima: Date.now() - 7 * 3600e3 }));
const c = cookieSesion(s.token, { seguro: true });
t('la cookie es HttpOnly', c.includes('HttpOnly'));
t('la cookie es SameSite=Strict', c.includes('SameSite=Strict'));
t('la cookie lleva Secure con https', c.includes('Secure'));
t('la cookie caduca', /Max-Age=\d+/.test(c));

console.log('\n▸ Límite de intentos');
let r = null;
for (let i = 0; i < 4; i += 1) r = fallo(r);
t('tras 4 fallos todavía no hay bloqueo', comprobarBloqueo(r) === null, JSON.stringify(r));
r = fallo(r);
const seg = comprobarBloqueo(r);
t('al quinto intento hay bloqueo', seg > 0, `${seg} s`);
t('durante el bloqueo no se puede entrar', comprobarBloqueo(fallo(r)) > 0);
t('el bloqueo expira solo', comprobarBloqueo({ ...r, hasta: Date.now() - 1 }) === null);
t('un acierto reinicia el contador', acierto().n === 0);
t('la espera crece con los intentos', fallo({ n: 8, hasta: 0 }).hasta > fallo({ n: 5, hasta: 0 }).hasta);

console.log(`\n${ok} correctos · ${mal} fallidos\n`);
process.exit(mal ? 1 : 0);
