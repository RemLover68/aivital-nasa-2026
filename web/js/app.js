// Plataforma web de Preaviso: País, Región y Comuna en una sola pantalla. Sobre el mapa de riesgo del día van los incendios del día
// (cola por prioridad, ficha con el porqué y los activos en el camino). Los datos entran por api.js; las reglas de cálculo
// están en prediccion.js (riesgo), region.js (zonas) y triaje.js (incendios).
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { SUPUESTOS_FABRICA, CRITERIOS, claseRiesgo, cortesRelativos, causasConEtiqueta, recomendar, unidadDeCelda, leerHash, aHash, clpCorto } from "./prediccion.js";
import { regionDe, nombreCorto, regionesDe, grillaRegion, esContinental, localizarIncendios } from "./region.js";
import { FECHAS, FECHA_INICIAL, diaValido, UMBRAL_ALERTA, esAlerta, horaDe, horaTxt, ordenarCola, filtrar, claseP, NIVELES_P, COLORES_P, sector } from "./triaje.js";
import { $, esc, dec, fFecha, leer, guardar } from "./util.js";

const S = { vista: "pais", dia: FECHA_INICIAL, region: null, comuna: null, celda: null, inc: null, tab: "incendios",
  orden: leer("preaviso.orden", "reduccion"), supuestos: { ...SUPUESTOS_FABRICA, ...leer("preaviso.supuestos", {}) } };
const D = { contornos: null, nombres: {}, chile: {}, comuna: {}, inc: {}, regiones: {} };   // lo ya pedido, por día
let mapa = null, capas = {}, ultimaVista = null, capaFuegos = null, capaDetalle = null, CTX = {}, zoomAlLlegar = false;
const fp = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const fha = (v) => dec(v, v < 10 ? 1 : 0);
const nombreDe = (id) => D.nombres[id]?.nombre ?? id;
const COLORES = ["#fff3b0", "#fdc863", "#f08a3c", "#d4472b", "#8c1d18"];
const colorR = (i) => COLORES[Math.max(0, i)];
// Color del anillo de un incendio en alerta: el de su nivel.
const ANILLO = ["#e6c75a", "#e6c75a", "#f08a3c", "#d4472b", "#b01e18"];
// El nivel se dice con palabras además del color: el color solo no alcanza para quien no distingue tonos.
const NIVELES = ["Muy bajo", "Bajo", "Medio", "Alto", "Muy alto"];
const chipNivel = (p) => `<span class="nivel r${claseRiesgo(p)}">Riesgo ${NIVELES[claseRiesgo(p)].toLowerCase()}</span>`;
const OPACIDAD_CELDA = 0.3;   // las celdas dejan ver la imagen satelital
const TIPO_ACTIVO = { vivienda: "Viviendas", escuela: "Escuela", salud: "Salud", planta: "Planta forestal", ruta: "Ruta", electrico: "Línea eléctrica" };
const COLOR_ACTIVO = { vivienda: "#1f6e8c", escuela: "#5f8f6b", salud: "#7c688a", planta: "#a06a2c", ruta: "#51616c", electrico: "#c9a227" };

// ------------------------------------------------------------------ datos
async function cargarContornos() {
  if (D.contornos) return;
  D.contornos = await api.contornos();
  for (const f of D.contornos.features) D.nombres[f.properties.region_id] = f.properties;
}
const geoDe = (id) => D.contornos.features.find((f) => f.properties.region_id === id);
async function chile() { return (D.chile[S.dia] ??= await api.riesgoChileDia(S.dia)); }
async function comuna(id = S.comuna) {
  const k = id + "|" + S.dia;
  if (!(k in D.comuna)) {
    const [ch] = await Promise.all([chile(), cargarContornos()]);
    D.comuna[k] = await api.riesgoComunaDia(id, S.dia, { feature: geoDe(id), p: ch.items.find((i) => i.region_id === id)?.p, periodo: ch.periodo });
  }
  return D.comuna[k];
}
async function regiones() {
  const [ch] = await Promise.all([chile(), cargarContornos()]);
  return (D.regiones[S.dia] ??= regionesDe(ch.items, D.nombres));
}
/** Los incendios del día, con su comuna y región puestas según el contorno que contiene el punto. */
async function incendios() {
  if (!D.inc[S.dia]) {
    const [t] = await Promise.all([api.triaje(S.dia), cargarContornos()]);
    D.inc[S.dia] = { ...t, incendios: localizarIncendios(t.incendios, D.contornos.features) };
  }
  return D.inc[S.dia];
}
const umbral = () => D.inc[S.dia]?.modelo?.umbral ?? UMBRAL_ALERTA;
/** Los incendios de la zona que se está mirando, en orden de prioridad. */
const aqui = () => ordenarCola(filtrar(D.inc[S.dia]?.incendios ?? [], S.vista === "comuna" ? { comuna: S.comuna } : S.vista === "region" ? { region: S.region } : {}));
const alcance = () => (S.vista === "comuna" ? "en la comuna" : S.vista === "region" ? "en la región" : "en Chile");

