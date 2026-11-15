"""Deja en web/datos/ext/contornos-chile.geojson una copia liviana de los contornos comunales del back.

Es el respaldo del mapa de Chile cuando el back no responde. Redondea a 3 decimales (unos 100 m) y quita puntos repetidos.
Uso:  python3 scripts/preparar_contornos.py [ruta o URL de regiones.geojson]
Por defecto baja https://marcelo-corro.github.io/aivital-incendios-datos/regiones.geojson (solo lectura).
"""
import json
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ORIGEN = sys.argv[1] if len(sys.argv) > 1 else "https://marcelo-corro.github.io/aivital-incendios-datos/regiones.geojson"


def anillo(a):
    out = []
    for x, y in a:
        p = [round(x, 3), round(y, 3)]
        if not out or out[-1] != p:
            out.append(p)
    return out if len(out) >= 4 else None


def main():
    if ORIGEN.startswith("http"):
        with urllib.request.urlopen(ORIGEN, timeout=60) as r:
            g = json.load(r)
    else:
        g = json.load(open(ORIGEN, encoding="utf-8"))
    for f in g["features"]:
        geo = f["geometry"]
        polis = [geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"]
        nuevos = []
        for pol in polis:
            anillos = [anillo(a) for a in pol]
            if anillos[0]:
                nuevos.append([a for a in anillos if a])
        f["geometry"] = {"type": "Polygon", "coordinates": nuevos[0]} if len(nuevos) == 1 else {"type": "MultiPolygon", "coordinates": nuevos}
    salida = RAIZ / "web" / "datos" / "ext" / "contornos-chile.geojson"
    salida.write_text(json.dumps(g, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(len(g["features"]), "comunas,", salida.stat().st_size // 1024, "KB")


main()
