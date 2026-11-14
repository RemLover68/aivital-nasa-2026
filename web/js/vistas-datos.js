// Vistas que se sumaron en la segunda iteración: prioridad, ficha de comuna (historia de focos),
// contraste con fuentes públicas y fuentes. La ficha de comuna adapta la guía del front que escribió el back.
import { api } from "./api.js";
import { FACTORES, PESOS_FABRICA, NOMBRE_PRIORIDAD, CORTE_PRIORIDAD, NOMBRE_ESTADO, SERIES, contraLoNormal, cortesPorCuantil,
  claseDeValor, totalPorAnio, filtrarCsvPorAnios, contrasteDelDia, aciertoPorFuente } from "./logica.js";
import { $, esc, NIVEL, NIVEL_MES, MESES, MESES_LARGO, fFecha, pct, dec, cuando, guardar, estado, datos } from "./util.js";

// app.js entrega aquí sus funciones de repintado, para no importarse en círculo.
const app = { pintar: () => {}, recalcular: () => {} };
export const conectar = (funciones) => Object.assign(app, funciones);

// ====================================================================================
// Prioridad
// ====================================================================================

function filaPrioridad(f, i) {
  const barra = f.aportes.filter((a) => a.puntos > 0.5).map((a) => `<span class="f-${a.id}" style="flex:${a.puntos}" title="${esc(a.nombre)}: ${Math.round(a.puntos)} puntos"></span>`).join("");
  const detalle = f.aportes.map((a) => `<tr><th scope="row"><i class="f-${a.id}"></i>${esc(a.nombre)}</th><td>${Math.round(a.valor * 100)} %</td><td>${datos.pesos[a.id]}</td><td>${dec(a.puntos)}</td></tr>`).join("");
  const conAccion = datos.alertas.filter((al) => al.punto.region_id === f.region_id);
  return `<li class="prio prio-${f.nivel} ${estado.comuna === f.region_id ? "es-sel" : ""}">
    <details ${estado.comuna === f.region_id ? "open" : ""}>
      <summary>
        <span class="prio-lugar">${i + 1}</span>
        <span class="prio-nombre">${esc(f.nombre)}<span class="sub">${esc(f.region)}</span></span>
        <span class="prio-nivel">${NOMBRE_PRIORIDAD[f.nivel]}</span>
        <span class="prio-puntaje" aria-label="Puntaje ${f.puntaje} de 100">${f.puntaje}</span>
        <span class="prio-barra" aria-hidden="true" style="--p:${f.puntaje}">${barra}</span>
        <span class="prio-porque">${cuando(f.dia)}. Sube por ${esc(f.porque.join(" y "))}. ${f.personas ? `${f.personas} personas en ${f.puntos.length} ${f.puntos.length === 1 ? "punto tuyo" : "puntos tuyos"}.` : "Sin puntos tuyos en la comuna."}</span>
      </summary>
      <div class="prio-detalle">
        <table class="tabla-ficha"><caption>De dónde sale el puntaje</caption><thead><tr><th scope="col">Factor</th><th scope="col">Valor</th><th scope="col">Peso</th><th scope="col">Puntos</th></tr></thead><tbody>${detalle}</tbody></table>
        <p>${conAccion.length ? `<strong>${conAccion.length}</strong> ${conAccion.length === 1 ? "punto tiene" : "puntos tienen"} acciones para hoy: ${conAccion.map((al) => `${esc(al.punto.nombre)} (${NOMBRE_ESTADO[al.estado].toLowerCase()})`).join(", ")}.` : "Ningún punto de esta comuna pide acciones hoy con los umbrales actuales."}</p>
        <p class="prio-botones"><button class="boton-secundario" data-vista="parte">Ver las acciones del parte</button>
          <button class="boton-secundario" data-ir-comuna="${esc(f.region_id)}" data-ir-vista="comuna">Ficha de la comuna</button></p>
      </div>
    </details></li>`;
}