// ------------------------------------------------------------------ marco: navegación y pie
function pintarMarco(origenRiesgo) {
  const nombres = { pais: "", region: S.region ? nombreCorto(Object.values(D.nombres).find((n) => regionDe(n.region_id) === S.region)?.region) : "", comuna: S.comuna ? nombreDe(S.comuna) : "" };
  for (const b of document.querySelectorAll(".navegacion button")) {
    const v = b.dataset.vista;
    b.removeAttribute("aria-current");
    if (v === S.vista) b.setAttribute("aria-current", "page");
    b.disabled = (v === "region" && !S.region) || (v === "comuna" && !S.comuna);
    b.title = b.disabled ? (v === "region" ? "Elige una región en el mapa primero" : "Elige una comuna primero") : "";
    b.querySelector("small").textContent = nombres[v] ?? "";
  }
  const t = D.inc[S.dia];
  const riesgo = origenRiesgo === "back" ? "Riesgo leído del back." : origenRiesgo === "sintetico" ? "Riesgo de ejemplo calculado en el navegador." : "";
  const fuegos = !t ? "" : t.ejemplo ? "Incendios del registro de CONAF; probabilidad de no control, factores, avance y activos de ejemplo." : "Incendios del registro de CONAF; probabilidades del back.";
  $("#fuente-datos").textContent = [riesgo, fuegos].filter(Boolean).join(" ");
}
/** Selector de día: va arriba del panel, sobre el título. */
function barraDia() {
  return `<div class="rangos"><div class="botones-rango" role="radiogroup" aria-label="Día">${FECHAS.map((f) =>
    `<button type="button" role="radio" aria-checked="${f === S.dia}" data-dia="${f}">${esc(fFecha(f, { weekday: "short", day: "numeric", month: "short" }))}</button>`).join("")}</div>
    <p class="periodo" aria-live="polite">${esc(fFecha(S.dia, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</p></div>`;
}
const pestanas = (lista) => `<div class="pestanas" role="tablist" aria-label="Contenido">${lista.map(([id, txt]) =>
  `<button type="button" role="tab" aria-selected="${S.tab === id}" data-tab="${id}">${esc(txt)}</button>`).join("")}</div>`;
function resumenDia(lista) {
  if (!lista.length) return `<p class="resumen-dia">Sin incendios registrados ese día en esta zona.</p>`;
  const k = lista.filter((i) => esAlerta(i, umbral())).length;
  return `<p class="resumen-dia"><strong>${lista.length}</strong> ${lista.length === 1 ? "incendio" : "incendios"} ese día, <strong class="${k ? "hay-alerta" : ""}">${k}</strong> en alerta (probabilidad de no control de ${Math.round(umbral() * 100)} % o más).</p>`;
}

