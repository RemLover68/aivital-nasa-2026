// Pruebas de las reglas que convierten pronóstico en avisos. Correr: node --test tests/logica.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { evaluar, estadoPorPunto, puntosSobreUmbralPorDia } from "../web/js/logica.js";

const protocolo = {
  id: "faenas", aplica_a: ["faena"], variable: "prob_foco",
  umbral_preparacion: 0.18, umbral_activacion: 0.30, dias_preparacion: 2, dias_activacion: 1,
  acciones_preparacion: [{ texto: "revisar", quien: "a" }], acciones_activacion: [{ texto: "suspender", quien: "b" }],
};
const punto = (id, comuna, tipo = "faena") => ({ id, tipo, region_id: comuna, personas: 10 });
const pron = (valores) => ({ dias: valores.map((v, i) => ({ dia: i + 1, prob_foco: v })) });

test("activa cuando mañana supera el umbral de activación", () => {
  const [a] = evaluar([protocolo], [punto("P1", "A")], { A: pron([0.35, 0.1, 0.1]) });
  assert.equal(a.estado, "activacion");
  assert.equal(a.acciones[0].texto, "suspender");
});

test("prepara cuando pasado mañana supera el umbral de preparación", () => {
  const [a] = evaluar([protocolo], [punto("P1", "A")], { A: pron([0.05, 0.2, 0.1]) });
  assert.equal(a.estado, "preparacion");
  assert.equal(a.dia.dia, 2);
});

test("un valor alto pasado mañana no activa: activar es solo para mañana", () => {
  const [a] = evaluar([protocolo], [punto("P1", "A")], { A: pron([0.05, 0.5, 0.1]) });
  assert.equal(a.estado, "preparacion");
});

test("más allá de los días de preparación queda en vigilancia y sin acciones", () => {
  const [a] = evaluar([protocolo], [punto("P1", "A")], { A: pron([0.05, 0.05, 0.05, 0.4]) });
  assert.equal(a.estado, "vigilancia");
  assert.equal(a.acciones.length, 0);
});

test("bajo el umbral, sin dato o de otro tipo no genera aviso", () => {
  assert.equal(evaluar([protocolo], [punto("P1", "A")], { A: pron([0.1, 0.1]) }).length, 0);
  assert.equal(evaluar([protocolo], [punto("P1", "A")], { A: pron([null, null]) }).length, 0);
  assert.equal(evaluar([protocolo], [punto("P1", "A", "colegio")], { A: pron([0.9]) }).length, 0);
  assert.equal(evaluar([protocolo], [punto("P1", "Z")], { A: pron([0.9]) }).length, 0);
});

test("ordena activación antes que preparación y resume el peor estado por punto", () => {
  const avisos = evaluar([protocolo], [punto("P1", "A"), punto("P2", "B")], { A: pron([0.05, 0.2]), B: pron([0.4]) });
  assert.deepEqual(avisos.map((a) => a.estado), ["activacion", "preparacion"]);
  assert.deepEqual(estadoPorPunto(avisos), { P2: "activacion", P1: "preparacion" });
});

test("cuenta por día los puntos sobre el umbral de activación", () => {
  const cuenta = puntosSobreUmbralPorDia([protocolo], [punto("P1", "A"), punto("P2", "B")], { A: pron([0.4, 0.1]), B: pron([0.4, 0.4]) }, 2);
  assert.deepEqual(cuenta, [2, 1]);
});

// ---------- prioridad, alertas, historia, registro y contraste ----------
import { priorizar, alertas, textoParte, contraLoNormal, cortesPorCuantil, claseDeValor, totalPorAnio, filtrarCsvPorAnios,
  sugerenciasDeUmbral, contrasteDelDia, aciertoPorFuente, PESOS_FABRICA } from "../web/js/logica.js";

const dia = (n, prob, humo = 0, confianza = "alta") => ({ dia: n, fecha: `2026-11-${14 + n}`, prob_foco: prob, pm25_humo: humo, confianza });
const pronDos = { items: [
  { region_id: "A", nombre: "Alfa", interfaz: 0.8, dias: [dia(1, 0.4, 60), dia(2, 0.1)] },
  { region_id: "B", nombre: "Beta", interfaz: 0.1, dias: [dia(1, 0.05), dia(2, 0.06)] },
] };
const ptos = [{ id: "P1", tipo: "faena", region_id: "A", personas: 100, nombre: "Faena Uno", comuna: "Alfa", responsable: "Jefatura" },
  { id: "P2", tipo: "faena", region_id: "B", personas: 10, nombre: "Faena Dos", comuna: "Beta", responsable: "Jefatura" }];

test("prioridad: la comuna con más riesgo y más personas queda primera y los aportes suman el puntaje", () => {
  const filas = priorizar(pronDos, ptos);
  assert.equal(filas[0].region_id, "A");
  assert.equal(filas[0].nivel, "alerta");
  assert.equal(Math.round(filas[0].aportes.reduce((s, a) => s + a.puntos, 0)), filas[0].puntaje);
  assert.equal(filas[1].nivel, "seguimiento");
});

