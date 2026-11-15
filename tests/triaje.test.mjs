// Pruebas de los incendios del día: cola, alertas, filtros, ubicación en comunas y sector de avance.
// Correr: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FECHAS, FECHA_INICIAL, UMBRAL_ALERTA, diaValido, rutaTriaje, horaDe, horaTxt, esAlerta, ordenarCola, filtrar, claseP, colorP, sector } from "../web/js/triaje.js";
import { localizarIncendios } from "../web/js/region.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../web/datos/ext/${f}`, import.meta.url), "utf8"));
const inc = (id, hora, p, extra = {}) => ({ id, nombre: id, comuna: "X", region: "R", region_id: "07", comuna_id: "07101", f_inicio: `2026-01-17 ${hora}`, p_no_control_dia: p, ...extra });

test("la cola va de mayor a menor probabilidad y desempata por hora de inicio", () => {
  const cola = ordenarCola([inc("a", "10:00", 0.3), inc("b", "09:00", 0.8), inc("c", "08:00", 0.3), inc("d", "11:00", 0.9)]);
  assert.deepEqual(cola.map((i) => i.id), ["d", "b", "c", "a"]);
  assert.deepEqual(cola.map((i) => i.prioridad), [1, 2, 3, 4]);
});

test("alerta: probabilidad igual o mayor al umbral", () => {
  assert.equal(UMBRAL_ALERTA, 0.5);
  assert.deepEqual([0.49, 0.5, 0.9].map((p) => esAlerta(inc("a", "08:00", p))), [false, true, true]);
  assert.equal(esAlerta(inc("a", "08:00", 0.6), 0.7), false);
});

test("horas: se leen del campo f_inicio y se muestran con dos dígitos", () => {
  assert.equal(horaDe(inc("a", "13:20", 0.5)), 13 + 20 / 60);
  assert.equal(horaTxt(8.5), "08:30");
});

test("filtros por región y por comuna, según donde cae el incendio", () => {
  const l = [inc("a", "08:00", 0.1, { region_id: "05", comuna_id: "05601" }), inc("b", "09:00", 0.1), inc("c", "10:00", 0.1, { comuna_id: "07102" })];
  assert.deepEqual(filtrar(l, { region: "07" }).map((i) => i.id), ["b", "c"]);
  assert.deepEqual(filtrar(l, { comuna: "05601" }).map((i) => i.id), ["a"]);
  assert.equal(filtrar(l).length, 3);
});

test("clases y colores de probabilidad", () => {
  assert.deepEqual([0.05, 0.25, 0.5, 0.7, 0.95].map(claseP), [0, 1, 2, 3, 4]);
  assert.equal(colorP(0.95), "#a50e0e");
});

test("el sector parte del punto de inicio y avanza hacia el rumbo", () => {
  const s = sector(-35, -71, 90, 4);                       // hacia el este
  assert.deepEqual(s[0], [-35, -71]);
  const medio = s[Math.floor(s.length / 2)];
  assert.ok(medio[1] > -71 && Math.abs(medio[0] + 35) < 0.01);
  const km = Math.hypot((medio[0] + 35) * 111, (medio[1] + 71) * 111 * Math.cos((35 * Math.PI) / 180));
  assert.ok(Math.abs(km - 4) < 0.1);
});

test("el día inválido vuelve al inicial y la ruta del archivo sale del día", () => {
  assert.equal(diaValido("1999-01-01"), FECHA_INICIAL);
  assert.equal(rutaTriaje("2026-01-18"), "triaje-2026-01-18.json");
});

test("datos de ejemplo: 17 de enero de 2026 trae 67 incendios, 12 de 50 ha o más, todos marcados como ejemplo", () => {
  const d = leer(`triaje-${FECHA_INICIAL}.json`);
  assert.equal(d.ejemplo, true);
  assert.equal(d.incendios.length, 67);
  assert.equal(d.incendios.filter((i) => i.real.sup_total_ha >= 50).length, 12);
  assert.equal(new Set(d.incendios.map((i) => i.prioridad)).size, 67);
});

test("datos de ejemplo: cada incendio cumple el contrato", () => {
  for (const f of FECHAS) {
    for (const i of leer(`triaje-${f}.json`).incendios) {
      assert.ok(i.f_inicio.startsWith(f));
      assert.ok(i.p_no_control_dia >= 0 && i.p_no_control_dia <= 1);
      assert.equal(i.factores.reduce((s, x) => s + x.aporte_pct, 0), 100, i.nombre);
      assert.ok(i.avance.radio_km_3h >= i.avance.radio_km_1h);
      assert.ok(i.activos.every((a, k, v) => a.eta_h > 0 && (k === 0 || v[k - 1].eta_h <= a.eta_h)));
    }
  }
});

test("localizar: cada incendio de los tres días cae en una comuna, casi todos por contorno", () => {
  const contornos = leer("contornos-chile.geojson");
  for (const f of FECHAS) {
    const dados = leer(`triaje-${f}.json`).incendios;
    const l = localizarIncendios(dados, contornos.features);
    assert.ok(l.every((i) => /^\d{5}$/.test(i.comuna_id) && i.region_id === i.comuna_id.slice(0, 2)), f);
    // El nombre de la comuna del registro coincide con el contorno en la gran mayoría de los casos.
    const nombres = Object.fromEntries(contornos.features.map((x) => [x.properties.region_id, x.properties.nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()]));
    const coinciden = l.filter((i) => nombres[i.comuna_id] === i.comuna.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()).length;
    assert.ok(coinciden / l.length > 0.8, `${f}: ${coinciden}/${l.length}`);
  }
});