// ------------------------------------------------------------------ incendios: cola y ficha
function filaIncendio(i) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral());
  return `<li><button type="button" class="${al ? "alerta" : ""}" style="--c:${ANILLO[c]}" data-incendio="${i.id}" aria-pressed="${i.id === S.inc}">
    <span class="prio">${i.prioridad}</span>
    <span class="que"><strong>${esc(i.nombre)}</strong><small>${esc(i.comuna)} &middot; ${horaTxt(horaDe(i))} &middot; ${esc(i.comb_inicial ?? "combustible sin dato")}</small></span>
    <span class="valor"><i class="r${c}" aria-hidden="true"></i>${Math.round(i.p_no_control_dia * 100)} %<small>${NIVELES_P[c]}${al ? " &middot; alerta" : ""}</small></span></button></li>`;
}
function fichaIncendio(i, n) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral()), max = Math.max(...i.factores.map((f) => f.aporte_pct));
  const t = D.inc[S.dia];
  return `<button type="button" class="boton claro volver-btn" data-inc-cerrar>&larr; Todos los incendios</button>
    <p class="pista">Prioridad ${i.prioridad} de ${n} ${alcance()}</p>
    <h2 class="ficha-t">${esc(i.nombre)}</h2>
    <p class="bajada">${esc(i.comuna)}, región ${esc(i.region)}. Inició a las ${horaTxt(horaDe(i))}. Combustible: ${esc(i.comb_inicial ?? "sin dato")}.</p>
    <div class="cifra-grande"><strong>${Math.round(i.p_no_control_dia * 100)} %</strong><span class="nivel r${c}">Probabilidad ${NIVELES_P[c].toLowerCase()}</span>${al ? '<span class="nivel-alerta">En alerta</span>' : ""}
      <span>de que no se controle el día de inicio</span></div>
    <p class="aviso-origen">${t.ejemplo ? "<b>Registro de CONAF:</b> nombre, lugar, hora y combustible. <b>De ejemplo:</b> probabilidad, factores, avance y activos." : "<b>Registro de CONAF:</b> nombre, lugar, hora y combustible. <b>Del modelo:</b> probabilidad, factores, avance y activos."}</p>
    ${S.comuna === i.comuna_id ? "" : `<button type="button" class="boton claro mini" data-ver-comuna="${i.comuna_id}" data-incendio-ir="${i.id}">Ver en su comuna</button>`}
    <h2>Por qué</h2>
    <ul class="causas">${i.factores.map((f) => `<li class="nomod"><div class="fila"><span>${esc(f.nombre)}<small>${esc(f.valor)}</small></span><span class="pct">${f.aporte_pct} %</span></div>
      <div class="barra" aria-hidden="true"><b style="width:${(f.aporte_pct / max) * 100}%"></b></div></li>`).join("")}</ul>
    <h2>En el camino</h2>
    ${i.activos.length ? `<ul class="activos">${i.activos.map((a) => `<li><i style="background:${COLOR_ACTIVO[a.tipo] ?? "#51616c"}" aria-hidden="true"></i>
      <span><strong>${esc(a.nombre)}</strong><small>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; ${a.personas_est ? `~${a.personas_est} personas` : "sin personas"}</small></span>
      <span class="eta">~${dec(a.eta_h, 1)} h</span></li>`).join("")}</ul>
      <p class="nota">Tiempo aproximado de llegada del fuego si avanza hacia el rumbo estimado.</p>` : `<p class="nota">No hay activos en la zona probable de avance.</p>`}
    <p class="apoyo">Apoyo a la decisión: la probabilidad no es una certeza ni una orden operativa.</p>`;
}
function contenidoIncendios() {
  const lista = aqui();
  const i = lista.find((x) => x.id === S.inc);
  if (i) return fichaIncendio(i, lista.length);
  return lista.length ? `<ol class="lista-cola">${lista.map(filaIncendio).join("")}</ol>` : `<p class="nota vacia">No hay incendios registrados ese día en esta zona.</p>`;
}

