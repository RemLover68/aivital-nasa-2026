import { api } from "./api.js";
import { CONFIG } from "./config.js";
import { evaluar, estadoPorPunto, puntosSobreUmbralPorDia, NOMBRE_ESTADO, priorizar, alertas, textoParte, PESOS_FABRICA,
  NOMBRE_PRIORIDAD, sugerenciasDeUmbral } from "./logica.js";
import { $, esc, NIVEL, MESES, fFecha, pct, num, cuando, leer, guardar, estado, datos } from "./util.js";
import { vistaPrioridad, vistaComuna, vistaContraste, vistaFuentes, alPintarComuna, clicDatos, cambioDatos, entradaDatos, conectar } from "./vistas-datos.js";

const NOMBRE_PROTOCOLO_CORTO = { faenas: "Faenas", humo: "Humo", salud: "Red de salud", establecimiento: "Establecimiento" };
const CAPAS = {
  foco: { nombre: "Riesgo de foco", leyenda: [["bajo", "Bajo"], ["medio", "Medio"], ["alto", "Alto"], ["muy_alto", "Muy alto"]] },
  humo: { nombre: "Humo esperado", leyenda: [["h0", "Menos de 15"], ["h1", "15 a 35"], ["h2", "35 a 55"], ["h3", "Más de 55 µg/m³"]] },
  salud: { nombre: "Alza respiratoria", leyenda: [["s0", "Menos de 5 %"], ["s1", "5 a 10 %"], ["s2", "10 a 18 %"], ["s3", "Más de 18 %"]] },
  ignicion: { nombre: "Presión de ignición", leyenda: [["i0", "Baja"], ["i1", "Media"], ["i2", "Alta"], ["i3", "Muy alta"]] },
};

let mapa = null;
let capaComunas = null;
let capaPuntos = null;
let vistaGuardada = null;

// ---------- formato ----------
const claseHumo = (v) => (v == null ? "nd" : v >= 55 ? "h3" : v >= 35 ? "h2" : v >= 15 ? "h1" : "h0");
const claseSalud = (v) => (v == null ? "nd" : v >= 18 ? "s3" : v >= 10 ? "s2" : v >= 5 ? "s1" : "s0");
// Presión de ignición humana: promedio de cercanía a líneas eléctricas, caminos y edificaciones. No cambia con el día.
const presionIgnicion = (it) => (it?.ignicion ? (it.ignicion.lineas + it.ignicion.caminos + it.ignicion.edificaciones) / 3 : null);
const claseIgnicion = (v) => (v == null ? "nd" : v >= 0.75 ? "i3" : v >= 0.55 ? "i2" : v >= 0.35 ? "i1" : "i0");
const claseCapa = (it, d) => (estado.capa === "ignicion" ? claseIgnicion(presionIgnicion(it))
  : !d ? "nd" : estado.capa === "foco" ? d.nivel : estado.capa === "humo" ? claseHumo(d.pm25_humo) : claseSalud(d.urgencias_resp_extra_pct));

function valorTexto(p, v) {
  if (p.variable === "prob_foco") return `probabilidad de foco ${pct(v)}`;
  if (p.variable === "pm25_humo") return `humo ${num(v, " µg/m³")}`;
  return `alza respiratoria ${num(v, " %")}`;
}

// ---------- carga ----------
async function cargar() {
  const [manifest, regiones, pronostico, puntos, protocolos, registro, metricas, contraste] = await Promise.all([
    api.manifest(), api.regiones(), api.pronostico(), api.puntos(), api.protocolos(), api.registro(), api.metricas(), api.contraste(),
  ]);
  Object.assign(datos, { manifest, regiones, pronostico, puntos: puntos.items, protocolos: protocolos.items, registro: registro.items, metricas, contraste });
  datos.comunas = regiones.features.map((f) => f.properties).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  datos.pesos = { ...PESOS_FABRICA, ...leer("preaviso.pesos", {}) };
  if (!pronostico.items?.length) throw new Error("No hay pronóstico ni riesgo publicado para ninguna comuna.");
  datos.pronPorComuna = Object.fromEntries(pronostico.items.map((it) => [it.region_id, it]));
  datos.nDias = Math.max(...pronostico.items.map((it) => it.dias.length));
  const guardados = leer("preaviso.umbrales", {});
  for (const p of datos.protocolos) Object.assign(p, guardados[p.id] || {});
  recalcular();
}

function recalcular() {
  datos.avisos = evaluar(datos.protocolos, datos.puntos, datos.pronPorComuna);
  datos.estadoPunto = estadoPorPunto(datos.avisos);
  datos.sobreUmbral = puntosSobreUmbralPorDia(datos.protocolos, datos.puntos, datos.pronPorComuna, datos.nDias);
  datos.prioridad = priorizar(datos.pronostico, datos.puntos, datos.pesos);
  datos.alertas = alertas(datos.avisos, datos.prioridad);
}

