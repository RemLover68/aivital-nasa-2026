// Plataforma web de Preaviso en tres niveles: país (por región), región (comunas y grilla gruesa) y comuna (grilla fina,
// causas y recomendaciones). Los datos entran por api.js; las reglas de cálculo están en prediccion.js y region.js.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { RANGOS, SUPUESTOS_FABRICA, CRITERIOS, claseRiesgo, cortesRelativos, causasConEtiqueta, recomendar,
  unidadDeCelda, leerHash, aHash, clp, clpCorto } from "./prediccion.js";
import { regionDe, nombreCorto, regionesDe, grillaRegion, esContinental } from "./region.js";
import { montarTriaje } from "./vista-triaje.js";
import { $, esc, dec, fFecha, leer, guardar } from "./util.js";

const S = { vista: "pais", rango: "esta-semana", region: null, comuna: null, celda: null, detalle: leer("preaviso.detalle", "recs"),
  orden: leer("preaviso.orden", "reduccion"), supuestos: { ...SUPUESTOS_FABRICA, ...leer("preaviso.supuestos", {}) } };
const D = { contornos: null, nombres: {}, chile: {}, comuna: {} };   // lo ya pedido, por rango
let mapa = null, capas = {}, ultimaVista = null, desmontar = null;   // desmontar: limpia la vista de triaje al salir
const fp = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const fha = (v) => dec(v, v < 10 ? 1 : 0);
const periodoTxt = (per) => per ? `${fFecha(per.desde, { day: "numeric", month: "long" })} al ${fFecha(per.hasta, { day: "numeric", month: "long", year: "numeric" })}` : "";
const nombreDe = (id) => D.nombres[id]?.nombre ?? id;
// El origen de los datos (back, ejemplo o sintético) se dice una sola vez, en el pie y en Metodología: sin avisos ni etiquetas repetidas.
const ETQ = "";
const COLORES = ["#fff3b0", "#fdc863", "#f08a3c", "#d4472b", "#8c1d18"];
const colorR = (i) => COLORES[Math.max(0, i)];
// El nivel se dice con palabras además del color: el color solo no alcanza para quien no distingue tonos.
const NIVELES = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"];
const chipNivel = (p) => `<span class="nivel r${claseRiesgo(p)}">Riesgo ${NIVELES[claseRiesgo(p)].toLowerCase()}</span>`;
const OPACIDAD_CELDA = 0.3;   // las celdas dejan ver la imagen satelital

// ------------------------------------------------------------------ datos
async function cargarContornos() {
  if (D.contornos) return;
  D.contornos = await api.contornos();
  for (const f of D.contornos.features) D.nombres[f.properties.region_id] = f.properties;
}
const geoDe = (id) => D.contornos.features.find((f) => f.properties.region_id === id);
async function chile() { return (D.chile[S.rango] ??= await api.prediccionChile(S.rango)); }
async function comuna(id = S.comuna) {
  const k = id + "|" + S.rango;
  if (!(k in D.comuna)) {
    // Si no hay detalle en el back ni en la copia de ejemplo, api.js lo arma sintético con el contorno y el riesgo del mapa.
    const [ch] = await Promise.all([chile(), cargarContornos()]);
    D.comuna[k] = await api.prediccionComuna(id, S.rango, { feature: geoDe(id), p: ch.items.find((i) => i.region_id === id)?.p, periodo: ch.periodo });
  }
  return D.comuna[k];
}

// ------------------------------------------------------------------ marco: navegación, periodo y pie
function pintarMarco(origen) {
  const nombres = { triaje: "", pais: "", region: S.region ? nombreCorto(regionActual()?.nombre) : "", comuna: S.comuna ? nombreDe(S.comuna) : "" };
  for (const b of document.querySelectorAll(".navegacion button")) {
    const v = b.dataset.vista;
    b.toggleAttribute("aria-current", v === S.vista);
    if (v === S.vista) b.setAttribute("aria-current", "page");
    b.disabled = (v === "region" && !S.region) || (v === "comuna" && !S.comuna);
    b.querySelector("small").textContent = nombres[v] ?? "";
  }
  $("#fuente-datos").textContent = origen === "back" ? "Predicción leída del back." : origen === "ejemplo" ? "Predicción de ejemplo, no sale del modelo." : origen === "sintetico" ? "Predicción sintética calculada en el navegador, no sale del modelo." : "";
}
/** Selector de periodo: va arriba del panel, sobre el título. */
function barraPeriodo(periodo) {
  return `<div class="rangos"><div class="botones-rango" role="radiogroup" aria-label="Periodo">${RANGOS.map((r) =>
    `<button type="button" role="radio" aria-checked="${r.id === S.rango}" data-rango="${r.id}">${esc(r.nombre)}</button>`).join("")}</div>
    <p class="periodo" aria-live="polite">${esc(periodoTxt(periodo))}</p></div>`;
}
let regionesCache = {};
function regionActual() { return regionesCache[S.rango]?.find((r) => r.id === S.region) ?? null; }
async function regiones() {
  const [ch] = await Promise.all([chile(), cargarContornos()]);
  return (regionesCache[S.rango] ??= regionesDe(ch.items, D.nombres));
}