// ------------------------------------------------------------------ mapa
function nuevoMapa(clave, limites, relleno = {}) {
  const previo = mapa && ultimaVista === clave ? { c: mapa.getCenter(), z: mapa.getZoom() } : null;
  if (mapa) { mapa.remove(); mapa = null; }
  capas = {};
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
  L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17 }).addTo(mapa);
  if (CONFIG.TESELAS_NOMBRES) L.tileLayer(CONFIG.TESELAS_NOMBRES, { maxZoom: 17 }).addTo(mapa);
  capaFuegos = L.layerGroup().addTo(mapa);
  capaDetalle = L.layerGroup().addTo(mapa);
  if (previo) mapa.setView(previo.c, previo.z); else mapa.fitBounds(limites, { paddingTopLeft: [8, 8], paddingBottomRight: [8, 8], ...relleno });
  ultimaVista = clave;
}
/** Leyenda compacta: una barra de cinco tramos con los cortes debajo y la explicación de los incendios. */
function leyenda(titulo, cortes, nota) {
  return `<div class="leyenda"><h3>${esc(titulo)} (%)</h3>
    <div class="rampa" aria-hidden="true">${COLORES.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="cortes">${cortes.map((t) => `<span>${esc(String(t).replace(/\s?%$/, ""))}</span>`).join("")}</div>
    <p class="fuegos-ley"><span class="item"><span class="m-punto" aria-hidden="true"></span>Incendio del día</span><span class="item"><span class="m-alerta" aria-hidden="true"></span>En alerta</span></p>${nota ? `<p class="nota-ley">${esc(nota)}</p>` : ""}</div>`;
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
    if (alTocar) r.on("click", () => { alTocar(c); for (const k of g.celdas) capas[`${k.f},${k.c}`].setStyle(estiloCelda(clase(k.p), sel(k))); r.bringToFront(); pintarFuegos(); });
    capas[`${c.f},${c.c}`] = r;
  }
  const min = Math.min(...ps), max = Math.max(...ps);
  return [min, ...cortes, max].map(fp);
}
/** Los incendios de la zona sobre el mapa. Los que están en alerta llevan un anillo del color de su nivel; el resto va más chico y suave. */
function pintarFuegos() {
  if (!capaFuegos) return;
  capaFuegos.clearLayers();
  const um = umbral();
  const lista = [...aqui()].sort((a, b) => (esAlerta(a, um) - esAlerta(b, um)) || a.p_no_control_dia - b.p_no_control_dia);
  for (const i of lista) {
    const al = esAlerta(i, um), c = claseP(i.p_no_control_dia), sel = i.id === S.inc;
    const r = al ? 7 + 6 * ((i.p_no_control_dia - um) / (1 - um)) : 4.5;
    if (al) L.circleMarker([i.lat, i.lon], { radius: r + 5, fill: false, color: ANILLO[c], weight: 3, opacity: 0.95, interactive: false }).addTo(capaFuegos);
    const p = L.circleMarker([i.lat, i.lon], { radius: r + (sel ? 3 : 0), color: sel ? "#ffffff" : al ? "#ffffff" : "#1d2a33", weight: sel ? 3.5 : al ? 1.8 : 1, fillColor: COLORES_P[c], fillOpacity: al ? 0.95 : 0.7 }).addTo(capaFuegos);
    p.bindTooltip(`<strong>${esc(i.nombre)}</strong><br>${esc(i.comuna)} &middot; prioridad ${i.prioridad}<br>${Math.round(i.p_no_control_dia * 100)} % de no control${al ? " &middot; en alerta" : ""}`, { sticky: true });
    p.on("click", () => elegirIncendio(i.id));
  }
}
/** Zona probable de avance y activos en el camino del incendio elegido. */
function pintarDetalle() {
  if (!capaDetalle) return;
  capaDetalle.clearLayers();
  const i = aqui().find((x) => x.id === S.inc);
  if (!i) return;
  const color = COLORES_P[claseP(i.p_no_control_dia)];
  const { direccion_grados: dir, radio_km_1h: r1, radio_km_3h: r3 } = i.avance;
  L.polygon(sector(i.lat, i.lon, dir, r3), { color, weight: 1.5, fillColor: color, fillOpacity: 0.3, interactive: false }).addTo(capaDetalle);
  L.polygon(sector(i.lat, i.lon, dir, r1), { color, weight: 1.5, fillColor: color, fillOpacity: 0.45, interactive: false }).addTo(capaDetalle);
  for (const a of i.activos) {
    L.circleMarker([a.lat, a.lon], { radius: 6, color: "#ffffff", weight: 2, fillColor: COLOR_ACTIVO[a.tipo] ?? "#51616c", fillOpacity: 1 }).addTo(capaDetalle)
      .bindTooltip(`<strong>${esc(a.nombre)}</strong><br>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; llega en ~${dec(a.eta_h, 1)} h`);
  }
}
function acercar(i) {
  const pts = [[i.lat, i.lon], ...sector(i.lat, i.lon, i.avance.direccion_grados, i.avance.radio_km_3h), ...i.activos.map((a) => [a.lat, a.lon])];
  mapa.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 12, animate: false });
}
/** La selección vive en la dirección de la página para poder compartirla, sin repintar todo. */
function fijarHash() { history.replaceState(null, "", aHash({ dia: S.dia, region: S.region, comuna: S.comuna, incendio: S.inc })); }
function elegirIncendio(id) {
  S.inc = id; S.tab = "incendios";
  fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle();
  const i = aqui().find((x) => x.id === id);
  if (i) acercar(i);
}
function cerrarIncendio() { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }

