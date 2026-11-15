// Pruebas de las reglas del producto nuevo: recomendaciones, orden, beneficio sobre costo y cambio de rango.
// Correr: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { RANGOS, SUPUESTOS_FABRICA, rangoValido, rutaChile, rutaComuna, claseRiesgo, cortesRelativos, beneficio, recomendar,
  causasConEtiqueta, unidadDeCelda, masRiesgosas, leerHash, aHash } from "../web/js/prediccion.js";

const EXT = new URL("../web/datos/ext/", import.meta.url);
const leer = (n) => JSON.parse(readFileSync(new URL(n, EXT), "utf8"));

const catalogo = {
  causas: [{ id: "pasto", nombre: "Pasto", modificable: true }, { id: "basurales", nombre: "Basurales", modificable: true },
    { id: "viento", nombre: "Viento", modificable: false }, { id: "temperatura", nombre: "Temperatura", modificable: false }],
  acciones: [{ id: "cortafuegos", nombre: "Cortafuegos", causa: "pasto" }, { id: "limpieza", nombre: "Limpieza de basurales", causa: "basurales" },
    { id: "falsa", nombre: "Acción sobre el viento", causa: "viento" }],
};
const unidad = {
  prob: 0.4, ha: [2, 10, 30], vidas_si_incendio: 0.1, personas_expuestas: 500,
  causas: [{ id: "pasto", pct: 30 }, { id: "viento", pct: 40 }, { id: "basurales", pct: 10 }, { id: "temperatura", pct: 20 }],
  recomendaciones: [
    { accion: "cortafuegos", reduccion_pp: 5, costo_clp: 50_000_000 },
    { accion: "limpieza", reduccion_pp: 2, costo_clp: 4_000_000 },
    { accion: "falsa", reduccion_pp: 9, costo_clp: 1_000_000 },
  ],
};
const S = { vsl_clp: 1_000_000_000, valor_propiedad_ha_clp: 10_000_000, costo_combate_ha_clp: 2_000_000 };

test("el beneficio suma vidas, propiedad y combate, ponderados por la reducción", () => {
  const b = beneficio(5, unidad, S);
  assert.equal(b.vidas, 0.05 * 0.1 * 1_000_000_000);
  assert.equal(b.propiedad, 0.05 * 10 * 10_000_000);
  assert.equal(b.otro, 0.05 * 10 * 2_000_000);
  assert.equal(b.total, b.vidas + b.propiedad + b.otro);
});

test("solo se recomienda sobre causas modificables", () => {
  const r = recomendar(unidad, catalogo, S);
  assert.deepEqual(r.map((x) => x.accion).sort(), ["cortafuegos", "limpieza"]);
});

test("razón beneficio/costo = beneficio total / costo", () => {
  const r = recomendar(unidad, catalogo, S).find((x) => x.accion === "limpieza");
  assert.equal(r.razon, beneficio(2, unidad, S).total / 4_000_000);
});

test("orden por reducción de probabilidad: mayor primero", () => {
  assert.deepEqual(recomendar(unidad, catalogo, S, "reduccion").map((x) => x.accion), ["cortafuegos", "limpieza"]);
});

test("orden por beneficio/costo puede invertir el orden", () => {
  // cortafuegos: 5 pp, razón (5M+5M+1M)/... ; limpieza es mucho más barata y gana en razón
  assert.deepEqual(recomendar(unidad, catalogo, S, "razon").map((x) => x.accion), ["limpieza", "cortafuegos"]);
});

test("cambiar los supuestos cambia el beneficio y puede cambiar el orden por razón", () => {
  const caro = { ...S, vsl_clp: 0, valor_propiedad_ha_clp: 0, costo_combate_ha_clp: 0 };
  const r = recomendar(unidad, catalogo, caro, "razon");
  assert.ok(r.every((x) => x.razon === 0));
  const alto = recomendar(unidad, catalogo, { ...S, valor_propiedad_ha_clp: 1_000_000_000 }, "razon");
  assert.ok(alto[0].razon > r[0].razon);
});

