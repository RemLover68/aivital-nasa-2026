// Sala de triaje: cola de incendios a la izquierda, mapa al centro, tarjeta del incendio elegido a la derecha y tablero de acierto abajo.
// Modo repetición: se elige un día y se avanza la hora; los incendios aparecen según su hora de inicio y la cola se reordena.
// Al llegar al fin del día se ve lo que pasó de verdad. Las reglas de cálculo están en triaje.js.
import { CONFIG } from "./config.js";
import { api } from "./api.js";
import { FECHAS, FECHA_INICIAL, HORA_INICIAL, HORA_FIN, horaDe, horaTxt, visiblesA, ordenarCola, filtrar, regionesPresentes,
  claseP, NIVELES_P, sector, metricasAcierto } from "./triaje.js";
import { $, esc, dec, fFecha } from "./util.js";

const COLORES = ["#fff3b0", "#fdc863", "#f08a3c", "#d4472b", "#8c1d18"];
const TIPO_ACTIVO = { vivienda: "Viviendas", escuela: "Escuela", salud: "Salud", planta: "Planta forestal", ruta: "Ruta", electrico: "Línea eléctrica" };
const COLOR_ACTIVO = { vivienda: "#1f6e8c", escuela: "#5f8f6b", salud: "#7c688a", planta: "#a06a2c", ruta: "#51616c", electrico: "#c9a227" };
const fp = (p) => `${Math.round(p * 100)} %`;
const cache = {};                                   // incendios del día ya pedidos
// El estado se guarda entre visitas a la pantalla: al volver se retoma el mismo día, hora e incendio.
const T = { fecha: FECHA_INICIAL, hora: HORA_INICIAL, region: "", sel: null, fit: null };