// ---------- franja de anticipación ----------
function pintarFranja() {
  const dias = datos.pronostico.items[0].dias;
  $("#franja").innerHTML = dias.map((d, i) => {
    const cuenta = { bajo: 0, medio: 0, alto: 0, muy_alto: 0 };
    let humoMax = null;
    for (const it of datos.pronostico.items) {
      const x = it.dias[i];
      if (!x) continue;
      cuenta[x.nivel] += 1;
      if (x.pm25_humo != null) humoMax = Math.max(humoMax ?? 0, x.pm25_humo);
    }
    const total = Object.values(cuenta).reduce((a, b) => a + b, 0);
    const barra = Object.entries(cuenta).filter(([, n]) => n).map(([nivel, n]) => `<span class="n-${nivel}" style="flex:${n}" title="${NIVEL[nivel]}: ${n} de ${total} comunas"></span>`).join("");
    const sel = estado.dia === d.dia;
    return `<button class="dia ${sel ? "es-sel" : ""} fuente-${d.fuente_foco}" role="radio" aria-checked="${sel}" data-dia="${d.dia}">
      <span class="dia-cuando">${d.dia === 1 ? "Mañana" : fFecha(d.fecha, { weekday: "long" })}</span>
      <span class="dia-fecha">${fFecha(d.fecha, { day: "numeric", month: "short" })}</span>
      <span class="dia-barra" aria-hidden="true">${barra}</span>
      <span class="dia-dato"><strong>${cuenta.alto + cuenta.muy_alto}</strong> comunas en alto o muy alto</span>
      <span class="dia-dato"><strong>${datos.sobreUmbral[i]}</strong> puntos sobre su umbral</span>
      <span class="dia-dato">Humo máximo ${num(humoMax == null ? null : Math.round(humoMax), " µg/m³")}</span>
      <span class="dia-fuente">${d.fuente_foco === "motor" ? "Motor propio" : "Tendencia externa"}</span>
    </button>`;
  }).join("");
}

// ---------- vista: parte de hoy ----------
const hechas = () => leer("preaviso.hechas", {});

function tarjetaAviso(a) {
  const h = hechas();
  const listas = a.acciones.filter((_, i) => h[`${a.id}|${i}`]).length;
  const acciones = a.acciones.map((ac, i) => {
    const clave = `${a.id}|${i}`;
    return `<li><label><input type="checkbox" data-hecha="${esc(clave)}" ${h[clave] ? "checked" : ""}>
      <span>${esc(ac.texto)}</span></label><span class="quien">${esc(ac.quien)}</span></li>`;
  }).join("");
  return `<details class="aviso est-${a.estado}">
    <summary>
      <span class="aviso-punto">${esc(a.punto.nombre)}</span>
      <span class="aviso-lugar">${esc(a.punto.comuna)}, ${a.punto.personas} personas</span>
      <span class="aviso-motivo">${cuando(a.dia)}: ${valorTexto(a.protocolo, a.valor)}. Confianza ${esc(a.dia.confianza)}.</span>
      <span class="aviso-avance">${listas} de ${a.acciones.length} hechas</span>
    </summary>
    <ul class="acciones">${acciones}</ul>
    <p class="freno">${esc(a.protocolo.freno)}</p>
  </details>`;
}

function bloqueEstado(est) {
  const lista = datos.avisos.filter((a) => a.estado === est);
  if (!lista.length) return `<section class="bloque"><h2>${NOMBRE_ESTADO[est]}</h2><p class="vacio">Nada por ${est === "activacion" ? "activar" : "preparar"} hoy con los umbrales actuales.</p></section>`;
  const porProtocolo = {};
  for (const a of lista) (porProtocolo[a.protocolo.id] ||= []).push(a);
  const VISIBLES = 3;
  const grupos = Object.values(porProtocolo).map((g) => {
    const resto = g.slice(VISIBLES);
    const mas = resto.length ? `<details class="mas"><summary>Ver ${resto.length} más de este protocolo</summary>${resto.map(tarjetaAviso).join("")}</details>` : "";
    return `<div class="grupo"><h3>${esc(g[0].protocolo.nombre)} <span class="cuenta">${g.length}</span></h3>${g.slice(0, VISIBLES).map(tarjetaAviso).join("")}${mas}</div>`;
  }).join("");
  return `<section class="bloque bloque-${est}"><h2>${NOMBRE_ESTADO[est]} <span class="cuenta">${lista.length}</span></h2>${grupos}</section>`;
}