test("costo cero no divide por cero", () => {
  const u = { ...unidad, recomendaciones: [{ accion: "limpieza", reduccion_pp: 1, costo_clp: 0 }] };
  assert.equal(recomendar(u, catalogo, S, "razon")[0].razon, null);
});

test("las causas se ordenan de mayor a menor y llevan su marca de modificable", () => {
  const c = causasConEtiqueta(unidad, catalogo);
  assert.deepEqual(c.map((x) => x.id), ["viento", "pasto", "temperatura", "basurales"]);
  assert.deepEqual(c.map((x) => x.modificable), [false, true, false, true]);
});

test("rangos: los cinco botones, id inválido vuelve al inicial y cada rango pide su archivo", () => {
  assert.deepEqual(RANGOS.map((r) => r.nombre), ["Esta semana", "Próxima semana", "Dentro de 2 semanas", "Este mes", "Próximo mes"]);
  assert.equal(rangoValido("nada"), "esta-semana");
  assert.equal(new Set(RANGOS.map((r) => rutaChile(r.id))).size, 5);
  assert.equal(rutaComuna("05801", "este-mes"), "prediccion-comuna-05801-este-mes.json");
  assert.equal(rutaComuna("05801", "xx"), "prediccion-comuna-05801-esta-semana.json");
});

test("el hash lleva día, región, comuna e incendio y se lee de vuelta", () => {
  assert.deepEqual(leerHash(aHash({ dia: "2026-01-17", comuna: "05801", incendio: "805123868" })), { rango: "esta-semana", dia: "2026-01-17", region: "05", comuna: "05801", vista: null, incendio: "805123868" });
  assert.deepEqual(leerHash(aHash({ dia: "2026-01-18", region: "07" })), { rango: "esta-semana", dia: "2026-01-18", region: "07", comuna: null, vista: null, incendio: null });
  assert.deepEqual(leerHash("#dia=2026-01-16"), { rango: "esta-semana", dia: "2026-01-16", region: null, comuna: null, vista: null, incendio: null });
  assert.equal(leerHash("#comuna=abc").comuna, null);
  assert.equal(leerHash("#dia=mañana").dia, null);
});

test("clases de riesgo: cortes fijos y escala relativa de celdas", () => {
  assert.deepEqual([0.05, 0.1, 0.3, 0.5, 0.9].map((p) => claseRiesgo(p)), [0, 1, 2, 3, 4]);
  assert.equal(claseRiesgo(null), -1);
  assert.deepEqual(cortesRelativos([0.01, 0.01]), []);
  assert.equal(cortesRelativos([0, 1]).length, 4);
});

test("las comunas más riesgosas salen de mayor a menor", () => {
  const items = [{ region_id: "a", p: 0.2 }, { region_id: "b", p: 0.5 }, { region_id: "c", p: 0.3 }];
  assert.deepEqual(masRiesgosas(items, { a: "A", b: "B", c: "C" }, 2).map((i) => i.region_id), ["b", "c"]);
});

// ---- Datos de ejemplo del contrato (los genera scripts/generar_prediccion.py) ----
test("ejemplo: 5 rangos x 345 comunas, todo marcado como ejemplo y periodos distintos", () => {
  const per = new Set();
  for (const r of RANGOS) {
    const c = leer(rutaChile(r.id));
    assert.equal(c.ejemplo, true);
    assert.equal(c.items.length, 345);
    assert.ok(c.items.every((i) => i.p >= 0 && i.p <= 1));
    per.add(c.periodo.desde + c.periodo.hasta);
  }
  assert.equal(per.size, 5);
});