export function vistaPrioridad() {
  const n = (nivel) => datos.prioridad.filter((f) => f.nivel === nivel).length;
  const deslizadores = FACTORES.map((f) => `<div class="peso"><label for="peso-${f.id}"><i class="f-${f.id}"></i>${esc(f.nombre)} <output>${datos.pesos[f.id]}</output></label>
      <input id="peso-${f.id}" type="range" min="0" max="50" step="5" value="${datos.pesos[f.id]}" data-peso="${f.id}" aria-describedby="ayuda-${f.id}">
      <p class="nota" id="ayuda-${f.id}">${esc(f.ayuda)}</p></div>`).join("");
  return `<div class="vista-prioridad">
    <div class="prioridad-principal">
      <h1>Prioridad</h1>
      <p class="bajada">Las comunas ordenadas por una suma de seis factores. Arriba queda lo que conviene mirar primero. Toca una fila para ver de dónde sale su puntaje.</p>
      <dl class="resumen">
        <div><dt>En alerta, ${CORTE_PRIORIDAD.alerta} puntos o más</dt><dd>${n("alerta")}</dd></div>
        <div><dt>En atención, ${CORTE_PRIORIDAD.atencion} a ${CORTE_PRIORIDAD.alerta - 1}</dt><dd>${n("atencion")}</dd></div>
        <div><dt>En seguimiento</dt><dd>${n("seguimiento")}</dd></div>
      </dl>
      <ol class="prioridad-lista">${datos.prioridad.map(filaPrioridad).join("")}</ol>
    </div>
    <aside class="prioridad-pesos">
      <section class="panel"><h2>Cuánto pesa cada factor</h2>
        <p class="nota">Los pesos de fábrica y los cortes de alerta son una propuesta del equipo. No salen de una medición. Muévelos según lo que le importa a tu organización.</p>
        ${deslizadores}
        <p><button class="boton-secundario" id="pesos-fabrica">Volver a los pesos de fábrica</button></p>
      </section>
    </aside>
  </div>`;
}

// ====================================================================================
// Ficha de comuna: riesgo, de dónde parten los incendios e historia de focos
// ====================================================================================

let cal = null;        // calendario de la comuna que se está viendo
let calDe = null;
let calError = null;

const barraSimple = (nombre, v, clase) => `<li><span class="barra-nombre">${esc(nombre)}</span>
  <span class="barra-pista"><span class="barra-valor ${clase}" style="width:${Math.round(v * 100)}%"></span></span><span class="barra-num">${Math.round(v * 100)} %</span></li>`;

function tarjetaRiesgo(it) {
  const d = it?.dias[0];
  const validando = datos.metricas.auc == null;
  if (!d) return `<section class="tarjeta"><h2>Riesgo para mañana</h2><p class="tarjeta-dato">—</p><p class="nota">No hay riesgo publicado para esta comuna.</p></section>`;
  return `<section class="tarjeta"><h2>Riesgo para mañana</h2>${datos.pronostico.inventado ? '<p><span class="etiqueta">Número inventado</span></p>' : ""}
    <p class="tarjeta-dato"><span class="pastilla n-${d.nivel}">${NIVEL[d.nivel]}</span> ${pct(d.prob_foco)}</p>
    ${validando ? '<p class="estado-modelo">Modelo en validación</p>' : ""}
    <p class="nota">Anticipa cómo se propaga un incendio activo. No predice dónde empieza uno.</p></section>`;
}

function tarjetaAporte(it) {
  const d = it?.dias[estado.dia - 1] ?? it?.dias[0];
  if (!d?.aporte) return `<section class="tarjeta"><h2>Por qué sube el riesgo</h2><p class="nota">Falta el desglose por familia de datos. Es parte de la extensión que se propuso al back.</p></section>`;
  return `<section class="tarjeta"><h2>Por qué sube el riesgo</h2>${datos.pronostico.inventado ? '<p><span class="etiqueta">Números inventados</span></p>' : ""}
    <ul class="barras">${barraSimple("Clima", d.aporte.clima, "f-anticipacion")}${barraSimple("Combustible", d.aporte.combustible, "f-interfaz")}${barraSimple("Igniciones", d.aporte.igniciones, "f-foco")}</ul>
    <p class="nota">Parte del riesgo de ${cuando(d).toLowerCase()} que viene de cada familia de datos. El modelo europeo acierta más cuando junta las tres.</p></section>`;
}

const ACCION_IGNICION = {
  lineas: ["Líneas eléctricas", "Pedir a la distribuidora la revisión de vegetación bajo el tendido antes de los días de riesgo alto."],
  caminos: ["Caminos", "Reforzar la vigilancia en bordes de camino y accesos en los días de riesgo alto."],
  edificaciones: ["Casas junto a vegetación", "Despejar vegetación seca en el borde de las viviendas y de tus puntos."],
};

