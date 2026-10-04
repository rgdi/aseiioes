#!/bin/sh
# Arranca el panel en modo "sólo panel" (la web la sirve nginx/FastPanel) y
# ejecuta la auditoría de seguridad contra él. Necesario porque este modo
# cambia el ruteo y hay que comprobarlo por separado.
#   ADMIN_PWD='una-clave-de-prueba-larga' sh .qa/ejecutar-panel-solo.sh security
set -e
cd /workspace
ADMIN_PWD="${ADMIN_PWD:-clave-de-prueba-local-2026}"
test="$1"
pkill -9 -f "scripts/admin.js" 2>/dev/null || true
sleep 1
SOLO_PANEL=1 node scripts/admin.js 4322 > /tmp/panel-solo.log 2>&1 &
pid=$!
i=0
while [ $i -lt 40 ]; do
  if curl -s -o /dev/null --max-time 2 http://127.0.0.1:4322/admin/; then break; fi
  sleep 0.5
  i=$((i + 1))
done
if [ ! -f .admin-clave.json ]; then
  ADMIN_PASSWORD="$ADMIN_PWD" node scripts/admin.js --nueva-clave > /dev/null
  kill $pid 2>/dev/null || true
  sleep 1
  SOLO_PANEL=1 node scripts/admin.js 4322 > /tmp/panel-solo.log 2>&1 &
  pid=$!
  i=0
  while [ $i -lt 40 ]; do
    if curl -s -o /dev/null --max-time 2 http://127.0.0.1:4322/admin/; then break; fi
    sleep 0.5
    i=$((i + 1))
  done
fi
set +e
SOLO_PANEL=1 ADMIN_PASSWORD="$ADMIN_PWD" node ".qa/$test.mjs" 2>&1 | tail -3
kill $pid 2>/dev/null
pkill -9 -f "scripts/admin.js" 2>/dev/null
exit 0