test("ejemplo: 26 comunas con detalle en cada rango y coherente con el archivo de Chile", () => {
  const archivos = readdirSync(EXT).filter((f) => /^prediccion-comuna-\d{5}-este-mes\.json$/.test(f));
  assert.equal(archivos.length, 26);
  const chile = Object.fromEntries(leer(rutaChile("este-mes")).items.map((i) => [i.region_id, i]));
  for (const f of archivos) {
    const d = leer(f);
    const id = d.comuna.region_id;
    assert.equal(d.ejemplo, true);
    assert.equal(chile[id].detalle, true);
    assert.equal(chile[id].p, d.resumen.prob);
    assert.ok(Math.abs(d.resumen.causas.reduce((a, c) => a + c.pct, 0) - 100) < 0.11, "causas de la comuna suman 100");
    const n = d.grilla.celdas.length;
    assert.ok(n >= 25 && n <= 144 && d.grilla.filas <= 14 && d.grilla.columnas <= 14);
    for (const c of d.grilla.celdas.slice(0, 5)) {
      assert.ok(Math.abs(c.ca.reduce((a, x) => a + x, 0) - 100) < 0.11);
      assert.equal(c.rc.length, d.catalogo.acciones.length);
    }
    // Una celda es más chica que la comuna: su probabilidad no supera la de la comuna.
    assert.ok(d.grilla.celdas.every((c) => c.p <= d.resumen.prob));
    // Las recomendaciones del ejemplo solo tocan causas modificables.
    const rs = recomendar(d.resumen, d.catalogo, SUPUESTOS_FABRICA);
    assert.equal(rs.length, d.resumen.recomendaciones.length);
  }
});

test("ejemplo: un periodo más largo no baja la probabilidad (esta semana <= este mes) y cambiar de rango cambia los datos", () => {
  const sem = Object.fromEntries(leer(rutaChile("esta-semana")).items.map((i) => [i.region_id, i.p]));
  const mes = Object.fromEntries(leer(rutaChile("este-mes")).items.map((i) => [i.region_id, i.p]));
  for (const id of Object.keys(sem)) assert.ok(sem[id] <= mes[id] + 1e-9);
  const a = leer(rutaComuna("05801", "esta-semana")), b = leer(rutaComuna("05801", "proximo-mes"));
  assert.notEqual(a.resumen.prob, b.resumen.prob);
  assert.notEqual(a.periodo.desde, b.periodo.desde);
});

test("celda: se convierte a la misma forma que la comuna y reparte las vidas por personas expuestas", () => {
  const d = leer(rutaComuna("05801", "este-mes"));
  const c = d.grilla.celdas[0];
  const u = unidadDeCelda(c, d);
  assert.equal(u.causas.length, d.catalogo.causas.length);
  assert.equal(u.recomendaciones.length, d.catalogo.acciones.length);
  const suma = d.grilla.celdas.reduce((a, x) => a + unidadDeCelda(x, d).vidas_si_incendio, 0);
  assert.ok(Math.abs(suma - d.resumen.vidas_si_incendio) / d.resumen.vidas_si_incendio < 0.35);
});

// ---- Respaldo sintético (web/js/sintetico.js): lo que se muestra si no hay datos del back ni copia de ejemplo ----
import { chileSintetico, comunaSintetica, periodoDe } from "../web/js/sintetico.js";
const contornos = leer("contornos-chile.geojson");
const HOY = new Date(2026, 10, 14);

test("sintético: toda comuna de Chile recibe un detalle válido según el contrato", () => {
  const ch = chileSintetico(contornos, "este-mes", HOY);
  assert.equal(ch.items.length, contornos.features.length);
  assert.equal(ch.ejemplo, true);
  for (const f of contornos.features) {
    const it = ch.items.find((i) => i.region_id === f.properties.region_id);
    const a = comunaSintetica(f, "este-mes", { p: it.p, periodo: ch.periodo }, HOY);
    assert.equal(a.ejemplo, true);
    assert.equal(a.resumen.prob, it.p);
    assert.ok(a.grilla.celdas.length > 0, f.properties.nombre);
    assert.ok(Math.abs(a.resumen.causas.reduce((s, c) => s + c.pct, 0) - 100) < 0.05);
    for (const c of a.grilla.celdas) {
      assert.ok(c.p >= 0 && c.p <= a.resumen.prob + 1e-9);
      assert.equal(c.ca.length, a.catalogo.causas.length);
      assert.equal(c.rc.length, a.catalogo.acciones.length);
    }
    assert.ok(recomendar(a.resumen, a.catalogo).length > 0);
    assert.ok(recomendar(unidadDeCelda(a.grilla.celdas[0], a), a.catalogo).every((r) => Number.isFinite(r.beneficio.total)));
  }
});