function fechaDelParte() {
  const hoy = new Date(datos.pronostico.items[0].dias[0].fecha + "T12:00:00");
  hoy.setDate(hoy.getDate() - 1);
  return new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(hoy);
}

function textoDelParte() {
  return textoParte(datos.alertas, { fecha: fechaDelParte(), ejemplo: Boolean(datos.pronostico.inventado || datos.pronostico.ejemplo) });
}

// Las tres situaciones de mayor puntaje, para que lo urgente se vea antes que la lista completa.
function loPrimero() {
  const top = datos.prioridad.filter((f) => f.nivel !== "seguimiento").slice(0, 3);
  if (!top.length) return "";
  return `<section class="primero" aria-labelledby="t-primero"><h2 id="t-primero">Lo primero</h2>
    <ol class="primero-lista">${top.map((f) => `<li class="prio-${f.nivel}"><button data-ir-comuna="${esc(f.region_id)}" data-ir-vista="prioridad">
      <span class="primero-puntaje">${f.puntaje}</span>
      <span class="primero-nombre">${esc(f.nombre)}</span>
      <span class="primero-nivel">${NOMBRE_PRIORIDAD[f.nivel]}, ${cuando(f.dia).toLowerCase()}</span>
      <span class="primero-porque">Sube por ${esc(f.porque.join(" y "))}. ${f.personas ? `${f.personas} personas en ${f.puntos.length} ${f.puntos.length === 1 ? "punto" : "puntos"}.` : "Sin puntos tuyos."}</span>
    </button></li>`).join("")}</ol>
    <p class="nota">Puntaje de 0 a 100 con seis factores. <button class="enlace" data-vista="prioridad">Ver el orden completo y cambiar los pesos</button></p></section>`;
}

function vistaParte() {
  const fechaHoy = fechaDelParte();
  const texto = textoDelParte();
  // un punto puede estar en vigilancia por más de un protocolo: se lista una sola vez
  const vistos = new Set();
  const vigilancia = datos.avisos.filter((a) => a.estado === "vigilancia" && datos.estadoPunto[a.punto.id] === "vigilancia" && !vistos.has(a.punto.id) && vistos.add(a.punto.id));
  const salud = datos.pronostico.items
    .map((it) => ({ it, d: it.dias.reduce((m, d) => ((d.urgencias_resp_extra_pct ?? -1) > (m.urgencias_resp_extra_pct ?? -1) ? d : m), it.dias[0]) }))
    .filter((x) => x.d.urgencias_resp_extra_pct != null)
    .sort((a, b) => b.d.urgencias_resp_extra_pct - a.d.urgencias_resp_extra_pct).slice(0, 6);
  const maxSalud = Math.max(1, ...salud.map((x) => x.d.urgencias_resp_extra_pct));
  const m = datos.metricas;
  return `<div class="parte">
    <div class="parte-principal">
      <h1>Parte del ${esc(fechaHoy)}</h1>
      <p class="bajada">Lo que conviene hacer hoy, antes de que el fuego o el humo lleguen a tus puntos.</p>
      <div class="envio" role="group" aria-label="Enviar el parte">
        <a class="boton-secundario" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(texto)}">Enviar por WhatsApp</a>
        <a class="boton-secundario" href="mailto:?subject=${encodeURIComponent(`Preaviso, parte del ${fechaHoy}`)}&body=${encodeURIComponent(texto)}">Enviar por correo</a>
        <button class="boton-secundario" id="copiar-parte">Copiar el texto</button>
        <a class="enlace" href="movil.html">Abrir la vista de terreno</a>
      </div>
      ${loPrimero()}
      ${bloqueEstado("activacion")}
      ${bloqueEstado("preparacion")}
    </div>
    <aside class="parte-lateral">
      <section class="panel">
        <h2>En vigilancia <span class="cuenta">${vigilancia.length}</span></h2>
        <p class="nota">Superan su umbral más adelante en la semana. Todavía no piden acción.</p>
        <ul class="lista-simple">${vigilancia.slice(0, 6).map((a) => `<li><span>${esc(a.punto.nombre)}</span><span>${fFecha(a.dia.fecha, { weekday: "short", day: "numeric" })}</span></li>`).join("") || "<li>Ninguno</li>"}</ul>
      </section>
      <section class="panel">
        <h2>Alza respiratoria esperada</h2>
        <p class="nota">Urgencias respiratorias sobre lo habitual, en el peor día de la semana de cada comuna.</p>
        <ul class="barras">${salud.map((x) => `<li><span class="barra-nombre">${esc(x.it.nombre)}</span>
          <span class="barra-pista"><span class="barra-valor ${claseSalud(x.d.urgencias_resp_extra_pct)}" style="width:${(x.d.urgencias_resp_extra_pct / maxSalud) * 100}%"></span></span>
          <span class="barra-num">+${num(x.d.urgencias_resp_extra_pct, " %")}</span></li>`).join("") || "<li>Sin dato de humo</li>"}</ul>
      </section>
      <section class="panel">
        <h2>Cuánto acierta el motor</h2>
        ${m.auc == null ? `<p class="estado-modelo">Modelo en validación</p><p class="nota">${esc(m.nota || "Pendiente.")}</p>` : `<dl class="metricas"><div><dt>Discriminación</dt><dd>${num(m.auc)}</dd></div><div><dt>Focos captados en el 10 % de mayor riesgo</dt><dd>${pct(m.captura_top10)}</dd></div></dl><p class="nota">${esc(m.nota || "")}</p>`}
        <p class="nota">Según el equipo del back, el modelo anticipa cómo se propaga un incendio activo. No predice dónde empieza uno.</p>
      </section>
    </aside>
  </div>`;
}

