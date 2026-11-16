"""Genera los datos SINTÉTICOS del mockup (web/datos/). Todos llevan "ejemplo": true.

Dos grupos de archivos:
  1. Contrato 0.2 del back (misma forma que publica
     https://marcelo-corro.github.io/hackaton-nasa-2026-datos):
     manifest.json, regiones.geojson, riesgo/ultimo.json, calendario/{id}.json
     (con mediana_historica), focos/{id}.csv, metricas.json
  2. Extensión propuesta, que TODAVÍA NO está en el contrato (web/datos/ext/):
     pronostico.json (con interfaz, presión de ignición, aporte por familia de datos
     y lo que dicen las fuentes externas), contraste.json, puntos.json,
     protocolos.json, registro.json

Nada de esto es un dato real. Los códigos de comuna (CUT) y las coordenadas se
escribieron de memoria y hay que verificarlos antes de usarlos con datos reales.
Los contornos son hexágonos alrededor de un punto central, no límites oficiales.

Uso (solo biblioteca estándar):
    python3 scripts/generar_datos_sinteticos.py
"""

from __future__ import annotations

import csv
import json
import math
import random
import statistics
from datetime import date, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
SALIDA = RAIZ / "web" / "datos"
CONTRATO = "0.2"
HOY = date(2026, 11, 14)
GENERADO = "2026-11-14T03:00:00Z"
rng = random.Random(8)

# region_id (CUT), nombre, región, lat, lon, población aprox., sesgo de riesgo (0-1)
COMUNAS = [
    ("05101", "Valparaíso", "Valparaíso", -33.05, -71.62, 296000, 0.75),
    ("05109", "Viña del Mar", "Valparaíso", -33.02, -71.52, 334000, 0.80),
    ("05801", "Quilpué", "Valparaíso", -33.06, -71.42, 152000, 0.85),
    ("05804", "Villa Alemana", "Valparaíso", -33.04, -71.33, 127000, 0.70),
    ("05102", "Casablanca", "Valparaíso", -33.32, -71.41, 27000, 0.65),
    ("05601", "San Antonio", "Valparaíso", -33.59, -71.61, 92000, 0.45),
    ("05501", "Quillota", "Valparaíso", -32.88, -71.25, 91000, 0.50),
    ("05802", "Limache", "Valparaíso", -33.01, -71.24, 46000, 0.60),
    ("13501", "Melipilla", "Metropolitana", -33.69, -71.21, 124000, 0.55),
    ("13503", "Curacaví", "Metropolitana", -33.40, -71.13, 33000, 0.60),
    ("06101", "Rancagua", "O'Higgins", -34.17, -70.74, 241000, 0.30),
    ("06201", "Pichilemu", "O'Higgins", -34.39, -72.00, 17000, 0.55),
    ("06204", "Marchigüe", "O'Higgins", -34.40, -71.61, 7500, 0.70),
    ("06205", "Navidad", "O'Higgins", -33.95, -71.83, 6800, 0.65),
    ("07301", "Curicó", "Maule", -34.98, -71.24, 149000, 0.35),
    ("07101", "Talca", "Maule", -35.43, -71.66, 220000, 0.35),
    ("07102", "Constitución", "Maule", -35.33, -72.41, 46000, 0.75),
    ("07201", "Cauquenes", "Maule", -35.97, -72.32, 41000, 0.65),
    ("16101", "Chillán", "Ñuble", -36.61, -72.10, 185000, 0.45),
    ("16201", "Quirihue", "Ñuble", -36.28, -72.54, 12000, 0.70),
    ("08111", "Tomé", "Biobío", -36.62, -72.96, 55000, 0.75),
    ("08101", "Concepción", "Biobío", -36.83, -73.05, 223000, 0.55),
    ("08109", "Santa Juana", "Biobío", -37.17, -72.94, 14000, 0.90),
    ("08306", "Nacimiento", "Biobío", -37.50, -72.67, 26000, 0.80),
    ("08301", "Los Ángeles", "Biobío", -37.47, -72.35, 202000, 0.50),
    ("08202", "Arauco", "Biobío", -37.25, -73.32, 36000, 0.70),
]

