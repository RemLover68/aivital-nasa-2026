"""Genera las dos presentaciones de Preaviso como HTML autocontenido.

Mismo formato que la presentación de Cupo Vivo (lámina de 1280 x 720 que se ajusta a la pantalla,
barra inferior, teclas de flecha), con la identidad de Preaviso (web/css/base.css).

  preaviso-pitch-v1-propuesta.html   lenguaje de Cupo Vivo: propuesta a quien usaría el producto
  preaviso-pitch-v2-mentor.html      lenguaje del documento "cumplia mentor": validación de idea

Las cifras salen del informe interno (web/producto.html), que lleva cada fuente con su nivel de certeza.
Uso:  python3 presentaciones/generar.py
"""

from __future__ import annotations

import base64
from pathlib import Path

AQUI = Path(__file__).resolve().parent
MAQUETA = "http://aivital-box.tail0a46d1.ts.net:7093"

# ---------- fuentes (nombre corto, dirección) ----------
F = {
    "suseso": ("SUSESO (2025). Medidas de los organismos administradores ante incendios forestales", "https://www.suseso.gob.cl/605/w3-article-747373.html"),
    "humo": ("Annual Review of Medicine (2023). Health Effects of Wildfire Smoke Exposure", "https://pmc.ncbi.nlm.nih.gov/articles/PMC12183787/"),
    "causas": ("Meteored, con cifras de CONAF, temporada 2022-23", "https://www.meteored.cl/noticias/actualidad/reciente-temporada-31-de-los-incendios-forestales-fueron-intencionales-en-chile.html"),
    "firms": ("NASA Earthdata. FIRMS FAQ", "https://earthdata.nasa.gov/data/tools/firms/faq"),
    "gwis": ("GWIS, Copernicus. Fire Danger Forecast", "https://gwis.jrc.ec.europa.eu/about-gwis/technical-background/fire-danger-forecast"),
    "conaf": ("CONAF. Situación actual y pronóstico de incendios", "https://www.conaf.cl/incendios/situacion-actual-y-pronostico-de-incendios/"),
    "cams": ("ECMWF. CAMS, Global atmospheric composition forecast data documentation", "https://confluence.ecmwf.int/display/CKB/CAMS%3A+Global+atmospheric+composition+forecast+data+documentation"),
    "ecmwf": ("Nature Communications 16, 2918 (2025). Global data-driven prediction of fire activity", "https://www.nature.com/articles/s41467-025-58097-7"),
    "ecmwf_nota": ("ECMWF (2025). Scientists present new ML tool for improved fire prediction", "https://www.ecmwf.int/en/about/media-centre/news/2025/scientists-present-new-ml-tool-improved-fire-prediction"),
    "ororatech": ("OroraTech. Wildfire Solution", "https://ororatech.com/all-products/wildfire-solution"),
    "technosylva": ("Technosylva. Sitio oficial", "https://www.technosylva.com/"),
    "bcaps": ("Evaluación del sistema de predicción de asma de Columbia Británica, temporada 2018 (2021)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC7994359"),
    "ciper": ("CIPER Chile (2024), columna de opinión. Incendios: El fracaso del SAE y un llamado a la acción", "https://www.ciperchile.cl/2024/03/10/incendios-el-fracaso-del-sae/"),
    "anticipacion": ("Anticipation Hub (2022). Anticipatory action triggers, forecast-based financing", "https://www.anticipation-hub.org/Documents/Briefing_Sheets_and_Fact_Sheets/Anticipatory_action_triggers_forecast-based-financing_FINAL.pdf"),
    "datos": ("Equipo AIVital (14 de noviembre de 2026). Serie armonizada de focos MODIS y VIIRS por comuna, contrato 0.2", "https://github.com/marcelo-corro/aivital-incendios-datos"),
    "igniciones": ("Cuadernos de Investigación Geográfica 51(2) (2025). Wildfire occurrence in Chile", "https://doi.org/10.18172/cig.6792"),
    "fondo": ("DIPRES (15 de mayo de 2024). Listo para ser ley: Cámara de Diputadas y Diputados despacha proyecto que crea un Fondo Transitorio para la Reconstrucción", "https://www.dipres.gob.cl/598/articles-333057_doc_pdf1.pdf"),
    "plan": ("Ministerio del Interior (17 de febrero de 2025). Gobierno homenajea a brigadistas forestales y destaca fortalecimiento de recursos para enfrentar incendios", "https://interior.gob.cl/noticias/2025/02/17/gobierno-homenajea-a-brigadistas-forestales-y-destaca-fortalecimiento-de-recursos-para-enfrentar-incendios/"),
    "clapes": ("Clapes UC (7 de febrero de 2024). Incendios Forestales 2024: Perspectivas. Informe preliminar", "https://expedientes.mma.gob.cl/storage/2025/06/05/expedientes/pdf/doc_7_20250605200924.pdf"),
    "bm": ("Banco Mundial (2012). A Cost Effective Solution to Reduce Disaster Losses in Developing Countries. Policy Research Working Paper 6058", "https://documents1.worldbank.org/curated/en/190261468181486694/text/WPS6058.txt"),
    "fann": ("Science of the Total Environment 610-611 (2018). The health impacts and economic value of wildland fire episodes in the U.S.: 2008-2012", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6117838"),
}


class Notas:
    """Numera las fuentes en el orden en que aparecen, como en un documento formal."""

    def __init__(self) -> None:
        self.orden: list[str] = []

    def n(self, clave: str) -> str:
        if clave not in self.orden:
            self.orden.append(clave)
        return f"<sup>{self.orden.index(clave) + 1}</sup>"

    def pie(self, *claves: str, extra: str = "") -> str:
        partes = [f'{self.n(c)} <a href="{F[c][1]}">{F[c][0]}</a>.' for c in claves]
        return f'<p class="srcline">{" ".join(partes)} {extra}</p>'

    def lista(self) -> str:
        return "".join(f'<li><a href="{F[c][1]}">{F[c][0]}. {F[c][1]}</a></li>' for c in self.orden)


def img(nombre: str) -> str:
    return "data:image/png;base64," + base64.b64encode((AQUI / "img" / nombre).read_bytes()).decode()


def img_png(nombre: str) -> str:
    return "data:image/png;base64," + base64.b64encode((AQUI / "img" / nombre).read_bytes()).decode()


MARCA = """<svg class="marca" viewBox="0 0 68 68" role="img" aria-label="Preaviso"><rect width="68" height="68" rx="15" fill="#1d2a33"/>
<rect x="11" y="38" width="7" height="18" rx="2" fill="#e6c75a"/><rect x="21" y="26" width="7" height="30" rx="2" fill="#e08a2e"/>
<rect x="31" y="12" width="7" height="44" rx="2" fill="#bf3326"/><rect x="41" y="24" width="7" height="32" rx="2" fill="#e08a2e" opacity=".55"/>
<rect x="51" y="36" width="7" height="20" rx="2" fill="#e6c75a" opacity=".55"/></svg>"""

CSS = """
:root { --bruma:#e8ecee; --papel:#f7f9f9; --blanco:#fff; --pizarra:#1d2a33; --pizarra-2:#51616c; --linea:#c7d1d6; --litoral:#1f6e8c; --litoral-osc:#164f66;
  --bajo:#a9c2b0; --medio:#e6c75a; --alto:#e08a2e; --brasa:#bf3326;
  --titulo:"Bricolage Grotesque","Arial Narrow",system-ui,sans-serif; --texto:"Atkinson Hyperlegible",system-ui,-apple-system,"Segoe UI",sans-serif; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; overflow: hidden; background: #d5dbde; font-family: var(--texto); color: var(--pizarra); }
h1, h2, h3, p { margin: 0; }
h1, h2, h3 { font-family: var(--titulo); text-wrap: balance; }
a { color: var(--litoral-osc); }
.viewport { position: fixed; inset: 0 0 48px 0; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.stage { width: 1280px; height: 720px; position: relative; flex: none; transform-origin: center center; background: var(--papel); box-shadow: 0 8px 40px rgba(29,42,51,.22); overflow: hidden; }
.slide { position: absolute; inset: 0; padding: 60px 80px 64px; display: none; flex-direction: column; justify-content: center; gap: 26px; font-size: 26px; line-height: 1.4; }
.slide.on { display: flex; }
.slide h1 { font-size: 104px; line-height: 1; font-weight: 800; letter-spacing: -.03em; }
.slide h2 { font-size: 50px; line-height: 1.08; font-weight: 800; letter-spacing: -.02em; max-width: 1040px; }
.slide .kicker { font: 700 17px var(--texto); letter-spacing: .1em; text-transform: uppercase; color: var(--litoral-osc); display: flex; gap: 12px; align-items: center; }
.slide p { max-width: 920px; font-size: 27px; color: var(--pizarra-2); }
.slide .big { font-size: 36px; color: var(--pizarra); font-weight: 700; }
.hip { font: 700 14px var(--texto); letter-spacing: .06em; text-transform: uppercase; background: #f1e7bd; color: #4a3d0c; border-radius: 4px; padding: 4px 9px; }
.slide.dark { background: var(--pizarra); color: #fff; }
.slide.dark h1, .slide.dark h2 { color: #fff; }
.slide.dark .kicker { color: var(--medio); }
.slide.dark p { color: #cfd8dc; }
.slide.dark .big { color: #fff; }
/* La franja de cinco días es la firma de la marca: va al pie de las portadas. */
.dias { position: absolute; left: 0; right: 0; bottom: 0; height: 18px; display: grid; grid-template-columns: repeat(5, 1fr); }
.dias i:nth-child(1) { background: var(--medio); } .dias i:nth-child(2) { background: var(--alto); } .dias i:nth-child(3) { background: var(--brasa); }
.dias i:nth-child(4) { background: var(--alto); opacity: .55; } .dias i:nth-child(5) { background: var(--medio); opacity: .55; }
.marca { position: absolute; top: 26px; right: 36px; width: 54px; height: 54px; }
.slide.dark .marca rect:first-child { fill: #2b3a45; }
.slide.dense { justify-content: flex-start; padding: 36px 56px 56px; gap: 15px; }
.slide.dense h2 { font-size: 39px; max-width: 1060px; }
.num3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 36px; margin-top: 6px; }
.num3 > div { border-top: 6px solid var(--pizarra); padding-top: 16px; display: flex; flex-direction: column; gap: 8px; }
.num3 > div:nth-child(1) { border-top-color: var(--brasa); } .num3 > div:nth-child(2) { border-top-color: var(--alto); } .num3 > div:nth-child(3) { border-top-color: var(--litoral); }
.num3 b { font: 800 70px var(--titulo); line-height: 1; letter-spacing: -.03em; white-space: nowrap; }
.num3 span { font-size: 23px; color: var(--pizarra-2); line-height: 1.3; }
.cards { display: grid; gap: 22px; margin-top: 6px; }
.c2 { grid-template-columns: repeat(2, 1fr); } .c3 { grid-template-columns: repeat(3, 1fr); } .c4 { grid-template-columns: repeat(4, 1fr); }
.card { background: var(--blanco); border-top: 6px solid var(--pizarra); padding: 22px 24px; display: flex; flex-direction: column; gap: 10px; }
.card.b { border-top-color: var(--brasa); } .card.a { border-top-color: var(--alto); } .card.l { border-top-color: var(--litoral); } .card.m { border-top-color: var(--medio); }
.card h3 { font-size: 30px; }
.dense .cards.c3 .card h3 { font-size: 40px; letter-spacing: -.02em; }
.card p { font-size: 21px; line-height: 1.35; }
.dense .card { padding: 16px 18px; } .dense .card h3 { font-size: 23px; } .dense .card p { font-size: 18.5px; }
.flow { display: flex; align-items: stretch; gap: 12px; margin-top: 8px; }
.flow .st { flex: 1; background: var(--blanco); border-top: 6px solid var(--linea); padding: 16px 16px; display: flex; flex-direction: column; gap: 6px; }
.flow .st.hi { background: var(--pizarra); border-top-color: var(--brasa); }
.flow .st.hi h3, .flow .st.hi p { color: #fff; }
.flow .st h3 { font-size: 23px; } .flow .st p { font-size: 18px; line-height: 1.3; }
.flow .ar { align-self: center; font: 800 30px var(--titulo); color: var(--pizarra-2); }
.tl { display: grid; grid-template-columns: repeat(5, 1fr); margin-top: 10px; }
.tl > div { padding: 18px 16px 0 0; display: flex; flex-direction: column; gap: 8px; border-top: 10px solid var(--linea); }
.tl > div:nth-child(1) { border-top-color: var(--bajo); } .tl > div:nth-child(2) { border-top-color: var(--medio); } .tl > div:nth-child(3) { border-top-color: var(--alto); }
.tl > div:nth-child(4) { border-top-color: var(--brasa); } .tl > div:nth-child(5) { border-top-color: var(--litoral); }
.tl b { font: 800 25px var(--titulo); } .tl span { font-size: 20px; line-height: 1.3; color: var(--pizarra-2); }
.tabla { display: grid; font-size: 19px; background: var(--blanco); }
.tabla > div { padding: 8px 12px; border-bottom: 1px solid var(--linea); align-content: center; }
.tabla .chip { vertical-align: middle; }
.tabla .h { font: 700 13px var(--texto); letter-spacing: .06em; text-transform: uppercase; color: var(--pizarra-2); background: var(--bruma); border: 0; }
.tabla .barra { display: inline-block; height: 12px; background: var(--pizarra); vertical-align: middle; margin-right: 10px; }
.tabla b { font: 800 22px var(--titulo); }
.t-pesos { grid-template-columns: 1.3fr 1.2fr 2.2fr; } .t-comp { grid-template-columns: 1.1fr 2fr 1.9fr; } .t-reg { grid-template-columns: .7fr 1fr 1fr .8fr 1.6fr 1fr; }
.t-real { grid-template-columns: 1.5fr .9fr 2.2fr; } .t-plan { grid-template-columns: 1.3fr 2.4fr .8fr 2fr; }
.chip { font: 700 14px var(--texto); padding: 3px 9px; border-radius: 3px; white-space: nowrap; background: var(--bruma); }
.chip.b { background: var(--brasa); color: #fff; } .chip.a { background: var(--alto); } .chip.v { background: var(--bajo); } .chip.m { background: var(--medio); }
.note { font-size: 19px !important; color: var(--pizarra-2); max-width: none !important; }
.srcline { position: absolute; left: 80px; right: 80px; bottom: 26px; font-size: 13.5px !important; color: var(--pizarra-2); line-height: 1.35; max-width: none !important; }
.dense .srcline { left: 56px; right: 56px; }
.srcline a { color: var(--litoral-osc); }
.src-list { margin: 0; padding-left: 26px; display: flex; flex-direction: column; gap: 5px; font-size: 14.5px; line-height: 1.3; }
.src-list a { word-break: break-all; }
.quote { font: 800 62px/1.08 var(--titulo); letter-spacing: -.02em; max-width: 1040px; }
.pills { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.pills span { border: 2px solid rgba(255,255,255,.5); color: #fff; border-radius: 4px; padding: 10px 20px; font-weight: 700; font-size: 21px; }
.pills a { background: var(--medio); color: var(--pizarra); border-radius: 4px; padding: 12px 24px; font-weight: 700; font-size: 21px; text-decoration: none; }
.ph3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 26px; }
.ph3 > div { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.ph3 h3 { font-size: 20px; text-align: center; }
.phone { width: 100%; max-width: 330px; background: #0d151a; border-radius: 26px; padding: 9px; }
.screen { background: var(--bruma); border-radius: 18px; overflow: hidden; display: flex; flex-direction: column; font-size: 12.5px; line-height: 1.35; text-align: left; }
.screen-top { background: var(--pizarra); color: #fff; padding: 9px 12px; font-weight: 700; font-size: 13px; display: flex; justify-content: space-between; }
.screen-top small { font-weight: 400; opacity: .8; }
.screen-in { padding: 9px; display: flex; flex-direction: column; gap: 7px; }
.al { background: #fff; border-left: 6px solid var(--brasa); padding: 8px 9px; }
.al.p { border-left-color: var(--alto); }
.al b { display: block; font: 800 15px var(--titulo); margin: 3px 0 1px; }
.al .ac { display: grid; grid-template-columns: 15px 1fr; gap: 6px; padding: 5px 0; border-top: 1px solid var(--linea); margin-top: 5px; }
.al .ac i { width: 13px; height: 13px; border: 1.5px solid var(--pizarra-2); border-radius: 2px; margin-top: 2px; }
.al .ac i.ok { background: var(--litoral); border-color: var(--litoral); }
.al small { color: var(--pizarra-2); }
.noti { background: #fff; border-radius: 12px; padding: 9px 11px; box-shadow: 0 1px 4px rgba(0,0,0,.15); }
.noti b { display: block; font-size: 13px; }
.wsp { background: #efeae2; } .wsp .screen-top { background: #1f6e8c; }
.msg { background: #e7f6df; color: #1d3a17; border-radius: 10px 10px 2px 10px; padding: 8px 10px; white-space: pre-line; }
.shots { display: grid; grid-template-columns: 2.35fr 1fr; gap: 22px; align-items: start; }
.shots figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
.shots img { width: 100%; display: block; border: 1px solid var(--linea); max-height: 450px; object-fit: cover; object-position: top; }
.shots figcaption { font-size: 15px; color: var(--pizarra-2); }
.ctrl { position: fixed; left: 0; right: 0; bottom: 0; height: 48px; background: var(--pizarra); color: #fff; display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 14px; }
.ctrl button { background: transparent; border: 1px solid rgba(255,255,255,.5); color: #fff; border-radius: 4px; padding: 6px 16px; font: 700 13px var(--texto); cursor: pointer; }
.ctrl button:hover { background: rgba(255,255,255,.15); }
.ctrl a { color: #fff; font-size: 13px; opacity: .85; text-decoration: none; padding: 6px 10px; }
.ctrl a:hover { opacity: 1; text-decoration: underline; }
.ctrl .links { position: absolute; right: 16px; display: flex; gap: 4px; }
.ctrl .brandc { position: absolute; left: 16px; font: 800 16px var(--titulo); }
:focus-visible { outline: 3px solid var(--medio); outline-offset: 2px; }
@media (max-width: 720px) { .ctrl .links, .ctrl .brandc { display: none; } }
"""

JS = """
(function () {
  const slides = Array.from(document.querySelectorAll(".slide")), stage = document.getElementById("stage");
  let i = Math.max(0, Math.min(slides.length - 1, (parseInt(location.hash.slice(1), 10) || 1) - 1));
  function show() {
    slides.forEach((s, k) => s.classList.toggle("on", k === i));
    document.getElementById("count").textContent = (i + 1) + " / " + slides.length;
    history.replaceState(null, "", "#" + (i + 1));
  }
  function fit() { stage.style.transform = "scale(" + Math.min(innerWidth / 1280, (innerHeight - 48) / 720) + ")"; }
  const go = d => { i = Math.max(0, Math.min(slides.length - 1, i + d)); show(); };
  document.getElementById("prev").onclick = () => go(-1);
  document.getElementById("next").onclick = () => go(1);
  document.getElementById("fs").onclick = () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
  addEventListener("keydown", e => {
    if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); go(1); }
    else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); go(-1); }
    else if (e.key === "Home") { i = 0; show(); } else if (e.key === "End") { i = slides.length - 1; show(); }
    else if (e.key === "f" || e.key === "F") document.getElementById("fs").click();
  });
  addEventListener("resize", fit); fit(); show();
})();
"""


def slide(cuerpo: str, clase: str = "") -> str:
    return f'<section class="slide {clase}">{MARCA}{cuerpo}</section>'


def portada(kicker: str, lema: str, pie: str) -> str:
    return slide(f'<div class="kicker">{kicker}</div><h1>Preaviso</h1><p class="big">{lema}</p><p>{pie}</p><div class="dias"><i></i><i></i><i></i><i></i><i></i></div>', "dark")


def pagina(titulo: str, slides: list[str], otra: tuple[str, str]) -> str:
    return f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{titulo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head>
<body>
<div class="viewport"><main class="stage" id="stage">
{chr(10).join(slides)}
</main></div>
<div class="ctrl">
  <span class="brandc">Preaviso</span>
  <button id="prev">← Anterior</button><span id="count">1 / 1</span><button id="next">Siguiente →</button><button id="fs">Pantalla completa</button>
  <span class="links"><a href="{MAQUETA}/index.html">Plataforma web</a><a href="{MAQUETA}/movil.html">Vista de terreno</a><a href="{otra[1]}">{otra[0]}</a></span>
</div>
<script>{JS}</script>
</body>
</html>
"""


H = '<span class="hip">hipótesis</span>'

# Piezas que comparten las dos versiones -------------------------------------------------------

TELEFONOS = """<div class="ph3">
  <div><h3>La alerta llega a la app de terreno</h3><div class="phone"><div class="screen"><div class="screen-top">Preaviso <small>Terreno</small></div><div class="screen-in">
    <div class="al"><span class="chip b">Activar hoy</span><b>Viña Las Tórtolas</b><small>Quilpué, 120 personas</small><br>Mañana, probabilidad de foco 33 %. Confianza alta.
      <div class="ac"><i class="ok"></i><span>Suspender soldadura, esmerilado y quemas<br><small>Jefatura de faena</small></span></div>
      <div class="ac"><i></i><span>Dejar un vehículo listo para evacuar<br><small>Jefatura de faena</small></span></div></div>
    <div class="al p"><span class="chip a">Preparar hoy</span><b>Escuela Los Litres</b><small>Valparaíso, 85 personas</small></div>
  </div></div></div></div>
  <div><h3>Vibra cuando aparece una alerta nueva</h3><div class="phone"><div class="screen" style="background:#33434e; min-height: 250px;"><div class="screen-in" style="padding-top:60px">
    <div class="noti"><b>Activar hoy: Viña Las Tórtolas</b>Quilpué. Mañana, probabilidad de foco 33 %.</div>
    <div class="noti"><b>3 alertas nuevas, 1 por activar hoy</b>Posta rural El Arrayán, SAPU Los Aromos y más</div>
  </div></div></div></div>
  <div><h3>El parte también sale por WhatsApp</h3><div class="phone"><div class="screen wsp"><div class="screen-top">Prevención de riesgos <small>grupo</small></div><div class="screen-in">
    <div class="msg">Preaviso, parte del sábado 14 de noviembre

ACTIVAR HOY (9)
- Viña Las Tórtolas (Quilpué, 120 personas). Mañana, probabilidad de foco 33 %. Confianza alta.
   · Suspender soldadura, esmerilado y quemas [Jefatura de faena]
   · Dejar un vehículo listo para evacuar [Jefatura de faena]</div>
  </div></div></div></div>
</div>
<p class="note">Los nombres y números de estas pantallas son de la maqueta y son inventados.</p>"""

PESOS = [("Probabilidad de foco", 30, "Qué tan probable es que haya fuego en la comuna ese día"),
         ("Personas expuestas", 25, "Cuántas personas hay en los puntos de la organización"),
         ("Humo esperado", 15, "Partículas finas de humo esperadas"),
         ("Casas junto a vegetación", 10, "Parte de la comuna donde se juntan viviendas y vegetación"),
         ("Cercanía en el tiempo", 10, "Mañana pesa más que dentro de cinco días"),
         ("Confianza del pronóstico", 10, "Un pronóstico de confianza alta pesa más")]


def tabla_pesos() -> str:
    filas = "".join(f'<div>{n}</div><div><span class="barra" style="width:{p * 4}px"></span><b>{p}</b></div><div>{d}</div>' for n, p, d in PESOS)
    return f'<div class="tabla t-pesos"><div class="h">Factor</div><div class="h">Peso de partida</div><div class="h">Qué mide</div>{filas}</div>'


def capturas() -> str:
    return f"""<div class="shots">
  <figure><img src="{img('web-prioridad.png')}" alt="Pantalla de prioridad de la plataforma web, con las comunas ordenadas por puntaje"><figcaption>Plataforma web, para quien decide y coordina. Prioridad por comuna con el aporte de cada factor.</figcaption></figure>
  <figure><img src="{img('app-terreno.png')}" alt="App de terreno con una alerta y sus acciones"><figcaption>App de Android, para quien está en terreno.</figcaption></figure>
</div>"""


REAL = [("Historia de focos por comuna", '<span class="chip v">Real</span>', "345 comunas, desde noviembre de 2000, con la serie que corrige el cambio de satélite"),
        ("Contornos de las comunas", '<span class="chip v">Real</span>', "Biblioteca del Congreso Nacional de Chile"),
        ("Plataforma web y app de Android", '<span class="chip v">Funciona</span>', "Nueve vistas en la web. Alertas con vibración en la app"),
        ("Riesgo de foco del motor", '<span class="chip m">En validación</span>', "El back todavía no publica riesgo ni métricas"),
        ("Humo y alza de urgencias respiratorias", '<span class="chip a">Inventado</span>', "La maqueta usa el coeficiente del metaanálisis con humo inventado"),
        ("Puntos, protocolos y registro", '<span class="chip a">Inventado</span>', "Son de un cliente de ejemplo")]


def tabla_real() -> str:
    filas = "".join(f"<div>{a}</div><div>{b}</div><div>{c}</div>" for a, b, c in REAL)
    return f'<div class="tabla t-real"><div class="h">Pieza</div><div class="h">Estado hoy</div><div class="h">Detalle</div>{filas}</div>'


def lamina_dinero(n: Notas, kicker: str) -> str:
    return slide(f"""<div class="kicker">{kicker}</div><h2>Tras un solo incendio el país creó un fondo de hasta $800.000 millones</h2>
<div class="num3">
  <div><b>$800.000 M</b><span>es el tope del fondo que el Estado creó en 2024 para reconstruir tras el incendio de Valparaíso {n.n('fondo')}</span></div>
  <div><b>US$723,5 M</b><span>en daños a viviendas e infraestructura por ese incendio, según una estimación preliminar de Clapes UC {n.n('clapes')}</span></div>
  <div><b>$156.000 M</b><span>es el presupuesto del plan contra incendios forestales de la temporada 2024-2025 {n.n('plan')}</span></div>
</div>
<p class="note">Las tres cifras miden lo que se gasta después de que el fuego parte. La estimación de Clapes UC se hizo a una semana del incendio y sus autores advierten que puede subir.</p>
{n.pie('fondo', 'clapes', 'plan')}""")


def lamina_valor(n: Notas, kicker: str) -> str:
    return slide(f"""<div class="kicker">{kicker}</div><h2>Cada 1 % de daño evitado en un incendio así equivale a US$7,2 millones</h2>
<div class="cards c3">
  <div class="card b"><h3>US$7,2 millones</h3><p>vale cada 1 % del daño estimado del incendio de Valparaíso de 2024. Es un cálculo propio sobre los US$723,5 millones de Clapes UC {n.n('clapes')}.</p></div>
  <div class="card a"><h3>4 a 36 veces</h3><p>rinde cada dólar puesto en pronóstico y alerta temprana en países en desarrollo, según el Banco Mundial {n.n('bm')}. La cifra es para tormentas, inundaciones y olas de calor.</p></div>
  <div class="card l"><h3>6 %</h3><p>bajó el costo de una inundación gracias al aviso y a las medidas tomadas, en el caso más prudente que cita ese mismo estudio {n.n('bm')}.</p></div>
</div>
<p class="note">El ahorro que lograría Preaviso todavía no está medido. No encontramos una cifra de beneficio de la alerta temprana específica para incendios. El piloto mide tres cosas en dinero: el costo de un día de faena detenida, los días de trabajo perdidos y las atenciones de urgencia.</p>
{n.pie('clapes', 'bm')}""", "dense")


def lamina_fuentes(n: Notas) -> str:
    return slide(f'<div class="kicker">Fuentes</div><h2>De dónde sale cada cifra</h2><ol class="src-list">{n.lista()}</ol>'
                 '<p class="note">El informe interno de producto reúne 57 fuentes y marca qué tan firme es cada afirmación.</p>', "dense")


# ---------- versión 1: lenguaje de Cupo Vivo ----------

def version_1() -> str:
    n = Notas()
    s = [
        portada("Propuesta para equipos de prevención de riesgos y redes de salud", "Saber qué hacer días antes del fuego y del humo.", "Equipo AIVital, NASA Space Apps 2026"),
        lamina_dinero(n, "Lo que cuesta llegar tarde"),
        lamina_valor(n, "Lo que vale llegar antes"),
        slide(f"""<div class="kicker">El problema</div><h2>Hoy se actúa cuando la alerta roja ya está declarada</h2>
<div class="num3">
  <div><b>72 horas</b><span>para evaluar riesgos, contadas desde la alerta roja, según la instrucción de la SUSESO a las mutualidades {n.n('suseso')}</span></div>
  <div><b>99 %</b><span>de los incendios forestales en Chile los origina una persona, según cifras de CONAF citadas en prensa {n.n('causas')}</span></div>
  <div><b>+0,36 %</b><span>de urgencias respiratorias por cada 1 µg/m³ de humo fino, el mismo día, según un metaanálisis {n.n('humo')}</span></div>
</div>{n.pie('suseso', 'causas', 'humo')}"""),
        slide("""<div class="kicker">La idea</div><h2>Preaviso hace tres cosas simples</h2>
<div class="cards c3">
  <div class="card b"><h3>Prioriza</h3><p>Ordena las comunas según el riesgo de foco, las personas expuestas y el humo esperado.</p></div>
  <div class="card a"><h3>Avisa</h3><p>Manda cada alerta a la app de terreno y por WhatsApp, con las acciones y quién las hace.</p></div>
  <div class="card l"><h3>Registra</h3><p>Anota qué se hizo y qué pasó después, y propone qué umbral conviene mover.</p></div>
</div>"""),
        slide(f"""<div class="kicker">1 · Prioriza</div><h2>Seis factores pesan distinto y juntos ordenan dónde mirar primero</h2>
{tabla_pesos()}
<p class="note">Puntaje de 0 a 100. Desde 60 la comuna queda en alerta y desde 40 en atención. Los pesos y los cortes son de partida y cada organización los ajusta en la plataforma.</p>""", "dense"),
        slide(f"""<div class="kicker">2 · Avisa</div><h2>Cada persona recibe la alerta con sus tareas, en el teléfono y por WhatsApp</h2>{TELEFONOS}""", "dense"),
        slide("""<div class="kicker">3 · Registra</div><h2>Cada aviso queda anotado con lo que se hizo y lo que pasó</h2>
<div class="tabla t-reg"><div class="h">Fecha</div><div class="h">Comuna</div><div class="h">Aviso</div><div class="h">Se actuó</div><div class="h">Qué pasó</div><div class="h">Resultado</div>
  <div>12 nov</div><div>Rancagua</div><div>24 horas antes</div><div>No</div><div>Hubo humo sobre el umbral</div><div><span class="chip v">Acierto</span></div>
  <div>9 nov</div><div>Quillota</div><div>48 horas antes</div><div>Sí</div><div>Hubo foco sobre el umbral</div><div><span class="chip v">Acierto</span></div>
  <div>7 nov</div><div>Constitución</div><div>24 horas antes</div><div>Sí</div><div>Sin foco ni humo</div><div><span class="chip a">Falsa alarma</span></div>
  <div>5 nov</div><div>Tomé</div><div>Sin aviso</div><div></div><div>Hubo foco</div><div><span class="chip b">Sin aviso previo</span></div>
</div>
<div class="cards c2">
  <div class="card l"><h3>Qué conviene ajustar</h3><p>Si 4 de cada 10 avisos de un protocolo son falsas alarmas, la plataforma propone subir su umbral. Si 1 de cada 4 casos llega sin aviso, propone bajarlo.</p></div>
  <div class="card"><h3>Decide una persona</h3><p>La plataforma propone el cambio y el equipo de prevención lo aprueba.</p></div>
</div>
<p class="note">Las filas son de la maqueta y son inventadas.</p>""", "dense"),
        slide(f"""<div class="kicker">El ciclo de un aviso</div><h2>Qué pasa antes de cada día de riesgo</h2>
<div class="tl">
  <div><b>5 a 3 días antes</b><span>Vigilancia. El punto aparece en la lista y todavía no pide acción.</span></div>
  <div><b>2 días antes</b><span>Preparación. Revisar vías de salida, mascarillas y contactos.</span></div>
  <div><b>1 día antes</b><span>Activación. Suspender trabajos con chispa y dejar un vehículo listo.</span></div>
  <div><b>El día</b><span>Freno. Si el pronóstico baja del umbral, el aviso se levanta.</span></div>
  <div><b>Después</b><span>Registro. Se anota si hubo foco o humo y si se actuó.</span></div>
</div>
<p class="note">El método de preparar y activar por etapas con un umbral acordado viene de la acción anticipatoria que se usa en inundaciones y calor {n.n('anticipacion')}.</p>{n.pie('anticipacion')}"""),
        slide(f"""<div class="kicker">Lo que ya existe</div><h2>Preaviso usa las capas públicas y agrega la acción</h2>
<div class="cards c4">
  <div class="card"><h3>NASA FIRMS</h3><p>Focos activos en menos de 3 horas, a 375 m con VIIRS {n.n('firms')}</p></div>
  <div class="card"><h3>GWIS</h3><p>Peligro por clima hasta 9 días, a 8 km {n.n('gwis')}</p></div>
  <div class="card"><h3>CONAF, Botón Rojo</h3><p>Zonas con probabilidad de ignición de 70 % o más y viento de 20 km/h o más {n.n('conaf')}</p></div>
  <div class="card"><h3>Copernicus CAMS</h3><p>Pronóstico de humo a 5 días, a unos 40 km {n.n('cams')}</p></div>
</div>
<p class="note">Las cuatro terminan en un mapa o en una alerta. Preaviso parte de ellas y entrega una lista de acciones con responsable.</p>{n.pie('firms', 'gwis', 'conaf', 'cams')}""", "dense"),
        slide(f"""<div class="kicker">Así se ve hoy</div><h2>Dos pantallas para dos personas distintas</h2>{capturas()}""", "dense"),
        slide(f"""<div class="kicker">Qué es real hoy</div><h2>La historia de focos ya es real y el pronóstico todavía es de ejemplo</h2>
{tabla_real()}
<p class="note">Ejemplo real. Viña del Mar registró 32 focos equivalentes MODIS en febrero de 2024, un mes que normalmente no tiene focos en la comuna {n.n('datos')}.</p>{n.pie('datos')}""", "dense"),
        slide("""<div class="kicker">Propuesta de piloto</div><h2>Un mes con tus centros para comprobarlo con datos propios</h2>
<div class="cards c4">
  <div class="card b"><h3>Semana 1</h3><p>Cargar los puntos y acordar umbrales y acciones de dos protocolos.</p></div>
  <div class="card a"><h3>Semanas 2 y 3</h3><p>Modo sombra. Preaviso avisa al equipo de prevención y no se interviene.</p></div>
  <div class="card m"><h3>Semana 4</h3><p>Avisos a terreno en 10 centros, con registro de lo que se hizo.</p></div>
  <div class="card l"><h3>Cierre</h3><p>Revisar aciertos y falsas alarmas y decidir si se amplía.</p></div>
</div>
<p class="big">En paralelo comparamos el motor con GWIS y Botón Rojo en las temporadas 2022-23 y 2023-24.</p>"""),
        slide("""<div class="kicker">Lo que necesitamos</div><h2>Una lista de lugares, sin datos de personas</h2>
<div class="cards c2">
  <div class="card b"><h3>Tus puntos</h3><p>Nombre del centro, comuna, tipo, cantidad de personas y el rol que responde por él.</p></div>
  <div class="card l"><h3>Tus protocolos</h3><p>Qué hace hoy tu organización ante una alerta roja y quién lo decide.</p></div>
</div>"""),
        slide(f"""<div class="kicker">Siguiente paso</div><div class="quote">¿Qué harías distinto con dos días de aviso?</div>
<p class="big">Probemos Preaviso con 10 de tus centros durante un mes.</p>
<div class="pills"><a href="{MAQUETA}/index.html">Abrir la plataforma</a><a href="{MAQUETA}/movil.html">Abrir la vista de terreno</a><span>Equipo AIVital</span></div>
<div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"),
    ]
    s.append(lamina_fuentes(n))
    return pagina("Preaviso, propuesta", s, ("Versión para mentoría", "preaviso-pitch-v2-mentor.html"))


# ---------- versión 2: lenguaje del documento "cumplia mentor" ----------

def version_2() -> str:
    n = Notas()
    s = [
        portada("Validación de idea · sesión de mentoría", "Que la alerta llegue con días de anticipación y con tareas.", "Equipo AIVital · 14 de noviembre de 2026"),
        lamina_dinero(n, "Tamaño del problema en dinero"),
        lamina_valor(n, f"Valor de anticipar {H}"),
        slide(f"""<div class="kicker">Problema</div><h2>Quienes deben actuar parten cuando la alerta ya existe</h2>
<div class="num3">
  <div><b>3 fases</b><span>fija la SUSESO para las mutualidades desde la alerta roja: respuesta inmediata, evaluación a 72 horas y salud mental al mes {n.n('suseso')}</span></div>
  <div><b>20 min</b><span>después de que el fuego llegó a viviendas salieron las alertas al celular en Viña del Mar en 2024, como mínimo {n.n('ciper')}</span></div>
  <div><b>1 a 3 días</b><span>de desfase tienen las alzas de urgencias respiratorias por humo {n.n('humo')}</span></div>
</div>
<p class="note">Además, las herramientas que leímos terminan en un mapa, una detección o una simulación.</p>
{n.pie('suseso', 'ciper', 'humo', extra='La cifra de Viña del Mar viene de una columna de opinión que cita a la comisión investigadora.')}"""),
        slide(f"""<div class="kicker">Cliente y usuario</div><h2>Quien recibe la alerta en terreno no es quien paga</h2>
<div class="cards c2">
  <div class="card b"><h3>Usuario</h3><p>Jefatura de faena o encargado de emergencias. Recibe la alerta en la app y marca lo que hizo.</p></div>
  <div class="card l"><h3>Cliente</h3><p>Prevención de riesgos de una mutualidad o dirección de una red de salud. Define umbrales y aprueba el gasto.</p></div>
</div>
<div class="num3" style="grid-template-columns: repeat(2, 1fr)">
  <div><b>4</b><span>organismos administradores obligados a actuar ante incendios: ACHS, Mutual de Seguridad, IST e ISL {n.n('suseso')}</span></div>
  <div><b>30</b><span>usuarios de salud pública recibían cada mañana el pronóstico de demanda respiratoria en Columbia Británica {n.n('bcaps')}</span></div>
</div>{n.pie('suseso', 'bcaps')}""", "dense"),
        slide(f"""<div class="kicker">Segmento de partida {H}</div><h2>Partiríamos por las mutualidades, que tienen la obligación por escrito</h2>
<div class="cards c2">
  <div class="card b"><h3>A favor</h3><p>La SUSESO las instruyó a actuar por fases desde la alerta roja {n.n('suseso')}. Hay obligación y presupuesto probable.</p></div>
  <div class="card a"><h3>En contra</h3><p>Son cuatro compradores y la misma instrucción las remite a un visor público gratuito. Que paguen por anticipar días está sin comprobar.</p></div>
</div>
<p class="note">Segundo segmento: demanda respiratoria por humo para redes de salud. El efecto es de +0,36 % de urgencias respiratorias por cada 1 µg/m³ de humo fino {n.n('humo')}, y en Chile todavía no medimos si el motor mejora esa estimación.</p>{n.pie('suseso', 'humo')}""", "dense"),
        slide("""<div class="kicker">Solución · qué se necesita</div><h2>Priorizar, avisar y registrar antes de que el fuego o el humo lleguen</h2>
<div class="cards c3">
  <div class="card b"><h3>Priorizar</h3><p>Ordenar las comunas por riesgo de foco, personas expuestas y humo esperado.</p></div>
  <div class="card a"><h3>Avisar</h3><p>Alertas con acciones y responsable, en la app de terreno y por WhatsApp.</p></div>
  <div class="card l"><h3>Registrar</h3><p>Anotar aciertos, falsas alarmas y acciones, y proponer ajustes de umbral.</p></div>
</div>
<p class="note">Nivel 1: aviso anticipado a centros de trabajo. Nivel 2: además, alza esperada de urgencias respiratorias por comuna.</p>"""),
        slide(f"""<div class="kicker">Competencia</div><h2>Mirar y predecir ya está cubierto, y parte de eso es público</h2>
<div class="tabla t-comp"><div class="h">Herramienta</div><div class="h">Qué entrega</div><div class="h">Dónde termina</div>
  <div>NASA FIRMS {n.n('firms')}</div><div>Focos activos en menos de 3 horas</div><div>Mapa y alerta por correo</div>
  <div>GWIS {n.n('gwis')}</div><div>Peligro por clima hasta 9 días, a 8 km</div><div>Mapa. Solo usa clima</div>
  <div>CONAF, Botón Rojo {n.n('conaf')}</div><div>Zonas críticas por ignición y viento</div><div>Mapa, tres veces por semana</div>
  <div>Modelo de ECMWF {n.n('ecmwf')}</div><div>Probabilidad de incendio a 9 km, con clima, combustible e igniciones</div><div>Resultado diario para usuarios de ECMWF y países miembros {n.n('ecmwf_nota')}</div>
  <div>OroraTech {n.n('ororatech')}</div><div>Detección satelital y peligro a 9 días</div><div>Alertas y API. ARAUCO es cliente</div>
  <div>Technosylva {n.n('technosylva')}</div><div>Riesgo por activo y respuesta</div><div>Acciones para agencias de incendios y eléctricas</div>
</div>
<p class="note">En lo que leímos, nadie entrega acciones con responsable para seguridad laboral o salud. Leímos páginas de producto y documentación, sin probar las herramientas.</p>
{n.pie('firms', 'gwis', 'conaf', 'ecmwf', 'ecmwf_nota', 'ororatech', 'technosylva')}""", "dense"),
        slide(f"""<div class="kicker">Producto</div><h2>De los focos del satélite a una alerta con tareas en el teléfono</h2>
<div class="flow">
  <div class="st"><h3>Focos y clima</h3><p>NASA FIRMS y datos abiertos</p></div><div class="ar">›</div>
  <div class="st"><h3>Riesgo por comuna</h3><p>Motor del equipo</p></div><div class="ar">›</div>
  <div class="st"><h3>Prioridad</h3><p>Seis factores con peso</p></div><div class="ar">›</div>
  <div class="st hi"><h3>Alerta con acciones</h3><p>App y WhatsApp</p></div><div class="ar">›</div>
  <div class="st"><h3>Registro</h3><p>Aciertos y falsas alarmas</p></div>
</div>
{capturas()}""", "dense"),
        slide(f"""<div class="kicker">Diferenciación {H}</div><h2>Podríamos diferenciarnos por la acción y por el acierto medido</h2>
<div class="cards c2">
  <div class="card b"><h3>Acción</h3><p>Protocolos con umbral, anticipación, responsable y freno. El método existe en inundaciones y calor {n.n('anticipacion')} y no encontramos casos con incendios o humo.</p>
    <p>Propuesta: partir con dos protocolos acordados con una mutualidad.</p></div>
  <div class="card l"><h3>Acierto</h3><p>Los autores del modelo europeo dicen que los índices clásicos de peligro generan falsas alarmas {n.n('ecmwf')}. Nuestro motor todavía no tiene su acierto medido.</p>
    <p>Propuesta: medirlo contra GWIS y Botón Rojo y publicarlo en la vista de contraste.</p></div>
</div>
<p class="note">Referencia externa: en el modelo europeo, usar solo clima o solo igniciones degrada el acierto cerca de 30 % frente a usar clima, combustible e igniciones juntos {n.n('ecmwf')}.</p>{n.pie('anticipacion', 'ecmwf')}""", "dense"),
        slide(f"""<div class="kicker">Estado · medición propia</div><h2>Lo que ya funciona y lo que todavía es de ejemplo</h2>
{tabla_real()}
<p class="note">Medición propia del 14 de noviembre de 2026 sobre los archivos que publica el equipo {n.n('datos')}. La plataforma tiene 16 pruebas automáticas de sus reglas.</p>{n.pie('datos')}""", "dense"),
        slide("""<div class="kicker">Plan de validación</div><h2>Cuatro pruebas, cada una con su condición para detenerse</h2>
<div class="tabla t-plan"><div class="h">Prueba</div><div class="h">Qué se hace</div><div class="h">Plazo</div><div class="h">Se detiene si</div>
  <div>0. El motor contra lo gratuito</div><div>Comparar acierto y anticipación con GWIS, Botón Rojo y el modelo europeo en 2022-23 y 2023-24</div><div>2 a 3 semanas</div><div>Acierta igual o gana menos de un día</div>
  <div>1. Datos de salud</div><div>Confirmar si el DEIS publica urgencias respiratorias diarias por comuna y con qué atraso</div><div>1 semana</div><div>El atraso supera los 7 días</div>
  <div>2. Necesidad en mutualidades</div><div>8 a 10 entrevistas con prevención de riesgos y una con la SUSESO</div><div>4 semanas</div><div>Menos de 2 pagarían por anticipar días</div>
  <div>3. Humo y urgencias</div><div>Comparar una base simple contra la base más la señal del motor, en 10 comunas o más</div><div>4 a 6 semanas</div><div>El error baja menos de 10 %</div>
</div>
<p class="note">Los umbrales son propuestas del equipo. Ninguna prueba se ha iniciado.</p>""", "dense"),
        slide(f"""<div class="kicker">Lo que pedimos</div><div class="quote">¿Qué prueba harías primero?</div>
<p class="big">Pedimos una hora para revisar la prueba del motor y un contacto en prevención de riesgos de una mutualidad.</p>
<div class="pills"><a href="{MAQUETA}/index.html">Abrir la plataforma</a><a href="{MAQUETA}/producto.html">Informe interno</a><span>Equipo AIVital</span></div>
<div class="dias"><i></i><i></i><i></i><i></i><i></i></div>""", "dark"),
    ]
    s.append(lamina_fuentes(n))
    return pagina("Preaviso, validación de idea", s, ("Versión propuesta", "preaviso-pitch-v1-propuesta.html"))


if __name__ == "__main__":
    for nombre, contenido in (("preaviso-pitch-v1-propuesta.html", version_1()), ("preaviso-pitch-v2-mentor.html", version_2())):
        (AQUI / nombre).write_text(contenido, encoding="utf-8")
        print(nombre, len(contenido) // 1024, "KB")
