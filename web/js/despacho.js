// Sala de despacho: una sola pantalla (guia-front-mvp.md §3). Cola a la izquierda, mapa al centro, tarjeta a la derecha, tablero de acierto al pie.
import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { $, esc, dec, fFecha } from "./util.js";
import { FECHAS, FECHA_INICIAL, diaValido, esAlerta, horaDe, horaTxt, ordenarCola, claseP, NIVELES_P, COLORES_P, colorP, sector } from "./triaje.js";

const TESELAS_MAPA = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const DIA_INICIAL = "2026-01-16";   // día con el que abre la sala
const S = { dia: DIA_INICIAL, region: "", inc: null, datos: null };
let mapa, capaPuntos, capaDetalle;
const pct = (p) => (p < 0.1 ? dec(p * 100, 1) : Math.round(p * 100)) + " %";
const origenTxt = () => (S.datos?.ejemplo ? "ejemplo" : "modelo");

/** Incendios visibles: los de la región elegida, ordenados por prioridad entre ellos. */
const visibles = () => ordenarCola((S.datos?.incendios ?? []).filter((i) => (!S.region || i.reg_id === S.region)));

/* ---------- barra ---------- */
function pintarBarra() {
  $("#dias").innerHTML = FECHAS.map((f) => `<button type="button" role="radio" aria-checked="${f === S.dia}" data-dia="${f}">${fFecha(f, { day: "numeric", month: "short" })}</button>`).join("");
  const regs = [...new Map((S.datos?.incendios ?? []).map((i) => [i.reg_id, i.region])).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  $("#region").innerHTML = `<option value="">Todo Chile</option>` + regs.map(([id, n]) => `<option value="${esc(id)}"${id === S.region ? " selected" : ""}>${esc(n)}</option>`).join("");
  $("#sello").hidden = !S.datos?.ejemplo;
  $("#rampa").innerHTML = COLORES_P.map((c, k) => `<i style="background:${c}"><span>${NIVELES_P[k]}</span></i>`).join("");
}

/* ---------- cola ---------- */
function pintarCola() {
  const cola = visibles();
  $("#cola-n").textContent = `· ${cola.length}`; $("#btn-cola-n").textContent = `· ${cola.length}`;
  if (S.inc && !cola.some((i) => i.id === S.inc)) S.inc = null;
  $("#lista").innerHTML = cola.length ? cola.map((i) => {
    const p = i.p_no_control_dia, al = esAlerta(i, S.datos.modelo?.umbral);
    return `<li><button type="button" class="fila${al ? " alerta" : ""}" data-id="${esc(i.id)}" aria-pressed="${i.id === S.inc}">
      <span class="prio">${i.prioridad}</span>
      <span class="que"><strong>${esc(i.nombre)}</strong><small>${esc(i.comuna)} · ${horaTxt(horaDe(i))} · ${esc(i.comb_inicial ?? "combustible sin dato")}</small></span>
      <span class="prob"><b>${pct(p)}</b><small>${NIVELES_P[claseP(p)]}</small></span></button></li>`;
  }).join("") : `<li class="vacio">No hay incendios en esta selección.</li>`;
}

/* ---------- mapa ---------- */
function crearMapa() {
  mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true, zoomControl: false });
  L.control.zoom({ position: "bottomleft", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(mapa);
  L.tileLayer(TESELAS_MAPA, { attribution: "&copy; colaboradores de OpenStreetMap", maxZoom: 17 }).addTo(mapa);
  mapa.setView(CONFIG.MAPA_CENTRO, 7);
  capaPuntos = L.layerGroup().addTo(mapa);
  capaDetalle = L.layerGroup().addTo(mapa);
  mapa.on("move zoom resize", posicionarTarjeta);
  mapa.on("click", () => { if (S.inc) cerrar(); });
}
function pintarMapa(ajustar = false) {
  capaPuntos.clearLayers();
  const cola = visibles();
  for (const i of cola) {
    const sel = i.id === S.inc, r = Math.max(5, 14 - i.prioridad * 0.35);
    L.circleMarker([i.lat, i.lon], { radius: r + (sel ? 3 : 0), stroke: sel, color: colorP(i.p_no_control_dia), weight: 2, opacity: 0.9, fillColor: colorP(i.p_no_control_dia), fillOpacity: sel ? 0.7 : 0.5 })
      .bindTooltip(`${esc(i.nombre)} · ${pct(i.p_no_control_dia)} (${origenTxt()})`).on("click", (e) => { L.DomEvent.stopPropagation(e); elegir(i.id); }).addTo(capaPuntos);
  }
  if (ajustar && cola.length) mapa.fitBounds(L.latLngBounds(cola.map((i) => [i.lat, i.lon])).pad(0.15), { maxZoom: 10 });
  pintarDetalle();
}
function pintarDetalle() {
  capaDetalle.clearLayers();
  const i = (S.datos?.incendios ?? []).find((x) => x.id === S.inc);
  if (!i) return;
  const c = colorP(i.p_no_control_dia);
  if (i.avance) {
    L.polygon(sector(i.lat, i.lon, i.avance.direccion_grados, i.avance.radio_km_3h), { stroke: false, fillColor: c, fillOpacity: 0.12, interactive: false }).addTo(capaDetalle);
    L.polygon(sector(i.lat, i.lon, i.avance.direccion_grados, i.avance.radio_km_1h), { stroke: false, fillColor: c, fillOpacity: 0.25, interactive: false }).addTo(capaDetalle);
  }
  for (const a of i.activos ?? []) L.circleMarker([a.lat, a.lon], { radius: 6, stroke: false, fillColor: "#1a73e8", fillOpacity: 0.7 }).bindTooltip(`${esc(a.nombre)} · ${dec(a.dist_km)} km`).addTo(capaDetalle);
}

/* ---------- tarjeta ---------- */
function pintarTarjeta() {
  const i = (S.datos?.incendios ?? []).find((x) => x.id === S.inc);
  const caja = $("#tarjeta");
  if (!i) { caja.hidden = true; caja.innerHTML = ""; return; }
  caja.hidden = false;
  const p = i.p_no_control_dia, c = claseP(p), fin = i.real;
  caja.innerHTML = `
    <button type="button" class="cerrar" data-cerrar aria-label="Cerrar">&times;</button>
    <p class="etq">Incendio <span class="marca-o">${origenTxt()}</span></p>
    <h2>${esc(i.nombre)}</h2>
    <p class="sub">${esc(i.comuna)}, ${esc(i.region)} · inicio ${esc(i.f_inicio.slice(11, 16))} · prioridad ${i.prioridad} de ${visibles().length}</p>
    <div class="grande"><strong style="color:${c >= 3 ? "#ff5a1f" : "inherit"}">${pct(p)}</strong><span>probabilidad de no control el día de inicio<br><b>${NIVELES_P[c]}</b> · ${origenTxt()}, umbral ${pct(S.datos.modelo?.umbral ?? 0.5)}</span></div>
    <h3 class="etq">Por qué</h3>
    <ul class="barras">${(i.factores ?? []).map((f) => `<li><div><span>${esc(f.nombre)}</span><b>${f.aporte_pct} %</b></div><i><u style="width:${Math.min(100, f.aporte_pct)}%"></u></i><small>${esc(f.valor)}</small></li>`).join("") || `<li class="vacio">Sin factores.</li>`}</ul>
    <h3 class="etq">En el camino</h3>
    ${(i.activos ?? []).length ? `<ul class="activos">${i.activos.map((a) => `<li><div><strong>${esc(a.nombre)}</strong><small>${esc(a.tipo)} · ${dec(a.dist_km)} km · ${a.personas_est ? `≈ ${a.personas_est} personas` : "sin personas estimadas"}</small></div><b>${dec(a.eta_h)} h</b></li>`).join("")}</ul>` : `<p class="vacio">Sin activos en la zona probable de avance.</p>`}
    ${fin ? `<div class="real"><h3 class="etq">Qué pasó realmente</h3><p>Superficie final <b>${dec(i.real.sup_total_ha)} ha</b> · ${i.real.controlado_mismo_dia ? "se controló el mismo día" : "no se controló el mismo día"}. El modelo había dicho <b>${pct(p)}</b>.</p></div>` : ""}
    <p class="origen">Datos reales del registro: nombre, comuna, hora de inicio y ubicación. ${S.datos.ejemplo ? "Probabilidad, factores, avance y activos son <b>de ejemplo</b>, no del modelo." : "Probabilidad, factores, avance y activos son estimaciones del modelo."}</p>`;
  caja.scrollTop = 0;
  posicionarTarjeta();
}
/** Pone el cuadro al costado del incendio elegido; si no cabe a la derecha, lo pasa a la izquierda. */
function posicionarTarjeta() {
  const caja = $("#tarjeta"), i = (S.datos?.incendios ?? []).find((x) => x.id === S.inc);
  if (!i || caja.hidden || !mapa) return;
  const pt = mapa.latLngToContainerPoint([i.lat, i.lon]), W = mapa.getSize().x, H = mapa.getSize().y;
  const w = caja.offsetWidth, h = caja.offsetHeight, sep = 20;
  let x = pt.x + sep; if (x + w > W - 8) x = pt.x - sep - w;
  x = Math.max(8, Math.min(x, W - w - 8));
  const y = Math.max(8, Math.min(pt.y - 48, H - h - 8));
  caja.style.left = x + "px"; caja.style.top = y + "px";
}
function cerrar() { S.inc = null; pintarCola(); pintarMapa(); pintarTarjeta(); }

/* ---------- tablero de acierto ---------- */
function pintarTablero() {
  const a = S.datos?.acierto ?? {}, ej = S.datos?.ejemplo, um = S.datos?.modelo?.umbral ?? 0.5;
  const conReal = visibles().filter((i) => i.real);
  const pos = conReal.filter((i) => !i.real.controlado_mismo_dia), pred = conReal.filter((i) => i.p_no_control_dia >= um);
  const vp = pred.filter((i) => !i.real.controlado_mismo_dia).length;
  const prec = pred.length ? vp / pred.length : null, rec = pos.length ? vp / pos.length : null;
  const n = Math.min(10, conReal.length), top = conReal.slice(0, n).filter((i) => !i.real.controlado_mismo_dia).length;
  const celda = (t, v, nota) => `<div class="m"><span>${t}</span><strong>${v}</strong><small>${nota}</small></div>`;
  const f = (v) => (v == null ? "—" : dec(v, 2));
  $("#tablero").innerHTML = `<h2 class="etq">Acierto del modelo · temporada ${esc(a.temporada ?? "")} <span class="marca-o">${ej ? "ejemplo" : "modelo"}</span></h2><div class="ms">
    ${celda("AUC-PR", f(a.auc_pr), a.base_azar == null ? "pendiente del back" : `azar ${f(a.base_azar)}`)}
    ${celda(`Precisión (umbral ${dec(um, 2)})`, prec == null ? "—" : Math.round(prec * 100) + " %", `${pred.length} avisados · ${ej ? "ejemplo" : "registro"}`)}
    ${celda("Recall", rec == null ? "—" : Math.round(rec * 100) + " %", `${pos.length} no controlados · ${ej ? "ejemplo" : "registro"}`)}
    ${celda(`No controlados en los primeros ${n}`, `${top} de ${n}`, "de la cola · " + (ej ? "ejemplo" : "registro"))}</div>`;
}

/* ---------- control ---------- */
function repintar(ajustar = false) { pintarBarra(); pintarCola(); pintarMapa(ajustar); pintarTarjeta(); pintarTablero(); }
function elegir(id) {
  S.inc = id; pintarCola(); pintarMapa(); pintarTarjeta();
  const i = S.datos.incendios.find((x) => x.id === id);
  if (i) mapa.flyTo([i.lat, i.lon], Math.max(mapa.getZoom(), 10), { duration: 0.6 });
  $(`.fila[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" });
}
async function cargarDia(dia) {
  S.dia = diaValido(dia); S.inc = null; S.region = "";
  S.datos = await api.triaje(S.dia);
  repintar(true);
}

$("#dias").addEventListener("click", (e) => { const b = e.target.closest("[data-dia]"); if (b) cargarDia(b.dataset.dia); });
$("#region").addEventListener("change", (e) => { S.region = e.target.value; S.inc = null; repintar(true); });
$("#abrir-cola").addEventListener("click", () => {
  const abierta = $("#cola").hidden; $("#cola").hidden = !abierta;
  $("#abrir-cola").setAttribute("aria-expanded", String(abierta));
  if (abierta) $("#cola").focus({ preventScroll: true });
});
$("#tarjeta").addEventListener("click", (e) => { if (e.target.closest("[data-cerrar]")) cerrar(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && S.inc) cerrar(); });
$("#lista").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) elegir(b.dataset.id); });

crearMapa();
cargarDia(DIA_INICIAL).catch((e) => { $("#lista").innerHTML = `<li class="vacio">No se pudieron leer los incendios del día.</li>`; console.error(e); });