ESTACIONALIDAD = [1.0, 1.2, 0.9, 0.5, 0.2, 0.1, 0.05, 0.1, 0.2, 0.4, 0.6, 0.9]


def escribir(ruta: Path, datos) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def hexagono(lat: float, lon: float, r: float = 0.042) -> list:
    k = 1 / math.cos(math.radians(lat))  # compensa que un grado de longitud mide menos
    pts = [[round(lon + r * k * math.cos(math.radians(a)), 4), round(lat + r * math.sin(math.radians(a)), 4)]
           for a in range(0, 360, 60)]
    return [pts + [pts[0]]]


def nivel_riesgo(p: float) -> str:
    return "muy_alto" if p >= 0.30 else "alto" if p >= 0.18 else "medio" if p >= 0.08 else "bajo"


def nivel_calendario(p: float) -> str:
    return "extrema" if p >= 95 else "alta" if p >= 75 else "normal" if p >= 25 else "baja"


# ---------- 1. Archivos del contrato 0.2 ----------

def gen_regiones() -> None:
    feats = [{"type": "Feature",
              "properties": {"region_id": c[0], "nombre": c[1], "region": c[2], "pais": "CL"},
              "geometry": {"type": "Polygon", "coordinates": hexagono(c[3], c[4])}} for c in COMUNAS]
    escribir(SALIDA / "regiones.geojson", {"type": "FeatureCollection", "features": feats})


def gen_calendario() -> None:
    for cid, nombre, *_r, sesgo in COMUNAS:
        registros = []
        por_mes: dict[int, list[float]] = {m: [] for m in range(1, 13)}
        crudos = []
        for anio in range(2000, 2026):
            for mes in range(1, 13):
                if anio == 2000 and mes < 11:
                    continue
                base = rng.gammavariate(2.0, 4.0) * ESTACIONALIDAD[mes - 1] * (0.4 + sesgo)
                if anio in (2017, 2023) and mes in (1, 2):
                    base *= 3.5
                if anio == 2024 and mes == 2 and cid.startswith("05"):
                    base *= 4
                crudos.append((anio, mes, base))
                por_mes[mes].append(base)
        arm_por_mes: dict[int, list[float]] = {m: [] for m in range(1, 13)}
        filas = []
        for anio, mes, base in crudos:
            modis = int(round(base))
            viirs = max(int(round(base * 3.4 + rng.gauss(0, 1))), 0) if anio >= 2012 else None
            arm = round(base * rng.uniform(0.94, 1.06), 1)
            arm_por_mes[mes].append(arm)
            filas.append((anio, mes, base, modis, viirs, arm))
        for anio, mes, base, modis, viirs, arm in filas:
            serie = sorted(por_mes[mes])
            pct = round(100 * sum(1 for v in serie if v <= base) / len(serie))
            registros.append({"anio": anio, "mes": mes, "modis": modis, "viirs": viirs, "armonizado": arm,
                              "armonizado_p05": round(arm * 0.86, 1), "armonizado_p95": round(arm * 1.15, 1),
                              "mediana_historica": round(statistics.median(arm_por_mes[mes]), 1),
                              "percentil": pct, "nivel": nivel_calendario(pct)})
        escribir(SALIDA / "calendario" / f"{cid}.json", {
            "contrato": CONTRATO, "ejemplo": True, "region_id": cid, "nombre": nombre,
            "unidad": "focos de vegetación (tipo 0) por mes", "unidad_armonizada": "equivalente MODIS",
            "metodo_armonizacion": "ejemplo (números inventados)", "registros": registros})