test("prioridad: con todo el peso en personas expuestas, el orden lo decide la exposición", () => {
  const pesos = Object.fromEntries(Object.keys(PESOS_FABRICA).map((k) => [k, k === "exposicion" ? 100 : 0]));
  const filas = priorizar({ items: [pronDos.items[1], pronDos.items[0]] }, [{ ...ptos[0], region_id: "B" }, { ...ptos[1], region_id: "A" }], pesos);
  assert.equal(filas[0].region_id, "B");
  assert.equal(filas[0].puntaje, 100);
});

test("alertas: una por punto con acciones, sin los que solo están en vigilancia", () => {
  const avisos = evaluar([protocolo], ptos, { A: pronDos.items[0], B: pronDos.items[1] });
  const lista = alertas(avisos, priorizar(pronDos, ptos));
  assert.equal(lista.length, 1);
  assert.equal(lista[0].punto.id, "P1");
  assert.equal(lista[0].estado, "activacion");
  assert.match(lista[0].id, /^P1\|activacion\|2026-11-15$/);
  assert.equal(lista[0].acciones[0].texto, "suspender");
  const texto = textoParte(lista, { fecha: "14 de noviembre", ejemplo: true });
  assert.match(texto, /ACTIVAR HOY \(1\)/);
  assert.match(texto, /MAQUETA/);
  assert.match(texto, /suspender \[b\]/);
});

const reg = (anio, mes, arm, extra = {}) => ({ anio, mes, modis: Math.round(arm), viirs: anio >= 2012 ? Math.round(arm * 3) : null, armonizado: arm, ...extra });

test("historia: el último mes se compara con la mediana que trae el archivo, o con la calculada si falta", () => {
  const con = contraLoNormal([reg(2023, 2, 5), reg(2024, 2, 21, { mediana_historica: 5 })]);
  assert.equal(con.veces, 4.2);
  const sin = contraLoNormal([reg(2022, 2, 4), reg(2023, 2, 6), reg(2024, 2, 20)]);
  assert.equal(sin.normal, 6);
});

test("historia: la serie sin armonizar salta cuando entra VIIRS y el total anual lo muestra", () => {
  const tot = totalPorAnio([reg(2011, 1, 10), reg(2012, 1, 10)], "crudo");
  assert.deepEqual(tot, [{ anio: 2011, total: 10 }, { anio: 2012, total: 40 }]);
  assert.deepEqual(totalPorAnio([reg(2011, 1, 10)], "viirs"), [{ anio: 2011, total: null }]);
});

test("historia: color por cuantiles, con el cero aparte", () => {
  const cortes = cortesPorCuantil([0, 0, 1, 2, 3, 4, 5, 100], 3);
  assert.equal(claseDeValor(0, cortes), 0);
  assert.equal(claseDeValor(null, cortes), "nd");
  assert.equal(claseDeValor(1, cortes), 1);
  assert.equal(claseDeValor(100, cortes), 3);
});

test("descarga: el CSV respeta el rango de años", () => {
  const r = filtrarCsvPorAnios("fecha,lat\n2019-01-02,1\n2024-02-03,2\n2025-01-01,3\n", 2020, 2024);
  assert.equal(r.filas, 1);
  assert.equal(r.texto, "fecha,lat\n2024-02-03,2\n");
});

test("registro: sugiere subir el umbral del protocolo con muchas falsas alarmas", () => {
  const filas = [..."ffaa"].map((c) => ({ protocolo: "humo", resultado: c === "f" ? "falsa_alarma" : "acierto" }));
  assert.deepEqual(sugerenciasDeUmbral(filas), [{ protocolo: "humo", tipo: "subir", casos: 2, de: 4 }]);
  assert.deepEqual(sugerenciasDeUmbral(filas.slice(0, 3)), []);
});

test("contraste: separa coincidencias de diferencias y cuenta aciertos por fuente", () => {
  const p = { items: [{ region_id: "A", nombre: "Alfa", dias: [{ nivel: "alto", externas: { gwis: "bajo", boton_rojo: false } }] },
    { region_id: "B", nombre: "Beta", dias: [{ nivel: "bajo", externas: { gwis: "bajo", boton_rojo: true } }] }] };
  assert.deepEqual(contrasteDelDia(p, 1).map((x) => x.lectura), ["solo_motor", "solo_publicas"]);
  const r = aciertoPorFuente({ items: [{ dias: [{ motor: "alto", gwis: "bajo", boton_rojo: false, focos_observados: 3 }, { motor: "alto", gwis: "bajo", boton_rojo: false, focos_observados: 0 }] }] });
  assert.deepEqual(r.motor, { avisos: 2, aciertos: 1, falsas: 1, sin_aviso: 0, dias_con_foco: 1 });
  assert.equal(r.gwis.sin_aviso, 1);
});
