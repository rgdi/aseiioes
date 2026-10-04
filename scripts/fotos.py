#!/usr/bin/env python3
"""
fotos.py — prepara las imágenes para la web.

    python3 scripts/fotos.py                  → procesa todo assets/fotos/
    python3 scripts/fotos.py ensayo.jpg       → procesa sólo ese fichero
    python3 scripts/fotos.py --ancho 2400     → límite superior (por defecto 2000)

Qué hace con cada foto:
  1. la reescala si es más grande del límite;
  2. crea las versiones -400, -800, -1200 y -1600, que la galería usa solas
     para que el móvil no descargue la versión grande;
  3. dice cuánto se ha ahorrado en cada una.

Necesita Pillow:   pip3 install Pillow
"""
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOS = os.path.join(RAIZ, "assets", "fotos")
VERSIONES = [400, 800, 1200, 1600]

try:
    from PIL import Image
except ImportError:
    print("\n✗ Falta Pillow. Instálalo con:\n\n    pip3 install Pillow\n")
    sys.exit(1)

args = sys.argv[1:]
limite = 2000
if "--ancho" in args:
    i = args.index("--ancho")
    limite = int(args[i + 1])
    del args[i:i + 2]
pedidos = [a for a in args if not a.startswith("--")]


def peso(n):
    if n < 1024:
        return f"{n} B"
    if n < 1048576:
        return f"{n / 1024:.0f} KB"
    return f"{n / 1048576:.1f} MB"


def procesar(ruta):
    rel = os.path.relpath(ruta, RAIZ)
    antes = os.path.getsize(ruta)
    try:
        im = Image.open(ruta)
    except Exception as e:
        print(f"  ✗ {rel}: no se puede abrir como imagen ({e})")
        return False

    w0, h0 = im.size
    jpg = ruta.lower().endswith((".jpg", ".jpeg"))

    if w0 > limite:
        im = im.resize((limite, round(h0 * limite / w0)), Image.LANCZOS)

    if jpg:
        im.convert("RGB").save(ruta, quality=88, progressive=True, optimize=True)
    else:
        im.save(ruta, optimize=True)

    print(f"  {rel}  {w0}×{h0}  {peso(antes)}")
    for v in VERSIONES:
        if v >= im.width:
            continue
        salida = re.sub(r"\.(jpe?g|png)$", f"-{v}.jpg", ruta, flags=re.I)
        im.resize((v, round(im.height * v / im.width)), Image.LANCZOS).convert("RGB").save(
            salida, quality=85, progressive=True, optimize=True
        )
        print(f"     └ {os.path.basename(salida)}  {peso(os.path.getsize(salida))}")
    return True


import re  # se usa dentro de procesar()

if not os.path.isdir(FOTOS):
    print(f"\nNo existe la carpeta {os.path.relpath(FOTOS, RAIZ)}/.\n")
    print("Créala y copia dentro las imágenes que quieras publicar:")
    print("    assets/fotos/encuentro-2026.jpg\n")
    sys.exit(0)

def todas(d):
    """Recorre también las subcarpetas: lo normal es agrupar por año o evento."""
    for raiz, _, ficheros in os.walk(d):
        for f in sorted(ficheros):
            if f.lower().endswith((".jpg", ".jpeg", ".png")):
                yield os.path.join(raiz, f)


objetivo = (
    [os.path.join(FOTOS, a if os.path.isabs(a) else os.path.join(FOTOS, a)) for a in pedidos]
    if pedidos
    else sorted(todas(FOTOS))
)
# Las versiones que genera este script no se reprocesan.
objetivo = [f for f in objetivo if not any(f.endswith(f"-{v}.jpg") for v in VERSIONES)]

if not objetivo:
    print(f"\nNo hay fotos nuevas en {os.path.relpath(FOTOS, RAIZ)}/.\n")
    sys.exit(0)

print(f"\n▸ Procesando {len(objetivo)} {'foto' if len(objetivo) == 1 else 'fotos'} (límite {limite} px)\n")
n = sum(1 for f in objetivo if procesar(f))

print(f"\n{n} {'foto lista' if n == 1 else 'fotos listas'}.\n")
print("Ahora copia el nombre en content/galeria.json o en un artículo:\n")
print('    "src": "/assets/fotos/encuentro-2026.jpg",')
print('    "alt": "Descripción de lo que se ve — obligatorio",\n')
print("Y reconstruye:\n\n    node scripts/build.js\n")
