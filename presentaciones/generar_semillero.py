"""Pitch de Preaviso con la estructura del pitch del Semillero (Intake Assist, Demo Day 3IE-USM).

Mismo recorrido de 3 minutos: portada, problema, momento crítico, producto, quién hace qué, avance, validación 1 y 2,
oportunidad y modelo, cierre. Se quitan la lámina de uso de fondos (no hubo financiamiento) y la frase de iteración
(esta vez no se iteró con usuarios). Las cifras de incendios se calculan aquí mismo sobre el registro público de CONAF
descargado en /aivital/aivital-datos-conaf, para que la lámina y los datos no se desalineen.

Uso:  python3 presentaciones/generar_semillero.py [v1|v2]
"""

from __future__ import annotations

import glob
import json
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
import generar as g  # noqa: E402  (reutiliza estilo, láminas y numeración de fuentes)

DATOS = "/aivital/aivital-datos-conaf"

g.F.update({
    "minvu": ("Gobierno de Chile, Minvu (11 de noviembre de 2025). Avances de la estrategia integral para prevenir incendios forestales (cifra de la ministra de Agricultura)", "https://www.minvu.gob.cl/noticia/gobierno-presenta-los-avances-de-la-estrategia-integral-para-prevenir-incendios-forestales-ante-inicio-de-temporada-de-alto-riesgo/"),
    "df": ("Diario Financiero (9 de enero de 2025). CONAF advierte alto riesgo de incendios (despacho de aviones y brigada; 137 muertos en Valparaíso 2024)", "https://www.df.cl/economia-y-politica/pais/conaf-advierte-alto-riesgo-de-incendios-este-domingo-con-evento"),
    "registro": ("CONAF. Registro público de incendios (capa incendios_totales, ArcGIS). Cálculo propio, 14 de noviembre de 2026", "https://services5.arcgis.com/A1ELWse9bRAi2JiV/arcgis/rest/services/incendios_totales/FeatureServer/0"),
    "wfa": ("CONAF, Saavedra y Brull (2019). Herramientas de apoyo a la toma de decisiones en la gestión del manejo del fuego (CONAF usa Wildfire Analyst desde 2011)", "https://cifag.cl/wp-content/uploads/2019/04/Presentacion-CONAF-Talca-19-03-2019.pdf"),
    "firecatch": ("Descubre.ai (2026). Firecatch: la startup chilena que detecta incendios con IA ya opera en tres países de LATAM", "https://descubre.ai/inteligencia-artificial/firecatch-la-startup-chilena-que-detecta-incendios-con-ia-ya-opera-en-tres-paises-de-latam/"),
    "visor": ("Senapred. Visor Chile Preparado", "https://senapred.cl/visor-chile-preparado/"),
    "emol": ("Emol (8 de enero de 2024). Brigadas nocturnas, IA y cámaras: modernización de Conaf (Consejo Regional de Biobío aprueba $1.361.392.000 para 15 cámaras de detección)", "https://www.emol.com/noticias/Nacional/2024/01/08/1117761/prevencion-incendios-conaf-verano-2024.html"),
    "contraloria": ("Meganoticias (8 de enero de 2026). Contraloría detecta deficiencias de CONAF en incendios de La Araucanía", "https://www.meganoticias.cl/nacional/511657-debilidades-deficiencias-conaf-contraloria-incendios-forestales-la-araucania-traiguen-lonquimay-8-1-202.html"),
    "wildfireia": ("LabRAI (2026). WildfireIA, benchmark nacional de fracaso del ataque inicial (EE. UU.)", "https://labrai.github.io/WildfireIA/"),
})

# ---------- cifras calculadas sobre el registro ----------
def cifras() -> dict:
    ruta = glob.glob(f"{DATOS}/2_situacion_y_registros/incendios_totales*")[0]
    P = [f["properties"] for f in json.load(open(ruta, encoding="utf-8"))["features"]]
    tot = sum(p["sup_total"] for p in P)
    grandes = [p for p in P if p["sup_total"] >= 50]
    nc = [p for p in P if p["f_control"] and p["f_control"] != p["f_inicio"][:10]]
    dia = [p for p in P if p["f_inicio"][:10] == "2026-01-17"]
    horas = [0] * 24
    gh = [0] * 24
    for p in dia:
        h = int(p["f_inicio"][11:13])
        horas[h] += 1
        if p["sup_total"] >= 50:
            gh[h] += 1
    return dict(n=len(P), ha=round(tot), ng=len(grandes), pg=round(100 * len(grandes) / len(P), 1),
                hg=round(100 * sum(p["sup_total"] for p in grandes) / tot, 1), nnc=len(nc),
                pnc=round(100 * len(nc) / len(P), 1), hnc=round(100 * sum(p["sup_total"] for p in nc) / tot),
                dia=len(dia), dia_g=sum(1 for p in dia if p["sup_total"] >= 50), horas=horas, gh=gh)


