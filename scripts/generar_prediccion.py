"""Genera los datos de EJEMPLO del contrato de predicción (web/datos/ext/prediccion-*.json). Determinista.

  prediccion-chile-<rango>.json            riesgo de las 345 comunas en el periodo
  prediccion-comuna-<codigo>-<rango>.json  grilla, tamaño, causas y recomendaciones (solo las 26 comunas de la maqueta)

Todo lleva "ejemplo": true. Ningún número sale del modelo de ML: se inventan con una fórmula simple y una semilla por comuna,
para que el front tenga con qué mostrarse hasta que el back publique lo real. El contrato está en web/datos/ext/CONTRATO.md.
Lee web/datos/ext/contornos-chile.geojson (ver scripts/preparar_contornos.py) y web/datos/manifest.json.

Uso (solo biblioteca estándar):  python3 scripts/generar_prediccion.py
"""
from __future__ import annotations

import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
EXT = RAIZ / "web" / "datos" / "ext"
HOY = date(2026, 11, 14)
GENERADO = "2026-11-14T03:00:00Z"
VERSION = "1.0"

# Rangos fijos. Cada uno cubre un periodo de fechas (el back decide las fechas; aquí son estas).
RANGOS = [
    ("esta-semana", "Esta semana", HOY, HOY + timedelta(days=6)),
    ("proxima-semana", "Próxima semana", HOY + timedelta(days=7), HOY + timedelta(days=13)),
    ("dentro-2-semanas", "Dentro de 2 semanas", HOY + timedelta(days=14), HOY + timedelta(days=20)),
    ("este-mes", "Este mes", HOY, date(2026, 11, 30)),
    ("proximo-mes", "Próximo mes", date(2026, 12, 1), date(2026, 12, 31)),
]
ESTACION = [1.0, 1.2, 0.9, 0.5, 0.2, 0.1, 0.05, 0.1, 0.2, 0.4, 0.6, 0.9]  # por mes, como en la maqueta anterior

# Causas: id, nombre, modificable por el municipio, peso base (%)
CAUSAS = [
    ("pasto", "Pasto y vegetación seca (combustible)", True, 22),
    ("interfaz", "Viviendas pegadas a la vegetación (interfaz)", True, 8),
    ("basurales", "Basurales y escombros", True, 6),
    ("quemas", "Quemas agrícolas y de residuos", True, 9),
    ("temperatura", "Temperatura", False, 14),
    ("sequia", "Sequía (déficit de lluvia y humedad)", False, 13),
    ("viento", "Viento", False, 10),
    ("caminos", "Cercanía a caminos y población", False, 10),
    ("relieve", "Relieve (pendiente)", False, 8),
]
# Acciones: id, nombre, causa que reduce, eficacia (fracción de esa causa que se elimina), costo CLP por hectárea tratada, fracción del suelo que se trata
ACCIONES = [
    ("cortafuegos", "Cortafuegos y limpieza de pasto en los bordes", "pasto", 0.55, 900_000, 0.00024),
    ("faja", "Faja de seguridad entre viviendas y vegetación", "interfaz", 0.60, 1_400_000, 0.00008),
    ("basurales", "Limpieza de basurales y escombros", "basurales", 0.70, 2_200_000, 0.00003),
    ("quemas", "Fiscalización de quemas y campañas de aviso", "quemas", 0.45, 350_000, 0.0004),
]
SUPUESTOS = {
    "vsl_clp": 1_500_000_000,
    "valor_propiedad_ha_clp": 15_000_000,
    "costo_combate_ha_clp": 2_500_000,
}


def escribir(ruta: Path, datos) -> None:
    ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def en_poligono(x: float, y: float, anillos: list) -> bool:
    """Punto dentro de un polígono (primer anillo menos los huecos), por trazado de rayo."""
    def dentro(anillo):
        c = False
        j = len(anillo) - 1
        for i in range(len(anillo)):
            xi, yi = anillo[i]
            xj, yj = anillo[j]
            if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
                c = not c
            j = i
        return c
    return dentro(anillos[0]) and not any(dentro(h) for h in anillos[1:])