// ---------- vista: mapa ----------
function vistaMapa() {
  const selector = Object.entries(CAPAS).map(([id, c]) => `<button class="capa ${estado.capa === id ? "es-sel" : ""}" role="radio" aria-checked="${estado.capa === id}" data-capa="${id}">${c.nombre}</button>`).join("");
  const leyenda = CAPAS[estado.capa].leyenda.map(([cl, t]) => `<span class="ley"><i class="n-${cl}"></i>${t}</span>`).join("");
  return `<div class="vista-mapa">
    <div class="mapa-barra"><div class="capas" role="radiogroup" aria-label="Qué muestra el mapa">${selector}</div><div class="leyenda">${leyenda}<span class="ley"><i class="pt"></i>Tus puntos</span></div>${estado.capa === "ignicion" ? '<p class="nota capa-nota">Cercanía a líneas eléctricas, caminos y edificaciones. No cambia con el día.</p>' : ""}<button class="boton-secundario" id="ver-todo">Ver todas las comunas</button></div>
    <div class="mapa-cuerpo"><div id="mapa" aria-label="Mapa de comunas"></div><aside id="ficha" class="ficha">${fichaComuna()}</aside></div>
  </div>`;
}

function colorDe(clase) {
  return getComputedStyle(document.documentElement).getPropertyValue(`--n-${clase}`).trim() || "#b9c3c8";
}

function pintarMapa() {
  if (!mapa) {
    mapa = L.map("mapa", { zoomSnap: 0.25, attributionControl: true }).setView(vistaGuardada?.c ?? CONFIG.MAPA_CENTRO, vistaGuardada?.z ?? CONFIG.MAPA_ZOOM);
    L.tileLayer(CONFIG.TESELAS, { attribution: CONFIG.TESELAS_CREDITO, maxZoom: 13, opacity: 0.55 }).addTo(mapa);
  } else if (mapa.getContainer() !== $("#mapa")) {
    vistaGuardada = { c: mapa.getCenter(), z: mapa.getZoom() };
    mapa.remove();
    mapa = null;
    return pintarMapa();
  }
  capaComunas?.remove();
  capaPuntos?.remove();
  capaComunas = L.geoJSON(datos.regiones, {
    style: (f) => {
      const it = datos.pronPorComuna[f.properties.region_id];
      const d = it?.dias[estado.dia - 1];
      const sel = estado.comuna === f.properties.region_id;
      return { fillColor: colorDe(claseCapa(it, d)), fillOpacity: 0.9, color: "#1d2a33", weight: sel ? 3.5 : 1 };
    },
    onEachFeature: (f, capa) => {
      capa.bindTooltip(f.properties.nombre, { sticky: true });
      capa.on("click", () => { estado.comuna = f.properties.region_id; pintarMapa(); $("#ficha").innerHTML = fichaComuna(); cargarCalendario(); });
    },
  }).addTo(mapa);
  capaPuntos = L.layerGroup(datos.puntos.map((x) => {
    const est = datos.estadoPunto[x.id];
    return L.circleMarker([x.lat, x.lon], { radius: est === "activacion" ? 6 : 4.5, color: "#1d2a33", weight: est ? 2 : 1, fillColor: est === "activacion" ? "#1d2a33" : "#ffffff", fillOpacity: 1 })
      .bindTooltip(`${x.nombre}${est ? `, ${NOMBRE_ESTADO[est].toLowerCase()}` : ""}`);
  })).addTo(mapa);
  setTimeout(() => mapa?.invalidateSize(), 0);
}