def gen_focos() -> None:
    sats = [("MODIS", "Terra"), ("MODIS", "Aqua"), ("VIIRS", "SNPP"), ("VIIRS", "NOAA20"), ("VIIRS", "NOAA21")]
    for cid, _n, _r, lat, lon, _p, sesgo in COMUNAS:
        ruta = SALIDA / "focos" / f"{cid}.csv"
        ruta.parent.mkdir(parents=True, exist_ok=True)
        with ruta.open("w", newline="", encoding="utf-8") as f:
            w = csv.writer(f)
            w.writerow(["fecha", "hora_utc", "lat", "lon", "sensor", "satelite", "confianza", "frp", "tipo"])
            for _ in range(int(6 + 30 * sesgo)):
                d = HOY - timedelta(days=rng.randint(0, 20))
                sensor, sat = rng.choice(sats)
                w.writerow([d.isoformat(), f"{rng.choice([3, 6, 15, 18]):02d}{rng.choice([0, 15, 30, 45]):02d}",
                            round(lat + rng.uniform(-0.07, 0.07), 4), round(lon + rng.uniform(-0.07, 0.07), 4),
                            sensor, sat, rng.choice(["baja", "nominal", "nominal", "alta"]),
                            round(rng.uniform(4, 60), 1), 0])


# ---------- 2. Extensión propuesta (no está en el contrato 0.2) ----------

def aporte_familias(empuje: float, sesgo: float, ignicion: dict) -> dict:
    """Cuánto del riesgo del día viene de cada familia de datos (suma 1)."""
    clima = 0.25 + 0.5 * empuje
    combustible = 0.2 + 0.35 * sesgo
    igniciones = 0.15 + 0.4 * (ignicion["lineas"] + ignicion["caminos"] + ignicion["edificaciones"]) / 3
    total = clima + combustible + igniciones
    c, f = round(clima / total, 2), round(combustible / total, 2)
    return {"clima": c, "combustible": f, "igniciones": round(1 - c - f, 2)}


def externas(prob: float) -> dict:
    """Lo que dirían ese día las fuentes públicas, con el mismo ruido para ambas (no hay ganador puesto a mano)."""
    p_gwis = max(0.01, prob + rng.uniform(-0.09, 0.09))
    return {"gwis": nivel_riesgo(p_gwis), "boton_rojo": prob + rng.uniform(-0.08, 0.08) >= 0.3}


def gen_contraste() -> None:
    """Últimos 14 días: qué dijo cada fuente el día antes y cuántos focos vio el satélite.

    El motor y GWIS llevan el mismo ruido: la maqueta no fabrica una ventaja para nadie.
    """
    items = []
    for cid, nombre, _r, _lat, _lon, _p, sesgo in COMUNAS:
        dias = []
        for k in range(14, 0, -1):
            verdad = max(0.01, sesgo * rng.uniform(0.1, 0.75) * 0.5)
            focos = 0 if rng.random() > verdad * 2.2 else rng.randint(1, 3 + int(20 * verdad))
            dias.append({"fecha": (HOY - timedelta(days=k)).isoformat(),
                         "motor": nivel_riesgo(max(0.01, verdad + rng.uniform(-0.1, 0.1))),
                         "gwis": nivel_riesgo(max(0.01, verdad + rng.uniform(-0.1, 0.1))),
                         "boton_rojo": verdad + rng.uniform(-0.1, 0.1) >= 0.3,
                         "focos_observados": focos})
        items.append({"region_id": cid, "nombre": nombre, "dias": dias})
    escribir(SALIDA / "ext" / "contraste.json", {
        "extension": "propuesta, no está en el contrato 0.2", "ejemplo": True,
        "nota": "Números inventados. La comparación real es la prueba 0 del plan de validación.",
        "fuentes": {"motor": "Motor propio", "gwis": "GWIS, peligro por clima", "boton_rojo": "CONAF, Botón Rojo",
                    "focos_observados": "NASA FIRMS, focos vistos ese día"},
        "items": items})