def coma(x: float) -> str:
    return f"{x:.1f}".replace(".", ",")


def miles(x: int) -> str:
    return f"{x:,}".replace(",", ".")


EXTRA_CSS = """
.bars { display: flex; align-items: flex-end; gap: 6px; height: 250px; border-bottom: 3px solid var(--pizarra); padding: 0 4px; }
.bars .b { flex: 1; display: flex; flex-direction: column-reverse; align-items: stretch; }
.bars .b i { display: block; }
.bars .b .t { background: var(--pizarra-2); opacity: .55; } .bars .b .gr { background: var(--brasa); }
.hrs { display: flex; gap: 6px; padding: 4px; font-size: 13px; color: var(--pizarra-2); }
.hrs span { flex: 1; text-align: center; }
.leg { display: flex; gap: 22px; font-size: 18px; color: var(--pizarra-2); align-items: center; }
.leg i { display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: -2px; }
.mock { background: var(--blanco); border: 1px solid var(--linea); border-top: 8px solid var(--brasa); padding: 18px 22px; display: flex; flex-direction: column; gap: 9px; font-size: 19px; box-shadow: 0 4px 18px rgba(29,42,51,.14); }
.mock .top { display: flex; justify-content: space-between; align-items: center; font: 800 21px var(--titulo); }
.mock .pb { font: 800 54px var(--titulo); letter-spacing: -.03em; line-height: 1; }
.mock .fx { display: grid; grid-template-columns: 150px 1fr; gap: 6px 10px; align-items: center; font-size: 16px; }
.mock .fx i { display: block; height: 12px; background: var(--litoral); }
.mock .row { border-top: 1px solid var(--linea); padding-top: 6px; font-size: 16.5px; }
.steps { display: flex; flex-direction: column; gap: 14px; }
.steps > div { display: grid; grid-template-columns: 46px 1fr; gap: 14px; align-items: start; }
.steps b.n { font: 800 22px var(--titulo); width: 40px; height: 40px; border-radius: 50%; background: var(--pizarra); color: #fff; display: grid; place-items: center; }
.steps h3 { font-size: 26px; } .steps p { font-size: 20px !important; line-height: 1.3; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; align-items: start; }
"""


def barras(c: dict) -> str:
    mx = max(c["horas"])
    esc = 220 / mx
    cols, lab = [], []
    for h in range(24):
        t, gr = c["horas"][h] - c["gh"][h], c["gh"][h]
        cols.append(f'<div class="b" title="{h} h: {c["horas"][h]} incendios">'
                    f'<i class="t" style="height:{t * esc:.0f}px"></i><i class="gr" style="height:{gr * esc:.0f}px"></i></div>')
        lab.append(f"<span>{h}</span>")
    return f'<div class="bars">{"".join(cols)}</div><div class="hrs">{"".join(lab)}</div>'


