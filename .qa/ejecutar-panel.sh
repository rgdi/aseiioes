#!/bin/sh
# Arranca el panel, ejecuta UN test y lo para. Cada test necesita un servidor
# recién: el bloqueo por IP que prueban deja la dirección restringida un rato,
# así que encadenarlos en el mismo servidor da falsos negativos.
#   .qa/ejecutar-panel.sh seguridad
set -e
cd /workspace
ADMIN_PWD="${ADMIN_PWD:-clave-de-prueba-local-2026}"
test="$1"
pkill -9 -f "scripts/admin.js" 2>/dev/null || true
sleep 1
node scripts/admin.js 4322 > /tmp/panel-servidor.log 2>&1 &
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
  node scripts/admin.js 4322 > /tmp/panel-servidor.log 2>&1 &
  pid=$!
  i=0
  while [ $i -lt 40 ]; do
    if curl -s -o /dev/null --max-time 2 http://127.0.0.1:4322/admin/; then break; fi
    sleep 0.5
    i=$((i + 1))
  done
fi
set +e
ADMIN_PASSWORD="$ADMIN_PWD" node ".qa/$test.mjs" 2>&1 | tail -4
code=$?
kill $pid 2>/dev/null
pkill -9 -f "scripts/admin.js" 2>/dev/null
exit 0