def poligonos(geo: dict) -> list:
    return [geo["coordinates"]] if geo["type"] == "Polygon" else geo["coordinates"]


def area_km2(polis: list) -> float:
    total = 0.0
    for pol in polis:
        a = pol[0]
        lat = sum(p[1] for p in a) / len(a)
        k = math.cos(math.radians(lat)) * 111.0
        s = sum(a[i][0] * a[(i + 1) % len(a)][1] - a[(i + 1) % len(a)][0] * a[i][1] for i in range(len(a)))
        total += abs(s) / 2 * k * 111.0
    return total


def reparto(pesos: list[float], total: float = 100.0, dec: int = 1) -> list[float]:
    """Normaliza a `total` con `dec` decimales, y el resto de redondeo va al mayor."""
    s = sum(pesos)
    r = [round(p / s * total, dec) for p in pesos]
    r[r.index(max(r))] = round(r[r.index(max(r))] + total - sum(r), dec)
    return r


def factor_periodo(desde: date, hasta: date) -> tuple[float, int]:
    dias = (hasta - desde).days + 1
    f = sum(ESTACION[(desde + timedelta(days=i)).month - 1] for i in range(dias)) / dias
    return f, dias


def cargar_comunas() -> list[dict]:
    g = json.loads((EXT / "contornos-chile.geojson").read_text(encoding="utf-8"))
    comunas = []
    for f in g["features"]:
        polis = poligonos(f["geometry"])
        xs = [p[0] for pol in polis for p in pol[0]]
        ys = [p[1] for pol in polis for p in pol[0]]
        rid = f["properties"]["region_id"]
        r = random.Random("comuna-" + rid)
        lat = (min(ys) + max(ys)) / 2
        # El riesgo de ejemplo se concentra en la zona centro-sur (Valparaíso al Biobío), donde se concentran los incendios.
        zona = math.exp(-(((lat + 35.5) / 4.2) ** 2))
        comunas.append({
            "id": rid, "nombre": f["properties"]["nombre"], "region": f["properties"]["region"],
            "bbox": [min(xs), min(ys), max(xs), max(ys)], "polis": polis, "lat": lat,
            "area": max(area_km2(polis), 1.0),
            "sesgo": min(1.0, 0.06 + 0.9 * zona * r.uniform(0.55, 1.15)),
            "pob": int(4000 * math.exp(r.gauss(0, 1.3)) * (1 + 3 * (r.random() < 0.08))),
        })
    return comunas


def pesos_causas(c: dict) -> list[float]:
    r = random.Random("causas-" + c["id"])
    return [base * math.exp(r.gauss(0, 0.35)) * (1.3 if cid == "pasto" and c["sesgo"] > 0.6 else 1.0) for cid, _n, _m, base in CAUSAS]


def grilla(c: dict) -> dict:
    """Celdas de 8x8 a 12x12 según el tamaño de la comuna; solo las que tocan la comuna."""
    w, s, e, n = c["bbox"]
    k = math.cos(math.radians(c["lat"]))
    ancho, alto = (e - w) * k, n - s
    lado = 8 if c["area"] < 150 else 10 if c["area"] < 700 else 12
    if ancho >= alto:
        cols, filas = lado, max(5, round(lado * alto / ancho))
    else:
        filas, cols = lado, max(5, round(lado * ancho / alto))
    dx, dy = (e - w) / cols, (n - s) / filas
    celdas = []
    for f in range(filas):
        for col in range(cols):
            x0, y1 = w + col * dx, n - f * dy
            pts = [(x0 + dx * a, y1 - dy * b) for a, b in ((.5, .5), (.2, .2), (.8, .2), (.2, .8), (.8, .8))]
            if any(en_poligono(px, py, pol) for px, py in pts for pol in c["polis"]):
                celdas.append((f, col, x0 + dx / 2, y1 - dy / 2))
    return {"bbox": [round(w, 4), round(s, 4), round(e, 4), round(n, 4)], "filas": filas, "columnas": cols, "celdas": celdas,
            "area_celda_ha": c["area"] * 100 / (filas * cols)}