// ------------------------------------------------------------------ mapa
function nuevoMapa(clave, limites, relleno = {}) {
  const previo = mapa && ultimaVista === clave ? { c: mapa.getCenter(), z: mapa.getZoom() } : null;
  if (mapa) { mapa.remove(); mapa = null; }
  capas = {};
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
  L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17 }).addTo(mapa);
  if (CONFIG.TESELAS_NOMBRES) L.tileLayer(CONFIG.TESELAS_NOMBRES, { maxZoom: 17 }).addTo(mapa);
  if (previo) mapa.setView(previo.c, previo.z); else mapa.fitBounds(limites, { paddingTopLeft: [8, 8], paddingBottomRight: [8, 8], ...relleno });
  ultimaVista = clave;
}
/** Leyenda compacta: una barra de cinco tramos con los cortes debajo. */
function leyenda(titulo, cortes, nota) {
  return `<div class="leyenda"><h3>${esc(titulo)} (%)</h3>
    <div class="rampa" aria-hidden="true">${COLORES.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="cortes">${cortes.map((t) => `<span>${esc(String(t).replace(/\s?%$/, ""))}</span>`).join("")}</div>${nota ? `<p>${esc(nota)}</p>` : ""}</div>`;
}
const estiloCelda = (clase, sel) => ({ color: sel ? "#ffffff" : colorR(clase), opacity: sel ? 1 : 0.85, weight: sel ? 3.5 : 1, fillColor: colorR(clase), fillOpacity: sel ? 0.55 : OPACIDAD_CELDA });
/** Pinta una grilla (de comuna o de región) con colores relativos a sus propias celdas. Devuelve los cortes para la leyenda. */
function pintarCeldas(g, alTocar, tooltip) {
  const [w, s, e, n] = g.bbox, dx = (e - w) / g.columnas, dy = (n - s) / g.filas;
  const ps = g.celdas.map((c) => c.p), cortes = cortesRelativos(ps), clase = (p) => cortes.filter((c) => p >= c).length;
  const sel = (c) => !!S.celda && S.celda.f === c.f && S.celda.c === c.c;
  for (const c of g.celdas) {
    const r = L.rectangle([[n - (c.f + 1) * dy, w + c.c * dx], [n - c.f * dy, w + (c.c + 1) * dx]], { ...estiloCelda(clase(c.p), alTocar && sel(c)), interactive: !!alTocar }).addTo(mapa);
    if (tooltip) r.bindTooltip(tooltip(c), { sticky: true });
    if (alTocar) r.on("click", () => { alTocar(c); for (const k of g.celdas) capas[`${k.f},${k.c}`].setStyle(estiloCelda(clase(k.p), sel(k))); r.bringToFront(); });
    capas[`${c.f},${c.c}`] = r;
  }
  const min = Math.min(...ps), max = Math.max(...ps);
  return [min, ...cortes, max].map(fp);
}

