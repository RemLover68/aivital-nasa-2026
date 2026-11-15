// Plataforma web de Preaviso: País, Región y Comuna en una sola pantalla, alimentada por lo que publica el back (contrato 0.5).
// Los datos reales entran por api.js (objeto `back`); las reglas de cálculo están en riesgo.js. El "modo visión" (apagado por defecto)
// agrega incendios con probabilidades de ejemplo, siempre con una etiqueta grande que dice que no son del modelo.
import { api, back } from "./api.js";
import { CONFIG } from "./config.js";
import { aHash, leerHash } from "./prediccion.js";
import { HORIZONTES, horizonteValido, NIVELES, NIVEL_TXT, NIVEL_COLOR, nivelIdx, regionDe, agruparRegiones, claseSector, pctTxt, periodoTxt, leerFocosCsv, recomendacion } from "./riesgo.js";
import { nombreCorto, esContinental, localizarIncendios } from "./region.js";
import { FECHAS, FECHA_INICIAL, diaValido, UMBRAL_ALERTA, esAlerta, horaDe, horaTxt, ordenarCola, filtrar, claseP, NIVELES_P, COLORES_P, sector } from "./triaje.js";
import { $, esc, dec, fFecha, leer, guardar } from "./util.js";

const S = { vista: "pais", h: "24", dia: FECHA_INICIAL, region: null, comuna: null, sector: null, inc: null, tab: null,
  vision: !!leer("preaviso.vision", false), focos: false, paisTodo: false, abiertas: new Set() };
const D = { contornos: null, nombres: {}, riesgo: {}, regs: {}, inc: {}, sect: {} };   // lo ya pedido
let mapa = null, capas = {}, ultimaVista = null, capaFuegos = null, capaDetalle = null, capaFocos = null, capaAlertas = null, CTX = {};
const fp = (p) => (p == null ? "sin dato" : p < 0.1 ? dec(p * 100, 1) + " %" : Math.round(p * 100) + " %");
const nombreDe = (id) => D.nombres[id]?.nombre ?? id;
const LIMITES_CHILE = [[-55.9, -75.7], [-17.5, -66.4]];
const RN = { bajo: 0, medio: 2, alto: 3, muy_alto: 4 };   // clase de color (r0 a r4) de cada nivel del back
const chipNivel = (n) => `<span class="nivel r${RN[n] ?? 0}">Riesgo ${NIVEL_TXT[n]?.toLowerCase() ?? "sin dato"}</span>`;
const COLORES_S = ["#fff3b0", "#fdc863", "#f08a3c", "#d4472b", "#8c1d18"];   // sectores: percentil dentro de la comuna
const ANILLO = ["#e6c75a", "#e6c75a", "#f08a3c", "#d4472b", "#b01e18"];
const TIPO_ACTIVO = { vivienda: "Viviendas", escuela: "Escuela", salud: "Salud", planta: "Planta forestal", ruta: "Ruta", electrico: "Línea eléctrica" };
const COLOR_ACTIVO = { vivienda: "#1f6e8c", escuela: "#5f8f6b", salud: "#7c688a", planta: "#a06a2c", ruta: "#51616c", electrico: "#c9a227" };
const hNombre = (h = S.h) => HORIZONTES.find((x) => x.id === h).nombre;

// ------------------------------------------------------------------ datos
async function cargarContornos() {
  if (D.contornos) return;
  D.contornos = await api.contornos();
  for (const f of D.contornos.features) D.nombres[f.properties.region_id] = f.properties;
}
const geoDe = (id) => D.contornos.features.find((f) => f.properties.region_id === id);
async function riesgo() {
  const [r] = await Promise.all([back.riesgo(S.h), cargarContornos()]);
  D.riesgo[S.h] = r;
  D.regs[S.h] ??= agruparRegiones(r.items, D.nombres);
  return r;
}
const porComuna = (r) => Object.fromEntries(r.items.map((i) => [i.region_id, i]));
/** Las comunas con sectores y alertas (las 36 de Valparaíso hoy) salen del manifest. */
async function conSectores() { return new Set((await back.manifest()).sectores?.regiones ?? []); }
async function incendios() {
  if (!S.vision) return null;
  if (!D.inc[S.dia]) {
    const [t] = await Promise.all([api.triaje(S.dia), cargarContornos()]);
    D.inc[S.dia] = { ...t, incendios: localizarIncendios(t.incendios, D.contornos.features) };
  }
  return D.inc[S.dia];
}
const umbral = () => D.inc[S.dia]?.modelo?.umbral ?? UMBRAL_ALERTA;
const aqui = () => (!S.vision ? [] : ordenarCola(filtrar(D.inc[S.dia]?.incendios ?? [], S.vista === "comuna" ? { comuna: S.comuna } : S.vista === "region" ? { region: S.region } : {})));
const alcance = () => (S.vista === "comuna" ? "en la comuna" : S.vista === "region" ? "en la región" : "en Chile");

