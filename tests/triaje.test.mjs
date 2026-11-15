// Pruebas de la sala de triaje: cola, modo repetición, filtros, sector de avance y métricas de acierto.
// Correr: node --test tests/
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FECHAS, FECHA_INICIAL, HORA_INICIAL, HORA_FIN, rutaTriaje, horaDe, horaTxt, visiblesA, ordenarCola, filtrar, regionesPresentes,
  claseP, sector, metricasAcierto } from "../web/js/triaje.js";

const leer = (f) => JSON.parse(readFileSync(new URL(`../web/datos/ext/triaje-${f}.json`, import.meta.url), "utf8"));
const inc = (id, hora, p, ok = true, extra = {}) => ({ id, nombre: id, comuna: "X", region: "R", reg_id: "07", f_inicio: `2026-01-17 ${hora}`, p_no_control_dia: p,
  real: { sup_total_ha: 1, controlado_mismo_dia: ok }, ...extra });

test("la cola va de mayor a menor probabilidad y desempata por hora de inicio", () => {
  const cola = ordenarCola([inc("a", "10:00", 0.3), inc("b", "09:00", 0.8), inc("c", "08:00", 0.3), inc("d", "11:00", 0.9)]);
  assert.deepEqual(cola.map((i) => i.id), ["d", "b", "c", "a"]);
  assert.deepEqual(cola.map((i) => i.prioridad), [1, 2, 3, 4]);
});

test("avanzar la hora revela incendios y reordena la cola", () => {
  const todos = [inc("a", "08:00", 0.3), inc("b", "13:20", 0.9), inc("c", "15:00", 0.6)];
  assert.deepEqual(ordenarCola(visiblesA(todos, 9)).map((i) => i.id), ["a"]);
  assert.deepEqual(ordenarCola(visiblesA(todos, 13 + 20 / 60)).map((i) => i.id), ["b", "a"]);
  assert.deepEqual(ordenarCola(visiblesA(todos, HORA_FIN)).map((i) => [i.id, i.prioridad]), [["b", 1], ["c", 2], ["a", 3]]);
});

test("horas: se leen del campo f_inicio y se muestran con dos dígitos", () => {
  assert.equal(horaDe(inc("a", "13:20", 0.5)), 13 + 20 / 60);
  assert.equal(horaTxt(8.5), "08:30");
  assert.equal(horaTxt(HORA_FIN), "24:00");
});

test("filtros por región y por comuna, y regiones presentes", () => {
  const l = [inc("a", "08:00", 0.1, true, { reg_id: "05", region: "Valparaíso", comuna: "Quillota" }), inc("b", "09:00", 0.1), inc("c", "10:00", 0.1)];
  assert.deepEqual(filtrar(l, { region: "07" }).map((i) => i.id), ["b", "c"]);
  assert.deepEqual(filtrar(l, { comuna: "Quillota" }).map((i) => i.id), ["a"]);
  assert.equal(filtrar(l).length, 3);
  assert.deepEqual(regionesPresentes(l).map((r) => [r.id, r.n]), [["07", 2], ["05", 1]]);
});

test("clases de probabilidad", () => {
  assert.deepEqual([0.05, 0.25, 0.5, 0.7, 0.95].map(claseP), [0, 1, 2, 3, 4]);
});

test("el sector parte del punto de inicio y avanza hacia el rumbo", () => {
  const s = sector(-35, -71, 90, 4);                       // hacia el este
  assert.deepEqual(s[0], [-35, -71]);
  const medio = s[Math.floor(s.length / 2)];
  assert.ok(medio[1] > -71 && Math.abs(medio[0] + 35) < 0.01);   // al este y casi a la misma latitud
  const km = Math.hypot((medio[0] + 35) * 111, (medio[1] + 71) * 111 * Math.cos((35 * Math.PI) / 180));
  assert.ok(Math.abs(km - 4) < 0.1);
});

test("métricas de acierto con un caso a mano", () => {
  // Ordenados por p: A(no ctrl) B(ctrl) C(no ctrl) D(ctrl). AP = (1/1 + 2/3) / 2.
  const l = [inc("A", "08:00", 0.9, false), inc("B", "09:00", 0.8, true), inc("C", "10:00", 0.7, false), inc("D", "11:00", 0.1, true)];
  const m = metricasAcierto(l, 0.5, 2);
  assert.ok(Math.abs(m.auc_pr - (1 + 2 / 3) / 2) < 1e-12);
  assert.equal(m.base_azar, 0.5);
  assert.equal(m.precision, 2 / 3);
  assert.equal(m.recall, 1);
  assert.equal(m.en_primeros, 1);
  assert.equal(metricasAcierto([inc("A", "08:00", 0.9, true)]), null);
});

test("datos de ejemplo: 17 de enero de 2026 trae 67 incendios, 12 de 50 ha o más, todos marcados como ejemplo", () => {
  assert.equal(FECHA_INICIAL, "2026-01-17");
  assert.equal(rutaTriaje("1999-01-01"), "triaje-2026-01-17.json");
  const d = leer(FECHA_INICIAL);
  assert.equal(d.ejemplo, true);
  assert.equal(d.incendios.length, 67);
  assert.equal(d.incendios.filter((i) => i.real.sup_total_ha >= 50).length, 12);
  assert.equal(new Set(d.incendios.map((i) => i.prioridad)).size, 67);
  assert.ok(visiblesA(d.incendios, HORA_INICIAL).length >= 10);
});

test("datos de ejemplo: cada incendio cumple el contrato y la probabilidad no usa el resultado real", () => {
  for (const f of FECHAS) {
    for (const i of leer(f).incendios) {
      assert.ok(i.f_inicio.startsWith(f));
      assert.ok(i.p_no_control_dia >= 0 && i.p_no_control_dia <= 1);
      assert.equal(i.factores.reduce((s, x) => s + x.aporte_pct, 0), 100, i.nombre);
      assert.ok(i.avance.radio_km_3h >= i.avance.radio_km_1h);
      assert.ok(i.activos.every((a, k, v) => a.eta_h > 0 && (k === 0 || v[k - 1].eta_h <= a.eta_h)));
      assert.equal(typeof i.real.controlado_mismo_dia, "boolean");
    }
  }
  // Si la probabilidad usara el resultado real, el acierto de ejemplo saldría inflado: debe quedar lejos de un acierto perfecto.
  const m = metricasAcierto(leer(FECHA_INICIAL).incendios);
  assert.ok(m.auc_pr < 0.9, `auc_pr ${m.auc_pr}`);
});