// ------------------------------------------------------------------ país: una región, un color
async function vistaPais() {
  const [datos, regs] = await Promise.all([chile(), regiones()]);
  const porReg = Object.fromEntries(regs.map((r) => [r.id, r]));
  $("#contenido").innerHTML = `<div class="vista-mapa pais">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de Chile con el riesgo de incendio por región"></div>
      ${leyenda("Probabilidad promedio de incendio", ["0", "10", "25", "45", "65", "100 %"], datos.ejemplo ? "Valores de ejemplo." : "")}</div>
    <aside class="lateral">
      ${barraPeriodo(datos.periodo)}
      <h1>Riesgo de incendio en Chile</h1>
      <p class="bajada">Promedio de las comunas de cada región. Haz clic en una región para ver sus comunas.</p>
      <div class="buscador"><label for="buscar">Ir directo a una comuna</label>
        <input id="buscar" list="lista-comunas" placeholder="Escribe el nombre" autocomplete="off">
        <datalist id="lista-comunas">${datos.items.map((i) => `<option value="${esc(nombreDe(i.region_id))} (${esc(nombreCorto(D.nombres[i.region_id]?.region))})"></option>`).join("")}</datalist></div>
      <h2>Regiones, de mayor a menor riesgo</h2>
      <ol class="lista-top">${regs.map((r) =>
        `<li><button type="button" data-region="${r.id}"><span>${esc(r.nombre)}<span class="region">${r.comunas.length} comunas</span></span><span class="valor"><i class="r${claseRiesgo(r.p)}" aria-hidden="true"></i>${fp(r.p)}</span></button></li>`).join("")}</ol>
    </aside></div>`;
  nuevoMapa("pais", [[-55.9, -75.7], [-17.5, -66.4]]);
  const deRegion = {};
  const estilo = (r, encima) => ({ color: encima ? "#ffffff" : colorR(claseRiesgo(r.p)), weight: encima ? 1.2 : 0.6, opacity: 0.9, fillColor: colorR(claseRiesgo(r.p)), fillOpacity: encima ? 0.8 : 0.55 });
  L.geoJSON(D.contornos, {
    filter: (f) => porReg[regionDe(f.properties.region_id)] != null,
    style: (f) => estilo(porReg[regionDe(f.properties.region_id)], false),
    onEachFeature: (f, capa) => {
      const r = porReg[regionDe(f.properties.region_id)];
      (deRegion[r.id] ??= []).push(capa);
      capa.bindTooltip(`<strong>${esc(r.nombre)}</strong><br>${fp(r.p)} de probabilidad promedio · riesgo ${NIVELES[claseRiesgo(r.p)].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => deRegion[r.id].forEach((k) => k.setStyle(estilo(r, true))));
      capa.on("mouseout", () => deRegion[r.id].forEach((k) => k.setStyle(estilo(r, false))));
      capa.on("click", () => ir({ region: r.id }));
    },
  }).addTo(mapa);
  pintarMarco(datos.origen);
}

// ------------------------------------------------------------------ región: comunas completas y grilla gruesa
async function vistaRegion() {
  const [datos, regs] = await Promise.all([chile(), regiones()]);
  const reg = regs.find((r) => r.id === S.region);
  if (!reg) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Región no encontrada</h1><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(datos.origen); return; }
  const comunas = [...reg.comunas].sort((a, b) => b.p - a.p || nombreDe(a.region_id).localeCompare(nombreDe(b.region_id), "es"));
  $("#contenido").innerHTML = `<div class="vista-mapa region">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de la región con sus comunas"></div><div id="leyenda-caja"></div></div>
    <aside class="lateral">
      ${barraPeriodo(datos.periodo)}
      <button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al país</button>
      <h1>${esc(reg.nombre)}</h1>
      <div class="cifra-grande"><strong>${fp(reg.p)}</strong>${chipNivel(reg.p)}<span>de probabilidad promedio de incendio en sus ${reg.comunas.length} comunas en el periodo</span></div>
      <h2>Comunas, de mayor a menor riesgo</h2>
      <ol class="lista-top">${comunas.map((i) =>
        `<li><button type="button" data-comuna="${i.region_id}"><span>${esc(nombreDe(i.region_id))}</span><span class="valor"><i class="r${claseRiesgo(i.p)}" aria-hidden="true"></i>${fp(i.p)}</span></button></li>`).join("")}</ol>
    </aside></div>`;
  const feats = reg.comunas.map((i) => geoDe(i.region_id)).filter(Boolean);
  const enTierra = feats.filter(esContinental);
  nuevoMapa("region:" + reg.id, L.geoJSON(enTierra.length ? enTierra : feats).getBounds(), { paddingBottomRight: [8, 70] });
  pintarMarco(datos.origen);
  // La grilla gruesa sale del detalle de cada comuna: se pide todo junto y se pinta cuando llega.
  const rango = S.rango;
  const detalle = await Promise.all(feats.map(async (f) => ({ id: f.properties.region_id, feature: f, arch: await comuna(f.properties.region_id) })));
  if (S.vista !== "region" || S.region !== reg.id || S.rango !== rango || !mapa) return;
  const g = grillaRegion(detalle);
  if (g) $("#leyenda-caja").innerHTML = leyenda("Riesgo de cada celda (relativo a la región)", pintarCeldas(g), "Cada celda promedia unas 4 celdas de comuna.");
  const por = Object.fromEntries(reg.comunas.map((i) => [i.region_id, i]));
  L.geoJSON({ type: "FeatureCollection", features: feats }, {
    style: { color: "#ffffff", weight: 1.3, opacity: 0.95, fillColor: "#ffffff", fillOpacity: 0 },
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id;
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong><br>${fp(por[id]?.p)} de probabilidad`, { sticky: true });
      capa.on("mouseover", () => capa.setStyle({ weight: 3, fillOpacity: 0.15 }));
      capa.on("mouseout", () => capa.setStyle({ weight: 1.3, fillOpacity: 0 }));
      capa.on("click", () => ir({ comuna: id }));
    },
  }).addTo(mapa);
}