// ------------------------------------------------------------------ marco: menú lateral (horizonte, modo visión y zonas) y pie
const ORDEN_REG = ["15", "01", "02", "03", "04", "05", "13", "06", "07", "16", "08", "09", "14", "10", "11", "12"];   // de norte a sur
let regionDelRail = null;
function pintarHorizontes() {
  const caja = $("#rail-h");
  if (!caja.children.length) {
    caja.innerHTML = HORIZONTES.map((x) => `<button type="button" role="radio" aria-checked="false" data-h="${x.id}"><strong>${esc(x.nombre.split(" ")[0])}</strong><small>${esc(x.nombre.split(" ")[1])}</small></button>`).join("");
  }
  for (const b of caja.children) b.setAttribute("aria-checked", String(b.dataset.h === S.h));
  const r = D.riesgo[S.h];
  $("#rail-periodo").innerHTML = r ? `Datos para el <strong>${esc(periodoTxt(r.periodo))}</strong>` : "";
}
function pintarVision() {
  $("#vision-btn").setAttribute("aria-pressed", String(S.vision));
  $("#rail-dia").hidden = !S.vision; $("#rail-ej").hidden = !S.vision;
  const caja = $("#rail-dia");
  if (S.vision && !caja.children.length) {
    caja.innerHTML = FECHAS.map((f) => `<button type="button" role="radio" aria-checked="false" data-dia="${f}" title="${esc(fFecha(f, { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}">
      <span>${esc(fFecha(f, { weekday: "short" }))}</span><strong>${esc(fFecha(f, { day: "numeric" }))}</strong><small>${esc(fFecha(f, { month: "short" }))}</small></button>`).join("");
  }
  for (const b of caja.children) b.setAttribute("aria-checked", String(b.dataset.dia === S.dia));
}
/** Árbol País, regiones y comunas. Se arma una vez por horizonte (los colores cambian) y después solo se marcan la zona activa y los desplegables abiertos. */
function pintarArbol() {
  const regs = D.regs[S.h], r = D.riesgo[S.h], arbol = $("#arbol");
  if (!regs || !r) return;
  if (arbol.dataset.h !== S.h) {
    const pc = porComuna(r);
    const orden = (x) => (ORDEN_REG.includes(x.id) ? ORDEN_REG.indexOf(x.id) : 99);
    arbol.innerHTML = [...regs].sort((x, y) => orden(x) - orden(y)).map((g) => {
      const nombre = nombreCorto(g.nombre);
      const comunas = [...g.comunas].sort((x, y) => nombreDe(x.region_id).localeCompare(nombreDe(y.region_id), "es"));
      const ins = g.nAltas ? `<b class="n-inc hot" title="${g.nAltas} ${g.nAltas === 1 ? "comuna" : "comunas"} en nivel alto o muy alto">${g.nAltas}</b>` : "";
      return `<li class="reg" data-reg="${g.id}"><div class="reg-fila">
        <button type="button" class="reg-nombre" data-region="${g.id}"><i class="r${RN[g.nivel]}" aria-hidden="true"></i><span>${esc(nombre)}</span>${ins}</button>
        <button type="button" class="reg-flecha" data-toggle="${g.id}" aria-expanded="false" aria-label="Comunas de ${esc(nombre)}"></button></div>
        <div class="com-caja"><ul class="com-lista">${comunas.map((c) => `<li><button type="button" data-comuna="${c.region_id}"><i class="r${RN[pc[c.region_id]?.nivel] ?? 0}" aria-hidden="true"></i><span>${esc(nombreDe(c.region_id))}</span></button></li>`).join("")}</ul></div></li>`;
    }).join("");
    arbol.dataset.h = S.h;
  }
  if (S.region !== regionDelRail) { if (S.region) S.abiertas.add(S.region); regionDelRail = S.region; }
  for (const li of arbol.children) {
    const abierta = S.abiertas.has(li.dataset.reg);
    li.classList.toggle("abierta", abierta);
    li.querySelector(".reg-flecha").setAttribute("aria-expanded", String(abierta));
    const n = li.querySelector(".reg-nombre");
    n.classList.toggle("dentro", S.region === li.dataset.reg && S.vista !== "region");
    if (S.vista === "region" && S.region === li.dataset.reg) n.setAttribute("aria-current", "page"); else n.removeAttribute("aria-current");
  }
  for (const b of arbol.querySelectorAll("[data-comuna]")) { if (S.vista === "comuna" && b.dataset.comuna === S.comuna) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); }
  const pais = document.querySelector(".arbol-pais");
  if (S.vista === "pais") pais.setAttribute("aria-current", "page"); else pais.removeAttribute("aria-current");
  arbol.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function pintarMarco() {
  pintarHorizontes(); pintarVision(); pintarArbol();
  $("#fuente-datos").textContent = "Riesgo, alertas y sectores leídos del back (contrato 0.5)." + (S.vision ? " Incendios del modo visión: probabilidades de ejemplo." : "");
}
/** Cifras que suben desde cero al entrar a una pantalla. */
function animarCifras(raiz = document) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const el of raiz.querySelectorAll("[data-cuenta]")) {
    const fin = Number(el.dataset.cuenta), t0 = performance.now();
    const paso = (t) => { const k = Math.min(1, (t - t0) / 800); el.textContent = Math.round(fin * (1 - (1 - k) ** 3)); if (k < 1) requestAnimationFrame(paso); };
    el.textContent = "0"; requestAnimationFrame(paso);
  }
}
const pestanas = (lista) => (lista.length < 2 ? "" : `<div class="pestanas" role="tablist" aria-label="Contenido">${lista.map(([id, txt]) =>
  `<button type="button" role="tab" aria-selected="${S.tab === id}" data-tab="${id}">${esc(txt)}</button>`).join("")}</div>`);

/** Fecha de los datos y, si el back lo marca, el aviso de que el horizonte es orientativo. */
function bloquePeriodo(r) {
  return `<p class="periodo">Datos para el <strong>${esc(periodoTxt(r.periodo))}</strong> &middot; horizonte ${esc(hNombre(r.horizonte))}</p>
    ${r.orientativo ? `<p class="aviso-origen"><b>Orientativo.</b> ${esc(r.nota ?? "")}</p>` : r.nota ? `<p class="nota">${esc(r.nota)}</p>` : ""}
    <p class="nota">Es el último día con datos satelitales, no el día de hoy. El nivel de cada horizonte usa sus propios cortes: no se comparan entre horizontes.</p>`;
}
function tarjetasRiesgo(items) {
  const altas = items.filter((i) => nivelIdx(i.nivel) >= 2).length, muy = items.filter((i) => i.nivel === "muy_alto").length;
  return `<div class="tarjetas"><div class="tarjeta"><strong data-cuenta="${altas}">${altas}</strong><span>Comunas en nivel alto o muy alto</span></div>
    <div class="tarjeta t-alerta${muy ? " activa" : ""}"><strong data-cuenta="${muy}">${muy}</strong><span>En nivel muy alto</span></div></div>`;
}
const ETIQUETA_EJ = `<div class="ejemplo-grande" role="note"><strong>Datos de ejemplo</strong><span>No son del modelo</span></div>`;

// ------------------------------------------------------------------ incendios del modo visión: cola y ficha
function filaIncendio(i, n = 0) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral());
  return `<li style="--i:${n}"><button type="button" class="${al ? "alerta" : ""}" style="--c:${ANILLO[c]}" data-incendio="${i.id}" aria-pressed="${i.id === S.inc}">
    <span class="prio">${i.prioridad}</span>
    <span class="que"><strong>${esc(i.nombre)}</strong><small>${esc(i.comuna)} &middot; ${horaTxt(horaDe(i))} &middot; ${esc(i.comb_inicial ?? "combustible sin dato")}</small></span>
    <span class="valor"><i class="r${c}" aria-hidden="true"></i>${Math.round(i.p_no_control_dia * 100)} %<small class="ej-mini">ejemplo</small></span></button></li>`;
}
function fichaIncendio(i, n) {
  const c = claseP(i.p_no_control_dia), al = esAlerta(i, umbral()), max = Math.max(...i.factores.map((f) => f.aporte_pct));
  return `<div class="ficha"><button type="button" class="boton claro volver-btn" data-inc-cerrar>&larr; Todos los incendios</button>
    ${ETIQUETA_EJ}
    <p class="pista">Prioridad ${i.prioridad} de ${n} ${alcance()}</p>
    <h2 class="ficha-t">${esc(i.nombre)}</h2>
    <p class="bajada">${esc(i.comuna)}, región ${esc(i.region)}. Inició a las ${horaTxt(horaDe(i))}. Combustible: ${esc(i.comb_inicial ?? "sin dato")}.</p>
    <div class="cifra-grande"><strong>${Math.round(i.p_no_control_dia * 100)} %</strong><span class="nivel r${c}">${NIVELES_P[c]} (ejemplo)</span>${al ? '<span class="nivel-alerta">En alerta (ejemplo)</span>' : ""}
      <span>de que no se controle el día de inicio</span></div>
    <p class="aviso-origen"><b>Registro de CONAF:</b> nombre, lugar, hora y combustible. <b>De ejemplo, no son del modelo:</b> probabilidad, factores, avance y activos.</p>
    ${S.comuna === i.comuna_id ? "" : `<button type="button" class="boton claro mini" data-ver-comuna="${i.comuna_id}" data-incendio-ir="${i.id}">Ver en su comuna</button>`}
    <h2>Por qué (ejemplo)</h2>
    <ul class="causas">${i.factores.map((f) => `<li class="nomod"><div class="fila"><span>${esc(f.nombre)}<small>${esc(f.valor)}</small></span><span class="pct">${f.aporte_pct} %</span></div>
      <div class="barra" aria-hidden="true"><b style="width:${(f.aporte_pct / max) * 100}%"></b></div></li>`).join("")}</ul>
    <h2>En el camino (ejemplo)</h2>
    ${i.activos.length ? `<ul class="activos">${i.activos.map((a) => `<li><i style="background:${COLOR_ACTIVO[a.tipo] ?? "#51616c"}" aria-hidden="true"></i>
      <span><strong>${esc(a.nombre)}</strong><small>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; ${a.personas_est ? `~${a.personas_est} personas` : "sin personas"}</small></span>
      <span class="eta">~${dec(a.eta_h, 1)} h</span></li>`).join("")}</ul>
      <p class="nota">Tiempo aproximado de llegada del fuego si avanza hacia el rumbo estimado.</p>` : `<p class="nota">No hay activos en la zona probable de avance.</p>`}
    <p class="apoyo">Apoyo a la decisión: la probabilidad no es una certeza ni una orden operativa.</p></div>`;
}
function contenidoIncendios() {
  const lista = aqui(), i = lista.find((x) => x.id === S.inc);
  if (i) return fichaIncendio(i, lista.length);
  return `${ETIQUETA_EJ}<p class="nota">Incendios del registro de CONAF del ${esc(fFecha(S.dia, { day: "numeric", month: "long", year: "numeric" }))}; las probabilidades son inventadas.</p>
    ${lista.length ? `<ol class="lista-cola">${lista.map(filaIncendio).join("")}</ol>` : `<p class="nota vacia">Sin incendios ese día en esta zona.</p>`}`;
}