function tarjetaIgnicion(it) {
  if (!it?.ignicion) return `<section class="tarjeta"><h2>De dónde parten los incendios</h2><p class="nota">Falta la capa de cercanía a líneas eléctricas, caminos y edificaciones. Es parte de la extensión que se propuso al back.</p></section>`;
  const mayor = Object.entries(it.ignicion).sort((a, b) => b[1] - a[1])[0][0];
  return `<section class="tarjeta"><h2>De dónde parten los incendios</h2>${datos.pronostico.inventado ? '<p><span class="etiqueta">Números inventados</span></p>' : ""}
    <ul class="barras">${Object.entries(ACCION_IGNICION).map(([k, [nombre]]) => barraSimple(nombre, it.ignicion[k], "f-humo")).join("")}</ul>
    <p class="tarjeta-accion"><strong>Qué hacer.</strong> ${ACCION_IGNICION[mayor][1]} <span class="quien">Prevención de riesgos</span></p>
    <p class="nota">Casi todos los incendios en Chile los origina una persona. Esta capa es una guía: en la zona central un modelo de este tipo acertó poco (estudio de 2025, ver Fuentes).</p></section>`;
}

export function vistaComuna() {
  const c = datos.comunas.find((x) => x.region_id === estado.comuna);
  const buscador = `<form class="buscador" id="form-comuna"><label for="buscar-comuna">Buscar comuna</label>
    <input id="buscar-comuna" list="lista-comunas" placeholder="Escribe el nombre" autocomplete="off" value="${c ? esc(c.nombre) : ""}">
    <datalist id="lista-comunas">${datos.comunas.map((x) => `<option value="${esc(x.nombre)}">${esc(x.region || "")}</option>`).join("")}</datalist>
    <button class="boton-secundario">Ver</button><span class="nota" id="buscar-aviso" role="status"></span></form>`;
  if (!c) {
    return `<div class="vista-comuna"><h1>¿Es normal el fuego de este mes en tu comuna?</h1>
      <p class="bajada">Busca una comuna para ver su riesgo, de dónde parten sus incendios y 25 años de focos en una serie que corrige el cambio de satélite.</p>
      ${buscador}
      <h2 class="sub-titulo">Las de mayor prioridad hoy</h2>
      <ul class="lista-simple lista-comunas">${datos.prioridad.slice(0, 8).map((f) => `<li><button class="enlace" data-ir-comuna="${esc(f.region_id)}">${esc(f.nombre)}</button><span>${NOMBRE_PRIORIDAD[f.nivel]}, ${f.puntaje} puntos</span></li>`).join("")}</ul></div>`;
  }
  const it = datos.pronPorComuna[c.region_id];
  const pts = datos.puntos.filter((x) => x.region_id === c.region_id);
  return `<div class="vista-comuna">
    <div class="titulo-fila"><div><h1>${esc(c.nombre)}</h1><p class="bajada">${esc(c.region || "")}${it?.poblacion ? `, ${it.poblacion.toLocaleString("es-CL")} habitantes` : ""}</p></div>${buscador}</div>
    <div class="tarjetas">
      <section class="tarjeta tarjeta-fuerte" id="tarjeta-normal"><h2>Este mes contra lo normal</h2><p class="nota">Cargando…</p></section>
      ${tarjetaRiesgo(it)}${tarjetaAporte(it)}${tarjetaIgnicion(it)}
    </div>
    <section class="bloque-historia" aria-labelledby="t-historia"><h2 id="t-historia">Historia de focos</h2><div id="historia"><p class="nota">Cargando el calendario…</p></div></section>
    <section class="bloque-historia"><h2>Tus puntos en la comuna</h2>
      <ul class="lista-simple">${pts.map((x) => `<li><span>${esc(x.nombre)}, ${x.personas} personas</span><span>${datos.estadoPunto[x.id] ? NOMBRE_ESTADO[datos.estadoPunto[x.id]] : "Sin aviso"}</span></li>`).join("") || "<li>Ninguno cargado</li>"}</ul>
      <p class="prio-botones"><button class="boton-secundario" data-vista="parte">Ver las acciones del parte</button> <button class="boton-secundario" id="copiar-enlace">Copiar el enlace a esta ficha</button></p>
    </section>
  </div>`;
}

export async function alPintarComuna() {
  const id = estado.comuna;
  if (!id) return;
  if (calDe !== id) {
    cal = null; calError = null; calDe = id; estado.mes = null; estado.desde = null; estado.hasta = null;
    try { cal = await api.calendario(id); } catch (e) { calError = e.message; }
    if (estado.comuna !== id || estado.vista !== "comuna") return;
  }
  pintarHistoria();
}