def pitch(version: int) -> str:
    c = cifras()
    n = g.Notas()
    N, S = n.n, n.pie
    s: list[str] = []

    s.append(g.slide(f"""<div class="kicker">AIVital · NASA Space Apps 2026 · Chile</div><h1>Preaviso</h1>
<p class="big">Qué incendio atender primero, y quién está en su camino.</p>
<p>Apoyo al despacho del primer ataque de CONAF.</p><div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"))

    s.append(g.slide(f"""<div class="kicker">El problema</div>
<h2>Chile gasta más de $160 mil millones por temporada, y casi todo el daño lo hacen muy pocos incendios</h2>
<div class="num3">
  <div><b>$160 mil mill.</b><span>destinados a prevenir y combatir incendios forestales en la temporada 2025-26 {N('minvu')}</span></div>
  <div><b>{coma(c['pg'])} %</b><span>de los incendios ({c['ng']} de {miles(c['n'])}) llegan a 50 ha o más {N('registro')}</span></div>
  <div><b>{coma(c['hg'])} %</b><span>de las {miles(c['ha'])} hectáreas quemadas entre julio de 2025 y mayo de 2026 las queman esos {c['ng']} incendios {N('registro')}</span></div>
</div>{S('minvu', 'registro')}"""))

    s.append(g.slide(f"""<div class="kicker">El momento crítico</div>
<h2>Cuando arden varios a la vez, hay que elegir en minutos a cuál mandar los recursos</h2>
<div class="leg"><span><b>17 de enero de 2026:</b> {c['dia']} incendios iniciados en un día, {c['dia_g']} de ellos de 50 ha o más</span>
  <span><i style="background:var(--pizarra-2);opacity:.55"></i>incendios</span><span><i style="background:var(--brasa)"></i>llegaron a 50 ha o más</span></div>
{barras(c)}
<p class="note">Incendios según la hora en que comenzaron. CONAF despacha de inmediato dos aviones y un helicóptero con brigada apenas sabe hacia dónde va el fuego, con unas 77 aeronaves para toda la temporada {N('df')}. Además, Contraloría halló en enero de 2026 fichas incompletas en el sistema de registro de CONAF {N('contraloria')}.</p>
{S('registro', 'df', 'contraloria')}""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Producto</div><h2>Preaviso ordena los incendios del día y dice qué hay en su camino</h2>
<div class="two">
 <div class="steps">
  <div><b class="n">1</b><div><h3>Avisan un incendio</h3><p>Entra solo, desde el registro de CONAF y el satélite.</p></div></div>
  <div><div><b class="n">2</b></div><div><h3>Preaviso calcula</h3><p>La probabilidad de que no se controle hoy, el porqué, y qué hospitales, subestaciones y colegios quedan en su dirección, con una hora aproximada.</p></div></div>
  <div><div><b class="n">3</b></div><div><h3>La persona decide</h3><p>El despachador ve la lista ordenada y decide. Preaviso apoya, no ordena.</p></div></div>
 </div>
 <div class="mock"><div class="top"><span>Prioridad 1 de 12</span><span class="hip">ejemplo</span></div>
  <div>No se controla hoy</div><div class="pb">62 %</div>
  <div class="fx"><span>Viento en ladera</span><i style="width:80%"></i><span>Combustible seco</span><i style="width:60%"></i><span>Hora de inicio</span><i style="width:40%"></i></div>
  <div class="row"><b>En el camino:</b> hospital a 3,2 km, llega en unas 2 h · subestación a 5 km, unas 3 h</div>
  <div class="row"><b>Posición en la lista:</b> 1 de 12</div></div>
</div><p class="note">La tarjeta es una maqueta con números inventados. Hoy la pantalla de despacho está en diseño.</p>""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Quién hace qué</div><h2>Cada herramienta mira una parte. Nosotros ordenamos todos los incendios del día.</h2>
<div class="cards c4">
 <div class="card"><h3>Anticipan</h3><p><b>Botón Rojo (CONAF)</b>: marca las comunas con probabilidad de ignición alta antes de que haya fuego {N('conaf')}.</p></div>
 <div class="card"><h3>Simulan uno a uno</h3><p><b>Wildfire Analyst (Technosylva)</b>: CONAF lo usa desde 2011; un analista simula cada incidente {N('wfa')}.</p></div>
 <div class="card"><h3>Detectan</h3><p><b>Firecatch</b> (Chile) y <b>OroraTech</b>: cámaras y satélites que avisan que hay fuego {N('firecatch')} {N('ororatech')}.</p></div>
 <div class="card l"><h3>Nuestra ventaja</h3><p>Ordenar <b>todos</b> los incendios del día, con el porqué y lo que hay en su camino, sobre lo que CONAF ya usa.</p></div>
</div>
<p class="note">No encontramos otra herramienta que ordene todos los incendios del día. Es una búsqueda propia, no una certeza. Senapred publica un visor de exposición, pero estático {N('visor')}.</p>
{S('conaf', 'wfa', 'firecatch', 'ororatech', 'visor')}""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Avance</div><h2>Ya trabajamos con datos reales de CONAF, no con ejemplos</h2>
<div class="num3">
  <div><b>182</b><span>capas públicas de CONAF descargadas (814 MB): pronóstico de 5 días, índice por comuna, registro de incendios y puntos de inicio desde 2002</span></div>
  <div><b>{miles(c['n'])}</b><span>incendios del registro, cada uno con su hora de inicio, combustible, comuna y superficie {N('registro')}</span></div>
  <div><b>153</b><span>bases de datos mapeadas (clima, satélite, relieve, infraestructura) para sumar al motor</span></div>
</div>
<p class="note">Lo que sigue en construcción: la pantalla de despacho. Ya tenemos su guía, el contrato de datos y la repetición del 17 de enero lista para armarse.</p>{S('registro')}"""))

    s.append(g.slide(f"""<div class="kicker">Validación 1: lo que comprobamos</div><h2>Hay una señal clara que seguir en el propio registro de CONAF</h2>
<div class="num3">
  <div><b>{c['nnc']}</b><span>incendios ({coma(c['pnc'])} %) no se controlaron el mismo día en que empezaron {N('registro')}</span></div>
  <div><b>{c['hnc']} %</b><span>de las hectáreas están en ese grupo: ahí se juega casi todo el daño</span></div>
  <div><b>100 %</b><span>de los incendios traen la hora de inicio, así que se puede cruzar con el clima de esa hora</span></div>
</div>
<p class="note">Hay un antecedente: un benchmark de EE. UU. con 38.128 incendios mostró que el fracaso del ataque inicial se puede anticipar con datos disponibles al momento del aviso {N('wildfireia')}. Esto describe lo ocurrido, no prueba que se pueda anticipar en Chile: eso es lo que medimos primero.</p>{S('registro', 'wildfireia')}"""))

    s.append(g.slide(f"""<div class="kicker">Validación 2: cliente y camino al piloto</div><h2>CONAF es quien decide, y hay precedente de que una región financia tecnología para CONAF</h2>
<div class="two">
 <div class="cards"><div class="card l"><h3>Cliente: CONAF (pasa a SERNAFOR)</h3><p>Tiene el dolor, los datos y el gasto. Sus centros de coordinación regionales son el usuario diario.</p></div>
  <div class="card"><h3>Precedente de compra</h3><p>El Consejo Regional de Biobío aprobó $1.361 millones para 15 cámaras de detección de CONAF {N('emol')}.</p></div>
  <div class="card"><h3>Segundo cliente: Senapred</h3><p>Para la parte de qué hospitales y colegios quedan en el camino.</p></div></div>
 <div class="steps"><div><b class="n">1</b><div><h3>Prueba retrospectiva</h3><p>Repetir la temporada pasada con datos de CONAF y ver dónde habría quedado cada incendio grande en la lista.</p></div></div>
  <div><div><b class="n">2</b></div><div><h3>Un despachador revisa</h3><p>Una persona de CONAF mira los casos y dice si habría cambiado una decisión.</p></div></div>
  <div><div><b class="n">3</b></div><div><h3>Modo sombra una temporada</h3><p>Corre en paralelo sin tocar el despacho: cero riesgo operativo.</p></div></div></div>
</div><p class="note">Aún no hemos conversado con CONAF: este camino es nuestra hipótesis.</p>{S('emol')}""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Oportunidad y modelo</div><h2>Ingreso recurrente por región, empezando con un piloto sin costo</h2>
<div class="cards c3">
 <div class="card"><h3>Año 0</h3><p>Piloto en modo sombra en una región, sin costo, con un convenio de colaboración.</p></div>
 <div class="card l"><h3>Año 1 en adelante</h3><p>Licencia anual por región o nacional, pagada con presupuesto de CONAF o financiamiento regional.</p></div>
 <div class="card"><h3>Después</h3><p>La capa de exposición para Senapred y municipios, y alertas a dueños de infraestructura.</p></div>
</div>
<p class="note"><span class="hip">hipótesis</span> Aún no hay precio: lo fijaremos en el piloto. Referencia de escala, no precio: una región aprobó $1.361 millones por 15 cámaras {N('emol')}, dentro de un gasto de más de $160 mil millones por temporada {N('minvu')}.</p>{S('emol', 'minvu')}"""))

    s.append(g.slide(f"""<div class="kicker">Cierre</div>
<p class="quote">¿Qué incendio habrías atendido primero el 17 de enero?</p>
<p class="big">Pedimos una hora con una jefatura regional de CONAF para repetir ese día con su despachador.</p>
<div class="pills"><a href="https://aivital.cloud">aivital.cloud</a><span>Decide siempre la persona</span></div>
<div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"))

    s.append(g.slide(f"""<div class="kicker">Fuentes</div><h2>Fuentes</h2><ol class="src-list">{n.lista()}</ol>""", "dense"))

    nombre = "preaviso-pitch-semillero-v1.html" if version == 1 else "preaviso-pitch-semillero-v2.html"
    html = g.pagina("Preaviso, pitch estilo Semillero", s, ("Pitch anterior", "preaviso-pitch-v1-propuesta.html"))
    html = html.replace("</style>", EXTRA_CSS + "</style>", 1)
    (AQUI / nombre).write_text(html, encoding="utf-8")
    return nombre


def aviso() -> dict:
    """Qué se sabe al momento del aviso: ¿se distinguen los incendios que serán grandes?"""
    ruta = glob.glob(f"{DATOS}/2_situacion_y_registros/incendios_totales*")[0]
    P = [f["properties"] for f in json.load(open(ruta, encoding="utf-8"))["features"]]
    G = [p for p in P if p["sup_total"] >= 50]
    R = [p for p in P if p["sup_total"] < 50]

    def pc(L, f):
        return round(100 * sum(1 for p in L if f(p)) / len(L))

    tarde = lambda p: 13 <= int(p["f_inicio"][11:13]) <= 18  # noqa: E731
    return dict(tg=pc(G, tarde), tr=pc(R, tarde),
                mg=pc(G, lambda p: p["comb_inicial"] == "Matorral"), mr=pc(R, lambda p: p["comb_inicial"] == "Matorral"),
                sg=pc(G, lambda p: not p["comb_inicial"]), sr=pc(R, lambda p: not p["comb_inicial"]))


def pitch_v2() -> str:
    c, a = cifras(), aviso()
    g.F["terram"] = ("Terram (2025). Balance ambiental 2025: sector forestal (Ley 21.744 que crea SERNAFOR)", "https://www.terram.cl/descargar/Balance-Ambiental-2025-Forestal.pdf")
    n = g.Notas()
    N, S = n.n, n.pie
    s: list[str] = []

    # 1. Gancho: la escena del día, antes del nombre del equipo
    s.append(g.slide(f"""<div class="kicker">Preaviso · AIVital · NASA Space Apps 2026</div>
<h2>17 de enero de 2026: {c['dia']} incendios en un solo día. {c['dia_g']} llegaron a 50 ha o más.</h2>
<p class="big">¿Cuál atiendes primero?</p>
<div class="leg"><span><i style="background:var(--pizarra-2);opacity:.55"></i>incendios, por hora de inicio</span><span><i style="background:var(--brasa)"></i>llegaron a 50 ha o más</span></div>
{barras(c)}{S('registro')}""", "dense"))

    # 2. Problema: dinero y concentración
    s.append(g.slide(f"""<div class="kicker">El problema</div>
<h2>Más de $160 mil millones por temporada, y {c['ng']} incendios hacen casi todo el daño</h2>
<div class="num3">
  <div><b>$160 mil mill.</b><span>para prevenir y combatir incendios forestales en la temporada 2025-26 {N('minvu')}</span></div>
  <div><b>{coma(c['pg'])} %</b><span>de los incendios ({c['ng']} de {miles(c['n'])}) llegan a 50 ha o más {N('registro')}</span></div>
  <div><b>{coma(c['hg'])} %</b><span>de las {miles(c['ha'])} ha quemadas entre julio de 2025 y mayo de 2026 {N('registro')}</span></div>
</div>
<p class="note">CONAF despacha dos aviones y un helicóptero con brigada apenas sabe hacia dónde va el fuego, con unas 77 aeronaves para la temporada {N('df')}.</p>{S('minvu', 'registro', 'df')}"""))

    # 3. Producto: la tarjeta de salida
    s.append(g.slide(f"""<div class="kicker">Producto</div><h2>Preaviso ordena los incendios del día y dice qué hay en su camino</h2>
<div class="two">
 <div class="steps">
  <div><b class="n">1</b><div><h3>Avisan un incendio</h3><p>Entra solo desde el registro de CONAF y el satélite.</p></div></div>
  <div><div><b class="n">2</b></div><div><h3>Preaviso lo pone en la lista</h3><p>Probabilidad de que no se controle hoy, el porqué y qué hay en su camino.</p></div></div>
  <div><div><b class="n">3</b></div><div><h3>La persona decide</h3><p>Preaviso apoya, no ordena.</p></div></div>
 </div>
 <div class="mock"><div class="top"><span>Prioridad 1 de 12</span><span class="hip">ejemplo</span></div>
  <div>No se controla hoy</div><div class="pb">62 %</div>
  <div class="fx"><span>Viento en ladera</span><i style="width:80%"></i><span>Combustible seco</span><i style="width:60%"></i><span>Hora de inicio</span><i style="width:40%"></i></div>
  <div class="row"><b>En el camino:</b> hospital a 3,2 km, unas 2 h · subestación a 5 km, unas 3 h</div>
  <div class="row"><b>Posición en la lista:</b> 1 de 12</div></div>
</div><p class="note">Maqueta con números inventados. La pantalla de despacho está en diseño.</p>""", "dense"))

    # 4. Quién hace qué
    s.append(g.slide(f"""<div class="kicker">Quién hace qué</div><h2>Cada herramienta mira una parte. Nosotros ordenamos todos los incendios del día.</h2>
<div class="cards c4">
 <div class="card"><h3>Anticipan</h3><p><b>Botón Rojo</b> (CONAF): comunas con ignición probable antes del fuego {N('conaf')}.</p></div>
 <div class="card"><h3>Simulan uno a uno</h3><p><b>Wildfire Analyst</b>: CONAF lo usa desde 2011 {N('wfa')}.</p></div>
 <div class="card"><h3>Detectan</h3><p><b>Firecatch</b> y <b>OroraTech</b> {N('firecatch')} {N('ororatech')}.</p></div>
 <div class="card l"><h3>Preaviso</h3><p>Ordena <b>todos</b> los incendios del día, con el porqué y lo que hay en su camino.</p></div>
</div>
<p class="note">No encontramos otra herramienta que lo haga: es una búsqueda propia, no una certeza.</p>{S('conaf', 'wfa', 'firecatch', 'ororatech')}""", "dense"))

    # 5. Avance
    s.append(g.slide(f"""<div class="kicker">Avance</div><h2>Ya trabajamos con datos reales de CONAF</h2>
<div class="num3">
  <div><b>182</b><span>capas públicas de CONAF descargadas</span></div>
  <div><b>{miles(c['n'])}</b><span>incendios con su hora de inicio, combustible y comuna {N('registro')}</span></div>
  <div><b>153</b><span>bases de datos mapeadas para sumar clima y satélite</span></div>
</div>
<p class="note">Lo que sigue en construcción: la pantalla de despacho.</p>{S('registro')}"""))

    # 6. Validación 1: dato propio
    s.append(g.slide(f"""<div class="kicker">Validación 1: un dato propio</div>
<h2>Al momento del aviso, un incendio que será grande se parece a los demás</h2>
<div class="num3">
  <div><b>{a['tg']} % y {a['tr']} %</b><span>empiezan entre las 13 y las 18 h: los que serán grandes y el resto</span></div>
  <div><b>{a['mg']} % y {a['mr']} %</b><span>parten en matorral: los que serán grandes y el resto</span></div>
  <div><b>{a['sg']} % y {a['sr']} %</b><span>sin combustible registrado: los que serán grandes y el resto</span></div>
</div>
<p class="note">Con la hora y el combustible solos casi no se distinguen {N('registro')}. Por eso hacen falta clima, relieve y satélite, y por eso la primera prueba es retrospectiva. Un estudio de EE. UU. con 38.128 incendios encontró señal usando datos del momento del aviso {N('wildfireia')}. Que ocurra en Chile es lo que medimos primero.</p>{S('registro', 'wildfireia')}"""))

    # 7. Validación 2: cliente objetivo y criterio de éxito
    s.append(g.slide(f"""<div class="kicker">Validación 2: cliente y prueba</div><h2>Primer cliente objetivo: CONAF. Y una prueba con criterio de éxito</h2>
<div class="two">
 <div class="cards"><div class="card l"><h3>CONAF, que pasa a ser SERNAFOR {N('terram')}</h3><p>Tiene el dolor, los datos y el gasto. Sus centros de coordinación regionales serían el usuario.</p></div>
  <div class="card"><h3>Precedente de compra</h3><p>El Consejo Regional de Biobío aprobó $1.361 millones para 15 cámaras de detección de CONAF {N('emol')}.</p></div>
  <div class="card"><h3>Segundo cliente: Senapred</h3><p>Por la parte de qué hospitales y colegios quedan en el camino.</p></div></div>
 <div class="steps"><div><b class="n">1</b><div><h3>Prueba retrospectiva</h3><p>Repetir la temporada pasada y ver dónde queda cada incendio grande en la lista.</p></div></div>
  <div><div><b class="n">2</b></div><div><h3>Un despachador revisa</h3><p>Dice si habría cambiado una decisión.</p></div></div>
  <div><div><b class="n">3</b></div><div><h3>Modo sombra una temporada</h3><p>Corre en paralelo sin tocar el despacho.</p></div></div>
  <div><div><b class="n">4</b></div><div><h3>Criterio de éxito (propuesto)</h3><p>Que 2 de cada 3 incendios grandes queden en el primer tercio de la lista. Al azar serían 1 de cada 3.</p></div></div></div>
</div><p class="note">Aún no hemos conversado con CONAF: este camino es nuestra hipótesis.</p>{S('terram', 'emol')}""", "dense"))

    # 8. Modelo
    s.append(g.slide(f"""<div class="kicker">Oportunidad y modelo</div><h2>Licencia anual por región, empezando con un piloto sin costo</h2>
<div class="cards c3">
 <div class="card"><h3>Año 0</h3><p>Piloto en modo sombra en una región, sin costo.</p></div>
 <div class="card l"><h3>Año 1 en adelante</h3><p>Licencia anual, con presupuesto de CONAF o financiamiento regional.</p></div>
 <div class="card"><h3>Después</h3><p>Capa de exposición para Senapred y municipios.</p></div>
</div>
<p class="note"><span class="hip">hipótesis</span> Aún no hay precio: lo fijaremos en el piloto.</p>"""))

    # 9. Cierre: promesa comprobable
    s.append(g.slide(f"""<div class="kicker">Cierre</div>
<p class="quote">Danos una hora con un despachador y repetimos el 17 de enero con nuestra lista.</p>
<p class="big">Que sea él quien diga si habría cambiado una decisión.</p>
<div class="pills"><a href="https://aivital.cloud">aivital.cloud</a><span>Decide siempre la persona</span></div>
<div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"))

    s.append(g.slide(f"""<div class="kicker">Fuentes</div><h2>Fuentes</h2><ol class="src-list">{n.lista()}</ol>""", "dense"))
    html = g.pagina("Preaviso, pitch estilo Semillero v2", s, ("Pitch v1", "preaviso-pitch-semillero-v1.html"))
    html = html.replace("</style>", EXTRA_CSS + "</style>", 1)
    (AQUI / "preaviso-pitch-semillero-v2.html").write_text(html, encoding="utf-8")
    return "preaviso-pitch-semillero-v2.html"


# Medido el 14-nov-2026 sobre los archivos de FIRMS (NASA) de Chile, focos de tipo vegetación, 1-mar-2012 a 2025:
# VIIRS S-NPP 335.116 focos contra 94.325 de MODIS (razón 3,55); correlación diaria 0,973; la razón anual va de 2,92 (2012) a 4,72 (2025).
ARMONIA = dict(razon=3.5, r0=2.9, r1=4.7, corr=0.97, desde=2012, hasta=2025)


def pitch_v3() -> str:
    """Pitch con la skill pitch-inversores: una idea por lámina, qué hacemos primero, mercado de abajo hacia arriba y ask explícito."""
    c, A = cifras(), ARMONIA
    g.F["terram"] = ("Terram (2025). Balance ambiental 2025: sector forestal (Ley 21.744 que crea SERNAFOR)", "https://www.terram.cl/descargar/Balance-Ambiental-2025-Forestal.pdf")
    g.F["firms"] = ("NASA Earthdata. FIRMS, archivo de descargas de focos MODIS y VIIRS (cálculo propio sobre Chile, vegetación, 2012-2025)", "https://firms.modaps.eosdis.nasa.gov/download/")
    n = g.Notas()
    N, S = n.n, n.pie
    s: list[str] = []
    UNA = "Preaviso ordena los incendios del día y muestra qué hay en su camino, para decidir a cuál mandar los recursos."

    s.append(g.slide(f"""<div class="kicker">Preaviso · AIVital</div>
<h2>{UNA}</h2>
<p class="big">17 de enero de 2026: {c['dia']} incendios en un día. {c['dia_g']} llegaron a 50 ha o más. ¿Cuál atendías primero?</p>
{barras(c)}{S('registro')}""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Problema</div>
<h2>Todo se juega en acertar cuál atender primero</h2>
<div class="num3">
  <div><b>$160 mil mill.</b><span>por temporada para prevenir y combatir incendios forestales, 2025-26 {N('minvu')}</span></div>
  <div><b>{coma(c['pg'])} %</b><span>de los incendios ({c['ng']} de {miles(c['n'])}) llegan a 50 ha o más {N('registro')}</span></div>
  <div><b>{coma(c['hg'])} %</b><span>de las hectáreas las queman esos {c['ng']} incendios {N('registro')}</span></div>
</div>{S('minvu', 'registro')}"""))

    s.append(g.slide(f"""<div class="kicker">Producto</div><h2>Todos los incendios del día, en orden, y por qué</h2>
<div class="shots"><figure><img src="{g.img_png('app-pais.png')}" alt="Preaviso: lista de incendios del 17 de enero de 2026 sobre el mapa de Chile"><figcaption>Plataforma funcionando con los {c['dia']} incendios reales de CONAF del 17 de enero. Probabilidades de ejemplo.</figcaption></figure>
<div class="steps"><div><b class="n">1</b><div><h3>La lista</h3><p>Ordenada por probabilidad de no controlarse hoy.</p></div></div>
<div><div><b class="n">2</b></div><div><h3>El porqué</h3><p>Viento, combustible, hora.</p></div></div>
<div><div><b class="n">3</b></div><div><h3>Su camino</h3><p>Hospitales y subestaciones, con hora de llegada.</p></div></div></div></div>""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Cómo funciona</div><h2>Un motor que cruza decenas de fuentes y entrega una lista</h2>
<div class="flow">
 <div class="st"><h3>Entra el aviso</h3><p>Registro de CONAF y focos de satélite de NASA.</p></div><div class="ar">→</div>
 <div class="st"><h3>Se cruza</h3><p>Clima, relieve, combustible e infraestructura.</p></div><div class="ar">→</div>
 <div class="st hi"><h3>Sale la lista</h3><p>Orden, porqué y activos en el camino.</p></div></div>
<p class="note">153 bases de datos ya mapeadas, públicas y gratuitas, para alimentar el motor: clima, satélite, relieve, población y salud.</p>""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Avance real</div><h2>Ya trabajamos con datos reales y medimos lo que importa</h2>
<div class="num3">
  <div><b>{miles(c['n'])}</b><span>incendios reales de CONAF, cada uno con su hora de inicio {N('registro')}</span></div>
  <div><b>{coma(A['razon'])}×</b><span>más focos ve VIIRS que MODIS en Chile, {A['desde']} a {A['hasta']} {N('firms')}</span></div>
  <div><b>{coma(A['r0'])} a {coma(A['r1'])}</b><span>cómo sube esa razón en {A['hasta'] - A['desde']} años: una constante no sirve {N('firms')}</span></div>
</div><p class="note">Prototipo de plataforma en pie, con los incendios reales y probabilidades de ejemplo.</p>{S('registro', 'firms')}"""))

    s.append(g.slide(f"""<div class="kicker">Mercado</div><h2>Se vende por región, y hay 16 compradores posibles</h2>
<div class="num3">
  <div><b>16</b><span>regiones, cada una con su despacho de incendios</span></div>
  <div><b>345</b><span>comunas con equipos municipales de emergencia {N('registro')}</span></div>
  <div><b>[por definir]</b><span>precio de la licencia anual: se fija en el primer piloto</span></div>
</div><p class="note">Cálculo de abajo hacia arriba: compradores por precio. Primer comprador: CONAF, que pasa a ser SERNAFOR {N('terram')}.</p>{S('registro', 'terram')}"""))

    s.append(g.slide(f"""<div class="kicker">Competencia</div><h2>Cada herramienta mira una parte. Preaviso ordena todos los incendios del día.</h2>
<div class="cards c4">
 <div class="card"><h3>Anticipan</h3><p><b>Botón Rojo</b>: comunas con riesgo antes del fuego {N('conaf')}.</p></div>
 <div class="card"><h3>Simulan uno</h3><p><b>Wildfire Analyst</b>: un incendio a la vez {N('wfa')}.</p></div>
 <div class="card"><h3>Detectan</h3><p><b>Firecatch</b> y <b>OroraTech</b> {N('firecatch')} {N('ororatech')}.</p></div>
 <div class="card l"><h3>Preaviso</h3><p>Ordena <b>todos</b>, con el porqué y lo que hay en su camino.</p></div></div>
<p class="note">No encontramos otra herramienta que lo haga: es una búsqueda propia, no una certeza.</p>{S('conaf', 'wfa', 'firecatch', 'ororatech')}""", "dense"))

    s.append(g.slide(f"""<div class="kicker">Modelo de negocio</div><h2>Licencia anual por región, y tres capas que se suman</h2>
<div class="cards c3">
 <div class="card l"><h3>Despacho</h3><p>Licencia anual por región a CONAF.</p></div>
 <div class="card"><h3>Exposición</h3><p>Senapred y municipios: qué hospitales y colegios quedan en el camino.</p></div>
 <div class="card"><h3>Infraestructura</h3><p>Alertas para dueños de redes eléctricas y de agua.</p></div></div>
<p class="note"><span class="hip">hipótesis</span> Aún sin precio ni cliente firmado.</p>"""))

    s.append(g.slide(f"""<div class="kicker">Visión</div><h2>De un país a cualquier región con focos de satélite</h2>
<div class="tl" style="grid-template-columns:repeat(3,1fr)">
 <div><b>Hoy</b><span>Prototipo con los incendios reales de Chile y probabilidades de ejemplo.</span></div>
 <div><b>Siguiente</b><span>Motor con clima, relieve y satélite; integración con el registro de CONAF.</span></div>
 <div><b>Después</b><span>El mismo motor para humo, daños posteriores y otros países con datos de NASA.</span></div></div>
<p class="note">Cada paso reutiliza la misma base de datos.</p>"""))

    s.append(g.slide(f"""<div class="kicker">Equipo</div><h2>AIVital: software que predice, explica y recomienda para decisiones públicas</h2>
<div class="cards c2">
 <div class="card"><h3>Intake Assist y Cupo Vivo</h3><p>Productos de AIVital para la red pública de salud, con el mismo método que usa Preaviso.</p></div>
 <div class="card l"><h3>Preaviso</h3><p>Lo llevamos a incendios: de la predicción a la decisión.</p></div></div>"""))

    s.append(g.slide(f"""<div class="kicker">Lo que pedimos</div>
<p class="quote">Una jefatura regional de CONAF para probar Preaviso con su despacho.</p>
<p class="big">Y capital semilla: <b>[monto por definir]</b>. ¿Qué incendio habrías atendido primero el 17 de enero?</p>
<div class="pills"><a href="https://aivital.cloud">aivital.cloud</a><span>Decide siempre la persona</span></div>
<div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"))

    s.append(g.slide(f"""<div class="kicker">Fuentes</div><h2>Fuentes</h2><ol class="src-list">{n.lista()}</ol>""", "dense"))
    html = g.pagina("Preaviso, pitch para inversionistas", s, ("Pitch anterior", "preaviso-pitch-semillero-v2.html"))
    html = html.replace("</style>", EXTRA_CSS + "</style>", 1)
    (AQUI / "preaviso-pitch-inversores-v1.html").write_text(html, encoding="utf-8")
    return "preaviso-pitch-inversores-v1.html"


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "v1"
    print(pitch_v3() if arg == "inv" else pitch_v2() if arg == "v2" else pitch(1))