def gen_pronostico() -> dict:
    """Cinco días por comuna: foco, humo y salud.

    Días 1 y 2: probabilidad de foco del motor propio. Días 3 a 5: tendencia de
    fuentes externas (peligro por clima). Humo: capa tipo Copernicus corregida con
    estaciones. Salud: alza de urgencias respiratorias con el coeficiente del
    metaanálisis (0,36 % por cada 1 µg/m³ de PM2,5 de humo, mismo día).
    """
    # un "frente" de calor y viento que pasa de norte a sur durante la semana
    ola = [0.8, 1.0, 0.85, 0.6, 0.4]
    items = []
    for cid, nombre, region, lat, lon, pob, sesgo in COMUNAS:
        fase = (lat + 33.0) / -4.5  # 0 en Valparaíso, 1 en Biobío
        # Parte de la comuna donde se juntan casas y vegetación (interfaz urbano-forestal).
        interfaz = round(min(0.95, max(0.05, 0.12 + 0.55 * sesgo * rng.uniform(0.7, 1.2) + min(pob, 300000) / 1.5e6)), 2)
        # Presión de ignición humana: cercanía a líneas eléctricas, caminos y edificaciones (0 a 1).
        ignicion = {"lineas": round(min(1, max(0.05, sesgo * rng.uniform(0.5, 1.1))), 2),
                    "caminos": round(min(1, max(0.05, 0.3 + min(pob, 250000) / 400000 + rng.uniform(-0.1, 0.1))), 2),
                    "edificaciones": round(min(1, interfaz * rng.uniform(0.85, 1.15)), 2)}
        dias = []
        for i in range(5):
            idx = i - round(fase * 2)
            empuje = ola[idx] if 0 <= idx < 5 else 0.42
            prob = max(0.01, min(0.62, sesgo * empuje * 0.47 + rng.uniform(-0.03, 0.03)))
            humo = round(min(max(2.0, prob * 300 * rng.uniform(0.55, 1.1) - 14), 140), 1)
            base_urg = max(4, round(pob / 100000 * 22))
            extra_pct = round(min(humo * 0.36, 45), 1)
            dias.append({
                "fecha": (HOY + timedelta(days=i + 1)).isoformat(),
                "dia": i + 1,
                "fuente_foco": "motor" if i < 2 else "externa",
                "prob_foco": round(prob, 3),
                "nivel": nivel_riesgo(prob),
                "confianza": "alta" if i == 0 else "media" if i < 3 else "baja",
                "pm25_humo": humo,
                "urgencias_resp_base": base_urg,
                "urgencias_resp_extra_pct": extra_pct,
                "urgencias_resp_extra": round(base_urg * extra_pct / 100, 1),
                "aporte": aporte_familias(empuje, sesgo, ignicion),
                "externas": externas(prob),
            })
        items.append({"region_id": cid, "nombre": nombre, "region": region, "lat": lat, "lon": lon,
                      "poblacion": pob, "interfaz": interfaz, "ignicion": ignicion, "dias": dias})
    datos = {"extension": "propuesta, no está en el contrato 0.2", "ejemplo": True, "calculado_utc": GENERADO,
             "nota": "Días 1 y 2 vienen del motor propio. Días 3 a 5 son tendencia de fuentes externas.",
             "coef_salud_pct_por_ug": 0.36, "items": items}
    escribir(SALIDA / "ext" / "pronostico.json", datos)
    return datos


def gen_riesgo(pron: dict) -> None:
    items = [{"region_id": it["region_id"], "prob_foco": it["dias"][0]["prob_foco"],
              "percentil": min(99, round(40 + it["dias"][0]["prob_foco"] * 130)),
              "nivel": it["dias"][0]["nivel"]} for it in pron["items"]]
    escribir(SALIDA / "riesgo" / "ultimo.json", {
        "contrato": CONTRATO, "ejemplo": True, "calculado_utc": GENERADO,
        "valido_para": (HOY + timedelta(days=1)).isoformat(), "horizonte_horas": 24,
        "modelo": "ejemplo (números inventados)", "items": items})


TIPOS = {
    "faena": ("Centro de trabajo", ["Packing", "Faena forestal", "Viña", "Obra", "Aserradero", "Fundo"]),
    "salud": ("Centro de salud", ["CESFAM", "Posta rural", "SAPU"]),
    "eleam": ("Residencia de mayores", ["Residencia"]),
    "colegio": ("Colegio", ["Escuela", "Liceo"]),
}
APELLIDOS = ["Los Aromos", "El Boldo", "Las Tórtolas", "Quebrada Honda", "El Maitén", "Santa Elvira", "La Rinconada",
             "Los Coigües", "El Peumo", "Agua Clara", "Cerro Alto", "Los Litres", "San Ramiro", "El Quillay",
             "Puente Viejo", "Las Vertientes", "El Arrayán", "Loma Larga"]