function pintarHistoria() {
  if (!$("#historia")) return;
  if (!cal) {
    $("#historia").innerHTML = `<p class="nota">No hay calendario para esta comuna. ${esc(calError || "")}</p>`;
    $("#tarjeta-normal").innerHTML = `<h2>Este mes contra lo normal</h2><p class="tarjeta-dato">—</p><p class="nota">Sin calendario para esta comuna.</p>`;
    return;
  }
  const reg = cal.registros;
  const anios = [...new Set(reg.map((r) => r.anio))].sort((a, b) => a - b);
  estado.desde ??= anios[0];
  estado.hasta ??= anios[anios.length - 1];
  const provisional = String(cal.metodo_armonizacion || "").startsWith("provisional");

  // --- tarjeta "contra lo normal"
  const n = contraLoNormal(reg);
  if (n) {
    const r = n.registro;
    $("#tarjeta-normal").innerHTML = `<h2>${MESES_LARGO[r.mes - 1][0].toUpperCase()}${MESES_LARGO[r.mes - 1].slice(1)} de ${r.anio} contra lo normal</h2>
      <p class="tarjeta-dato"><span class="pastilla c-${r.nivel}">${NIVEL_MES[r.nivel] ?? esc(r.nivel)}</span> ${n.veces == null ? `${dec(r.armonizado)} focos` : `${n.veces.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} veces`}</p>
      <p class="nota">${n.veces == null ? (r.armonizado > 0 ? `En un ${MESES_LARGO[r.mes - 1]} normal esta comuna no tiene focos.` : `Sin focos, igual que un ${MESES_LARGO[r.mes - 1]} normal.`)
        : `${dec(r.armonizado)} focos contra ${dec(n.normal)} de un ${MESES_LARGO[r.mes - 1]} normal.`} Es el último mes con datos.</p>
      ${cal.ejemplo ? "" : `<p class="nota">Dato real del back, método ${esc(cal.metodo_armonizacion || "sin declarar")}.</p>`}`;
  }

  // --- calendario
  const f = SERIES[estado.serie].valor;
  const cortes = cortesPorCuantil(reg.map((r) => r.armonizado));   // la escala se fija con la serie armonizada: así el salto de la cruda se ve
  const porClave = Object.fromEntries(reg.map((r) => [`${r.anio}-${r.mes}`, r]));
  const primerViirs = reg.find((r) => r.viirs != null)?.anio;
  const visibles = anios.filter((a) => a >= estado.desde && a <= estado.hasta).reverse();
  const filas = visibles.map((a) => {
    const celdas = MESES.map((m, i) => {
      const r = porClave[`${a}-${i + 1}`];
      if (!r) return `<td><span class="cv cv-nd" title="${m} ${a}: sin dato"></span></td>`;
      const v = f(r);
      const clave = `${a}-${i + 1}`;
      return `<td><button class="cv cv-${claseDeValor(v, cortes)} ${estado.mes === clave ? "es-sel" : ""}" data-mes="${clave}" aria-pressed="${estado.mes === clave}" aria-label="${m} ${a}: ${v == null ? "sin dato" : `${dec(v)} focos`}${r.nivel ? `, nivel ${r.nivel}` : ""}" title="${m} ${a}: ${dec(v)}"></button></td>`;
    }).join("");
    const marca = estado.serie !== "armonizado" && a === primerViirs ? `<tr class="cambio-satelite"><td colspan="13">Desde ${a} entra el satélite VIIRS, que ve más focos. Aquí cambió el satélite, no el fuego.</td></tr>` : "";
    return `<tr><th scope="row">${a}</th>${celdas}</tr>${marca}`;
  }).join("");
  const sel = estado.mes && porClave[estado.mes];
  const detalle = sel ? `<dl class="mes-detalle" aria-live="polite">
      <div><dt>Mes</dt><dd>${MESES_LARGO[sel.mes - 1]} de ${sel.anio}</dd></div>
      <div><dt>Armonizado</dt><dd>${dec(sel.armonizado)}${sel.armonizado_p05 != null ? ` <span class="sub">entre ${dec(sel.armonizado_p05)} y ${dec(sel.armonizado_p95)}</span>` : ""}</dd></div>
      <div><dt>MODIS</dt><dd>${dec(sel.modis)}</dd></div><div><dt>VIIRS</dt><dd>${dec(sel.viirs)}</dd></div>
      <div><dt>Mes normal</dt><dd>${dec(sel.mediana_historica)}</dd></div>
      <div><dt>Percentil</dt><dd>${dec(sel.percentil)}</dd></div>
      <div><dt>Nivel</dt><dd>${NIVEL_MES[sel.nivel] ?? "—"}</dd></div></dl>`
    : `<p class="nota mes-detalle-vacio">Toca un mes para ver sus números.</p>`;
  const opciones = (elegido) => anios.map((a) => `<option ${a === elegido ? "selected" : ""}>${a}</option>`).join("");
  const series = Object.entries(SERIES).map(([id, s]) => `<button class="capa ${estado.serie === id ? "es-sel" : ""}" role="radio" aria-checked="${estado.serie === id}" data-serie="${id}">${s.nombre}</button>`).join("");
  const leyenda = ["Sin focos", "Pocos", "", "", "", "", "Muchos"].map((t, i) => `<span class="ley"><i class="cv-${i}"></i>${t}</span>`).join("");

  // --- total por año
  const tot = totalPorAnio(reg, estado.serie).filter((t) => t.anio >= estado.desde && t.anio <= estado.hasta);
  const maxTot = Math.max(1, ...tot.map((t) => t.total ?? 0));
  const barras = tot.map((t) => `<div class="anio ${t.anio === primerViirs && estado.serie !== "armonizado" ? "anio-cambio" : ""}" title="${t.anio}: ${t.total == null ? "sin dato" : dec(t.total, 0)}">
      <span class="anio-barra" style="height:${t.total == null ? 0 : Math.max(1, (t.total / maxTot) * 100)}%"></span><span class="anio-rotulo">${t.anio % 5 === 0 || tot.length <= 10 ? t.anio : ""}</span></div>`).join("");
  const mayor = [...tot].filter((t) => t.total != null).sort((a, b) => b.total - a.total).slice(0, 2).map((t) => t.anio);

  $("#historia").innerHTML = `
    <div class="historia-barra">
      <div class="capas" role="radiogroup" aria-label="Qué serie muestra el calendario">${series}</div>
      <button class="boton-secundario" id="alternar-armonizado">${estado.serie === "armonizado" ? "Ver sin armonizar" : "Volver a la serie armonizada"}</button>
      <label class="rango">Años <select id="anio-desde" aria-label="Desde el año">${opciones(estado.desde)}</select> a <select id="anio-hasta" aria-label="Hasta el año">${opciones(estado.hasta)}</select></label>
    </div>
    <p class="nota">${cal.ejemplo ? '<span class="etiqueta">Datos de ejemplo</span> ' : ""}${provisional ? '<span class="etiqueta">Serie provisional</span> ' : ""}${estado.serie === "armonizado"
      ? "Focos equivalentes MODIS: los dos satélites llevados a una misma escala, para comparar 2005 con 2025."
      : estado.serie === "crudo" ? "Suma de lo que vio cada satélite, sin corregir. El conteo sube cuando entra VIIRS aunque el fuego sea el mismo."
        : `Conteo crudo de ${estado.serie.toUpperCase()}, sin corregir.`}</p>
    <div class="historia-cuerpo">
      <div class="cal-caja"><table class="cal-tabla"><caption class="solo-lectores">Focos por mes y año, serie ${esc(SERIES[estado.serie].nombre)}</caption>
        <thead><tr><td></td>${MESES.map((m) => `<th scope="col">${m[0].toUpperCase()}</th>`).join("")}</tr></thead><tbody>${filas}</tbody></table>
        <div class="leyenda">${leyenda}</div></div>
      <div class="historia-lado">
        ${detalle}
        <h3>Total por año</h3>
        <div class="anios" role="img" aria-label="Total de focos por año. Los años con más focos fueron ${mayor.join(" y ")}.">${barras}</div>
        <p class="nota">Los años con más focos en el rango: ${mayor.join(" y ") || "sin dato"}.</p>
        <p><button class="boton-secundario" id="descargar-csv">Descargar focos de ${estado.desde} a ${estado.hasta} (CSV)</button></p>
        <p class="nota" id="descarga-aviso" role="status"></p>
      </div>
    </div>`;
}