// ------------------------------------------------------------------ mapa
function nuevoMapa(clave, limites, relleno = {}) {
  const previo = mapa && ultimaVista === clave ? { c: mapa.getCenter(), z: mapa.getZoom() } : null;
  if (mapa) { mapa.remove(); mapa = null; }
  capas = {};
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
  L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17 }).addTo(mapa);
  if (CONFIG.TESELAS_NOMBRES) L.tileLayer(CONFIG.TESELAS_NOMBRES, { maxZoom: 17 }).addTo(mapa);
  capaFocos = L.layerGroup().addTo(mapa);
  capaAlertas = L.layerGroup().addTo(mapa);
  capaFuegos = L.layerGroup().addTo(mapa);
  capaDetalle = L.layerGroup().addTo(mapa);
  if (previo) mapa.setView(previo.c, previo.z); else mapa.fitBounds(limites, { paddingTopLeft: [8, 8], paddingBottomRight: [8, 8], ...relleno });
  ultimaVista = clave;
}
/** Leyenda de niveles (país y región): los cuatro niveles del back y los cortes de probabilidad del horizonte, si los trae. */
function leyendaNiveles(r) {
  const u = r.umbrales;
  const cortes = u ? `Desde ${pctTxt(u.medio, 1)} medio, ${pctTxt(u.alto, 1)} alto, ${pctTxt(u.muy_alto, 1)} muy alto.` : "";
  return `<div class="leyenda vertical"><h3>Nivel de riesgo, ${esc(hNombre(r.horizonte))}</h3>
    <p class="niveles-ley">${NIVELES.map((n) => `<span class="item"><i class="sw" style="background:${NIVEL_COLOR[n]}"></i>${NIVEL_TXT[n]}</span>`).join("")}</p>
    ${cortes ? `<p class="nota-ley">${esc(cortes)}</p>` : ""}
    ${S.vision ? `<p class="fuegos-ley"><span class="item"><span class="m-punto" aria-hidden="true"></span>Incendio de ejemplo</span><span class="item"><span class="m-alerta" aria-hidden="true"></span>En alerta (ejemplo)</span></p>` : ""}</div>`;
}
function leyendaSectores() {
  return `<div class="leyenda vertical"><h3>Orden de cada sector dentro de la comuna</h3>
    <div class="escala"><div class="rampa" aria-hidden="true">${COLORES_S.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
    <div class="cortes"><span>Menos probable</span><span>Más probable</span></div></div>
    <p class="nota-ley">Color por percentil dentro de la comuna: dónde es más probable que caiga el fuego si lo hay. No predice dónde empieza.</p></div>`;
}
const estiloComuna = (nivel, encima) => ({ color: encima ? "#ffffff" : NIVEL_COLOR[nivel], weight: encima ? 1.4 : 0.5, opacity: 0.9, fillColor: NIVEL_COLOR[nivel], fillOpacity: encima ? 0.8 : 0.55 });
/** Los incendios del modo visión sobre el mapa. Los que están en alerta llevan un anillo del color de su nivel. */
function pintarFuegos() {
  if (!capaFuegos) return;
  capaFuegos.clearLayers();
  if (!S.vision) return;
  const um = umbral();
  const lista = [...aqui()].sort((a, b) => (esAlerta(a, um) - esAlerta(b, um)) || a.p_no_control_dia - b.p_no_control_dia);
  for (const i of lista) {
    const al = esAlerta(i, um), c = claseP(i.p_no_control_dia), sel = i.id === S.inc;
    const r = al ? 7 + 6 * ((i.p_no_control_dia - um) / (1 - um)) : 4.5;
    if (al) L.circleMarker([i.lat, i.lon], { radius: r + 5, fill: false, color: ANILLO[c], weight: 3, opacity: 0.95, interactive: false }).addTo(capaFuegos);
    const p = L.circleMarker([i.lat, i.lon], { radius: r + (sel ? 3 : 0), color: sel ? "#ffffff" : al ? "#ffffff" : "#1d2a33", weight: sel ? 3.5 : al ? 1.8 : 1, fillColor: COLORES_P[c], fillOpacity: al ? 0.95 : 0.7 }).addTo(capaFuegos);
    p.bindTooltip(`<strong>${esc(i.nombre)}</strong><br>${esc(i.comuna)} &middot; prioridad ${i.prioridad}<br>${Math.round(i.p_no_control_dia * 100)} % de no control (ejemplo, no es del modelo)`, { sticky: true });
    p.on("click", () => elegirIncendio(i.id));
  }
}
/** Zona probable de avance y activos del incendio elegido (ejemplo). */
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
/** Mapa de calor de focos históricos de la comuna: círculos translúcidos que se suman donde hay más. */
async function pintarFocos() {
  if (!capaFocos) return;
  capaFocos.clearLayers();
  if (!S.focos || S.vista !== "comuna" || !CTX.sect) return;
  const comuna = S.comuna;
  try {
    const f = leerFocosCsv(await back.focosSector(comuna));
    if (!S.focos || S.comuna !== comuna || !capaFocos) return;
    for (const p of f) L.circleMarker([p.lat, p.lon], { radius: 5, stroke: false, fillColor: "#ff5a00", fillOpacity: 0.22, interactive: false }).addTo(capaFocos);
  } catch (e) { console.error(e); }
}