def gen_puntos() -> None:
    puntos, n = [], 0
    nombres = APELLIDOS[:]
    for cid, comuna, _r, lat, lon, _p, sesgo in COMUNAS:
        cuantos = 2 if sesgo >= 0.7 else 1
        for _ in range(cuantos):
            n += 1
            tipo = rng.choices(list(TIPOS), weights=[5, 2, 1, 1])[0]
            if not nombres:
                nombres = APELLIDOS[:]
            ap = nombres.pop(rng.randrange(len(nombres)))
            puntos.append({
                "id": f"P{n:03d}", "tipo": tipo, "tipo_nombre": TIPOS[tipo][0],
                "nombre": f"{rng.choice(TIPOS[tipo][1])} {ap}", "region_id": cid, "comuna": comuna,
                "lat": round(lat + rng.uniform(-0.06, 0.06), 4), "lon": round(lon + rng.uniform(-0.06, 0.06), 4),
                "personas": rng.choice([18, 25, 40, 60, 85, 120, 240]) if tipo != "eleam" else rng.choice([22, 38, 54]),
                "al_aire_libre": tipo == "faena" and rng.random() < 0.8,
                "responsable": rng.choice(["Prevención de riesgos", "Jefatura de faena", "Dirección del centro",
                                           "Encargado de emergencias"]),
            })
    escribir(SALIDA / "ext" / "puntos.json", {"extension": "propuesta, no está en el contrato 0.2",
                                               "ejemplo": True, "items": puntos})


def gen_protocolos() -> None:
    protocolos = [
        {"id": "faenas", "nombre": "Faenas al aire libre con riesgo de incendio",
         "aplica_a": ["faena"], "variable": "prob_foco", "unidad": "probabilidad de foco",
         "umbral_preparacion": 0.18, "umbral_activacion": 0.30, "dias_preparacion": 2, "dias_activacion": 1,
         "freno": "Si el pronóstico baja del umbral de preparación, se levanta el aviso.",
         "acciones_preparacion": [
             {"texto": "Revisar vías de salida y punto de encuentro de la faena", "quien": "Jefatura de faena"},
             {"texto": "Confirmar teléfonos de contacto de cada cuadrilla", "quien": "Prevención de riesgos"}],
         "acciones_activacion": [
             {"texto": "Suspender soldadura, esmerilado y quemas", "quien": "Jefatura de faena"},
             {"texto": "Dejar un vehículo listo para evacuar", "quien": "Jefatura de faena"},
             {"texto": "Avisar al centro de salud más cercano de la mutualidad", "quien": "Prevención de riesgos"}]},
        {"id": "humo", "nombre": "Humo sobre centros de trabajo",
         "aplica_a": ["faena", "colegio"], "variable": "pm25_humo", "unidad": "µg/m³ de partículas finas",
         "umbral_preparacion": 35, "umbral_activacion": 55, "dias_preparacion": 2, "dias_activacion": 1,
         "freno": "Si la estación local marca menos de 35 µg/m³ en la mañana, se levanta el aviso.",
         "acciones_preparacion": [
             {"texto": "Verificar existencia de mascarillas con filtro", "quien": "Prevención de riesgos"},
             {"texto": "Identificar a trabajadores con asma o enfermedad pulmonar", "quien": "Prevención de riesgos"}],
         "acciones_activacion": [
             {"texto": "Reprogramar el trabajo pesado al aire libre", "quien": "Jefatura de faena"},
             {"texto": "Entregar mascarillas y habilitar una sala cerrada", "quien": "Prevención de riesgos"}]},
        {"id": "salud", "nombre": "Refuerzo respiratorio en la red de salud",
         "aplica_a": ["salud"], "variable": "urgencias_resp_extra_pct", "unidad": "% de alza en urgencias respiratorias",
         "umbral_preparacion": 10, "umbral_activacion": 18, "dias_preparacion": 3, "dias_activacion": 1,
         "freno": "Si el alza esperada baja de 10 %, se vuelve a la dotación habitual.",
         "acciones_preparacion": [
             {"texto": "Revisar existencia de inhaladores y oxígeno", "quien": "Dirección del centro"},
             {"texto": "Listar pacientes respiratorios crónicos para contacto del equipo clínico", "quien": "Dirección del centro"}],
         "acciones_activacion": [
             {"texto": "Reforzar el turno de urgencia respiratoria", "quien": "Dirección del centro"},
             {"texto": "Ofrecer control por teleconsulta a pacientes crónicos", "quien": "Dirección del centro"}]},
        {"id": "establecimiento", "nombre": "Centro de salud o residencia en zona de riesgo",
         "aplica_a": ["salud", "eleam"], "variable": "prob_foco", "unidad": "probabilidad de foco",
         "umbral_preparacion": 0.22, "umbral_activacion": 0.34, "dias_preparacion": 3, "dias_activacion": 1,
         "freno": "Si el pronóstico baja del umbral de preparación, se levanta el aviso.",
         "acciones_preparacion": [
             {"texto": "Revisar el plan de evacuación y el transporte para personas con movilidad reducida", "quien": "Encargado de emergencias"},
             {"texto": "Despejar vegetación seca en el entorno inmediato", "quien": "Dirección del centro"}],
         "acciones_activacion": [
             {"texto": "Coordinar con el municipio el lugar de traslado", "quien": "Encargado de emergencias"},
             {"texto": "Dejar lista la ficha y los medicamentos de cada residente", "quien": "Dirección del centro"}]},
    ]
    escribir(SALIDA / "ext" / "protocolos.json", {"extension": "propuesta, no está en el contrato 0.2",
                                                   "ejemplo": True, "items": protocolos})