async function descargarCsv() {
  const aviso = $("#descarga-aviso");
  const c = datos.comunas.find((x) => x.region_id === estado.comuna);
  try {
    aviso.textContent = "Preparando la descarga…";
    const r = filtrarCsvPorAnios(await api.focosCsv(estado.comuna), estado.desde, estado.hasta);
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(new Blob([r.texto], { type: "text/csv" }));
    enlace.download = `focos_${(c?.nombre || estado.comuna).replace(/\s+/g, "_")}_${estado.desde}-${estado.hasta}.csv`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(enlace.href), 5000);
    aviso.textContent = `Descargados ${r.filas} focos de ${r.total} que tiene el archivo.`;
  } catch (e) { aviso.textContent = `No se pudo descargar. ${e.message}`; }
}

// ====================================================================================
// Contraste: nuestro motor al lado de lo que ya es público
// ====================================================================================

const LECTURA = {
  solo_motor: ["Solo avisa el motor", "Revisar antes de activar: ninguna fuente pública lo acompaña."],
  solo_publicas: ["Solo avisan las públicas", "Mirar la comuna aunque el motor no avise."],
  coinciden: ["Coinciden en avisar", "Aviso con más respaldo."],
  ninguna: ["Nadie avisa", ""],
};

export function vistaContraste() {
  const filasDia = contrasteDelDia(datos.pronostico, estado.dia);
  if (!filasDia.length || !datos.contraste) {
    return `<div class="vista-tabla"><h1>Contraste</h1><p class="bajada">Esta pantalla pone el motor propio al lado de las fuentes públicas (GWIS, Botón Rojo de CONAF y los focos que ve NASA FIRMS). Con los datos conectados ahora no hay con qué comparar: falta la extensión del contrato.</p></div>`;
  }
  const d = datos.pronostico.items[0].dias[estado.dia - 1];
  const orden = { solo_motor: 0, solo_publicas: 1, coinciden: 2, ninguna: 3 };
  filasDia.sort((a, b) => orden[a.lectura] - orden[b.lectura] || a.nombre.localeCompare(b.nombre, "es"));
  const n = (l) => filasDia.filter((f) => f.lectura === l).length;
  const filas = filasDia.map((f) => `<tr class="lec-${f.lectura}"><th scope="row"><button class="enlace" data-ir-comuna="${esc(f.region_id)}">${esc(f.nombre)}</button></th>
      <td><span class="pastilla n-${f.motor}">${NIVEL[f.motor]}</span></td><td><span class="pastilla n-${f.gwis}">${NIVEL[f.gwis]}</span></td>
      <td>${f.boton_rojo ? "Marcada" : "No"}</td><td><strong>${LECTURA[f.lectura][0]}</strong><span class="sub">${LECTURA[f.lectura][1]}</span></td></tr>`).join("");
  const ac = aciertoPorFuente(datos.contraste);
  const nombres = datos.contraste.fuentes;
  const filasAc = Object.entries(ac).map(([k, r]) => `<tr><th scope="row">${esc(nombres[k] || k)}</th><td class="der">${r.avisos}</td><td class="der">${r.aciertos}</td><td class="der">${r.falsas}</td><td class="der">${r.sin_aviso}</td>
      <td class="der">${r.avisos ? `${Math.round((r.aciertos / r.avisos) * 100)} %` : "—"}</td></tr>`).join("");
  const dias = datos.contraste.items[0].dias;
  return `<div class="vista-tabla"><h1>Contraste</h1>
    <p class="bajada">El motor propio al lado de lo que ya es público. Sirve para dos cosas: decidir cuánto confiar en un aviso y medir si el motor aporta algo sobre lo gratuito.</p>
    <h2 class="sub-titulo">${cuando(d)}, ${fFecha(d.fecha, { day: "numeric", month: "long" })}: dónde coinciden y dónde no</h2>
    <dl class="resumen">
      <div><dt>Coinciden en avisar</dt><dd>${n("coinciden")}</dd></div>
      <div><dt>Solo avisa el motor</dt><dd>${n("solo_motor")}</dd></div>
      <div><dt>Solo avisan las públicas</dt><dd>${n("solo_publicas")}</dd></div>
      <div><dt>Nadie avisa</dt><dd>${n("ninguna")}</dd></div>
    </dl>
    <p class="nota">Una fuente "avisa" cuando marca nivel alto o muy alto, o cuando Botón Rojo marca la zona.</p>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th scope="col">Comuna</th><th scope="col">Motor propio</th><th scope="col">GWIS, peligro por clima</th><th scope="col">Botón Rojo, CONAF</th><th scope="col">Lectura y qué hacer</th></tr></thead><tbody>${filas}</tbody></table></div>
    <h2 class="sub-titulo">Del ${fFecha(dias[0].fecha, { day: "numeric", month: "long" })} al ${fFecha(dias[dias.length - 1].fecha, { day: "numeric", month: "long" })}: quién acertó</h2>
    <p class="nota">Cada aviso se compara con los focos que NASA FIRMS vio al día siguiente en la comuna. <strong>En la maqueta estos números son inventados y no favorecen a nadie.</strong> La comparación real es la prueba 0 del plan de validación.</p>
    <div class="tabla-caja"><table class="tabla"><thead><tr><th scope="col">Fuente</th><th scope="col" class="der">Avisos</th><th scope="col" class="der">Con foco</th><th scope="col" class="der">Falsas alarmas</th><th scope="col" class="der">Focos sin aviso</th><th scope="col" class="der">Avisos que acertaron</th></tr></thead>
      <tbody>${filasAc}<tr><th scope="row">Modelo europeo de probabilidad de incendio (ECMWF)</th><td colspan="5">Sin acceso. Su resultado diario llega a usuarios registrados y países miembros.</td></tr></tbody></table></div>
    <p class="prio-botones"><button class="boton-secundario" data-vista="protocolos">Ajustar umbrales en Protocolos</button> <button class="boton-secundario" data-vista="registro">Ver el registro propio</button></p>
  </div>`;
}