function fichaComuna() {
  const it = datos.pronPorComuna[estado.comuna];
  if (!it) return `<h2>Elige una comuna</h2><p class="nota">Toca una comuna del mapa para ver sus próximos días, su historia de focos y tus puntos en ella.</p>`;
  const filas = it.dias.map((d) => `<tr class="${d.dia === estado.dia ? "es-sel" : ""}">
    <th scope="row">${fFecha(d.fecha, { weekday: "short", day: "numeric" })}</th>
    <td><span class="pastilla n-${d.nivel}">${NIVEL[d.nivel]}</span> ${pct(d.prob_foco)}</td>
    <td>${num(d.pm25_humo == null ? null : Math.round(d.pm25_humo))}</td>
    <td>${d.urgencias_resp_extra_pct == null ? "sin dato" : `+${num(d.urgencias_resp_extra_pct, " %")}`}</td></tr>`).join("");
  const pts = datos.puntos.filter((x) => x.region_id === it.region_id);
  return `<h2>${esc(it.nombre)}</h2><p class="nota">${esc(it.region)}${it.poblacion ? `, ${it.poblacion.toLocaleString("es-CL")} habitantes` : ""}</p>
    <table class="tabla-ficha"><thead><tr><th scope="col">Día</th><th scope="col">Foco</th><th scope="col">Humo</th><th scope="col">Urgencias</th></tr></thead><tbody>${filas}</tbody></table>
    <h3>Historia de focos, últimos 36 meses</h3><div id="calendario" class="calendario"><p class="nota">Cargando…</p></div>
    <h3>Tus puntos en la comuna</h3>
    <ul class="lista-simple">${pts.map((x) => `<li><span>${esc(x.nombre)}</span><span>${datos.estadoPunto[x.id] ? NOMBRE_ESTADO[datos.estadoPunto[x.id]] : "Sin aviso"}</span></li>`).join("") || "<li>Ninguno cargado</li>"}</ul>
    <p><button class="boton-secundario" data-ir-comuna="${esc(it.region_id)}" data-ir-vista="comuna">Ver la ficha completa de la comuna</button></p>`;
}

async function cargarCalendario() {
  const id = estado.comuna;
  if (!id || !$("#calendario")) return;
  try {
    const cal = await api.calendario(id);
    if (estado.comuna !== id || !$("#calendario")) return;
    const meses = MESES;
    const ult = cal.registros.slice(-36);
    const ultimo = ult[ult.length - 1];
    $("#calendario").innerHTML = `<div class="cal-celdas">${ult.map((r) => `<span class="c-${r.nivel}" title="${meses[r.mes - 1]} ${r.anio}: ${num(r.armonizado)} focos armonizados, percentil ${r.percentil}"></span>`).join("")}</div>
      <p class="nota">Cada celda es un mes. El último, ${meses[ultimo.mes - 1]} de ${ultimo.anio}, quedó en el percentil ${ultimo.percentil} de su historia (${esc(ultimo.nivel)}).</p>
      <div class="leyenda"><span class="ley"><i class="c-baja"></i>Baja</span><span class="ley"><i class="c-normal"></i>Normal</span><span class="ley"><i class="c-alta"></i>Alta</span><span class="ley"><i class="c-extrema"></i>Extrema</span></div>`;
  } catch (e) {
    if ($("#calendario")) $("#calendario").innerHTML = `<p class="nota">No hay calendario para esta comuna. ${esc(e.message)}</p>`;
  }
}

