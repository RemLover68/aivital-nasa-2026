// Plataforma web de Preaviso: mapa de Chile por periodo, vista de comuna con grilla, causas y recomendaciones.
// Los datos entran por api.js; las reglas de cálculo están en prediccion.js.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { RANGOS, SUPUESTOS_FABRICA, CORTES_RIESGO, CRITERIOS, claseRiesgo, cortesRelativos, causasConEtiqueta, recomendar,
  unidadDeCelda, masRiesgosas, leerHash, aHash, clp, clpCorto } from "./prediccion.js";
import { $, esc, dec, fFecha, leer, guardar } from "./util.js";

const S = { vista: "chile", rango: "esta-semana", comuna: null, celda: null, orden: leer("preaviso.orden", "reduccion"), supuestos: { ...SUPUESTOS_FABRICA, ...leer("preaviso.supuestos", {}) } };
const D = { contornos: null, nombres: {}, chile: {}, comuna: {} };   // lo ya pedido, por rango
let mapa = null, capas = {}, ultimaVista = null;
const fp = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const fha = (v) => dec(v, v < 10 ? 1 : 0);
const periodoTxt = (per) => per ? `${fFecha(per.desde, { day: "numeric", month: "long" })} al ${fFecha(per.hasta, { day: "numeric", month: "long", year: "numeric" })}` : "";
const nombreDe = (id) => D.nombres[id]?.nombre ?? id;
// El origen de los datos (back, ejemplo o sintético) se dice una sola vez, en el pie y en Metodología: sin avisos ni etiquetas repetidas.
const ETQ = "";

// ------------------------------------------------------------------ datos
async function cargarContornos() {
  if (D.contornos) return;
  D.contornos = await api.contornos();
  for (const f of D.contornos.features) D.nombres[f.properties.region_id] = f.properties;
}
async function chile() { return (D.chile[S.rango] ??= await api.prediccionChile(S.rango)); }
async function comuna() {
  const k = S.comuna + "|" + S.rango;
  if (!(k in D.comuna)) {
    // Si no hay detalle en el back ni en la copia de ejemplo, api.js lo arma sintético con el contorno y el riesgo del mapa.
    const [ch] = await Promise.all([chile(), cargarContornos()]);
    D.comuna[k] = await api.prediccionComuna(S.comuna, S.rango, { feature: geoDe(S.comuna), p: ch.items.find((i) => i.region_id === S.comuna)?.p, periodo: ch.periodo });
  }
  return D.comuna[k];
}

// ------------------------------------------------------------------ marco: rangos, avisos, navegación
function pintarMarco(periodo, ejemplo, origen) {
  $("#rangos").innerHTML = RANGOS.map((r) => `<button type="button" role="radio" aria-checked="${r.id === S.rango}" data-rango="${r.id}">${esc(r.nombre)}</button>`).join("");
  for (const p of document.querySelectorAll("[data-periodo]")) p.textContent = periodo ? periodoTxt(periodo) : "";
  for (const b of document.querySelectorAll(".navegacion button")) b.removeAttribute("aria-current");
  const vistaNav = S.vista === "comuna" ? "comuna" : S.vista;
  document.querySelector(`.navegacion [data-vista="${vistaNav}"]`)?.setAttribute("aria-current", "page");
  const nc = $("#nav-comuna");
  nc.hidden = !S.comuna;
  nc.textContent = S.comuna ? nombreDe(S.comuna) : "";
  $("#fuente-datos").textContent = origen === "back" ? "Predicción leída del back." : origen === "ejemplo" ? "Predicción de ejemplo, no sale del modelo." : origen === "sintetico" ? "Predicción sintética calculada en el navegador, no sale del modelo." : "";
}