// ====================================================================================
// Fuentes
// ====================================================================================

export function vistaFuentes() {
  const m = datos.manifest;
  return `<div class="vista-fuentes"><h1>Acerca de y fuentes</h1>
    <p class="bajada">Preaviso toma la serie de focos de calor de los satélites de NASA, el riesgo que calcula el motor del equipo y lo cruza con los lugares de cada organización. El resultado es una lista diaria de acciones con responsable.</p>
    <section><h2>Por qué hay que armonizar</h2>
      <p>Los focos se cuentan desde 2000 con el sensor MODIS y desde 2012 también con VIIRS, que tiene más resolución y ve más focos. Si se suman sin corregir, la serie salta en 2012 por el cambio de satélite y no por el fuego. La serie armonizada lleva los dos sensores a una misma escala. Se ve en la ficha de cada comuna con el botón "Ver sin armonizar".</p></section>
    <section><h2>Fuentes de los datos</h2>
      <ul class="fuentes">
        <li><strong>NASA FIRMS.</strong> We acknowledge the use of data and/or imagery from NASA's Fire Information for Resource Management System (FIRMS) (<a href="https://earthdata.nasa.gov/firms">https://earthdata.nasa.gov/firms</a>), part of NASA's Land, Atmosphere Near real-time Capability for Earth observations (LANCE) (<a href="https://earthdata.nasa.gov/lance">https://earthdata.nasa.gov/lance</a>) and NASA's Earth Science Data and Information System (ESDIS).</li>
        <li>Giglio, L., Schroeder, W., y Justice, C. O. (2016). The collection 6 MODIS active fire detection algorithm and fire products. Remote Sensing of Environment, 178, 31-41. <a href="https://doi.org/10.1016/j.rse.2016.02.054">https://doi.org/10.1016/j.rse.2016.02.054</a></li>
        <li>Schroeder, W., Oliva, P., Giglio, L., y Csiszar, I. A. (2014). The New VIIRS 375m active fire detection data product: algorithm description and initial assessment. Remote Sensing of Environment, 143, 85-96. <a href="https://doi.org/10.1016/j.rse.2013.12.008">https://doi.org/10.1016/j.rse.2013.12.008</a></li>
        <li><strong>Límites comunales.</strong> Biblioteca del Congreso Nacional de Chile, División comunal: polígonos de las comunas de Chile. <a href="https://www.bcn.cl/siit/mapas_vectoriales">https://www.bcn.cl/siit/mapas_vectoriales</a>. Material referencial.</li>
        <li><strong>Datos del equipo.</strong> Serie armonizada, calendario y riesgo por comuna, contrato ${esc(m.contrato)}. <a href="https://github.com/marcelo-corro/aivital-incendios-datos">https://github.com/marcelo-corro/aivital-incendios-datos</a></li>
        <li><strong>Igniciones humanas.</strong> Crespo-Pérez y otros (2025). Wildfire occurrence in Chile: regional modeling and implications for risk management. Cuadernos de Investigación Geográfica 51(2). <a href="https://doi.org/10.18172/cig.6792">https://doi.org/10.18172/cig.6792</a></li>
        <li><strong>Clima, combustible e igniciones juntos.</strong> Di Giuseppe, McNorton, Lombardi y Wetterhall (2025). Global data-driven prediction of fire activity. Nature Communications 16, 2918. <a href="https://doi.org/10.1038/s41467-025-58097-7">https://doi.org/10.1038/s41467-025-58097-7</a></li>
        <li><strong>Mapa base.</strong> Colaboradores de OpenStreetMap. <a href="https://www.openstreetmap.org/copyright">https://www.openstreetmap.org/copyright</a></li>
      </ul>
      <p class="nota">El resto de la evidencia, con 57 fuentes y su nivel de certeza, está en el <a href="producto.html">informe interno de producto</a>.</p></section>
    <section><h2>Límites</h2>
      <ul class="fuentes">
        <li>Según el equipo del back, el modelo de riesgo anticipa cómo se propaga un incendio activo. No predice dónde empieza uno.</li>
        <li>Humo, alza de urgencias respiratorias, presión de ignición y contraste con fuentes públicas son hoy datos de ejemplo. Todavía no existen en el back.</li>
        <li>Los puntos, protocolos y registro son de un cliente inventado.</li>
        <li>Los pesos de la prioridad y los cortes de alerta son una propuesta del equipo, sin medición detrás.</li>
      </ul></section>
    <section><h2>Equipo</h2><p>AIVital, NASA Space Apps 2026, desafío "Harmonization of MODIS and VIIRS Hot Spots".</p></section>
  </div>`;
}