def gen_registro() -> None:
    resultados = [("acierto", 14), ("falsa_alarma", 6), ("sin_aviso", 2)]
    bolsa = [r for r, n in resultados for _ in range(n)]
    rng.shuffle(bolsa)
    filas = []
    for i, res in enumerate(bolsa):
        c = rng.choice(COMUNAS)
        d = HOY - timedelta(days=2 + i * 2 + rng.randint(0, 1))
        proto = rng.choice(["faenas", "humo", "salud", "establecimiento"])
        hecho = res != "sin_aviso" and rng.random() < 0.75
        filas.append({
            "fecha": d.isoformat(), "region_id": c[0], "comuna": c[1], "protocolo": proto,
            "anticipacion_horas": 0 if res == "sin_aviso" else rng.choice([24, 24, 48]),
            "aviso": res != "sin_aviso", "accion_tomada": hecho,
            "que_paso": {"acierto": "Hubo foco o humo sobre el umbral",
                         "falsa_alarma": "No hubo foco ni humo sobre el umbral",
                         "sin_aviso": "Hubo foco y no se había avisado"}[res],
            "resultado": res})
    filas.sort(key=lambda f: f["fecha"], reverse=True)
    escribir(SALIDA / "ext" / "registro.json", {"extension": "propuesta, no está en el contrato 0.2",
                                                 "ejemplo": True, "items": filas})


def gen_manifest_metricas() -> None:
    escribir(SALIDA / "manifest.json", {
        "contrato": CONTRATO, "ejemplo": True, "generado_utc": GENERADO,
        "periodo": {"desde": "2000-11", "hasta": "2025-12"}, "regiones": [c[0] for c in COMUNAS],
        "archivos": {"regiones": "regiones.geojson", "calendario": "calendario/{region_id}.json",
                     "riesgo": "riesgo/ultimo.json", "focos": "focos/{region_id}.csv", "metricas": "metricas.json"}})
    escribir(SALIDA / "metricas.json", {
        "contrato": CONTRATO, "ejemplo": True, "modelo": None, "periodo_prueba": None, "auc": None,
        "precision_media": None, "captura_top10": None, "nota": "Pendiente: todavía no hay modelo validado."})


if __name__ == "__main__":
    gen_regiones()
    gen_calendario()
    gen_focos()
    pron = gen_pronostico()
    gen_riesgo(pron)
    gen_puntos()
    gen_protocolos()
    gen_registro()
    gen_contraste()
    gen_manifest_metricas()
    print(f"Datos sintéticos escritos en {SALIDA}")