test("sintético: la misma comuna y rango dan siempre los mismos números, y otro rango los cambia", () => {
  const f = contornos.features[0];
  assert.deepEqual(comunaSintetica(f, "esta-semana", {}, HOY), comunaSintetica(f, "esta-semana", {}, HOY));
  assert.notDeepEqual(comunaSintetica(f, "esta-semana", {}, HOY).resumen, comunaSintetica(f, "proximo-mes", {}, HOY).resumen);
});

test("sintético: los periodos se cuentan desde hoy", () => {
  assert.deepEqual(periodoDe("esta-semana", HOY), { desde: "2026-11-14", hasta: "2026-11-20" });
  assert.deepEqual(periodoDe("este-mes", HOY), { desde: "2026-11-14", hasta: "2026-11-30" });
  assert.deepEqual(periodoDe("proximo-mes", HOY), { desde: "2026-12-01", hasta: "2026-12-31" });
});

// ---- Nivel región (web/js/region.js) ----
import { regionesDe, grillaRegion, esContinental } from "../web/js/region.js";

test("región: promedio de sus comunas y grilla gruesa dentro del rango de las celdas finas", () => {
  const ch = chileSintetico(contornos, "este-mes", HOY);
  const nombres = Object.fromEntries(contornos.features.map((f) => [f.properties.region_id, f.properties]));
  const regs = regionesDe(ch.items, nombres);
  assert.equal(regs.length, 16);
  const valpo = regs.find((r) => r.id === "05");
  assert.ok(Math.abs(valpo.p - valpo.comunas.reduce((a, c) => a + c.p, 0) / valpo.comunas.length) < 1e-12);
  const comunas = valpo.comunas.map((it) => {
    const feature = contornos.features.find((f) => f.properties.region_id === it.region_id);
    return { id: it.region_id, feature, arch: comunaSintetica(feature, "este-mes", { p: it.p, periodo: ch.periodo }, HOY) };
  });
  const g = grillaRegion(comunas);
  const finas = comunas.filter((c) => esContinental(c.feature)).flatMap((c) => c.arch.grilla.celdas.map((k) => k.p));
  assert.ok(g.celdas.length > 20 && g.celdas.length < finas.length);
  for (const c of g.celdas) assert.ok(c.p >= Math.min(...finas) - 1e-9 && c.p <= Math.max(...finas) + 1e-9);
});

// ---- Riesgo de un día suelto (el que usa la plataforma) ----
import { periodoDia } from "../web/js/sintetico.js";

test("sintético por día: la suma del riesgo de las comunas calza con unos 65 incendios y cada día es distinto", () => {
  const sumas = ["2026-01-16", "2026-01-17", "2026-01-18"].map((d) => chileSintetico(contornos, periodoDia(d)).items.reduce((a, i) => a + i.p, 0));
  for (const x of sumas) assert.ok(x > 50 && x < 85, String(x));
  const a = chileSintetico(contornos, periodoDia("2026-01-16")), b = chileSintetico(contornos, periodoDia("2026-01-17"));
  assert.notDeepEqual(a.items, b.items);
  assert.deepEqual(a.items, chileSintetico(contornos, periodoDia("2026-01-16")).items);
});

test("sintético por día: el detalle de comuna calza con su riesgo del día y cumple el contrato", () => {
  const ch = chileSintetico(contornos, periodoDia("2026-01-17"));
  for (const f of contornos.features.slice(0, 40)) {
    const it = ch.items.find((i) => i.region_id === f.properties.region_id);
    const a = comunaSintetica(f, periodoDia("2026-01-17"), { p: it.p, periodo: ch.periodo });
    assert.equal(a.resumen.prob, it.p);
    assert.equal(a.periodo.desde, "2026-01-17");
    assert.ok(a.grilla.celdas.length > 0 && Math.abs(a.resumen.causas.reduce((s, c) => s + c.pct, 0) - 100) < 0.05);
  }
});