// ------------------------------------------------------------------ panel de cada nivel
function listaRegiones(regs) {
  return `<ol class="lista-top">${regs.map((r) => `<li><button type="button" data-region="${r.id}"><span>${esc(nombreCorto(r.nombre))}<span class="region">${r.comunas.length} comunas</span></span><span class="valor"><i class="r${claseRiesgo(r.p)}" aria-hidden="true"></i>${fp(r.p)}</span></button></li>`).join("")}</ol>`;
}
function listaComunas(reg) {
  const cs = [...reg.comunas].sort((a, b) => b.p - a.p || nombreDe(a.region_id).localeCompare(nombreDe(b.region_id), "es"));
  return `<ol class="lista-top">${cs.map((i) => `<li><button type="button" data-comuna="${i.region_id}"><span>${esc(nombreDe(i.region_id))}</span><span class="valor"><i class="r${claseRiesgo(i.p)}" aria-hidden="true"></i>${fp(i.p)}</span></button></li>`).join("")}</ol>`;
}
function htmlPais() {
  const lista = aqui();
  return `${barraDia()}<h1>Incendios y riesgo en Chile</h1>${resumenDia(lista)}
    <div class="buscador"><label for="buscar">Ir directo a una comuna</label>
      <input id="buscar" list="lista-comunas" placeholder="Escribe el nombre" autocomplete="off">
      <datalist id="lista-comunas">${CTX.items.map((i) => `<option value="${esc(nombreDe(i.region_id))} (${esc(nombreCorto(D.nombres[i.region_id]?.region))})"></option>`).join("")}</datalist></div>
    ${pestanas([["incendios", "Incendios"], ["zonas", "Regiones"]])}
    <div id="detalle">${S.tab === "zonas" ? listaRegiones(CTX.regs) : contenidoIncendios()}</div>`;
}
function htmlRegion() {
  const reg = CTX.reg, lista = aqui();
  return `${barraDia()}<button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al país</button>
    <h1>${esc(reg.nombre)}</h1>
    <div class="cifra-grande"><strong>${fp(reg.p)}</strong>${chipNivel(reg.p)}<span>de probabilidad promedio de incendio ese día en sus ${reg.comunas.length} comunas</span></div>
    ${resumenDia(lista)}
    ${pestanas([["incendios", "Incendios"], ["zonas", "Comunas"]])}
    <div id="detalle">${S.tab === "zonas" ? listaComunas(reg) : contenidoIncendios()}</div>`;
}
function panelResumen(u, cel) {
  return `<div class="cifra-grande"><strong>${fp(u.prob)}</strong>${cel ? "" : chipNivel(u.prob)}<span>de probabilidad de que ocurra un incendio ${cel ? "dentro de esta celda" : "en la comuna"} ese día</span></div>
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
      <div><dt>Costo para el municipio</dt><dd>${clpCorto(r.costo_clp)}</dd></div>
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
function htmlComuna() {
  const arch = CTX.arch, info = D.nombres[S.comuna];
  if (!arch) return `${barraDia()}<button type="button" class="boton claro volver-btn" data-vista="region">&larr; Volver a la región</button><h1>${esc(info.nombre)}</h1><p class="nota">Esta comuna no tiene detalle.</p>`;
  const celdaSel = S.celda ? arch.grilla.celdas.find((c) => c.f === S.celda.f && c.c === S.celda.c) : null;
  const u = celdaSel ? unidadDeCelda(celdaSel, arch) : arch.resumen;
  const lista = aqui();
  const cuerpo = S.tab === "causas" ? panelCausas(u, arch.catalogo) : S.tab === "recs" ? panelRecs(u, arch.catalogo) : `${lista.length ? resumenDia(lista) : ""}${contenidoIncendios()}`;
  return `${barraDia()}<div class="panel-cols">
    <div class="col-resumen">
      ${celdaSel ? `<button type="button" class="boton claro volver-btn" id="quitar-celda">&larr; Volver a la comuna</button>`
        : `<button type="button" class="boton claro volver-btn" data-vista="region">&larr; Volver a la región</button>`}
      <h1>${esc(info.nombre)}</h1><p class="bajada">${esc(info.region)}</p>
      ${panelResumen(u, !!celdaSel)}
      ${celdaSel ? "" : `<p class="nota pista">Haz clic en una celda del mapa para ver su detalle.</p>`}
    </div>
    <div class="col-detalle">${pestanas([["incendios", "Incendios"], ["recs", "Recomendaciones"], ["causas", "Causas"]])}<div id="detalle">${cuerpo}</div></div></div>`;
}
const htmlPanel = () => (S.vista === "comuna" ? htmlComuna() : S.vista === "region" ? htmlRegion() : htmlPais());
/** Repinta solo el panel (pestaña, orden, supuestos, incendio elegido), sin tocar el mapa. */
function repintarPanel(alInicio = false) {
  const p = $("#panel");
  if (!p) return;
  const abierto = document.querySelector(".supuestos")?.open, foco = document.activeElement?.dataset?.sup;
  const col = S.vista === "comuna" ? () => document.querySelector(".col-detalle") : () => p;
  const y = col()?.scrollTop ?? 0;
  p.innerHTML = htmlPanel();
  if (col()) col().scrollTop = alInicio ? 0 : y;
  const det = document.querySelector(".supuestos");
  if (det && abierto) det.open = true;
  if (foco) document.querySelector(`[data-sup="${foco}"]`)?.focus();
}

// ------------------------------------------------------------------ país: una región, un color, y los incendios encima
async function vistaPais() {
  const [datos, regs] = await Promise.all([chile(), regiones(), incendios()]);
  CTX = { items: datos.items, regs };
  const porReg = Object.fromEntries(regs.map((r) => [r.id, r]));
  $("#contenido").innerHTML = `<div class="vista-mapa pais">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de Chile con el riesgo por región y los incendios del día"></div>
      <div id="leyenda-caja">${leyenda("Probabilidad promedio de incendio", ["0", "10", "25", "45", "65", "100 %"])}</div></div>
    <aside class="lateral" id="panel">${htmlPais()}</aside></div>`;
  nuevoMapa("pais", [[-55.9, -75.7], [-17.5, -66.4]]);
  const deRegion = {};
  const estilo = (r, encima) => ({ color: encima ? "#ffffff" : colorR(claseRiesgo(r.p)), weight: encima ? 1.2 : 0.6, opacity: 0.9, fillColor: colorR(claseRiesgo(r.p)), fillOpacity: encima ? 0.8 : 0.55 });
  L.geoJSON(D.contornos, {
    filter: (f) => porReg[regionDe(f.properties.region_id)] != null,
    style: (f) => estilo(porReg[regionDe(f.properties.region_id)], false),
    onEachFeature: (f, capa) => {
      const r = porReg[regionDe(f.properties.region_id)];
      (deRegion[r.id] ??= []).push(capa);
      capa.bindTooltip(`<strong>${esc(r.nombre)}</strong><br>${fp(r.p)} de probabilidad promedio &middot; riesgo ${NIVELES[claseRiesgo(r.p)].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => deRegion[r.id].forEach((k) => k.setStyle(estilo(r, true))));
      capa.on("mouseout", () => deRegion[r.id].forEach((k) => k.setStyle(estilo(r, false))));
      capa.on("click", () => ir({ region: r.id }));
    },
  }).addTo(mapa);
  pintarFuegos(); pintarDetalle();
  pintarMarco(datos.origen);
}