def focos_calientes(c: dict, celdas: list) -> list[float]:
    """Peso relativo de cada celda: 2 o 3 focos de concentración fijos por comuna (no cambian con el rango)."""
    r = random.Random("focos-" + c["id"])
    w, s, e, n = c["bbox"]
    focos = [(r.uniform(w, e), r.uniform(s, n), r.uniform(0.08, 0.22) * max(e - w, n - s), r.uniform(0.6, 1.4)) for _ in range(r.choice((2, 3)))]
    pesos = []
    for _f, _c, x, y in celdas:
        v = 0.08 + r.uniform(0, 0.06)
        for fx, fy, sg, a in focos:
            v += a * math.exp(-(((x - fx) / sg) ** 2 + ((y - fy) / sg) ** 2) / 2)
        pesos.append(v)
    return pesos


def recomendaciones(p: float, causas_pct: list[float], area_ha: float) -> list[tuple[float, float]]:
    """Por acción: (reducción en puntos porcentuales, costo CLP). Solo actúan sobre causas modificables."""
    ids = [c[0] for c in CAUSAS]
    out = []
    for _aid, _n, causa, efic, costo_ha, fr in ACCIONES:
        share = causas_pct[ids.index(causa)] / 100
        red = p * 100 * share * efic
        costo = area_ha * fr * (0.5 + share * 2) * costo_ha
        out.append((round(red, 2), int(round(costo, -3))))
    return out


def predecir(c: dict, rango: tuple, g: dict, pesos_celda: list[float]) -> tuple[dict, float, float]:
    _rid, _nombre, desde, hasta = rango
    fper, dias = factor_periodo(desde, hasta)
    lam = 0.045 * c["sesgo"] * (c["area"] / 400) ** 0.35 * fper * dias
    p = min(0.97, 1 - math.exp(-lam))
    r = random.Random(f"datos-{c['id']}-{rango[0]}")
    pesos = pesos_causas(c)
    # La temperatura y la sequía pesan más en diciembre; el viento, en periodos cortos.
    pesos[4] *= 1 + 0.25 * (desde.month == 12)
    pesos[5] *= 1 + 0.20 * (desde.month == 12)
    pesos = [x * r.uniform(0.95, 1.05) for x in pesos]
    pct = reparto(pesos)
    por_id = {cid: v for (cid, *_), v in zip(CAUSAS, pct)}
    ha = 5.0 * (0.5 + por_id["pasto"] / 22) * (0.6 + por_id["viento"] / 10) * (0.6 + por_id["relieve"] / 8) * (c["area"] / 400) ** 0.2
    expuestos = int(c["pob"] * por_id["interfaz"] / 100 * 3)
    vidas = expuestos * 1e-5
    area_ha = c["area"] * 100
    s = sum(pesos_celda)
    n = len(pesos_celda)
    lam_c = -math.log(1 - p)
    celdas = []
    for (f, col, _x, _y), w in zip(g["celdas"], pesos_celda):
        pc = 1 - math.exp(-lam_c * w / s)
        # La concentración de causas cambia un poco entre celdas, sin salir de lo plausible.
        rc = random.Random(f"celda-{c['id']}-{f}-{col}")
        cc = reparto([x * rc.uniform(0.6, 1.5) * (1 + 0.5 * (w / s * n - 1)) ** (1 if cid == "pasto" else 0) for x, (cid, *_r) in zip(pesos, CAUSAS)])
        fh = (w / s * n) ** 0.5
        hac = ha * fh
        celdas.append({
            "f": f, "c": col, "p": round(pc, 4),
            "ha": [round(hac * 0.25, 1), round(hac, 1), round(hac * 3.2, 1)],
            "ex": int(expuestos / n * (0.5 + rc.random())),
            "ca": cc,
            "rc": [list(x) for x in recomendaciones(pc, cc, g["area_celda_ha"])],
        })
    cuerpo = {
        "contrato": "prediccion-1.0", "ejemplo": True, "generado_utc": GENERADO, "modelo": "ejemplo (números inventados, no del modelo)",
        "rango": rango[0], "periodo": {"desde": desde.isoformat(), "hasta": hasta.isoformat()},
        "comuna": {"region_id": c["id"], "nombre": c["nombre"], "region": c["region"]},
        "catalogo": {
            "causas": [{"id": i, "nombre": nm, "modificable": m} for i, nm, m, _b in CAUSAS],
            "acciones": [{"id": i, "nombre": nm, "causa": ca} for i, nm, ca, *_r in ACCIONES],
        },
        "resumen": {
            "prob": round(p, 3), "ha": [round(ha * 0.25, 1), round(ha, 1), round(ha * 3.2, 1)],
            "personas_expuestas": expuestos, "vidas_si_incendio": round(vidas, 4),
            "causas": [{"id": cid, "pct": v} for (cid, *_), v in zip(CAUSAS, pct)],
            "recomendaciones": [{"accion": a[0], "reduccion_pp": rd, "costo_clp": cs}
                                for a, (rd, cs) in zip(ACCIONES, recomendaciones(p, pct, area_ha))],
        },
        "supuestos_sugeridos": SUPUESTOS,
        "grilla": {"bbox": g["bbox"], "filas": g["filas"], "columnas": g["columnas"],
                   "nota": "f=0 es la fila del norte, c=0 la columna del oeste. ha=[p10, esperado, p90]. ca y rc siguen el orden de catalogo.causas y catalogo.acciones; rc=[reduccion_pp, costo_clp].",
                   "celdas": celdas},
    }
    return cuerpo, p, ha


