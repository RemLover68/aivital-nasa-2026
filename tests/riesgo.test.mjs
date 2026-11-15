// Pruebas de las reglas de los datos del back (contrato 0.4). Correr: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { normalizarRiesgo, agruparRegiones, claseSector, pctTxt, periodoTxt, leerFocosCsv, recomendacion, horizonteValido, nivelIdx } from "../web/js/riesgo.js";

test("normalizarRiesgo toma el periodo, el nivel y las notas del archivo", () => {
  const r = normalizarRiesgo({ ejemplo: false, modelo: "m", horizonte_horas: 168, valido_para: "2026-01-01", valido_hasta: "2026-01-07", orientativo: true, nota: "x",
    items: [{ region_id: "05109", prob_foco: 0.3, nivel: "alto", percentil: 90 }] });
  assert.deepEqual(r.periodo, { desde: "2026-01-01", hasta: "2026-01-07" });
  assert.equal(r.horizonte, "168"); assert.equal(r.orientativo, true);
  assert.deepEqual(r.items[0], { region_id: "05109", p: 0.3, nivel: "alto", percentil: 90 });
  assert.equal(normalizarRiesgo({ horizonte_horas: 24, valido_para: "2026-01-01", items: [] }).periodo.hasta, "2026-01-01");
});

test("agruparRegiones ordena por comunas en alto o muy alto y usa el nivel más alto", () => {
  const nombres = { "05101": { region: "Región de Valparaíso" }, "05102": { region: "Región de Valparaíso" }, "13101": { region: "Región Metropolitana" } };
  const g = agruparRegiones([{ region_id: "05101", p: 0.1, nivel: "bajo" }, { region_id: "05102", p: 0.5, nivel: "muy_alto" }, { region_id: "13101", p: 0.2, nivel: "medio" }], nombres);
  assert.deepEqual(g.map((x) => [x.id, x.nivel, x.nAltas]), [["05", "muy_alto", 1], ["13", "medio", 0]]);
});

test("niveles y horizontes", () => {
  assert.deepEqual(["bajo", "medio", "alto", "muy_alto"].map(nivelIdx), [0, 1, 2, 3]);
  assert.deepEqual(["24", "48", "168", "5", null].map(horizonteValido), ["24", "48", "168", "24", "24"]);
});

test("el color del sector sale del percentil dentro de la comuna", () => {
  assert.deepEqual([0, 19.9, 20, 55, 80, 100].map(claseSector), [0, 0, 1, 2, 4, 4]);
});

test("porcentajes con decimales fijos y periodos en español", () => {
  assert.equal(pctTxt(0.00003, 2), "0,00 %"); assert.equal(pctTxt(0.0123, 2), "1,23 %"); assert.equal(pctTxt(null), "sin dato");
  assert.equal(periodoTxt({ desde: "2026-01-01", hasta: "2026-01-01" }), "1 de enero de 2026");
  assert.equal(periodoTxt({ desde: "2026-01-01", hasta: "2026-01-07" }), "1 al 7 de enero de 2026");
  assert.equal(periodoTxt({ desde: "2026-01-30", hasta: "2026-02-02" }), "30 de enero al 2 de febrero de 2026");
});

test("focos del CSV y recomendaciones con su enlace", () => {
  const f = leerFocosCsv("fecha,lat,lon,frp,focos_incendio,sector_id\n2012-02-03,-33.1,-71.5,158.3,35,05109_1_2\nmal\n2012-02-04,x,y,1,1,a");
  assert.deepEqual(f, [{ fecha: "2012-02-03", lat: -33.1, lon: -71.5, frp: 158.3 }]);
  const rec = { recomendaciones: { poda: { texto: "Podar", fuente: "minvu" }, sola: { texto: "Sola", fuente: null } }, fuentes: { minvu: { nombre: "MINVU", url: "https://x" } } };
  assert.deepEqual(recomendacion(rec, "poda"), { codigo: "poda", texto: "Podar", fuente: "MINVU", url: "https://x" });
  assert.equal(recomendacion(rec, "sola").url, null);
  assert.equal(recomendacion(rec, "nada"), null);
});