// ------------------------------------------------------------------ región: comunas completas y grilla gruesa
async function vistaRegion() {
  const [datos, regs] = await Promise.all([chile(), regiones(), incendios()]);
  const reg = regs.find((r) => r.id === S.region);
  if (!reg) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Región no encontrada</h1><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(datos.origen); return; }
  CTX = { items: datos.items, regs, reg };
  $("#contenido").innerHTML = `<div class="vista-mapa region">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de la región con sus comunas y los incendios del día"></div><div id="leyenda-caja"></div></div>
    <aside class="lateral" id="panel">${htmlRegion()}</aside></div>`;
  const feats = reg.comunas.map((i) => geoDe(i.region_id)).filter(Boolean);
  const enTierra = feats.filter(esContinental);
  nuevoMapa("region:" + reg.id, L.geoJSON(enTierra.length ? enTierra : feats).getBounds(), { paddingBottomRight: [8, 70] });
  pintarFuegos(); pintarDetalle();
  pintarMarco(datos.origen);
  // La grilla gruesa sale del detalle de cada comuna: se pide todo junto y se pinta cuando llega.
  const dia = S.dia;
  const detalle = await Promise.all(feats.map(async (f) => ({ id: f.properties.region_id, feature: f, arch: await comuna(f.properties.region_id) })));
  if (S.vista !== "region" || S.region !== reg.id || S.dia !== dia || !mapa) return;
  const g = grillaRegion(detalle);
  if (g) $("#leyenda-caja").innerHTML = leyenda("Riesgo de cada celda (relativo a la región)", pintarCeldas(g), "cada celda promedia unas 4 de comuna");
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
  pintarFuegos(); pintarDetalle();   // se vuelven a dibujar encima de los contornos para que reciban el clic
}