// ====================================================================================
// Eventos de estas vistas. Devuelven true si atendieron el evento.
// ====================================================================================

export function clicDatos(e) {
  const serie = e.target.closest("[data-serie]");
  if (serie) { estado.serie = serie.dataset.serie; pintarHistoria(); return true; }
  if (e.target.id === "alternar-armonizado") { estado.serie = estado.serie === "armonizado" ? "crudo" : "armonizado"; pintarHistoria(); $("#alternar-armonizado")?.focus(); return true; }
  const mes = e.target.closest("[data-mes]");
  if (mes) { estado.mes = estado.mes === mes.dataset.mes ? null : mes.dataset.mes; pintarHistoria(); $(`[data-mes="${estado.mes}"]`)?.focus(); return true; }
  if (e.target.id === "descargar-csv") { descargarCsv(); return true; }
  if (e.target.id === "copiar-enlace") {
    navigator.clipboard?.writeText(location.href).then(() => { e.target.textContent = "Enlace copiado"; }, () => { e.target.textContent = "No se pudo copiar"; });
    return true;
  }
  if (e.target.id === "pesos-fabrica") { datos.pesos = { ...PESOS_FABRICA }; localStorage.removeItem("preaviso.pesos"); app.recalcular(); app.pintar(); return true; }
  return false;
}

