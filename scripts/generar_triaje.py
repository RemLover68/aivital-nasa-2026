"""Genera los datos de EJEMPLO de la sala de triaje (web/datos/ext/triaje-<AAAA-MM-DD>.json). Determinista.

Los incendios (id, nombre, hora de inicio, lugar, combustible) y el resultado real (superficie final y si se controló el
mismo día) salen del registro público de CONAF (capa incendios_totales). Todo lo demás es INVENTADO con una fórmula simple
y una semilla por incendio: viento, humedad del combustible, pendiente, temperatura, probabilidad de no control, factores,
avance y activos en el camino. Todo va con "ejemplo": true.

La probabilidad usa solo lo que se sabe al inicio del incendio (combustible, hora y los valores inventados). NO usa el
resultado real: así el tablero de acierto no se infla con datos de ejemplo. El contrato está descrito en guia-front-mvp.md §5.

Uso:  python3 scripts/generar_triaje.py [ruta/a/incendios_totales.geojson]
"""
from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
EXT = RAIZ / "web" / "datos" / "ext"
REGISTRO = Path("/aivital/aivital-datos-conaf/2_situacion_y_registros/incendios_totales__0_incendios_totales.geojson")
FECHAS = ["2026-01-16", "2026-01-17", "2026-01-18"]
GENERADO = "2026-11-14T00:00:00Z"
UMBRAL = 0.5

# Aporte de cada tipo de combustible al logit (inventado) y qué tan rápido avanza el fuego en él.
COMBUSTIBLE = {
    "Plantación pino": (0.9, 0.8), "Plantación eucaliptus": (0.9, 0.8), "Otras plantaciones": (0.5, 0.8),
    "Arbolado natural": (0.6, 0.7), "Matorral": (0.3, 1.0), "Pastizal": (-0.2, 1.3),
    "Cultivo agrícola": (-0.6, 1.1), "Desechos": (-0.5, 0.9),
}
# tipo, nombre genérico, personas mínimas y máximas
ACTIVOS = [
    ("vivienda", "Caserío rural", 20, 400), ("escuela", "Escuela rural", 40, 220), ("salud", "Posta de salud rural", 30, 150),
    ("ruta", "Ruta o puente", 0, 0), ("electrico", "Línea de media tensión", 0, 0),
]
PLANTA = ("planta", "Aserradero o planta forestal", 15, 90)


def inicio_hora(f_inicio: str) -> float:
    h, m = f_inicio[11:16].split(":")
    return int(h) + int(m) / 60


def factores(comb: str | None, hora: float, r: random.Random) -> tuple[float, list[dict], dict]:
    """Probabilidad inventada de que el incendio no se controle el día de inicio, con el aporte de cada factor."""
    tarde = math.cos(2 * math.pi * (hora - 16) / 24)            # 1 a las 16 h, -1 a las 4 h
    viento = max(4.0, 14 + 14 * tarde + r.gauss(0, 6))            # km/h, más fuerte en la tarde
    humedad = max(3.0, 11 - 5 * tarde + r.gauss(0, 2.5))          # % del combustible fino muerto, más seco en la tarde
    pendiente = max(0.0, min(55.0, r.gauss(16, 12)))              # %
    temp = 27 + 6 * tarde + r.gauss(0, 2)                         # °C
    base, _ = COMBUSTIBLE.get(comb or "", (0.0, 1.0))
    t = {
        "viento de ladera": 0.06 * (viento * (1 + pendiente / 100) - 20),
        "humedad del combustible fino muerto": 0.12 * (10 - humedad),
        "tipo de combustible": base,
        "hora de inicio": 0.5 * tarde,
        "pendiente": 0.03 * (pendiente - 15),
        "temperatura": 0.07 * (temp - 28),
    }
    p = 1 / (1 + math.exp(-(-1.9 + sum(t.values()))))
    valores = {
        "viento de ladera": f"{viento:.0f} km/h", "humedad del combustible fino muerto": f"{humedad:.0f} %",
        "tipo de combustible": comb or "sin dato", "hora de inicio": f"{int(hora):02d}:{int(round((hora % 1) * 60)):02d}",
        "pendiente": f"{pendiente:.0f} %", "temperatura": f"{temp:.0f} °C",
    }
    suma = sum(abs(v) for v in t.values()) or 1.0
    pct = {k: round(abs(v) / suma * 100) for k, v in t.items()}
    mayor = max(pct, key=pct.get)
    pct[mayor] += 100 - sum(pct.values())                         # el resto del redondeo va al mayor
    fs = [{"nombre": k, "aporte_pct": pct[k], "valor": valores[k]} for k in sorted(t, key=lambda k: -pct[k])]
    return p, fs, {"viento": viento, "pendiente": pendiente}