/** Dibuja la sala de triaje dentro de `raiz`. Devuelve una función que la desmonta. */
export async function montarTriaje(raiz, { alCargar }) {
  // Enlace directo a un momento de la repetición: #vista=triaje&fecha=2026-01-17&hora=24
  const q = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (FECHAS.includes(q.get("fecha"))) T.fecha = q.get("fecha");
  if (q.get("hora") !== null && Number.isFinite(Number(q.get("hora")))) T.hora = Math.max(0, Math.min(HORA_FIN, Number(q.get("hora"))));
  let mapa = null, capaPuntos = null, capaDetalle = null, datos = null, vivo = true;
  raiz.innerHTML = `<div class="triaje">
    <div class="barra-triaje">
      <div class="grupo"><span class="etq">Día</span><div class="botones-rango" role="radiogroup" aria-label="Día de la repetición">${FECHAS.map((f) =>
        `<button type="button" role="radio" aria-checked="${f === T.fecha}" data-fecha="${f}">${esc(fFecha(f, { day: "numeric", month: "short" }))}</button>`).join("")}</div></div>
      <div class="grupo hora"><span class="etq">Hora</span><strong id="hora-txt" aria-live="polite"></strong>
        <button type="button" class="boton claro mini" data-paso="-1" aria-label="Retroceder una hora">&minus;1 h</button>
        <input id="rango-hora" type="range" min="0" max="${HORA_FIN}" step="0.25" aria-label="Hora del día">
        <button type="button" class="boton claro mini" data-paso="1" aria-label="Avanzar una hora">+1 h</button>
        <button type="button" class="boton mini" id="fin-dia">Ver el fin del día</button></div>
      <div class="grupo"><label class="etq" for="sel-region">Región</label><select id="sel-region"></select></div>
    </div>
    <div class="triaje-zonas">
      <aside class="cola panel-flota" aria-label="Cola de incendios"><div id="cola"></div></aside>
      <div class="mapa-caja"><div id="mapa" class="mapa" role="application" aria-label="Mapa de incendios del día"></div><div id="leyenda-caja"></div></div>
      <aside class="tarjeta panel-flota" aria-label="Incendio elegido"><div id="tarjeta"></div></aside>
    </div>
    <div class="tablero" id="tablero"></div></div>`;

  // ---------------------------------------------------------------- datos
  async function cargar() {
    const f = T.fecha;
    datos = cache[f] ??= await api.triaje(f);
    if (!vivo) return;
    const regs = regionesPresentes(datos.incendios);
    if (T.region && !regs.some((r) => r.id === T.region)) T.region = "";
    $("#sel-region").innerHTML = `<option value="">Todo Chile (${datos.incendios.length})</option>${regs.map((r) => `<option value="${r.id}"${r.id === T.region ? " selected" : ""}>${esc(r.nombre)} (${r.n})</option>`).join("")}`;
    alCargar?.(datos.origen);
    pintarTodo();
  }
  const delDia = () => filtrar(datos.incendios, { region: T.region || null });
  const cola = () => ordenarCola(visiblesA(delDia(), T.hora));
  const finDelDia = () => T.hora >= HORA_FIN;

  // ---------------------------------------------------------------- controles
  function pintarControles() {
    $("#hora-txt").textContent = horaTxt(T.hora);
    $("#rango-hora").value = String(T.hora);
    for (const b of raiz.querySelectorAll("[data-fecha]")) b.setAttribute("aria-checked", String(b.dataset.fecha === T.fecha));
    $("#fin-dia").disabled = finDelDia();
  }

  // ---------------------------------------------------------------- cola
  function pintarCola(lista) {
    const total = delDia().length;
    $("#cola").innerHTML = `<h2>Cola de incendios</h2>
      <p class="nota"><strong>${lista.length}</strong> conocidos a las ${horaTxt(T.hora)}, de ${total} del día. Ordenados por la probabilidad de que no se controlen el día de inicio.</p>
      ${lista.length ? `<ol class="lista-cola">${lista.map((i) => {
        const c = claseP(i.p_no_control_dia), fin = finDelDia() && i.real;
        return `<li><button type="button" data-incendio="${i.id}" aria-pressed="${i.id === T.sel}">
          <span class="prio">${i.prioridad}</span>
          <span class="que"><strong>${esc(i.nombre)}</strong><small>${esc(i.comuna)} &middot; ${horaTxt(horaDe(i))} &middot; ${esc(i.comb_inicial ?? "combustible sin dato")}</small>
            ${fin ? `<small class="real ${i.real.controlado_mismo_dia ? "ok" : "no"}">${i.real.controlado_mismo_dia ? "Se controló el mismo día" : "No se controló el mismo día"}${i.real.sup_total_ha != null ? ` &middot; ${dec(i.real.sup_total_ha, i.real.sup_total_ha < 10 ? 1 : 0)} ha` : ""}</small>` : ""}</span>
          <span class="valor"><i class="r${c}" aria-hidden="true"></i>${fp(i.p_no_control_dia)}<small>${NIVELES_P[c]}</small></span></button></li>`;
      }).join("")}</ol>` : `<p class="nota vacia">Todavía no hay incendios conocidos a esta hora${T.region ? " en esta región" : ""}. Avanza la hora.</p>`}`;
  }

  // ---------------------------------------------------------------- tarjeta
  function pintarTarjeta(lista) {
    const i = lista.find((x) => x.id === T.sel);
    if (!i) { $("#tarjeta").innerHTML = `<h2>Incendio elegido</h2><p class="nota">No hay incendios para mostrar a esta hora.</p>`; return; }
    const c = claseP(i.p_no_control_dia), max = Math.max(...i.factores.map((f) => f.aporte_pct));
    const real = finDelDia() && i.real;
    const coincide = real && ((i.p_no_control_dia >= (datos.modelo?.umbral ?? 0.5)) === !i.real.controlado_mismo_dia);
    $("#tarjeta").innerHTML = `
      <p class="pista">Prioridad ${i.prioridad} de ${lista.length}</p>
      <h1>${esc(i.nombre)}</h1>
      <p class="bajada">${esc(i.comuna)}, región ${esc(i.region)}. Inició a las ${horaTxt(horaDe(i))}. Combustible: ${esc(i.comb_inicial ?? "sin dato")}.</p>
      <div class="cifra-grande"><strong>${fp(i.p_no_control_dia)}</strong><span class="nivel r${c}">Probabilidad ${NIVELES_P[c].toLowerCase()}</span>
        <span>de que no se controle el día de inicio</span></div>
      <p class="aviso-origen">${datos.ejemplo
        ? "<b>Dato real (CONAF):</b> nombre, lugar, hora de inicio y combustible. <b>Estimación de ejemplo:</b> probabilidad, factores, avance y activos; no salen del modelo."
        : "<b>Dato real (CONAF):</b> nombre, lugar, hora de inicio y combustible. <b>Estimación del modelo:</b> probabilidad, factores, avance y activos."}</p>
      ${real ? `<div class="resultado"><h2>Qué pasó de verdad</h2>
        <p>${i.real.controlado_mismo_dia ? "Se controló el mismo día" : "No se controló el mismo día"}${i.real.sup_total_ha != null ? `; superficie final ${dec(i.real.sup_total_ha, 1)} ha` : ""}.
        El modelo había dicho ${fp(i.p_no_control_dia)}: ${coincide ? "coincide" : "no coincide"} con lo que ocurrió.</p></div>` : ""}
      <h2>Por qué</h2>
      <ul class="causas">${i.factores.map((f) => `<li class="nomod"><div class="fila"><span>${esc(f.nombre)}<small>${esc(f.valor)}</small></span><span class="pct">${f.aporte_pct} %</span></div>
        <div class="barra" aria-hidden="true"><b style="width:${(f.aporte_pct / max) * 100}%"></b></div></li>`).join("")}</ul>
      <h2>En el camino</h2>
      ${i.activos.length ? `<ul class="activos">${i.activos.map((a) => `<li><i style="background:${COLOR_ACTIVO[a.tipo] ?? "#51616c"}" aria-hidden="true"></i>
        <span><strong>${esc(a.nombre)}</strong><small>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; ${a.personas_est ? `~${a.personas_est} personas` : "sin personas"}</small></span>
        <span class="eta">~${dec(a.eta_h, 1)} h</span></li>`).join("")}</ul>
        <p class="nota">El tiempo es una llegada aproximada del fuego si avanza hacia el rumbo estimado.</p>` : `<p class="nota">No hay activos en la zona probable de avance.</p>`}
      <p class="apoyo">Apoyo a la decisión: la probabilidad no es una certeza ni una orden operativa.</p>`;
  }

  // ---------------------------------------------------------------- mapa
  function iniciarMapa() {
    mapa = L.map("mapa", { preferCanvas: true, zoomSnap: 0.25, attributionControl: true });
    L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 17 }).addTo(mapa);
    if (CONFIG.TESELAS_NOMBRES) L.tileLayer(CONFIG.TESELAS_NOMBRES, { maxZoom: 17 }).addTo(mapa);
    capaPuntos = L.layerGroup().addTo(mapa);
    capaDetalle = L.layerGroup().addTo(mapa);
    mapa.setView([-35.5, -71.5], 6);
    $("#leyenda-caja").innerHTML = `<div class="leyenda"><h3>Probabilidad de no control el día de inicio</h3>
      <div class="rampa" aria-hidden="true">${COLORES.map((c) => `<i style="background:${c}"></i>`).join("")}</div>
      <div class="cortes">${["0", "20", "40", "60", "80", "100 %"].map((t) => `<span>${t}</span>`).join("")}</div>
      <p>El tamaño del punto sigue la prioridad en la cola.</p></div>`;
  }
  function pintarMapa(lista) {
    capaPuntos.clearLayers();
    const n = lista.length;
    for (const i of lista) {
      const sel = i.id === T.sel, c = claseP(i.p_no_control_dia);
      const radio = n > 1 ? 13 - (8 * (i.prioridad - 1)) / (n - 1) : 13;
      const p = L.circleMarker([i.lat, i.lon], { radius: radio + (sel ? 2 : 0), color: sel ? "#ffffff" : "#1d2a33", weight: sel ? 3.5 : 1.2, fillColor: COLORES[c], fillOpacity: 0.95 }).addTo(capaPuntos);
      p.bindTooltip(`<strong>${esc(i.nombre)}</strong><br>${esc(i.comuna)} &middot; prioridad ${i.prioridad}<br>${fp(i.p_no_control_dia)} de no control`, { sticky: true });
      p.on("click", () => elegir(i.id));
    }
    // Encuadre: al cambiar de día o de región, se ajusta a todos los incendios del día para que el mapa no salte al avanzar la hora.
    const clave = T.fecha + "|" + T.region;
    if (T.fit !== clave && delDia().length) {
      T.fit = clave;
      const pts = delDia().map((i) => [i.lat, i.lon]);
      mapa.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 9, animate: false });
    }
  }
  function pintarDetalleMapa(lista) {
    capaDetalle.clearLayers();
    const i = lista.find((x) => x.id === T.sel);
    if (!i) return;
    const color = COLORES[claseP(i.p_no_control_dia)];
    const { direccion_grados: dir, radio_km_1h: r1, radio_km_3h: r3 } = i.avance;
    L.polygon(sector(i.lat, i.lon, dir, r3), { color, weight: 1.5, fillColor: color, fillOpacity: 0.3, interactive: false }).addTo(capaDetalle);
    L.polygon(sector(i.lat, i.lon, dir, r1), { color, weight: 1.5, fillColor: color, fillOpacity: 0.45, interactive: false }).addTo(capaDetalle);
    for (const a of i.activos) {
      L.circleMarker([a.lat, a.lon], { radius: 6, color: "#ffffff", weight: 2, fillColor: COLOR_ACTIVO[a.tipo] ?? "#51616c", fillOpacity: 1 }).addTo(capaDetalle)
        .bindTooltip(`<strong>${esc(a.nombre)}</strong><br>${esc(TIPO_ACTIVO[a.tipo] ?? a.tipo)} &middot; a ${dec(a.dist_km, 1)} km &middot; llega en ~${dec(a.eta_h, 1)} h`);
    }
  }
  function acercar(i) {
    const r3 = i.avance.radio_km_3h;
    const pts = [[i.lat, i.lon], ...sector(i.lat, i.lon, i.avance.direccion_grados, r3), ...i.activos.map((a) => [a.lat, a.lon])];
    mapa.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 12, animate: false });
  }

  // ---------------------------------------------------------------- tablero de acierto
  function pintarTablero() {
    const e = datos.ejemplo, pie = e ? "Calculado aquí con probabilidades de ejemplo: no mide el modelo real." : "Contra el registro de CONAF.";
    if (!finDelDia()) {
      $("#tablero").innerHTML = `<h2>Tablero de acierto</h2><p class="nota">Se calcula al llegar al fin del día: hace falta saber qué pasó con cada incendio.</p>`;
      return;
    }
    const a = datos.acierto ?? {};
    const m = metricasAcierto(delDia(), datos.modelo?.umbral ?? 0.5, 10);
    if (!m) { $("#tablero").innerHTML = `<h2>Tablero de acierto</h2><p class="nota">No hay incendios no controlados en esta selección para medir.</p>`; return; }
    const v = (x, mio) => x ?? mio;
    const pct = (x) => (x == null ? "sin dato" : `${Math.round(x * 100)} %`);
    $("#tablero").innerHTML = `<h2>Tablero de acierto</h2>
      <dl class="stats">
        <div><dt>AUC-PR</dt><dd>${dec(v(a.auc_pr, m.auc_pr), 2)}<small>al azar: ${dec(v(a.base_azar, m.base_azar), 2)}</small></dd></div>
        <div><dt>Precisión (umbral ${pct(datos.modelo?.umbral ?? 0.5)})</dt><dd>${pct(v(a.precision, m.precision))}<small>de los que avisó, cuántos no se controlaron</small></dd></div>
        <div><dt>Recall (umbral ${pct(datos.modelo?.umbral ?? 0.5)})</dt><dd>${pct(v(a.recall, m.recall))}<small>de los no controlados, cuántos avisó</small></dd></div>
        <div><dt>No controlados entre los ${m.k} primeros</dt><dd>${m.en_primeros} de ${Math.min(m.k, m.positivos)}<small>de ${m.positivos} no controlados en el día</small></dd></div>
      </dl><p class="nota pie-tab">${pie}</p>`;
  }

  // ---------------------------------------------------------------- orquestación
  function pintarTodo() {
    const lista = cola();
    if (!lista.some((i) => i.id === T.sel)) T.sel = lista[0]?.id ?? null;
    pintarControles(); pintarCola(lista); pintarTarjeta(lista); pintarMapa(lista); pintarDetalleMapa(lista); pintarTablero();
  }
  function elegir(id) {
    T.sel = id;
    const lista = cola();
    pintarCola(lista); pintarTarjeta(lista); pintarMapa(lista); pintarDetalleMapa(lista);
    const i = lista.find((x) => x.id === id);
    if (i) acercar(i);
    $("#tarjeta").parentElement.scrollTop = 0;
  }
  const ponerHora = (h) => { T.hora = Math.max(0, Math.min(HORA_FIN, h)); pintarTodo(); };

  raiz.addEventListener("click", (e) => {
    const f = e.target.closest("[data-fecha]"), p = e.target.closest("[data-paso]"), inc = e.target.closest("[data-incendio]");
    if (f) { T.fecha = f.dataset.fecha; T.sel = null; cargar(); return; }
    if (p) { ponerHora(Number(p.dataset.paso) > 0 ? Math.floor(T.hora) + 1 : Math.ceil(T.hora) - 1); return; }
    if (e.target.closest("#fin-dia")) { ponerHora(HORA_FIN); return; }
    if (inc) elegir(inc.dataset.incendio);
  });
  raiz.addEventListener("input", (e) => { if (e.target.id === "rango-hora") ponerHora(Number(e.target.value)); });
  raiz.addEventListener("change", (e) => { if (e.target.id === "sel-region") { T.region = e.target.value; T.sel = null; pintarTodo(); } });

  iniciarMapa();
  await cargar();
  return () => { vivo = false; mapa?.remove(); mapa = null; };
}