export function cambioDatos(e) {
  if (e.target.id === "anio-desde" || e.target.id === "anio-hasta") {
    estado[e.target.id === "anio-desde" ? "desde" : "hasta"] = Number(e.target.value);
    if (estado.desde > estado.hasta) [estado.desde, estado.hasta] = [estado.hasta, estado.desde];
    pintarHistoria();
  }
  if (e.target.dataset.peso) {
    datos.pesos[e.target.dataset.peso] = Number(e.target.value);
    guardar("preaviso.pesos", datos.pesos);
    app.recalcular();
    app.pintar();
    $(`#peso-${e.target.dataset.peso}`)?.focus();
  }
}

export function entradaDatos(e) {
  if (e.target.dataset.peso) e.target.closest(".peso").querySelector("output").textContent = e.target.value;
}

document.addEventListener("submit", (e) => {
  if (e.target.id !== "form-comuna") return;
  e.preventDefault();
  const texto = $("#buscar-comuna").value.trim().toLowerCase();
  const sinTilde = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const c = datos.comunas.find((x) => sinTilde(x.nombre.toLowerCase()) === sinTilde(texto)) || (texto.length >= 3 && datos.comunas.find((x) => sinTilde(x.nombre.toLowerCase()).startsWith(sinTilde(texto))));
  if (!c) { $("#buscar-aviso").textContent = "No hay una comuna con ese nombre en los datos."; return; }
  estado.comuna = c.region_id;
  estado.vista = "comuna";
  app.pintar();
});