// ---------- vista: mis puntos ----------
function vistaPuntos() {
  const orden = { activacion: 0, preparacion: 1, vigilancia: 2, undefined: 3 };
  const lista = [...datos.puntos].sort((a, b) => orden[datos.estadoPunto[a.id]] - orden[datos.estadoPunto[b.id]] || b.personas - a.personas);
  const cab = datos.pronostico.items[0].dias.map((d) => `<th scope="col" class="col-dia ${d.dia === estado.dia ? "es-sel" : ""}">${fFecha(d.fecha, { weekday: "short", day: "numeric" })}</th>`).join("");
  const filas = lista.map((x) => {
    const est = datos.estadoPunto[x.id];
    const dias = (datos.pronPorComuna[x.region_id]?.dias || []).map((d) => `<td class="col-dia ${d.dia === estado.dia ? "es-sel" : ""}"><span class="celda n-${d.nivel}" title="Foco ${NIVEL[d.nivel]}, ${pct(d.prob_foco)}"></span><span class="celda-humo ${claseHumo(d.pm25_humo)}">${d.pm25_humo == null ? "" : Math.round(d.pm25_humo)}</span></td>`).join("");
    return `<tr><th scope="row">${esc(x.nombre)}<span class="sub">${esc(x.tipo_nombre)}${x.al_aire_libre ? ", al aire libre" : ""}</span></th>
      <td>${esc(x.comuna)}</td><td class="der">${x.personas}</td>${dias}
      <td><span class="estado est-${est || "ninguno"}">${est ? NOMBRE_ESTADO[est] : "Sin aviso"}</span></td></tr>`;
  }).join("");
  return `<div class="vista-tabla"><div class="titulo-fila"><div><h1>Mis puntos</h1><p class="bajada">${datos.puntos.length} lugares cargados. En cada día, el color es el riesgo de foco de su comuna y el número es el humo esperado en µg/m³.</p></div>
    <button class="boton-secundario" disabled title="Disponible cuando exista el servicio de carga">Subir puntos desde una planilla</button></div>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th scope="col">Punto</th><th scope="col">Comuna</th><th scope="col" class="der">Personas</th>${cab}<th scope="col">Estado</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

// ---------- vista: protocolos ----------
function rangoDe(p) {
  if (p.variable === "prob_foco") return { min: 0.05, max: 0.6, paso: 0.01, f: pct };
  if (p.variable === "pm25_humo") return { min: 10, max: 120, paso: 1, f: (v) => `${v} µg/m³` };
  return { min: 2, max: 40, paso: 1, f: (v) => `${v} %` };
}

function vistaProtocolos() {
  const tipos = { faena: "centros de trabajo", salud: "centros de salud", eleam: "residencias de mayores", colegio: "colegios" };
  const tarjetas = datos.protocolos.map((p) => {
    const r = rangoDe(p);
    const mios = datos.avisos.filter((a) => a.protocolo.id === p.id);
    const n = (e) => mios.filter((a) => a.estado === e).length;
    const lista = (acs) => acs.map((a) => `<li>${esc(a.texto)}<span class="quien">${esc(a.quien)}</span></li>`).join("");
    return `<article class="protocolo" data-protocolo="${p.id}">
      <header><h2>${esc(p.nombre)}</h2><p class="nota">Aplica a ${p.aplica_a.map((t) => tipos[t]).join(" y ")}. Mira ${esc(p.unidad)}.</p></header>
      <div class="etapas">
        <section class="etapa etapa-preparacion"><h3>Preparación</h3><p class="etapa-cuando">Hasta ${p.dias_preparacion} días antes</p>
          <label>Umbral <output>${r.f(p.umbral_preparacion)}</output><input type="range" min="${r.min}" max="${r.max}" step="${r.paso}" value="${p.umbral_preparacion}" data-umbral="umbral_preparacion"></label>
          <ul class="acciones-lista">${lista(p.acciones_preparacion)}</ul></section>
        <section class="etapa etapa-activacion"><h3>Activación</h3><p class="etapa-cuando">Hasta ${p.dias_activacion} día antes</p>
          <label>Umbral <output>${r.f(p.umbral_activacion)}</output><input type="range" min="${r.min}" max="${r.max}" step="${r.paso}" value="${p.umbral_activacion}" data-umbral="umbral_activacion"></label>
          <ul class="acciones-lista">${lista(p.acciones_activacion)}</ul></section>
        <section class="etapa etapa-freno"><h3>Freno</h3><p>${esc(p.freno)}</p></section>
      </div>
      <p class="efecto">Con estos umbrales, esta semana: <strong>${n("activacion")}</strong> por activar hoy, <strong>${n("preparacion")}</strong> por preparar y <strong>${n("vigilancia")}</strong> en vigilancia.</p>
    </article>`;
  }).join("");
  return `<div class="vista-protocolos"><h1>Protocolos</h1><p class="bajada">Cada protocolo dice qué valor dispara el aviso, con cuánta anticipación, qué se hace y cuándo se levanta. Mueve un umbral y verás cuántos avisos genera: más bajo avisa antes y trae más falsas alarmas.</p>${tarjetas}
    <p><button class="boton-secundario" id="restaurar">Volver a los umbrales de fábrica</button></p></div>`;
}

// ---------- vista: registro ----------
function vistaRegistro() {
  const r = datos.registro;
  const n = (res) => r.filter((f) => f.resultado === res).length;
  const avisados = r.filter((f) => f.aviso);
  const conAccion = avisados.filter((f) => f.accion_tomada).length;
  const nombres = { acierto: "Acierto", falsa_alarma: "Falsa alarma", sin_aviso: "Sin aviso previo" };
  const sug = sugerenciasDeUmbral(r).map((s) => `<li><strong>${esc(NOMBRE_PROTOCOLO_CORTO[s.protocolo] || s.protocolo)}.</strong> ${s.tipo === "subir"
    ? `${s.casos} de ${s.de} avisos fueron falsas alarmas. Conviene subir su umbral.`
    : `${s.casos} de ${s.de} casos llegaron sin aviso previo. Conviene bajar su umbral.`} <button class="enlace" data-vista="protocolos">Ir al protocolo</button></li>`).join("");
  const filas = r.map((f) => `<tr><th scope="row">${fFecha(f.fecha, { day: "numeric", month: "short" })}</th><td>${esc(f.comuna)}</td>
    <td>${esc(NOMBRE_PROTOCOLO_CORTO[f.protocolo] || f.protocolo)}</td><td>${f.aviso ? `${f.anticipacion_horas} horas antes` : "No se avisó"}</td>
    <td>${f.aviso ? (f.accion_tomada ? "Sí" : "No") : ""}</td><td>${esc(f.que_paso)}</td><td><span class="estado res-${f.resultado}">${nombres[f.resultado]}</span></td></tr>`).join("");
  return `<div class="vista-tabla"><h1>Registro</h1><p class="bajada">Cada aviso queda anotado con lo que se hizo y lo que pasó después. Así se sabe cuánto acierta la plataforma y dónde conviene mover un umbral.</p>
    <dl class="resumen">
      <div><dt>Avisos enviados</dt><dd>${avisados.length}</dd></div>
      <div><dt>Aciertos</dt><dd>${n("acierto")}</dd></div>
      <div><dt>Falsas alarmas</dt><dd>${n("falsa_alarma")}</dd></div>
      <div><dt>Focos sin aviso previo</dt><dd>${n("sin_aviso")}</dd></div>
      <div><dt>Avisos con acción tomada</dt><dd>${avisados.length ? Math.round((conAccion / avisados.length) * 100) : 0} %</dd></div>
    </dl>
    <section class="sugerencias"><h2>Qué conviene ajustar</h2>${sug ? `<ul>${sug}</ul>` : '<p class="nota">Con este registro ningún protocolo pide un ajuste. Se sugiere un cambio cuando 4 de cada 10 avisos son falsas alarmas o 1 de cada 4 casos llega sin aviso.</p>'}
      <p class="nota">La decisión de mover un umbral la toma una persona. La plataforma solo la propone.</p></section>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th scope="col">Fecha</th><th scope="col">Comuna</th><th scope="col">Protocolo</th><th scope="col">Aviso</th><th scope="col">Se actuó</th><th scope="col">Qué pasó</th><th scope="col">Resultado</th></tr></thead><tbody>${filas}</tbody></table></div></div>`;
}

// ---------- armado ----------
const VISTAS = { parte: vistaParte, prioridad: vistaPrioridad, mapa: vistaMapa, puntos: vistaPuntos, protocolos: vistaProtocolos, registro: vistaRegistro,
  comuna: vistaComuna, contraste: vistaContraste, fuentes: vistaFuentes };
// La franja de días solo acompaña a las vistas que dependen del día elegido.
const CON_FRANJA = new Set(["parte", "prioridad", "mapa", "puntos", "contraste"]);

function direccion() {
  const q = new URLSearchParams(location.search);
  if (estado.vista === "comuna" && estado.comuna) q.set("comuna", estado.comuna); else q.delete("comuna");
  const texto = q.toString();
  history.replaceState(null, "", `${location.pathname}${texto ? `?${texto}` : ""}#${estado.vista}`);
}