// ------------------------------------------------------------------ dirección de la página
const hashDe = (n) => {
  const q = new URLSearchParams(aHash(n).slice(1));
  if (!S.vision) { q.delete("dia"); q.delete("incendio"); }
  if (n.h && n.h !== "24") q.set("h", n.h);
  if (n.sector) q.set("sector", n.sector);
  return "#" + q.toString();
};
const hashActual = () => hashDe({ dia: S.dia, h: S.h, region: S.region, comuna: S.comuna, incendio: S.inc, sector: S.sector, vista: S.vista === "metodologia" ? "metodologia" : null });
/** La selección vive en la dirección de la página para poder compartirla, sin repintar todo. */
function fijarHash() { history.replaceState(null, "", hashActual()); }
function elegirIncendio(id) {
  S.inc = id; S.tab = "incendios";
  fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle();
  const i = aqui().find((x) => x.id === id);
  if (i) acercar(i);
}
function cerrarIncendio() { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }

// ------------------------------------------------------------------ panel de cada nivel
const textoRasgo = (k) => CTX.rec?.rasgos?.[k] ?? k;
const chipsRasgos = (lista) => (lista?.length ? `<ul class="chips">${lista.map((k) => `<li>${esc(textoRasgo(k))}</li>`).join("")}</ul>` : "");
const chipsCondiciones = (lista) => (lista?.length ? `<ul class="chips clima">${lista.map((k) => `<li title="${esc(CTX.rec?.condiciones?.[k]?.texto ?? k)}">${esc(CTX.rec?.condiciones?.[k]?.texto ?? k)}</li>`).join("")}</ul>` : "");
/** Lista de recomendaciones con su texto y el enlace a la fuente, tal como las publica el back. */
function listaRecs(codigos) {
  const rs = (codigos ?? []).map((c) => recomendacion(CTX.rec, c)).filter(Boolean);
  if (!rs.length) return "";
  return `<ul class="recs-lista">${rs.map((r) => `<li>${esc(r.texto)}${r.url ? ` <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.fuente ?? "Fuente")}</a>` : ""}</li>`).join("")}</ul>`;
}
function listaRegiones(regs) {
  return `<ol class="lista-top">${regs.map((g, n) => `<li style="--i:${n}"><button type="button" data-region="${g.id}"><span>${esc(nombreCorto(g.nombre))}<span class="region">${g.nAltas} de ${g.comunas.length} comunas en nivel alto o muy alto</span></span><span class="valor"><i class="r${RN[g.nivel]}" aria-hidden="true"></i>${NIVEL_TXT[g.nivel]}</span></button></li>`).join("")}</ol>`;
}
function listaComunas(reg) {
  const cs = [...reg.comunas].sort((a, b) => nivelIdx(b.nivel) - nivelIdx(a.nivel) || b.p - a.p || nombreDe(a.region_id).localeCompare(nombreDe(b.region_id), "es"));
  return `<ol class="lista-top">${cs.map((i, n) => `<li style="--i:${n}"><button type="button" data-comuna="${i.region_id}"><span>${esc(nombreDe(i.region_id))}<span class="region">${fp(i.p)} de probabilidad</span></span><span class="valor"><i class="r${RN[i.nivel]}" aria-hidden="true"></i>${NIVEL_TXT[i.nivel]}</span></button></li>`).join("")}</ol>`;
}
function htmlPais() {
  const r = CTX.r, lista = listaRegiones(CTX.regs);
  const cuerpo = S.vision ? (() => {
    const inc = aqui(), i = inc.find((x) => x.id === S.inc);
    if (i) return fichaIncendio(i, inc.length);
    return `<div class="mitades"><section><h2 class="sub">Incendios (ejemplo)</h2>${contenidoIncendios()}</section><section><h2 class="sub">Regiones</h2>${lista}</section></div>`;
  })() : `<h2 class="sub">Regiones</h2>${lista}`;
  return `<h1>Chile</h1>${bloquePeriodo(r)}${tarjetasRiesgo(r.items)}${cuerpo}`;
}
/** Tipos de alerta del contrato 0.5; el color de fuego activo es propio, distinto de los de nivel. */
const TIPO_ALERTA = {
  fuego_activo: { etiqueta: "Fuego activo", grupo: "Fuego activo: focos en los últimos 3 días", color: "#5b2a86" },
  alerta: { etiqueta: "Alerta", grupo: "Alerta: riesgo alto o muy alto", color: "#d4472b" },
  vigilancia: { etiqueta: "Vigilancia", grupo: "Vigilancia: riesgo medio", color: "#f08a3c" },
};
const chipTipo = (t) => (TIPO_ALERTA[t] ? `<span class="chip-tipo tipo-${t}">${TIPO_ALERTA[t].etiqueta}</span>` : "");
const listaMotivos = (m) => (m?.length ? `<ul class="motivos">${m.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : "");
/** Tarjetas de alertas del back, en su orden: sectores de las comunas con más riesgo y más exposición. */
function tarjetasAlertas() {
  const a = CTX.alertas, lista = a?.horizontes?.[S.h] ?? [], info = a?.listas?.[S.h];
  const titulo = info?.titulo ? `<h2 class="lista-titulo">${esc(info.titulo)}</h2>` : "";
  const respaldo = a?.validacion?.nota ? `<p class="nota chica respaldo">${esc(a.validacion.nota)}</p>` : "";
  if (info?.vacia || !lista.length) {
    return `${titulo}<p class="nota">${esc(info?.mensaje || "No hay alertas para este horizonte.")}</p>${a?.nota ? `<p class="nota chica">${esc(a.nota)}</p>` : ""}${respaldo}`;
  }
  let anterior = null;
  return `${titulo}<p class="nota">${esc(a.nota)}</p><ol class="alertas">${lista.map((x, n) => {
    const encabezado = x.tipo !== anterior && TIPO_ALERTA[x.tipo] ? `<li class="alerta-grupo" aria-hidden="true">${esc(TIPO_ALERTA[x.tipo].grupo)}</li>` : "";
    anterior = x.tipo;
    return `${encabezado}<li class="tipo-${esc(x.tipo)}" style="--c:${TIPO_ALERTA[x.tipo]?.color ?? NIVEL_COLOR[x.nivel_comuna]}"><div class="alerta-cab"><span class="prio">${n + 1}</span><strong>${esc(x.comuna)}</strong>${chipTipo(x.tipo)}${chipNivel(x.nivel_comuna)}</div>
    ${x.tipo === "fuego_activo" && x.dist_foco_reciente_km != null ? `<p class="dist-foco">a ${dec(x.dist_foco_reciente_km, 1)} km del foco más reciente</p>` : ""}
    <dl class="alerta-datos">
      <div><dt>Probabilidad de foco en la comuna</dt><dd>${fp(x.prob_foco_comuna)}</dd></div>
      <div><dt>Si hay fuego en la comuna, que caiga en este sector</dt><dd>${fp(x.prob_si_fuego_en_comuna)}</dd></div>
      <div><dt>Si hay fuego aquí, que sea un incendio grande</dt><dd>${fp(x.prob_incendio_grande)}</dd></div></dl>
    ${chipsRasgos(x.rasgos)}
    <details><summary>Qué hacer (${x.recomendaciones.length})</summary>${listaRecs(x.recomendaciones)}</details>
    <button type="button" class="boton claro mini" data-comuna="${x.region_id}" data-sector="${x.sector_id}">Ver sector en la comuna</button></li>`; }).join("")}</ol>${respaldo}`;
}
function panelClima() {
  const cs = [...(CTX.alertas?.comunas ?? [])].sort((a, b) => b.clima_ultimo_dia.condiciones.length - a.clima_ultimo_dia.condiciones.length || a.nombre.localeCompare(b.nombre, "es"));
  if (!cs.length) return `<p class="nota">No hay clima para esta región.</p>`;
  const fecha = cs[0].clima_ultimo_dia.fecha_clima;
  return `<p class="nota">Clima del último día observado (${esc(fFecha(fecha, { day: "numeric", month: "long", year: "numeric" }))}). Los umbrales y su fuente están en cada condición.</p>
    <ul class="clima-lista">${cs.map((c) => { const k = c.clima_ultimo_dia; return `<li><button type="button" class="clima-nombre" data-comuna="${c.region_id}">${esc(c.nombre)}</button>
      <small>${dec(k.tmax, 1)} °C máx. &middot; humedad mín. ${dec(k.hrmin, 0)} % &middot; viento ${dec(k.viento_max_kmh, 0)} km/h &middot; ${k.dias_sin_lluvia} días sin lluvia</small>
      ${c.fuego_activo ? chipTipo("fuego_activo") : ""}
      ${k.condiciones.length ? chipsCondiciones(k.condiciones) : `<small class="nota">Sin condiciones extremas.</small>`}
      ${c.motivos?.length ? `<details><summary>Por qué (${c.motivos.length})</summary>${listaMotivos(c.motivos)}</details>` : ""}
      ${c.recomendaciones_clima?.length ? `<details><summary>Qué hacer (${c.recomendaciones_clima.length})</summary>${listaRecs(c.recomendaciones_clima)}</details>` : ""}</li>`; }).join("")}</ul>`;
}
const etiquetaPestanaAlertas = () => (CTX.alertas?.listas?.[S.h]?.tipo_lista === "alertas" || !CTX.alertas?.listas?.[S.h] ? "Alertas" : "Prioridades");
const tabsRegion = () => [...(CTX.alertas ? [["alertas", etiquetaPestanaAlertas()], ["clima", "Clima"]] : []), ["comunas", "Comunas"], ...(S.vision ? [["incendios", "Incendios (ejemplo)"]] : [])];
function htmlRegion() {
  const reg = CTX.reg, r = CTX.r;
  const cuerpo = S.tab === "alertas" ? tarjetasAlertas() : S.tab === "clima" ? panelClima() : S.tab === "incendios" ? contenidoIncendios()
    : `${CTX.alertas ? "" : `<p class="nota">Fuera de Valparaíso solo hay riesgo por comuna: aún no hay sectores ni alertas.</p>`}${listaComunas(reg)}`;
  return `<button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Chile</button>
    <h1>${esc(reg.nombre)}</h1>${bloquePeriodo(r)}${tarjetasRiesgo(reg.comunas)}${pestanas(tabsRegion())}<div id="detalle">${cuerpo}</div>`;
}
const nombreSector = (p) => `Sector ${CTX.puestos?.get(p.sector_id) ?? "?"} de ${CTX.sect?.features.length ?? "?"}`;
const coordSector = (p) => `${Math.abs(p.lat).toFixed(3)}° S · ${Math.abs(p.lon).toFixed(3)}° O`;
function fichaSector(f) {
  const p = f.properties, h = S.h;
  const comp = [["Interfaz con viviendas", p.pct_interfaz], ["Pastizal", p.pct_pastizal], ["Bosque o matorral", p.pct_bosque_matorral], ["Cultivo", p.pct_cultivo], ["Construido", p.pct_construido]].filter(([, v]) => v > 0);
  return `<div class="ficha"><button type="button" class="boton claro volver-btn" data-sector-cerrar>&larr; Sectores de la comuna</button>
    <h2 class="ficha-t">${esc(nombreSector(p))}</h2>
    <p class="coord">${esc(coordSector(p))}</p>
    <p class="bajada">Percentil ${dec(p.percentil_en_comuna, 0)} dentro de la comuna &middot; ${dec(p.area_km2, 2)} km².</p>
    <div class="cifra-grande"><strong>${pctTxt(p.prob_fuego_24h, 2)}</strong><span>de probabilidad de foco en este sector en 24 h (un sector es chico, por eso la cifra es baja)</span></div>
    <dl class="datos-resumen">
      <div><dt>Si hay fuego en la comuna, que caiga en este sector</dt><dd>${pctTxt(p.prob_si_fuego_en_comuna, 1)}</dd></div>
      <div><dt>Si hay fuego aquí, que sea un incendio grande</dt><dd>${pctTxt(p.prob_incendio_grande, 1)}</dd></div></dl>
    <p class="nota">El modelo no predice dónde empieza un incendio: ordena dónde es más probable que caiga el fuego si lo hay y estima si sería grande.</p>
    <h2>Rasgos</h2>${chipsRasgos(p.rasgos) || `<p class="nota">Sin rasgos destacados.</p>`}
    ${comp.length ? `<p class="nota">${comp.map(([n, v]) => `${n} ${dec(v, 1)} %`).join(" &middot; ")} &middot; pendiente media ${dec(p.pendiente_media, 1)}°</p>` : ""}
    <h2>Historial</h2>
    <p class="nota">${p.dias_con_fuego ? `${p.dias_con_fuego} ${p.dias_con_fuego === 1 ? "día" : "días"} con fuego desde 2012, ${p.incendios_grandes} ${p.incendios_grandes === 1 ? "incendio grande" : "incendios grandes"}; último fuego el ${esc(fFecha(p.ultimo_fuego, { day: "numeric", month: "long", year: "numeric" }))}.` : "Sin fuego registrado desde 2012."}</p>
    <h2>Qué hacer (${esc(hNombre(h))})</h2>${listaRecs(p.recomendaciones?.[h]) || `<p class="nota">Sin recomendaciones para este horizonte.</p>`}</div>`;
}
function listaSectores(sect) {
  const top = [...sect.features].sort((a, b) => b.properties.percentil_en_comuna - a.properties.percentil_en_comuna).slice(0, 10);
  return `<p class="nota">Los 10 sectores con mayor orden dentro de la comuna. Toca uno en la lista o en el mapa.</p>
    <ol class="lista-cola">${top.map((f, n) => { const p = f.properties; return `<li style="--i:${n}"><button type="button" data-sector="${p.sector_id}" aria-pressed="${p.sector_id === S.sector}">
      <span class="prio">${n + 1}</span><span class="que"><strong>${esc(nombreSector(p))}</strong><small>${esc((p.rasgos ?? []).map(textoRasgo).join(", ") || "sin rasgos destacados")}</small></span>
      <span class="valor">p${dec(p.percentil_en_comuna, 0)}<small>${pctTxt(p.prob_incendio_grande, 0)} grande</small></span></button></li>`; }).join("")}</ol>
    <label class="check"><input type="checkbox" id="ver-focos"${S.focos ? " checked" : ""}> Mostrar focos históricos de la comuna (desde 2012)</label>`;
}
const tabsComuna = () => [...(CTX.sect ? [["sectores", "Sectores"]] : []), ...(S.vision ? [["incendios", "Incendios (ejemplo)"]] : [])];
function htmlComuna() {
  const info = D.nombres[S.comuna], it = porComuna(CTX.r)[S.comuna], clima = CTX.alertas?.comunas?.find((c) => c.region_id === S.comuna);
  const f = S.sector && CTX.sect?.features.find((x) => x.properties.sector_id === S.sector);
  const cuerpo = S.tab === "incendios" ? contenidoIncendios() : f ? fichaSector(f) : CTX.sect ? listaSectores(CTX.sect) : "";
  const k = clima?.clima_ultimo_dia;
  return `<div class="panel-cols"><div class="col-resumen">
      <button type="button" class="boton claro volver-btn" data-vista="region">&larr; Volver a la región</button>
      <h1>${esc(info.nombre)}</h1><p class="bajada">${esc(info.region)}</p>
      ${bloquePeriodo(CTX.r)}
      <div class="cifra-grande"><strong>${fp(it?.p)}</strong>${chipNivel(it?.nivel)}${clima?.fuego_activo ? chipTipo("fuego_activo") : ""}<span>de probabilidad de al menos un foco en la comuna (${esc(hNombre())})</span></div>
      ${clima?.motivos?.length ? `<h2>Por qué</h2>${listaMotivos(clima.motivos)}` : ""}
      ${k ? `<h2>Clima</h2><p class="nota">${dec(k.tmax, 1)} °C máx. &middot; humedad mín. ${dec(k.hrmin, 0)} % &middot; viento ${dec(k.viento_max_kmh, 0)} km/h &middot; ${k.dias_sin_lluvia} días sin lluvia</p>${chipsCondiciones(k.condiciones)}
        ${clima.recomendaciones_clima?.length ? `<details><summary>Qué hacer por el clima (${clima.recomendaciones_clima.length})</summary>${listaRecs(clima.recomendaciones_clima)}</details>` : ""}` : ""}
      ${CTX.sect ? "" : `<p class="aviso-origen">Esta comuna no tiene sectores ni alertas: por ahora el back solo publica el riesgo de la comuna.</p>`}
    </div>
    <div class="col-detalle">${pestanas(tabsComuna())}<div id="detalle">${cuerpo}</div></div></div>`;
}
const htmlPanel = () => (S.vista === "comuna" ? htmlComuna() : S.vista === "region" ? htmlRegion() : htmlPais());
/** Repinta solo el panel (pestaña, incendio o sector elegido), sin tocar el mapa. */
function repintarPanel(alInicio = false) {
  const p = $("#panel");
  if (!p) return;
  const col = S.vista === "comuna" ? () => document.querySelector(".col-detalle") : () => p;
  const y = col()?.scrollTop ?? 0;
  p.innerHTML = htmlPanel();
  p.classList.remove("refresca"); void p.offsetWidth; p.classList.add("refresca");
  if (col()) col().scrollTop = alInicio ? 0 : y;
}

// ------------------------------------------------------------------ país: una comuna, un color, y los incendios de ejemplo encima si el modo visión está encendido
const marcoVista = (clase, aria, leyenda, extra = "") => `<div class="vista-mapa ${clase}">
    <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="${aria}"></div><div id="leyenda-caja">${leyenda}</div>${extra}
      ${S.vision ? `<div class="mapa-ejemplo">Incendios de ejemplo: las probabilidades no son del modelo</div>` : ""}</div>
    <aside class="lateral" id="panel"></aside></div>`;
function limitesZona() {
  const pts = (D.inc[S.dia]?.incendios ?? []).map((i) => [i.lat, i.lon]);
  return pts.length ? L.latLngBounds(pts).pad(0.3) : L.latLngBounds(LIMITES_CHILE);
}
async function vistaPais() {
  const [r] = await Promise.all([riesgo(), incendios()]);
  CTX = { r, regs: D.regs[S.h] };
  const pc = porComuna(r);
  const zoom = S.vision ? `<button type="button" class="mapa-zoom" id="mapa-zoom">${S.paisTodo ? "Ver zona de incendios" : "Ver todo Chile"}</button>` : "";
  $("#contenido").innerHTML = marcoVista("pais", "Mapa de Chile con el nivel de riesgo de cada comuna", leyendaNiveles(r), zoom);
  $("#panel").innerHTML = htmlPais();
  nuevoMapa("pais", S.vision && !S.paisTodo ? limitesZona() : LIMITES_CHILE);
  const deRegion = {};
  L.geoJSON(D.contornos, {
    filter: (f) => pc[f.properties.region_id] != null,
    style: (f) => estiloComuna(pc[f.properties.region_id].nivel, false),
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = pc[id], reg = regionDe(id);
      (deRegion[reg] ??= []).push(capa);
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong> (${esc(nombreCorto(f.properties.region))})<br>${fp(it.p)} de probabilidad &middot; riesgo ${NIVEL_TXT[it.nivel].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => capa.setStyle(estiloComuna(it.nivel, true)));
      capa.on("mouseout", () => capa.setStyle(estiloComuna(it.nivel, false)));
      capa.on("click", () => ir({ region: reg }));
    },
  }).addTo(mapa);
  pintarFuegos(); pintarDetalle();
  pintarMarco();
}

// ------------------------------------------------------------------ región: comunas coloreadas, y en Valparaíso las alertas y el clima
async function vistaRegion() {
  const [r] = await Promise.all([riesgo(), incendios()]);
  const reg = D.regs[S.h].find((g) => g.id === S.region);
  if (!reg) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Región no encontrada</h1><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(); return; }
  const con = await conSectores();
  const tiene = reg.comunas.some((c) => con.has(c.region_id));
  const [alertas, rec] = await Promise.all([tiene ? back.alertas(S.region) : null, tiene ? back.recomendaciones() : null]);
  CTX = { r, reg, alertas, rec };
  if (!tabsRegion().some(([id]) => id === S.tab)) S.tab = alertas ? "alertas" : "comunas";
  $("#contenido").innerHTML = marcoVista("region", "Mapa de la región con el nivel de riesgo de sus comunas", leyendaNiveles(r));
  $("#panel").innerHTML = htmlRegion();
  const feats = reg.comunas.map((i) => geoDe(i.region_id)).filter(Boolean);
  const enTierra = feats.filter(esContinental);
  nuevoMapa("region:" + reg.id, L.geoJSON(enTierra.length ? enTierra : feats).getBounds(), { paddingBottomRight: [8, 70] });
  const pc = porComuna(r);
  L.geoJSON({ type: "FeatureCollection", features: feats }, {
    style: (f) => ({ ...estiloComuna(pc[f.properties.region_id].nivel, false), color: "#ffffff", weight: 1.3 }),
    onEachFeature: (f, capa) => {
      const id = f.properties.region_id, it = pc[id];
      capa.bindTooltip(`<strong>${esc(f.properties.nombre)}</strong><br>${fp(it.p)} de probabilidad &middot; riesgo ${NIVEL_TXT[it.nivel].toLowerCase()}`, { sticky: true });
      capa.on("mouseover", () => capa.setStyle({ weight: 3, fillOpacity: 0.8 }));
      capa.on("mouseout", () => capa.setStyle({ weight: 1.3, fillOpacity: 0.55 }));
      capa.on("click", () => ir({ comuna: id }));
    },
  }).addTo(mapa);
  // Los sectores de las alertas, numerados en el orden de las tarjetas.
  (alertas?.horizontes?.[S.h] ?? []).forEach((x, n) => {
    L.marker([x.lat, x.lon], { icon: L.divIcon({ className: "mk-alerta", html: `<span>${n + 1}</span>`, iconSize: [26, 26] }) }).addTo(capaAlertas)
      .bindTooltip(`<strong>${n + 1}. ${esc(x.comuna)}</strong><br>${TIPO_ALERTA[x.tipo] ? esc(TIPO_ALERTA[x.tipo].etiqueta) + " · " : ""}riesgo ${NIVEL_TXT[x.nivel_comuna].toLowerCase()}`).on("click", () => ir({ comuna: x.region_id, sector: x.sector_id }));
  });
  pintarFuegos();
  pintarMarco();
}

// ------------------------------------------------------------------ comuna: sectores coloreados por su orden dentro de la comuna
const estiloSector = (p, sel) => ({ color: sel ? "#ffffff" : COLORES_S[claseSector(p.percentil_en_comuna)], weight: sel ? 3.5 : 0.8, opacity: 0.95, fillColor: COLORES_S[claseSector(p.percentil_en_comuna)], fillOpacity: sel ? 0.7 : 0.5 });
function marcarSector() {
  for (const [id, capa] of Object.entries(capas)) { capa.setStyle(estiloSector(capa.feature.properties, id === S.sector)); if (id === S.sector) capa.bringToFront(); }
}
function elegirSector(id) {
  S.sector = id; S.tab = "sectores";
  fijarHash(); marcarSector(); repintarPanel(true);
  if (id && capas[id]) mapa.fitBounds(capas[id].getBounds(), { padding: [80, 80], maxZoom: 15, animate: false });
}
async function vistaComuna() {
  const [r] = await Promise.all([riesgo(), incendios()]);
  const id = S.comuna, info = D.nombres[id];
  if (!info) { $("#contenido").innerHTML = `<div class="texto-largo"><h1>Comuna no encontrada</h1><p>El código ${esc(id)} no está entre los contornos.</p><button class="boton" data-vista="pais">Volver al país</button></div>`; pintarMarco(); return; }
  const man = await back.manifest(), tiene = (man.sectores?.regiones ?? []).includes(id);
  const [sect, alertas, rec] = await Promise.all([tiene ? back.sectores(id) : null, tiene ? back.alertas(regionDe(id)) : null, tiene ? back.recomendaciones() : null]);
  // Puesto de cada sector dentro de la comuna (1 = mayor percentil): se calcula una vez para que lista, ficha y mapa coincidan.
  const puestos = new Map([...(sect?.features ?? [])]
    .sort((a, b) => b.properties.percentil_en_comuna - a.properties.percentil_en_comuna)
    .map((f, i) => [f.properties.sector_id, i + 1]));
  CTX = { r, sect, alertas, rec, puestos };
  if (!tabsComuna().some(([t]) => t === S.tab)) S.tab = sect ? "sectores" : "incendios";
  if (S.sector && !sect?.features.some((f) => f.properties.sector_id === S.sector)) S.sector = null;
  const nota = tiene ? `<div class="nota-mapa"><strong>Sobre el modelo de sectores</strong>${esc(man.sectores.modelo_b?.nota ?? "")}</div>` : "";
  $("#contenido").innerHTML = marcoVista("comuna", "Mapa de la comuna con sus sectores", sect ? leyendaSectores() : leyendaNiveles(r), nota);
  $("#panel").innerHTML = htmlComuna();
  const contorno = L.geoJSON(geoDe(id), { style: { color: "#ffffff", weight: 3, fill: false }, interactive: false });
  nuevoMapa("comuna:" + id, contorno.getBounds(), { paddingTopLeft: [24, 24], paddingBottomRight: [24, 84] });
  if (sect) {
    L.geoJSON(sect, {
      style: (f) => estiloSector(f.properties, f.properties.sector_id === S.sector),
      onEachFeature: (f, capa) => {
        const p = f.properties; capas[p.sector_id] = capa;
        capa.bindTooltip(`<strong>${esc(nombreSector(p))}</strong><br>Percentil ${dec(p.percentil_en_comuna, 0)} en la comuna<br>${pctTxt(p.prob_fuego_24h, 2)} de foco en 24 h`, { sticky: true });
        capa.on("click", () => elegirSector(p.sector_id));
      },
    }).addTo(mapa);
  } else {
    const it = porComuna(r)[id];
    L.geoJSON(geoDe(id), { style: estiloComuna(it?.nivel ?? "bajo", false), interactive: false }).addTo(mapa);
  }
  contorno.addTo(mapa).bringToFront();
  pintarFuegos(); pintarDetalle(); pintarFocos();
  if (S.sector && capas[S.sector]) mapa.fitBounds(capas[S.sector].getBounds(), { padding: [80, 80], maxZoom: 15, animate: false });
  pintarMarco();
}

// ------------------------------------------------------------------ metodología y fuentes
async function vistaMetodologia() {
  let r = null, rec = null;
  try { r = await back.riesgo(S.h); rec = await back.recomendaciones(); } catch { /* sin datos: igual se muestra el texto */ }
  mapa?.remove(); mapa = null; ultimaVista = null; capaFuegos = capaDetalle = capaFocos = capaAlertas = null;
  const fuentesRec = Object.values(rec?.fuentes ?? {});
  $("#contenido").innerHTML = `<div class="texto-largo"><button type="button" class="boton claro volver-btn" data-vista="pais">&larr; Volver al mapa</button><h1>Metodología y fuentes</h1>
    <p>Preaviso apoya a quien decide dónde poner recursos de prevención contra incendios: muestra qué comunas tienen más riesgo, dónde es más probable que caiga el fuego dentro de cada comuna si lo hay, por qué, y qué hacer.</p>
    <h2>De dónde salen los números</h2>
    <p>Todo sale del back (contrato 0.5, <a href="https://marcelo-corro.github.io/aivital-incendios-datos/">marcelo-corro.github.io/aivital-incendios-datos</a>): riesgo por comuna, alertas, sectores y recomendaciones. La plataforma no inventa números en el flujo principal.${r ? ` El modelo es <code>${esc(r.modelo)}</code>.` : ""}</p>
    <h2>Fecha de los datos</h2>
    <p>Los datos son para el ${r ? esc(periodoTxt(r.periodo)) : "último día con datos satelitales"}, el último día con datos satelitales, no para el día de hoy. Se puede elegir entre 24 horas, 48 horas y 7 días. El de 7 días es orientativo: supera poco a la climatología.</p>
    <h2>Niveles</h2>
    <p>Cada archivo trae el nivel de cada comuna (bajo, medio, alto, muy alto) con los cortes propios de su horizonte. Por eso no se compara la probabilidad entre horizontes.</p>
    <h2>País, región, comuna y sectores</h2>
    <p>El mapa del país pinta cada comuna con su nivel. Al entrar a una región se ven sus comunas; en Valparaíso, además, las tarjetas de alertas (en el orden en que las publica el back) y el clima de cada comuna. Al entrar a una comuna de Valparaíso se ven sus sectores de aproximadamente 1 km², coloreados por su percentil dentro de la comuna. Fuera de Valparaíso solo hay riesgo por comuna.</p>
    <p>El modelo de sectores no predice dónde empieza un incendio: ordena dónde es más probable que caiga el fuego si lo hay y estima si sería grande. La probabilidad de foco de un sector es baja porque un sector es chico.</p>
    <h2>Modo visión (datos de ejemplo)</h2>
    <p>Apagado por defecto. Muestra incendios del registro de CONAF del 16 al 18 de enero de 2026 con una probabilidad de no control, factores, avance y activos <strong>inventados</strong>: no son del modelo y cada pantalla lo dice con una etiqueta grande. La probabilidad de no control es pariente de la probabilidad de incendio grande del back, que sí está validada; calcularla para enero de 2026 necesita focos satelitales de ese mes y datos de CONAF en tiempo real, que hoy no hay.</p>
    <h2>Fuentes</h2>
    <ul>
      <li>NASA FIRMS. We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) <a href="https://earthdata.nasa.gov/firms">https://earthdata.nasa.gov/firms</a>.</li>
      <li>Biblioteca del Congreso Nacional de Chile. División comunal: polígonos de las comunas. <a href="https://www.bcn.cl/siit/mapas_vectoriales">https://www.bcn.cl/siit/mapas_vectoriales</a>. Material referencial.</li>
      <li>Equipo AIVital. Datos del contrato 0.5. <a href="https://github.com/marcelo-corro/aivital-incendios-datos">https://github.com/marcelo-corro/aivital-incendios-datos</a></li>
      <li>CONAF. Registro de incendios forestales (capa incendios_totales), datos públicos bajados el 14 de noviembre de 2026. <a href="https://www.conaf.cl/">https://www.conaf.cl/</a></li>
      <li>Esri, Maxar, Earthstar Geographics y la comunidad de usuarios de SIG. World Imagery: imagen satelital del mapa base. <a href="https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9">https://www.arcgis.com/home/item.html?id=10df2279f9684e4a9f6a7f08febac2a9</a></li>
      ${fuentesRec.map((f) => `<li>${esc(f.nombre)}. <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.url)}</a></li>`).join("")}
    </ul></div>`;
  pintarMarco();
}

// ------------------------------------------------------------------ navegación y eventos
function ir(cambio) {
  // Al cambiar de nivel o de horizonte se suelta el incendio elegido, salvo que el cambio lo traiga (por ejemplo "Ver en su comuna").
  const n = { dia: S.dia, h: S.h, region: S.region, comuna: S.comuna, vista: null, incendio: null, sector: null, ...cambio };
  if ("region" in cambio && !("comuna" in cambio)) n.comuna = null;
  if (n.vista === "pais") { n.region = null; n.comuna = null; }
  if (n.vista === "region") n.comuna = null;
  if (n.comuna) n.region = regionDe(n.comuna);
  if (!n.comuna) n.sector = null;
  if (location.hash === hashDe(n)) { pintar(); return; }
  location.hash = hashDe(n);
}

async function pintar() {
  const h = leerHash(location.hash), q = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (h.comuna !== S.comuna) S.focos = false;
  S.h = horizonteValido(q.get("h")); S.dia = diaValido(h.dia); S.region = h.region; S.comuna = h.comuna; S.inc = h.incendio;
  S.sector = h.comuna && /^\d{5}_-?\d+_-?\d+$/.test(q.get("sector") ?? "") ? q.get("sector") : null;
  if (S.inc && !S.vision) { S.vision = true; guardar("preaviso.vision", true); }
  S.vista = h.vista === "metodologia" ? "metodologia" : h.comuna ? "comuna" : h.region ? "region" : "pais";
  const validas = { pais: ["incendios"], region: ["alertas", "clima", "comunas", "incendios"], comuna: ["sectores", "incendios"] }[S.vista];
  if (validas && !validas.includes(S.tab)) S.tab = null;
  if (S.inc) S.tab = "incendios";
  try {
    if (S.vista === "metodologia") await vistaMetodologia();
    else {
      await (S.vista === "comuna" ? vistaComuna() : S.vista === "region" ? vistaRegion() : vistaPais());
      const i = S.inc && aqui().find((x) => x.id === S.inc);
      if (S.inc && !i) { S.inc = null; fijarHash(); repintarPanel(true); pintarFuegos(); pintarDetalle(); }
      else if (i) { repintarPanel(true); pintarDetalle(); acercar(i); }
      animarCifras($("#contenido"));
    }
  } catch (e) {
    console.error(e);
    $("#contenido").innerHTML = `<div class="texto-largo"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p><p class="nota">Los datos salen del back (${esc(CONFIG.BASE_CONTRATO)}). No se muestran datos inventados en su lugar.</p></div>`;
  }
}

document.addEventListener("click", (e) => {
  const hz = e.target.closest("[data-h]");
  if (hz) { ir({ h: hz.dataset.h, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  if (e.target.closest("[data-vision]")) {
    S.vision = !S.vision; guardar("preaviso.vision", S.vision);
    ir({ vista: S.vista === "metodologia" ? "metodologia" : null }); return;
  }
  const dia = e.target.closest("[data-dia]");
  if (dia) { ir({ dia: dia.dataset.dia, vista: S.vista === "metodologia" ? "metodologia" : null }); return; }
  const v = e.target.closest("[data-vista]");
  if (v) { e.preventDefault(); if (!v.disabled) ir({ vista: v.dataset.vista }); return; }
  const tg = e.target.closest("[data-toggle]");
  if (tg) { const id = tg.dataset.toggle; if (!S.abiertas.delete(id)) S.abiertas.add(id); pintarArbol(); return; }
  if (e.target.closest("#mapa-zoom")) {
    S.paisTodo = !S.paisTodo;
    mapa?.flyToBounds(S.paisTodo ? LIMITES_CHILE : limitesZona(), { duration: 0.9 });
    $("#mapa-zoom").textContent = S.paisTodo ? "Ver zona de incendios" : "Ver todo Chile";
    return;
  }
  const r = e.target.closest("[data-region]");
  if (r) { S.abiertas.add(r.dataset.region); ir({ region: r.dataset.region }); return; }
  const vc = e.target.closest("[data-ver-comuna]");
  if (vc) { ir({ comuna: vc.dataset.verComuna, incendio: vc.dataset.incendioIr }); return; }
  const sc = e.target.closest("[data-comuna][data-sector]");
  if (sc) { ir({ comuna: sc.dataset.comuna, sector: sc.dataset.sector }); return; }
  const c = e.target.closest("[data-comuna]");
  if (c) { ir({ comuna: c.dataset.comuna }); return; }
  const sec = e.target.closest("[data-sector]");
  if (sec) { elegirSector(sec.dataset.sector); return; }
  if (e.target.closest("[data-sector-cerrar]")) { elegirSector(null); return; }
  const inc = e.target.closest("[data-incendio]");
  if (inc) { elegirIncendio(inc.dataset.incendio); return; }
  if (e.target.closest("[data-inc-cerrar]")) { cerrarIncendio(); return; }
  const t = e.target.closest("[data-tab]");
  if (t) { S.tab = t.dataset.tab; repintarPanel(true); }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "ver-focos") { S.focos = e.target.checked; pintarFocos(); }
  if (e.target.id === "buscar") {
    const t = e.target.value.trim().toLowerCase();
    const id = Object.keys(D.nombres).find((k) => `${D.nombres[k].nombre} (${nombreCorto(D.nombres[k].region)})`.toLowerCase() === t)
      ?? Object.keys(D.nombres).find((k) => D.nombres[k].nombre.toLowerCase() === t);
    if (id) ir({ comuna: id });
  }
});

window.addEventListener("hashchange", pintar);
if (!location.hash) history.replaceState(null, "", hashDe({ dia: S.dia }));
pintar();