// ------------------------------------------------------------------ comuna
async function vistaComuna() {
  const [ch] = await Promise.all([chile(), regiones(), incendios()]);
  const id = S.comuna, info = D.nombres[id];
  if (!info) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Comuna no encontrada</h1><p>El código ${esc(id)} no está entre los contornos.</p><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(ch.origen); return; }
  const arch = await comuna();
  CTX = { arch };
  $("#contenido").innerHTML = `<div class="vista-mapa comuna">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de la comuna con la grilla de riesgo y los incendios del día"></div><div id="leyenda-caja"></div></div>
    <aside class="lateral" id="panel">${htmlComuna()}</aside></div>`;
  const capa = L.geoJSON(geoDe(id), { style: { color: "#ffffff", weight: 3, fill: false }, interactive: false });
  nuevoMapa("comuna:" + id, capa.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 84] });
  if (arch) {
    const cortes = pintarCeldas(arch.grilla, (c) => { S.celda = { f: c.f, c: c.c }; repintarPanel(); }, (c) => `Celda: ${fp(c.p)} de probabilidad<br>${fha(c.ha[1])} ha esperadas`);
    $("#leyenda-caja").innerHTML = leyenda("Riesgo de cada celda (relativo a la comuna)", cortes);
  }
  capa.addTo(mapa).bringToFront();
  pintarFuegos(); pintarDetalle();
  pintarMarco(arch?.origen ?? ch.origen);
}

// ------------------------------------------------------------------ metodología y fuentes
async function vistaMetodologia() {
  let ch = null;
  try { ch = await chile(); await incendios(); } catch { /* sin datos: igual se muestra el texto */ }
  mapa?.remove(); mapa = null; ultimaVista = null; capaFuegos = null; capaDetalle = null;
  $("#contenido").innerHTML = `<div class="texto-largo"><button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al mapa</button><h1>Metodología y fuentes</h1>
    <p>Preaviso apoya a quien despacha recursos contra incendios y al personal municipal: muestra dónde se concentra el riesgo de incendio un día, qué incendios están en marcha y cuáles tienen más probabilidad de no controlarse el día en que empiezan, por qué, y qué hay en su camino.</p>
    <h2>Un día a la vez</h2>
    <p>Se elige un día (16, 17 o 18 de enero de 2026, tomados del registro de CONAF) y todo se calcula para ese día: el riesgo de cada región, comuna y celda, y la lista de incendios. No hay horas ni periodos más largos.</p>
    <h2>País, región y comuna</h2>
    <p>El mapa del país pinta cada región con el promedio de la probabilidad de que ocurra al menos un incendio en sus comunas. Al entrar a una región se ven sus comunas y una grilla gruesa, donde cada celda promedia unas cuatro celdas de comuna. Al entrar a una comuna se ve una grilla de 8x8 a 12x12 celdas según el tamaño, cada una con su riesgo propio. Como una celda es mucho más chica que la comuna, su probabilidad es menor que la de la comuna entera: por eso el color de las celdas es relativo a la propia zona y la leyenda lo dice.</p>
    <h2>Incendios y alertas</h2>
    <p>Los puntos del mapa son los incendios del día, y la lista los ordena por la probabilidad de que no se controlen el día de inicio. Un incendio está en alerta cuando esa probabilidad llega al umbral del modelo (${Math.round(umbral() * 100)} %): lleva un anillo del color de su nivel en el mapa y un borde del mismo color en la lista. Al elegir uno se ve el porqué (el aporte de cada factor), la zona probable de avance dibujada en el mapa y los activos que tiene en el camino con un tiempo aproximado de llegada. Es un apoyo a la decisión, no una orden operativa ni una alerta a la población.</p>
    <p>Nombre, lugar, hora de inicio y combustible salen del registro de CONAF. La probabilidad, los factores, el avance y los activos son hoy de ejemplo, inventados con una fórmula simple, y no usan el resultado real del incendio.</p>
    <h2>Causas</h2>
    <p>Cada unidad (comuna o celda) muestra el porcentaje que aporta cada variable a la salida del modelo (pasto o combustible, temperatura, sequía, viento, cercanía a caminos y población, relieve, entre otras). Las causas se marcan como modificables por el municipio (pasto, interfaz con viviendas, basurales, quemas) o no modificables (clima, viento, relieve, ubicación).</p>
    <h2>Recomendaciones y beneficio</h2>
    <p>Solo se recomienda sobre causas modificables. Cada acción trae del back su reducción de probabilidad en puntos porcentuales y su costo en CLP. El beneficio se calcula en la pantalla, para que los supuestos se puedan cambiar:</p>
    <p class="formula">beneficio = (reducción en puntos / 100) x ( vidas esperadas si hay incendio x valor de vida estadística + hectáreas esperadas x (valor de propiedad por hectárea + costo de combate por hectárea) )<br>razón = beneficio / costo</p>
    <p>Los valores de fábrica son ${clpCorto(SUPUESTOS_FABRICA.vsl_clp)} por vida, ${clpCorto(SUPUESTOS_FABRICA.valor_propiedad_ha_clp)} de propiedad por hectárea y ${clpCorto(SUPUESTOS_FABRICA.costo_combate_ha_clp)} de combate por hectárea. Son una propuesta del equipo, sin fuente: el municipio debe poner los suyos.</p>
    <h2>Límites</h2>
    <ul>
      <li>${ch?.ejemplo !== false ? "Hoy el riesgo y las probabilidades de la plataforma son de ejemplo: se calculan en el navegador con una fórmula simple y una semilla (web/js/sintetico.js, scripts/generar_triaje.py). No salen del modelo de ML." : "Los números vienen del back."}</li>
      <li>La tasa diaria del riesgo de ejemplo se calibró para que la suma de las 345 comunas calce con unos 65 incendios por día, como un día punta de enero.</li>
      <li>El contrato de datos que debe publicar el back está en <code>web/datos/ext/CONTRATO.md</code>.</li>
      <li>Según el equipo del back, el motor actual anticipa cómo se propaga un incendio activo; qué mide la predicción diaria debe acordarse con el back.</li>
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
    </ul></div>`;
  pintarMarco(ch?.origen);
}