function pintar() {
  document.querySelectorAll("[data-vista]").forEach((b) => b.setAttribute("aria-current", b.dataset.vista === estado.vista ? "page" : "false"));
  pintarFranja();
  $(".anticipacion").hidden = !CON_FRANJA.has(estado.vista);
  direccion();
  if (estado.vista !== "mapa" && mapa) { vistaGuardada = { c: mapa.getCenter(), z: mapa.getZoom() }; mapa.remove(); mapa = null; }
  $("#contenido").innerHTML = VISTAS[estado.vista]();
  if (estado.vista === "mapa") { pintarMapa(); cargarCalendario(); }
  if (estado.vista === "comuna") alPintarComuna();
}
conectar({ pintar, recalcular });

document.addEventListener("click", (e) => {
  const vista = e.target.closest("[data-vista]");
  if (vista) { estado.vista = vista.dataset.vista; pintar(); window.scrollTo(0, 0); return; }
  const ir = e.target.closest("[data-ir-comuna]");
  if (ir) { estado.comuna = ir.dataset.irComuna; estado.vista = ir.dataset.irVista || "comuna"; pintar(); window.scrollTo(0, 0); return; }
  if (e.target.id === "copiar-parte") {
    navigator.clipboard?.writeText(textoDelParte()).then(() => { e.target.textContent = "Texto copiado"; }, () => { e.target.textContent = "No se pudo copiar"; });
    return;
  }
  if (e.target.closest("[data-fuente]")) { guardar("preaviso.fuente", e.target.closest("[data-fuente]").dataset.fuente); location.href = location.pathname; return; }
  if (clicDatos(e)) return;
  const dia = e.target.closest("[data-dia]");
  if (dia) { estado.dia = Number(dia.dataset.dia); pintar(); return; }
  const capa = e.target.closest("[data-capa]");
  if (capa) { estado.capa = capa.dataset.capa; pintar(); return; }
  if (e.target.id === "ver-todo" && mapa && capaComunas) { mapa.fitBounds(capaComunas.getBounds(), { padding: [24, 24] }); return; }
  if (e.target.id === "restaurar") { localStorage.removeItem("preaviso.umbrales"); location.reload(); }
});