def avance_y_activos(p: dict, comb: str | None, meteo: dict, r: random.Random) -> tuple[dict, list[dict]]:
    """Cono de avance y activos dentro de él, con tiempo aproximado de llegada. Todo inventado."""
    _, rapidez = COMBUSTIBLE.get(comb or "", (0.0, 1.0))
    v = (0.25 + 0.035 * meteo["viento"] * (1 + meteo["pendiente"] / 60)) * rapidez   # km/h
    dirección = r.uniform(0, 360)
    avance = {"direccion_grados": round(dirección), "radio_km_1h": round(v, 1), "radio_km_3h": round(v * 2.6, 1)}
    tipos = list(ACTIVOS) + ([PLANTA] if comb and comb.startswith(("Plantación", "Otras plantaciones")) else [])
    lat, lon = p["lat"], p["lon"]
    activos = []
    for _ in range(r.randint(2, 5)):
        tipo, nombre, pmin, pmax = r.choice(tipos)
        rumbo = math.radians(dirección + r.uniform(-25, 25))
        dist = r.uniform(0.4, max(1.2, avance["radio_km_3h"] * 1.4))
        activos.append({
            "tipo": tipo, "nombre": nombre,
            "lat": round(lat + dist * math.cos(rumbo) / 111.0, 5),
            "lon": round(lon + dist * math.sin(rumbo) / (111.0 * math.cos(math.radians(lat))), 5),
            "dist_km": round(dist, 1), "eta_h": round(dist / v, 1),
            "personas_est": r.randint(pmin, pmax) if pmax else 0,
        })
    return avance, sorted(activos, key=lambda a: a["eta_h"])


def incendio(props: dict) -> dict:
    r = random.Random("triaje-" + props["id"])
    hora = inicio_hora(props["f_inicio"])
    comb = props.get("comb_inicial") or None
    prob, fs, meteo = factores(comb, hora, r)
    avance, activos = avance_y_activos(props, comb, meteo, r)
    fecha = props["f_inicio"][:10]
    return {
        "id": props["id"], "nombre": props["nombre"].strip(), "comuna": props["comuna"], "region": props["region"],
        "reg_id": f"{int(props['reg_id']):02d}", "lat": round(props["lat"], 5), "lon": round(props["lon"], 5),
        "f_inicio": props["f_inicio"], "comb_inicial": comb, "p_no_control_dia": round(prob, 3),
        "factores": fs, "avance": avance, "activos": activos,
        "real": {"sup_total_ha": props["sup_total"], "controlado_mismo_dia": bool(props["f_control"]) and props["f_control"] == fecha},
    }


def main() -> None:
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else REGISTRO
    props = [f["properties"] for f in json.loads(ruta.read_text(encoding="utf-8"))["features"]]
    for f in EXT.glob("triaje-*.json"):
        f.unlink()
    for fecha in FECHAS:
        lista = [incendio(p) for p in props if (p.get("f_inicio") or "").startswith(fecha) and p.get("lat") is not None]
        lista.sort(key=lambda i: (i["f_inicio"], i["id"]))
        # Prioridad del día completo: de mayor a menor probabilidad, a igual probabilidad el que empezó antes.
        for n, i in enumerate(sorted(lista, key=lambda i: (-i["p_no_control_dia"], i["f_inicio"])), 1):
            i["prioridad"] = n
        cuerpo = {
            "fecha": fecha, "ejemplo": True, "modo": "repeticion", "generado_utc": GENERADO,
            "modelo": {"version": "ejemplo (probabilidad inventada, no es el modelo real)", "umbral": UMBRAL},
            "incendios": lista,
            "acierto": {"auc_pr": None, "base_azar": None, "precision": None, "recall": None, "temporada": "2025-26"},
        }
        (EXT / f"triaje-{fecha}.json").write_text(json.dumps(cuerpo, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(fecha, len(lista), "incendios")


main()
