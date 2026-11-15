// Reglas puras de la sala de triaje (sin DOM, para poder probarlas con node --test).
// Contrato de datos: guia-front-mvp.md §5, archivo web/datos/ext/triaje-<AAAA-MM-DD>.json.

export const FECHAS = ["2026-01-16", "2026-01-17", "2026-01-18"];
export const FECHA_INICIAL = "2026-01-17";
export const HORA_INICIAL = 14;       // el 17 de enero a las 14:00 ya hay una cola con varios incendios
export const HORA_FIN = 24;           // fin del día: aparece el resultado real
export const rutaTriaje = (fecha) => `triaje-${FECHAS.includes(fecha) ? fecha : FECHA_INICIAL}.json`;

/** Hora decimal de inicio de un incendio: "2026-01-17 13:20" da 13,33. */
export function horaDe(incendio) {
  const [h, m] = incendio.f_inicio.slice(11, 16).split(":").map(Number);
  return h + m / 60;
}
export const horaTxt = (hora) => (hora >= HORA_FIN ? "24:00" : `${String(Math.floor(hora)).padStart(2, "0")}:${String(Math.round((hora % 1) * 60)).padStart(2, "0")}`);

/** Los incendios que ya empezaron a la `hora` (inclusive). El resto todavía no se conoce. */
export const visiblesA = (incendios, hora) => incendios.filter((i) => horaDe(i) <= hora + 1e-9);

/**
 * Cola de despacho: de mayor a menor probabilidad de no control el día de inicio; a igual probabilidad, el que empezó antes.
 * Devuelve copias con `prioridad` de 1 a N calculada solo entre los incendios recibidos (la cola cambia al llegar uno nuevo).
 */
export function ordenarCola(incendios) {
  return [...incendios]
    .sort((a, b) => b.p_no_control_dia - a.p_no_control_dia || horaDe(a) - horaDe(b) || a.id.localeCompare(b.id))
    .map((i, n) => ({ ...i, prioridad: n + 1 }));
}

/** Filtros de la cola: región (código de dos dígitos) y comuna (nombre). Sin filtro, todos. */
export const filtrar = (incendios, { region = null, comuna = null } = {}) =>
  incendios.filter((i) => (!region || i.reg_id === region) && (!comuna || i.comuna === comuna));

/** Regiones presentes en la lista, con su cantidad de incendios, de mayor a menor. */
export function regionesPresentes(incendios) {
  const por = new Map();
  for (const i of incendios) { const r = por.get(i.reg_id) ?? { id: i.reg_id, nombre: i.region, n: 0 }; r.n++; por.set(i.reg_id, r); }
  return [...por.values()].sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, "es"));
}

/** Clase de probabilidad 0 a 4 con los mismos cortes que el mapa de riesgo (para el color y el texto). */
export const CORTES_P = [0.2, 0.4, 0.6, 0.8];
export const claseP = (p) => CORTES_P.filter((c) => p >= c).length;
export const NIVELES_P = ["Muy baja", "Baja", "Media", "Alta", "Muy alta"];

/**
 * Sector circular para dibujar la zona probable de avance. Rumbo en grados desde el norte, hacia donde avanza el fuego.
 * Devuelve [[lat, lon], ...] con el vértice en el punto de inicio.
 */
export function sector(lat, lon, rumboGrados, radioKm, semiAngulo = 28, pasos = 14) {
  const pts = [[lat, lon]];
  for (let k = 0; k <= pasos; k++) {
    const b = ((rumboGrados - semiAngulo + (2 * semiAngulo * k) / pasos) * Math.PI) / 180;
    pts.push([lat + (radioKm * Math.cos(b)) / 111, lon + (radioKm * Math.sin(b)) / (111 * Math.cos((lat * Math.PI) / 180))]);
  }
  return pts;
}

/**
 * Qué tan bien ordenó el modelo, contra lo que pasó de verdad (solo hay resultado real en el modo repetición).
 * "Positivo" = el incendio no se controló el día de inicio.
 * - auc_pr: área bajo la curva precisión-recall (método de precisión promedio) y `base_azar` = proporción de positivos.
 * - precision y recall en el umbral.
 * - en_primeros: cuántos de los no controlados quedaron entre los `k` primeros de la cola.
 */
export function metricasAcierto(incendios, umbral = 0.5, k = 10) {
  const conReal = incendios.filter((i) => i.real);
  const positivos = conReal.filter((i) => !i.real.controlado_mismo_dia).length;
  if (!conReal.length || !positivos) return null;
  const orden = [...conReal].sort((a, b) => b.p_no_control_dia - a.p_no_control_dia || horaDe(a) - horaDe(b));
  let aciertos = 0, ap = 0;
  orden.forEach((i, n) => { if (!i.real.controlado_mismo_dia) { aciertos++; ap += aciertos / (n + 1); } });
  const pred = conReal.filter((i) => i.p_no_control_dia >= umbral);
  const vp = pred.filter((i) => !i.real.controlado_mismo_dia).length;
  return {
    auc_pr: ap / positivos, base_azar: positivos / conReal.length,
    precision: pred.length ? vp / pred.length : null, recall: vp / positivos,
    en_primeros: orden.slice(0, k).filter((i) => !i.real.controlado_mismo_dia).length, k, positivos, total: conReal.length,
  };
}

/** Texto corto del resultado real de un incendio, para la cola y la tarjeta al final del día. */
export function resultadoReal(i) {
  if (!i.real) return null;
  return { controlado: i.real.controlado_mismo_dia, ha: i.real.sup_total_ha };
}