// ------------------------------------------------------------------ navegación y eventos
function ir(cambio) {
  // Al cambiar de nivel o de día se suelta el incendio elegido, salvo que el cambio lo traiga (por ejemplo "Ver en su comuna").
  const n = { dia: S.dia, region: S.region, comuna: S.comuna, vista: null, incendio: null, ...cambio };
  if ("region" in cambio && !("comuna" in cambio)) n.comuna = null;
  if (n.vista === "pais") { n.region = null; n.comuna = null; }
  if (n.vista === "region") n.comuna = null;
  if (n.comuna) n.region = regionDe(n.comuna);
  zoomAlLlegar = !!n.incendio;
  if (location.hash === aHash(n)) { pintar(); return; }
  location.hash = aHash(n);
}

async function pintar() {
  const h = leerHash(location.hash);
  if (h.comuna !== S.comuna) S.celda = null;
  S.dia = diaValido(h.dia); S.region = h.region; S.comuna = h.comuna; S.inc = h.incendio;
  S.vista = h.vista === "metodologia" ? "metodologia" : h.comuna ? "comuna" : h.region ? "region" : "pais";
  const validas = { pais: ["incendios", "zonas"], region: ["incendios", "zonas"], comuna: ["incendios", "recs", "causas"] }[S.vista];
  if (validas && !validas.includes(S.tab)) S.tab = "incendios";
  try {
    if (S.vista === "metodologia") await vistaMetodologia();
    else {
      await (S.vista === "comuna" ? vistaComuna() : S.vista === "region" ? vistaRegion() : vistaPais());
      const i = S.inc && aqui().find((x) => x.id === S.inc);
      if (S.inc && !i) { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }
      else if (i) { S.tab = "incendios"; repintarPanel(true); pintarDetalle(); if (zoomAlLlegar || h.incendio) acercar(i); }
      zoomAlLlegar = false;
    }
  } catch (e) {
    console.error(e);
    $("#contenido").innerHTML = `<div class="texto-largo"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p></div>`;
  }
}

document.addEventListener("click", (e) => {
  const dia = e.target.closest("[data-dia]");
  if (dia) { ir({ dia: dia.dataset.dia, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  const v = e.target.closest("[data-vista]");
  if (v) { e.preventDefault(); if (!v.disabled) ir({ vista: v.dataset.vista }); return; }
  const r = e.target.closest("[data-region]");
  if (r) { ir({ region: r.dataset.region }); return; }
  const vc = e.target.closest("[data-ver-comuna]");
  if (vc) { ir({ comuna: vc.dataset.verComuna, incendio: vc.dataset.incendioIr }); return; }
  const c = e.target.closest("[data-comuna]");
  if (c) { ir({ comuna: c.dataset.comuna }); return; }
  const inc = e.target.closest("[data-incendio]");
  if (inc) { elegirIncendio(inc.dataset.incendio); return; }
  if (e.target.closest("[data-inc-cerrar]")) { cerrarIncendio(); return; }
  const t = e.target.closest("[data-tab]");
  if (t) { S.tab = t.dataset.tab; repintarPanel(true); return; }
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

window.addEventListener("hashchange", pintar);
if (!location.hash) history.replaceState(null, "", aHash({ dia: S.dia }));
pintar();