// ------------------------------------------------------------------ comuna
function panelResumen(u, cel) {
  return `<div class="cifra-grande"><strong>${fp(u.prob)}</strong>${cel ? "" : chipNivel(u.prob)}<span>de probabilidad de que ocurra un incendio ${cel ? "dentro de esta celda" : "en la comuna"} en el periodo</span></div>
    <dl class="datos-resumen">
      <div><dt>Tamaño estimado si ocurre un incendio</dt><dd>${fha(u.ha[1])} ha<small>Rango probable: de ${fha(u.ha[0])} a ${fha(u.ha[2])} ha</small></dd></div>
      <div><dt>Personas expuestas</dt><dd>${Math.round(u.personas_expuestas).toLocaleString("es-CL")}<small>Viven cerca de la vegetación que podría arder</small></dd></div>
    </dl>`;
}
function panelCausas(u, cat) {
  const cs = causasConEtiqueta(u, cat);
  const mod = cs.filter((c) => c.modificable).reduce((a, c) => a + c.pct, 0);
  const max = Math.max(...cs.map((c) => c.pct));
  const fila = (c) => `<li class="${c.modificable ? "mod" : "nomod"}"><div class="fila"><span>${esc(c.nombre)}<small>${c.modificable ? "Modificable" : "No modificable"}</small></span><span class="pct">${dec(c.pct, 1)} %</span></div>
      <div class="barra" aria-hidden="true"><b style="width:${(c.pct / max) * 100}%"></b></div></li>`;
  return `<p class="nota"><strong>${dec(mod, 0)} %</strong> del riesgo depende de causas que el municipio puede modificar (barras verdes). El resto no se puede cambiar (barras grises).</p>
    <ul class="causas">${cs.map(fila).join("")}</ul>`;
}
function panelRecs(u, cat) {
  const recs = recomendar(u, cat, S.supuestos, S.orden);
  return `<p class="nota">Solo sobre causas que el municipio puede modificar.</p>
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

function cuerpoComuna(arch) {
  const celdaSel = S.celda ? arch.grilla.celdas.find((c) => c.f === S.celda.f && c.c === S.celda.c) : null;
  const u = celdaSel ? unidadDeCelda(celdaSel, arch) : arch.resumen;
  const info = D.nombres[S.comuna];
  const pest = (id, txt) => `<button type="button" role="tab" aria-selected="${S.detalle === id}" data-detalle="${id}">${txt}</button>`;
  return `<div class="col-resumen">
      ${celdaSel ? `<button type="button" class="boton claro volver-btn" id="quitar-celda">&larr; Volver a la comuna</button>`
        : `<button type="button" class="boton claro volver-btn" data-vista="region">&larr; Volver a la región</button>`}
      <h1>${esc(info.nombre)}</h1><p class="bajada">${esc(info.region)}</p>
      ${panelResumen(u, !!celdaSel)}
      ${celdaSel ? "" : `<p class="nota pista">Haz clic en una celda del mapa para ver su detalle.</p>`}
    </div>
    <div class="col-detalle">
      <div class="pestanas" role="tablist" aria-label="Detalle">${pest("recs", "Recomendaciones")}${pest("causas", "Causas")}</div>
      <div id="detalle">${S.detalle === "causas" ? panelCausas(u, arch.catalogo) : panelRecs(u, arch.catalogo)}</div>
    </div>`;
}

async function vistaComuna() {
  const [ch] = await Promise.all([chile(), regiones()]);
  const id = S.comuna, info = D.nombres[id];
  if (!info) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Comuna no encontrada</h1><p>El código ${esc(id)} no está entre los contornos.</p><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(ch.origen); return; }
  const arch = await comuna();
  $("#contenido").innerHTML = `<div class="vista-mapa comuna">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de la comuna con la grilla de riesgo"></div><div id="leyenda-caja"></div></div>
    <aside class="lateral" id="panel">${barraPeriodo(arch?.periodo ?? ch.periodo)}<div class="panel-cols" id="cuerpo-panel">${arch ? cuerpoComuna(arch) : `<p class="nota">Esta comuna no tiene detalle.</p>`}</div></aside></div>`;
  const capa = L.geoJSON(geoDe(id), { style: { color: "#ffffff", weight: 3, fill: false }, interactive: false });
  nuevoMapa("comuna:" + id, capa.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 84] });
  if (arch) {
    const cortes = pintarCeldas(arch.grilla, (c) => { S.celda = { f: c.f, c: c.c }; refrescarPanel(arch); }, (c) => `Celda: ${fp(c.p)} de probabilidad<br>${fha(c.ha[1])} ha esperadas`);
    $("#leyenda-caja").innerHTML = leyenda("Riesgo de cada celda (relativo a la comuna)", cortes, arch.ejemplo ? "Valores de ejemplo." : "");
  }
  capa.addTo(mapa).bringToFront();
  pintarMarco(arch?.origen ?? ch.origen);
}
function refrescarPanel(arch) {
  $("#cuerpo-panel").innerHTML = cuerpoComuna(arch);
}

// ------------------------------------------------------------------ metodología y fuentes
async function vistaMetodologia() {
  let ch = null;
  try { ch = await chile(); } catch { /* sin datos: igual se muestra el texto */ }
  mapa?.remove(); mapa = null; ultimaVista = null;
  $("#contenido").innerHTML = `<div class="texto-largo"><button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al mapa</button><h1>Metodología y fuentes</h1>
    <p>Preaviso ayuda al personal municipal a ver en qué parte de su comuna se concentra el riesgo de incendio en un periodo, por qué, y qué puede hacer el municipio para bajarlo.</p>
    <h2>Qué predice el modelo</h2>
    <p>La probabilidad de que ocurra al menos un incendio en un periodo fijo: esta semana, la próxima, dentro de dos semanas, este mes o el próximo. No predice día por día. Al elegir otro periodo se recalcula todo: mapa, causas y recomendaciones.</p>
    <h2>Sala de triaje</h2>
    <p>Muestra, para cada incendio avisado, la probabilidad de que no se controle el día de inicio, el porqué, los activos que tiene en el camino con un tiempo aproximado de llegada y la cola de todos los incendios del día ordenada por prioridad. Es un apoyo a la decisión, no una orden operativa ni una alerta a la población. Funciona en modo repetición: se elige un día (16, 17 o 18 de enero de 2026) y se avanza la hora; los incendios aparecen según su hora de inicio y la cola se reordena. Al llegar al fin del día se ve qué pasó de verdad y el tablero de acierto. Nombre, lugar, hora de inicio, combustible y resultado real salen del registro de CONAF; la probabilidad, los factores, el avance y los activos son hoy de ejemplo, inventados con una fórmula simple, y no usan el resultado real.</p>
    <h2>País, región y comuna</h2>
    <p>El mapa del país pinta cada región con el promedio de la probabilidad de sus comunas. Al entrar a una región se ven sus comunas y una grilla gruesa, donde cada celda promedia unas cuatro celdas de comuna. Al entrar a una comuna se ve una grilla de 8x8 a 12x12 celdas según el tamaño, cada una con su riesgo propio. Como una celda es mucho más chica que la comuna, su probabilidad es menor que la de la comuna entera: por eso el color de las celdas es relativo a la propia comuna y la leyenda lo dice.</p>
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
      <li>CONAF. Registro de incendios forestales (capa incendios_totales), datos públicos bajados el 14 de noviembre de 2026. <a href="https://www.conaf.cl/">https://www.conaf.cl/</a></li>
      <li>Esri, Maxar, Earthstar Geographics y la comunidad de usuarios de SIG. World Imagery: imagen satelital del mapa base. <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9</a></li>
      <li>Colaboradores de OpenStreetMap. Mapa base anterior. <a href="https://www.openstreetmap.org/copyright">https://www.openstreetmap.org/copyright</a></li>
    </ul></div>`;
  pintarMarco(ch?.origen);
}


// ------------------------------------------------------------------ navegación y eventos
function ir(cambio) {
  const n = { rango: S.rango, region: S.region, comuna: S.comuna, vista: null, ...cambio };
  if ("region" in cambio && !("comuna" in cambio)) n.comuna = null;
  if (n.vista === "pais" || n.vista === "triaje") { n.region = null; n.comuna = null; }
  if (n.vista === "region") n.comuna = null;
  if (n.comuna) n.region = regionDe(n.comuna);
  location.hash = aHash(n);
}

async function vistaTriaje() {
  if (mapa) { mapa.remove(); mapa = null; ultimaVista = null; }
  $("#contenido").innerHTML = "";
  desmontar = await montarTriaje($("#contenido"), { alCargar: (origen) => pintarMarco(origen) });
}

async function pintar() {
  if (desmontar) { desmontar(); desmontar = null; }
  const h = leerHash(location.hash);
  if (h.comuna !== S.comuna) S.celda = null;
  S.rango = h.rango; S.region = h.region; S.comuna = h.comuna;
  S.vista = h.vista === "metodologia" ? "metodologia" : h.comuna ? "comuna" : h.region ? "region" : h.vista === "triaje" ? "triaje" : "pais";
  try {
    if (S.vista === "triaje") await vistaTriaje();
    else if (S.vista === "metodologia") await vistaMetodologia();
    else if (S.vista === "comuna") await vistaComuna();
    else if (S.vista === "region") await vistaRegion();
    else await vistaPais();
  } catch (e) {
    console.error(e);
    $("#contenido").innerHTML = `<div class="texto-largo"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p></div>`;
  }
}

document.addEventListener("click", (e) => {
  const rango = e.target.closest("[data-rango]");
  if (rango) { ir({ rango: rango.dataset.rango, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  const v = e.target.closest("[data-vista]");
  if (v) { e.preventDefault(); if (!v.disabled) ir({ vista: v.dataset.vista }); return; }
  const r = e.target.closest("[data-region]");
  if (r) { ir({ region: r.dataset.region }); return; }
  const c = e.target.closest("[data-comuna]");
  if (c) { ir({ comuna: c.dataset.comuna }); return; }
  const d = e.target.closest("[data-detalle]");
  if (d) { S.detalle = d.dataset.detalle; guardar("preaviso.detalle", S.detalle); repintarPanel(); return; }
  if (e.target.id === "quitar-celda") { S.celda = null; pintar(); }
  if (e.target.id === "sup-fabrica") { S.supuestos = { ...SUPUESTOS_FABRICA }; guardar("preaviso.supuestos", S.supuestos); repintarPanel(); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "orden") { S.orden = e.target.value; guardar("preaviso.orden", S.orden); repintarPanel(); }
  if (e.target.dataset?.sup) {
    const v = Number(e.target.value);
    if (Number.isFinite(v) && v >= 0) { S.supuestos[e.target.dataset.sup] = v; guardar("preaviso.supuestos", S.supuestos); }
    repintarPanel();
  }
  if (e.target.id === "buscar") {
    const t = e.target.value.trim().toLowerCase();
    const id = Object.keys(D.nombres).find((k) => `${D.nombres[k].nombre} (${nombreCorto(D.nombres[k].region)})`.toLowerCase() === t)
      ?? Object.keys(D.nombres).find((k) => D.nombres[k].nombre.toLowerCase() === t);
    if (id) ir({ comuna: id });
  }
});

/** Recalcula solo el panel (pestaña, orden y supuestos), sin recargar el mapa ni mover la selección. */
async function repintarPanel() {
  const arch = await comuna();
  if (!arch) return;
  const abierto = document.querySelector(".supuestos")?.open;
  const foco = document.activeElement?.dataset?.sup;
  const y = document.querySelector(".col-detalle")?.scrollTop ?? 0;
  refrescarPanel(arch);
  const col = document.querySelector(".col-detalle");
  if (col) col.scrollTop = y;
  const det = document.querySelector(".supuestos");
  if (det && abierto) det.open = true;
  if (foco) document.querySelector(`[data-sup="${foco}"]`)?.focus();
}

window.addEventListener("hashchange", pintar);
if (!location.hash) history.replaceState(null, "", aHash({ rango: S.rango, vista: "triaje" }));
pintar();