document.addEventListener("change", (e) => {
  if (e.target.dataset.hecha) {
    const h = hechas();
    h[e.target.dataset.hecha] = e.target.checked;
    guardar("preaviso.hechas", h);
    const aviso = e.target.closest("details.aviso");
    const total = aviso.querySelectorAll("[data-hecha]").length;
    const listas = aviso.querySelectorAll("[data-hecha]:checked").length;
    aviso.querySelector(".aviso-avance").textContent = `${listas} de ${total} hechas`;
  }
  if (e.target.dataset.umbral) {
    const id = e.target.closest("[data-protocolo]").dataset.protocolo;
    const p = datos.protocolos.find((x) => x.id === id);
    p[e.target.dataset.umbral] = Number(e.target.value);
    if (p.umbral_preparacion > p.umbral_activacion) p.umbral_preparacion = p.umbral_activacion;
    const g = leer("preaviso.umbrales", {});
    g[id] = { umbral_preparacion: p.umbral_preparacion, umbral_activacion: p.umbral_activacion };
    guardar("preaviso.umbrales", g);
    recalcular();
    pintar();
  }
  cambioDatos(e);
});

document.addEventListener("input", (e) => {
  entradaDatos(e);
  if (!e.target.dataset.umbral) return;
  const p = datos.protocolos.find((x) => x.id === e.target.closest("[data-protocolo]").dataset.protocolo);
  e.target.closest("label").querySelector("output").textContent = rangoDe(p).f(Number(e.target.value));
});

// Franja amarilla de arriba e interruptor del pie: de dónde vienen los números que se están viendo.
function pintarAvisoDeDatos() {
  const m = datos.manifest;
  const partes = [];
  if (CONFIG.FUENTE === "maqueta") partes.push(`${CONFIG.SIN_BACK ? "No hubo conexión con el back. " : ""}Maqueta con datos inventados. Ningún número de esta página es un pronóstico real.`);
  else {
    partes.push(m.ejemplo ? `Historia de focos: datos de ejemplo del back (${m.regiones.length} comunas).` : `Historia de focos y contornos: datos reales del back, ${m.regiones.length} comunas, generados el ${fFecha(m.generado_utc.slice(0, 10), { day: "numeric", month: "long" })}.`);
    if (datos.pronostico.back_sin_riesgo) partes.push("El back todavía no publica riesgo: el pronóstico, el humo y la salud de esta página son inventados.");
    else if (datos.pronostico.un_solo_dia) partes.push("El back entrega riesgo solo para mañana: humo, salud y los días siguientes quedan sin dato.");
    partes.push("Los puntos, protocolos y registro son de un cliente inventado.");
  }
  $("#aviso-sintetico").textContent = partes.join(" ");
  $("#aviso-sintetico").hidden = false;
  $("#fuente-datos").innerHTML = `Datos: <button class="enlace" data-fuente="maqueta" ${CONFIG.FUENTE === "maqueta" ? 'aria-current="true"' : ""}>maqueta</button> o <button class="enlace" data-fuente="back" ${CONFIG.FUENTE === "back" ? 'aria-current="true"' : ""}>back publicado</button> (contrato ${esc(m.contrato)}).`;
}

(async function iniciar() {
  try {
    await cargar();
    const pedida = location.hash.slice(1);
    if (VISTAS[pedida]) estado.vista = pedida;
    // Enlace compartible: ?comuna=05109 abre directo la ficha de esa comuna.
    const comuna = new URLSearchParams(location.search).get("comuna");
    if (comuna && datos.comunas.some((c) => c.region_id === comuna)) { estado.comuna = comuna; estado.vista = "comuna"; }
    pintarAvisoDeDatos();
    pintar();
  } catch (e) {
    $("#contenido").innerHTML = `<div class="error"><h1>No se pudieron cargar los datos</h1><p>${esc(e.message)}</p><p>Revisa las rutas en <code>js/config.js</code> y que el servidor esté publicando la carpeta de datos.</p></div>`;
  }
})();
