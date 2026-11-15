// Única puerta de entrada a los datos. Las vistas no hacen fetch por su cuenta.
import { CONFIG, URL_BACK } from "./config.js";
import { rutaChile, rutaComuna } from "./prediccion.js";
import { chileSintetico, comunaSintetica } from "./sintetico.js";

async function leerJSON(url, cache = "no-store") {
  const r = await fetch(url, { cache });
  if (!r.ok) throw new Error(`No se pudo leer ${url} (respuesta ${r.status})`);
  return r.json();
}

let manifestCache = null;

async function manifest() {
  if (manifestCache) return manifestCache;
  try {
    manifestCache = await leerJSON(CONFIG.BASE_CONTRATO + "manifest.json");
  } catch (e) {
    // Sin conexión con el back: se sigue con la copia local y la página lo dice.
    if (CONFIG.BASE_CONTRATO === CONFIG.BASE_MAQUETA) throw e;
    CONFIG.BASE_CONTRATO = CONFIG.BASE_MAQUETA;
    CONFIG.FUENTE = "maqueta";
    CONFIG.SIN_BACK = true;
    manifestCache = await leerJSON(CONFIG.BASE_CONTRATO + "manifest.json");
  }
  return manifestCache;
}

// Las rutas de cada archivo salen del manifest, como pide el contrato.
async function ruta(clave, regionId) {
  const m = await manifest();
  const plantilla = m.archivos[clave];
  return CONFIG.BASE_CONTRATO + (regionId ? plantilla.replace("{region_id}", regionId) : plantilla);
}

// Con solo riesgo/ultimo.json se arma un día: sin humo, sin salud y sin los factores de la extensión.
async function pronosticoDeUnDia() {
  const [riesgo, geo] = await Promise.all([api.riesgo(), api.regiones()]);
  const nombres = Object.fromEntries(geo.features.map((f) => [f.properties.region_id, f.properties]));
  return {
    ejemplo: riesgo.ejemplo,
    calculado_utc: riesgo.calculado_utc,
    un_solo_dia: true,
    nota: "Solo hay riesgo a 24 horas: falta el pronóstico extendido.",
    items: riesgo.items.map((it) => ({
      region_id: it.region_id,
      nombre: nombres[it.region_id]?.nombre ?? it.region_id,
      region: nombres[it.region_id]?.region ?? "",
      dias: [{ fecha: riesgo.valido_para, dia: 1, fuente_foco: "motor", prob_foco: it.prob_foco, nivel: it.nivel,
               confianza: "alta", pm25_humo: null, urgencias_resp_base: null, urgencias_resp_extra_pct: null,
               urgencias_resp_extra: null }],
    })),
  };
}

// ---- Predicción por periodo (producto nuevo) ----
// Se pide primero a BASE_PREDICCION; si falla, a la copia de ejemplo local. Una vez que falla el back, no se vuelve a insistir.
let predBackCaido = !CONFIG.BASE_PREDICCION;
async function leerPrediccion(archivo) {
  if (!predBackCaido) {
    try { return { ...(await leerJSON(CONFIG.BASE_PREDICCION + archivo)), origen: "back" }; } catch { predBackCaido = true; CONFIG.SIN_PREDICCION = true; }
  }
  return { ...(await leerJSON(CONFIG.BASE_EXT + archivo)), origen: "ejemplo" };
}

export const api = {
  // Orden en los dos casos: back, copia de ejemplo local y, si no hay nada, datos sintéticos calculados en el navegador (sintetico.js).
  prediccionChile: async (rango) => {
    try { return await leerPrediccion(rutaChile(rango)); } catch { /* sigue con lo sintético */ }
    return { ...chileSintetico(await api.contornos(), rango), origen: "sintetico" };
  },
  // `base` trae el contorno de la comuna y su riesgo en el mapa de Chile ({ feature, p, periodo }) para armar el respaldo sintético.
  prediccionComuna: async (codigo, rango, base = {}) => {
    try { return await leerPrediccion(rutaComuna(codigo, rango)); } catch { /* sigue con lo sintético */ }
    return base.feature ? { ...comunaSintetica(base.feature, rango, base), origen: "sintetico" } : null;
  },
  // Contornos de las 345 comunas: los del back; si no responde, la copia liviana local.
  contornos: async () => {
    try { return await leerJSON(URL_BACK + "regiones.geojson", "default"); } catch { /* sigue con la copia local */ }
    return leerJSON(CONFIG.BASE_EXT + "contornos-chile.geojson", "default");
  },

  // ---- Contrato 0.2 (back: https://marcelo-corro.github.io/aivital-incendios-datos) ----
  manifest,
  // Los contornos reales pesan 2 MB: se dejan en la caché del navegador.
  regiones: async () => leerJSON(await ruta("regiones"), "default"),
  riesgo: async () => leerJSON(await ruta("riesgo")),
  calendario: async (regionId) => leerJSON(await ruta("calendario", regionId)),
  urlFocos: (regionId) => ruta("focos", regionId),
  // El CSV se pide como texto: el atributo download no funciona entre dominios distintos.
  focosCsv: async (regionId) => {
    const r = await fetch(await ruta("focos", regionId), { cache: "no-store" });
    if (!r.ok) throw new Error(`No hay focos para ${regionId} (respuesta ${r.status})`);
    return r.text();
  },
  metricas: async () => leerJSON(await ruta("metricas")),

  // ---- Extensión propuesta (no está en el contrato 0.2) ----
  // Orden: riesgo real del back si existe (un día). Si viene vacío, el pronóstico inventado de la maqueta, marcado.
  pronostico: async () => {
    await manifest();
    if (CONFIG.FUENTE !== "maqueta") {
      const riesgo = await api.riesgo().catch(() => ({ items: [] }));
      if (riesgo.items?.length) return pronosticoDeUnDia();
      return { ...(await leerJSON(CONFIG.BASE_EXT + "pronostico.json")), inventado: true, back_sin_riesgo: true };
    }
    try { return { ...(await leerJSON(CONFIG.BASE_EXT + "pronostico.json")), inventado: true }; } catch { return pronosticoDeUnDia(); }
  },
  contraste: async () => { try { return await leerJSON(CONFIG.BASE_EXT + "contraste.json"); } catch { return null; } },

  // ---- Del cliente (en la maqueta, de ejemplo) ----
  puntos: () => leerJSON(CONFIG.BASE_EXT + "puntos.json"),
  protocolos: () => leerJSON(CONFIG.BASE_EXT + "protocolos.json"),
  registro: () => leerJSON(CONFIG.BASE_EXT + "registro.json"),
};