// ------------------------------------------------------------------ mapa
function nuevoMapa(clave, limites) {
  const previo = mapa && ultimaVista === clave ? { c: mapa.getCenter(), z: mapa.getZoom() } : null;
  if (mapa) { mapa.remove(); mapa = null; }
  capas = {};
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
  L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17, opacity: 0.55 }).addTo(mapa);
  if (previo) mapa.setView(previo.c, previo.z); else mapa.fitBounds(limites, { padding: [6, 6] });
  ultimaVista = clave;
}
const geoDe = (id) => D.contornos.features.find((f) => f.properties.region_id === id);

const TXT_CORTES = ["menos de 10 %", "10 % a 25 %", "25 % a 45 %", "45 % a 65 %", "65 % o más"];
function leyenda(titulo, textos, nota) {
  return `<div class="leyenda"><h3>${esc(titulo)}</h3><ul>${textos.map((t, i) => `<li><i class="r${i}"></i>${esc(t)}</li>`).join("")}</ul>${nota ? `<p class="nota">${nota}</p>` : ""}</div>`;
}

async function vistaChile() {
  const [datos] = await Promise.all([chile(), cargarContornos()]);
  const por = Object.fromEntries(datos.items.map((i) => [i.region_id, i]));
  $("#contenido").innerHTML = `<div class="vista-mapa">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de Chile con el riesgo de incendio por comuna"></div>
      ${leyenda("Probabilidad de al menos un incendio en el periodo", TXT_CORTES, datos.ejemplo ? "Valores de ejemplo." : "")}</div>
    <aside class="lateral">
      <h1>Riesgo de incendio en Chile${datos.ejemplo ? ETQ : ""}</h1>
      <p class="periodo" data-periodo></p>
      <p class="bajada">Probabilidad de al menos un incendio en el periodo. Haz clic en una comuna para ver su detalle.</p>
      <div class="buscador"><label for="buscar">Buscar una comuna</label>
        <input id="buscar" list="lista-comunas" placeholder="Escribe el nombre" autocomplete="off">
        <datalist id="lista-comunas">${datos.items.map((i) => `<option value="${esc(nombreDe(i.region_id))} (${esc((D.nombres[i.region_id]?.region ?? "").replace(/^Región (de |del |de la )?/, ""))})"></option>`).join("")}</datalist></div>
      <h2>Las 10 comunas con más riesgo</h2>
      <ol class="lista-top">${masRiesgosas(datos.items, Object.fromEntries(Object.entries(D.nombres).map(([k, v]) => [k, v.nombre])), 10).map((i) =>
        `<li><button type="button" data-comuna="${i.region_id}"><span>${esc(nombreDe(i.region_id))}<span class="region">${esc((D.nombres[i.region_id]?.region ?? "").replace(/^Región (de |del |de la )?/, ""))}</span></span><span class="valor"><i class="r${claseRiesgo(i.p)}" aria-hidden="true"></i>${fp(i.p)}</span></button></li>`).join("")}</ol>
    </aside></div>`;
  nuevoMapa("chile", [[-55.9, -75.7], [-17.5, -66.4]]);
  L.geoJSON(D.contornos, {
    filter: (f) => por[f.properties.region_id] != null,
    style: (f) => {
      const it = por[f.properties.region_id];
      return { color: "#8a979f", weight: 0.3, fillColor: colorR(claseRiesgo(it.p)), fillOpacity: 0.82 };
    },
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = por[id];
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong><br>${fp(it.p)} de probabilidad · riesgo ${NIVELES[claseRiesgo(it.p)].toLowerCase()}`, { sticky: true });
      capa.on("click", () => ir({ comuna: id, vista: "comuna" }));
    },
  }).addTo(mapa);
  pintarMarco(datos.periodo, datos.ejemplo, datos.origen);
}
const COLORES = ["#fff3b0", "#fdc863", "#f08a3c", "#d4472b", "#8c1d18"];
// El nivel se dice con palabras además del color: el color solo no alcanza para quien no distingue tonos.
const NIVELES = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"];
const chipNivel = (p) => `<span class="nivel r${claseRiesgo(p)}">Riesgo ${NIVELES[claseRiesgo(p)].toLowerCase()}</span>`;
const colorR = (i) => COLORES[Math.max(0, i)];

// ------------------------------------------------------------------ comuna
function panelResumen(u, titulo, cel, prom, ej) {
  return `<div class="cifra-grande"><strong>${fp(u.prob)}</strong>${cel ? "" : chipNivel(u.prob)}<span>de probabilidad de que ocurra un incendio ${cel ? "dentro de esta celda" : "en la comuna"} en el periodo${ej ? ETQ : ""}</span></div>
    ${cel ? `<p class="celda-info">Esta celda tiene ${dec(u.prob / prom, 1)} veces el riesgo promedio de las celdas de la comuna.</p>` : ""}
    <dl class="datos-resumen">
      <div><dt>Tamaño estimado si ocurre un incendio</dt><dd>${fha(u.ha[1])} ha esperadas<small>Rango probable: de ${fha(u.ha[0])} a ${fha(u.ha[2])} ha (percentiles 10 y 90)</small></dd></div>
      <div><dt>Personas expuestas</dt><dd>${Math.round(u.personas_expuestas).toLocaleString("es-CL")}<small>Viven cerca de la vegetación que podría arder</small></dd></div>
    </dl>`;
}
function panelCausas(u, cat) {
  const cs = causasConEtiqueta(u, cat);
  const mod = cs.filter((c) => c.modificable).reduce((a, c) => a + c.pct, 0);
  const max = Math.max(...cs.map((c) => c.pct));
  const fila = (c) => `<li class="${c.modificable ? "mod" : "nomod"}"><div class="fila"><span>${esc(c.nombre)}<small>${c.modificable ? "Modificable" : "No modificable"}</small></span><span class="pct">${dec(c.pct, 1)} %</span></div>
      <div class="barra" aria-hidden="true"><b style="width:${(c.pct / max) * 100}%"></b></div></li>`;
  return `<h2>Por qué: causas del riesgo</h2>
    <p class="nota"><strong>${dec(mod, 0)} %</strong> del riesgo depende de causas que el municipio puede modificar (barras verdes). El resto no se puede cambiar (barras grises).</p>
    <ul class="causas">${cs.slice(0, 4).map(fila).join("")}</ul>
    ${cs.length > 4 ? `<details class="mas-causas"><summary>Ver las otras ${cs.length - 4} causas</summary><ul class="causas">${cs.slice(4).map(fila).join("")}</ul>
      <p class="nota">Contribución de cada variable a la salida del modelo. Todas suman 100 %.</p></details>` : ""}`;
}
function panelRecs(u, cat, ej) {
  const recs = recomendar(u, cat, S.supuestos, S.orden);
  return `<h2>Qué hacer: recomendaciones</h2>
    <p class="nota">Solo sobre causas modificables.</p>
    <div class="orden"><label for="orden">Ordenar por</label>
      <select id="orden">${Object.entries(CRITERIOS).map(([k, v]) => `<option value="${k}"${k === S.orden ? " selected" : ""}>${v}</option>`).join("")}</select></div>
    ${recs.length ? `<ol class="recs">${recs.map((r) => `<li><h3>${esc(r.nombre)}</h3><dl>
      <div><dt>Reduce la probabilidad en</dt><dd>${dec(r.reduccion_pp, 1)} puntos<small>de ${fp(u.prob)} a ${fp(Math.max(0, u.prob - r.reduccion_pp / 100))}</small></dd></div>
      <div><dt>Costo para el municipio</dt><dd>${clpCorto(r.costo_clp)}<small>${clp(r.costo_clp)}</small></dd></div>
      <div><dt>Beneficio esperado</dt><dd>${clpCorto(r.beneficio.total)}<small>vidas ${clpCorto(r.beneficio.vidas)}, propiedades ${clpCorto(r.beneficio.propiedad)}, combate evitado ${clpCorto(r.beneficio.otro)}</small></dd></div>
      <div><dt>Beneficio sobre costo</dt><dd>${r.razon == null ? "—" : dec(r.razon, 2) + " veces"} ${r.razon >= 1 ? '<span class="chip bueno">Beneficio mayor que el costo</span>' : ""}</dd></div></dl></li>`).join("")}</ol>`
      : '<p class="nota">No hay recomendaciones para esta unidad.</p>'}
    <details class="supuestos"><summary>Supuestos usados (editables)</summary><div class="campos">
      <label>Valor de una vida estadística (CLP)<input type="number" min="0" step="1000000" data-sup="vsl_clp" value="${S.supuestos.vsl_clp}"><small>Cuánto vale evitar una muerte. Propuesta del equipo, sin fuente.</small></label>
      <label>Valor de propiedad por hectárea afectada (CLP)<input type="number" min="0" step="500000" data-sup="valor_propiedad_ha_clp" value="${S.supuestos.valor_propiedad_ha_clp}"><small>Viviendas, cultivos y bosque que se pierden por hectárea quemada. Propuesta del equipo.</small></label>
      <label>Costo de combate por hectárea (CLP)<input type="number" min="0" step="100000" data-sup="costo_combate_ha_clp" value="${S.supuestos.costo_combate_ha_clp}"><small>Brigadas, aeronaves y maquinaria que se gastan por hectárea. Propuesta del equipo.</small></label>
      <button type="button" class="boton claro" id="sup-fabrica">Volver a los valores de fábrica</button>
      <p class="nota">Beneficio = reducción de probabilidad x (vidas esperadas x valor de vida + hectáreas esperadas x (propiedad + combate)).</p></div></details>`;
}

async function vistaComuna() {
  const [ch] = await Promise.all([chile(), cargarContornos()]);
  const arch = D.nombres[S.comuna] ? await comuna() : null;
  const id = S.comuna;
  const it = ch.items.find((i) => i.region_id === id);
  const info = D.nombres[id];
  if (!info) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Comuna no encontrada</h1><p>El código ${esc(id)} no está entre los contornos.</p><button class="boton" data-vista="chile">Volver al mapa de Chile</button></div>`; pintarMarco(ch.periodo, ch.ejemplo, ch.origen); return; }
  const ej = !!(arch?.ejemplo ?? ch.ejemplo);
  let cuerpo;
  if (!arch) {
    cuerpo = `<p class="cifra-grande"><strong>${fp(it?.p)}</strong><span>de probabilidad de que ocurra un incendio en la comuna en el periodo${ch.ejemplo ? ETQ : ""}</span></p>
      <p class="celda-info">Esta comuna todavía no tiene detalle por celdas, causas ni recomendaciones. Cuando el back lo publique aparecerá aquí.</p>`;
  } else {
    const comunaU = arch.resumen;
    const celdaSel = S.celda ? arch.grilla.celdas.find((c) => c.f === S.celda.f && c.c === S.celda.c) : null;
    const prom = arch.grilla.celdas.reduce((a, c) => a + c.p, 0) / arch.grilla.celdas.length;
    const u = celdaSel ? unidadDeCelda(celdaSel, arch) : comunaU;
    cuerpo = `${celdaSel ? `<p class="celda-info"><strong>Celda seleccionada</strong> (fila ${celdaSel.f + 1}, columna ${celdaSel.c + 1}). <button type="button" class="volver" id="quitar-celda">Ver toda la comuna</button></p>` : `<p class="nota">Haz clic en una celda del mapa para ver su detalle.</p>`}
      ${panelResumen(u, "", !!celdaSel, prom, ej)}${panelCausas(u, arch.catalogo)}${panelRecs(u, arch.catalogo, ej)}`;
  }
  $("#contenido").innerHTML = `<div class="vista-mapa comuna">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de la comuna con la grilla de riesgo"></div><div id="leyenda-caja"></div></div>
    <aside class="lateral" id="panel"><button type="button" class="volver" data-vista="chile">Volver al mapa de Chile</button>
      <h1>${esc(info.nombre)}</h1><p class="bajada">${esc(info.region)}</p><p class="periodo" data-periodo></p><div id="cuerpo-panel">${cuerpo}</div></aside></div>`;
  const feat = geoDe(id);
  const capa = L.geoJSON(feat, { style: { color: "#1d2a33", weight: 3, fill: false }, interactive: false });
  const lim = capa.getBounds();
  nuevoMapa("comuna:" + id, lim);
  if (arch) pintarGrilla(arch, ej);
  capa.addTo(mapa).bringToFront();
  pintarMarco(arch?.periodo ?? ch.periodo, ej, arch?.origen ?? ch.origen);
}

function pintarGrilla(arch, ej) {
  const g = arch.grilla, [w, s, e, n] = g.bbox, dx = (e - w) / g.columnas, dy = (n - s) / g.filas;
  const cortes = cortesRelativos(g.celdas.map((c) => c.p));
  const prom = g.celdas.reduce((a, c) => a + c.p, 0) / g.celdas.length;
  const clase = (p) => cortes.filter((c) => p >= c).length;
  const sel = (c) => S.celda && S.celda.f === c.f && S.celda.c === c.c;
  const estilo = (c) => ({ color: sel(c) ? "#000" : "#5b6770", weight: sel(c) ? 3.5 : 0.6, fillColor: colorR(clase(c.p)), fillOpacity: 0.72 });
  capas = {};
  for (const c of g.celdas) {
    const r = L.rectangle([[n - (c.f + 1) * dy, w + c.c * dx], [n - c.f * dy, w + (c.c + 1) * dx]], estilo(c)).addTo(mapa);
    r.bindTooltip(`Celda: ${fp(c.p)} de probabilidad<br>${fha(c.ha[1])} ha esperadas`, { sticky: true });
    r.on("click", () => { S.celda = { f: c.f, c: c.c }; for (const k of g.celdas) capas[`${k.f},${k.c}`].setStyle(estilo(k)); capas[`${c.f},${c.c}`].bringToFront(); refrescarPanel(arch); });
    capas[`${c.f},${c.c}`] = r;
  }
  const min = Math.min(...g.celdas.map((c) => c.p)), max = Math.max(...g.celdas.map((c) => c.p));
  const tramos = [min, ...cortes, max];
  $("#leyenda-caja").innerHTML = leyenda("Riesgo de cada celda (relativo a la comuna)",
    [0, 1, 2, 3, 4].map((i) => cortes.length ? `${fp(tramos[i])} a ${fp(tramos[i + 1])}` : fp(min)),
    `Promedio de las celdas: ${fp(prom)}.${ej ? " Valores de ejemplo." : ""}`);
}

function refrescarPanel(arch) {
  const comunaU = arch.resumen, ej = !!arch.ejemplo;
  const celdaSel = S.celda ? arch.grilla.celdas.find((c) => c.f === S.celda.f && c.c === S.celda.c) : null;
  const prom = arch.grilla.celdas.reduce((a, c) => a + c.p, 0) / arch.grilla.celdas.length;
  const u = celdaSel ? unidadDeCelda(celdaSel, arch) : comunaU;
  $("#cuerpo-panel").innerHTML = `${celdaSel ? `<p class="celda-info"><strong>Celda seleccionada</strong> (fila ${celdaSel.f + 1}, columna ${celdaSel.c + 1}). <button type="button" class="volver" id="quitar-celda">Ver toda la comuna</button></p>` : `<p class="nota">Haz clic en una celda del mapa para ver su detalle.</p>`}
    ${panelResumen(u, "", !!celdaSel, prom, ej)}${panelCausas(u, arch.catalogo)}${panelRecs(u, arch.catalogo, ej)}`;
  $("#panel").scrollTop = 0;
}

// ------------------------------------------------------------------ metodología y fuentes
async function vistaMetodologia() {
  let ch = null;
  try { ch = await chile(); } catch { /* sin datos: igual se muestra el texto */ }
  mapa?.remove(); mapa = null; ultimaVista = null;
  $("#contenido").innerHTML = `<div class="texto-largo"><h1>Metodología y fuentes</h1>
    <p>Preaviso ayuda al personal municipal a ver en qué parte de su comuna se concentra el riesgo de incendio en un periodo, por qué, y qué puede hacer el municipio para bajarlo.</p>
    <h2>Qué predice el modelo</h2>
    <p>La probabilidad de que ocurra al menos un incendio en un periodo fijo: esta semana, la próxima, dentro de dos semanas, este mes o el próximo. No predice día por día. Al elegir otro periodo se recalcula todo: mapa, causas y recomendaciones.</p>
    <h2>Mapa de Chile y vista de comuna</h2>
    <p>El mapa de Chile pinta cada comuna según su probabilidad. Al entrar a una comuna se ve una grilla de 8x8 a 12x12 celdas según el tamaño, cada una con su riesgo propio. Como una celda es mucho más chica que la comuna, su probabilidad es menor que la de la comuna entera: por eso el color de las celdas es relativo a la propia comuna y la leyenda lo dice.</p>
    <h2>Causas</h2>
    <p>Cada unidad (comuna o celda) muestra el porcentaje que aporta cada variable a la salida del modelo (pasto o combustible, temperatura, sequía, viento, cercanía a caminos y población, relieve, entre otras). Las causas se marcan como modificables por el municipio (pasto, interfaz con viviendas, basurales, quemas) o no modificables (clima, viento, relieve, ubicación).</p>
    <h2>Recomendaciones y beneficio</h2>
    <p>Solo se recomienda sobre causas modificables. Cada acción trae del back su reducción de probabilidad en puntos porcentuales y su costo en CLP. El beneficio se calcula en la pantalla, para que los supuestos se puedan cambiar:</p>
    <p class="formula">beneficio = (reducción en puntos / 100) x ( vidas esperadas si hay incendio x valor de vida estadística + hectáreas esperadas x (valor de propiedad por hectárea + costo de combate por hectárea) )<br>razón = beneficio / costo</p>
    <p>Los valores de fábrica son ${clpCorto(SUPUESTOS_FABRICA.vsl_clp)} por vida, ${clpCorto(SUPUESTOS_FABRICA.valor_propiedad_ha_clp)} de propiedad por hectárea y ${clpCorto(SUPUESTOS_FABRICA.costo_combate_ha_clp)} de combate por hectárea. Son una propuesta del equipo, sin fuente: el municipio debe poner los suyos.</p>
    <h2>Límites</h2>
    <ul>
      <li>${ch?.ejemplo !== false ? "Hoy todos los números de la plataforma son de ejemplo, generados con una fórmula simple y una semilla (scripts/generar_prediccion.py). No salen del modelo de ML." : "Los números vienen del back."}</li>
      <li>Si para una comuna no hay datos del back ni copia de ejemplo, la página calcula datos sintéticos en el navegador con la misma fórmula (<code>web/js/sintetico.js</code>) y lo dice en el pie de página.</li>
      <li>El contrato de datos que debe publicar el back está en <code>web/datos/ext/CONTRATO.md</code>.</li>
      <li>Según el equipo del back, el motor actual anticipa cómo se propaga un incendio activo; qué mide la predicción por periodo debe acordarse con el back.</li>
    </ul>
    <h2>Fuentes</h2>
    <ul>
      <li>NASA FIRMS. We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) <a href="https://earthdata.nasa.gov/firms">https://earthdata.nasa.gov/firms</a>.</li>
      <li>Biblioteca del Congreso Nacional de Chile. División comunal: polígonos de las comunas. <a href="https://www.bcn.cl/siit/mapas_vectoriales">https://www.bcn.cl/siit/mapas_vectoriales</a>. Material referencial.</li>
      <li>Equipo AIVital. Datos del contrato 0.2. <a href="https://github.com/marcelo-corro/aivital-incendios-datos">https://github.com/marcelo-corro/aivital-incendios-datos</a></li>
      <li>Crespo-Pérez y otros (2025). Wildfire occurrence in Chile: regional modeling and implications for risk management. Cuadernos de Investigación Geográfica 51(2). <a href="https://doi.org/10.18172/cig.6792">https://doi.org/10.18172/cig.6792</a></li>
      <li>Di Giuseppe, McNorton, Lombardi y Wetterhall (2025). Global data-driven prediction of fire activity. Nature Communications 16, 2918. <a href="https://doi.org/10.1038/s41467-025-58097-7">https://doi.org/10.1038/s41467-025-58097-7</a></li>
      <li>Colaboradores de OpenStreetMap. Mapa base. <a href="https://www.openstreetmap.org/copyright">https://www.openstreetmap.org/copyright</a></li>
    </ul></div>`;
  pintarMarco(ch?.periodo, ch?.ejemplo !== false && !!ch, ch?.origen);
}

// ------------------------------------------------------------------ navegación y eventos
function ir(cambio) {
  const nuevo = { rango: S.rango, comuna: S.comuna, vista: S.vista, ...cambio };
  if (nuevo.vista === "chile") nuevo.comuna = null;
  location.hash = aHash(nuevo);
}

async function pintar() {
  const h = leerHash(location.hash);
  const cambiaComuna = h.comuna !== S.comuna;
  S.rango = h.rango;
  S.comuna = h.comuna;
  S.vista = h.vista === "metodologia" ? "metodologia" : h.comuna ? "comuna" : "chile";
  if (cambiaComuna) S.celda = null;
  try {
    if (S.vista === "metodologia") await vistaMetodologia();
    else if (S.vista === "comuna") await vistaComuna();
    else await vistaChile();
  } catch (e) {
    console.error(e);
    $("#contenido").innerHTML = `<div class="texto-largo"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p></div>`;
  }
}

document.addEventListener("click", (e) => {
  const rango = e.target.closest("[data-rango]");
  if (rango) { ir({ rango: rango.dataset.rango }); return; }
  const v = e.target.closest("[data-vista]");
  if (v) { e.preventDefault(); ir({ vista: v.dataset.vista, comuna: v.dataset.vista === "comuna" ? S.comuna : null }); return; }
  const c = e.target.closest("[data-comuna]");
  if (c) { ir({ comuna: c.dataset.comuna, vista: "comuna" }); return; }
  if (e.target.id === "quitar-celda") {
    S.celda = null; pintar();
  }
  if (e.target.id === "sup-fabrica") { S.supuestos = { ...SUPUESTOS_FABRICA }; guardar("preaviso.supuestos", S.supuestos); repintarRecs(); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "orden") { S.orden = e.target.value; guardar("preaviso.orden", S.orden); repintarRecs(); }
  if (e.target.dataset?.sup) {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) { S.supuestos[e.target.dataset.sup] = v; guardar("preaviso.supuestos", S.supuestos); }
    repintarRecs();
  }
  if (e.target.id === "buscar") {
    const t = e.target.value.trim().toLowerCase();
    const id = Object.keys(D.nombres).find((k) => `${D.nombres[k].nombre} (${D.nombres[k].region.replace(/^Región (de |del |de la )?/, "")})`.toLowerCase() === t)
      ?? Object.keys(D.nombres).find((k) => D.nombres[k].nombre.toLowerCase() === t);
    if (id) ir({ comuna: id, vista: "comuna" });
  }
});

/** Recalcula solo el panel (orden y supuestos), sin recargar el mapa ni mover la selección. */
async function repintarRecs() {
  const arch = await comuna();
  if (!arch) return;
  const abierto = document.querySelector(".supuestos")?.open;
  const foco = document.activeElement?.dataset?.sup;
  const y = $("#panel").scrollTop;
  refrescarPanel(arch);
  $("#panel").scrollTop = y;
  const det = document.querySelector(".supuestos");
  if (det && abierto) det.open = true;
  if (foco) document.querySelector(`[data-sup="${foco}"]`)?.focus();
}

window.addEventListener("hashchange", pintar);
if (!location.hash) history.replaceState(null, "", aHash({ rango: S.rango, comuna: null, vista: "chile" }));
pintar();