def main() -> None:
    comunas = cargar_comunas()
    detalle = set(json.loads((RAIZ / "web" / "datos" / "manifest.json").read_text())["regiones"])
    for f in EXT.glob("prediccion-*.json"):
        f.unlink()
    grillas = {}
    for c in comunas:
        if c["id"] in detalle:
            g = grilla(c)
            grillas[c["id"]] = (g, focos_calientes(c, g["celdas"]))
    n = 0
    for rango in RANGOS:
        items = []
        for c in comunas:
            if c["id"] in grillas:
                g, pesos = grillas[c["id"]]
                cuerpo, p, ha = predecir(c, rango, g, pesos)
                escribir(EXT / f"prediccion-comuna-{c['id']}-{rango[0]}.json", cuerpo)
                n += 1
                items.append({"region_id": c["id"], "p": round(p, 3), "ha": round(ha, 1), "detalle": True})
            else:
                # Sin detalle: riesgo calculado simple, con la misma fórmula.
                fper, dias = factor_periodo(rango[2], rango[3])
                lam = 0.045 * c["sesgo"] * (c["area"] / 400) ** 0.35 * fper * dias
                items.append({"region_id": c["id"], "p": round(min(0.97, 1 - math.exp(-lam)), 3), "ha": round(4 * (c["area"] / 400) ** 0.2, 1)})
        escribir(EXT / f"prediccion-chile-{rango[0]}.json", {
            "contrato": "prediccion-1.0", "ejemplo": True, "generado_utc": GENERADO, "modelo": "ejemplo (números inventados, no del modelo)",
            "rango": rango[0], "periodo": {"desde": rango[2].isoformat(), "hasta": rango[3].isoformat()}, "items": items})
    escribir(EXT / "prediccion-rangos.json", {
        "contrato": "prediccion-1.0", "ejemplo": True,
        "rangos": [{"id": i, "nombre": nm, "desde": d.isoformat(), "hasta": h.isoformat()} for i, nm, d, h in RANGOS],
        "supuestos_sugeridos": SUPUESTOS})
    print(f"{len(comunas)} comunas, {len(grillas)} con detalle, {n} archivos de comuna")


main()
