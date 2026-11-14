// Arma el parte del día en texto, con las mismas reglas de la plataforma, para mandarlo por WhatsApp o correo.
//   node scripts/parte.mjs            imprime el texto
//   node scripts/parte.mjs --nuevas   imprime solo las alertas que todavía no se han avisado
//   node scripts/parte.mjs --marcar   anota las alertas de ahora como ya avisadas (se llama después de un envío que resultó)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { evaluar, priorizar, alertas, textoParte } from "../web/js/logica.js";

const raiz = fileURLToPath(new URL("../web/datos/ext/", import.meta.url));
const leer = (n) => JSON.parse(readFileSync(raiz + n, "utf-8"));
const [pronostico, puntos, protocolos] = [leer("pronostico.json"), leer("puntos.json"), leer("protocolos.json")];

const pronPorComuna = Object.fromEntries(pronostico.items.map((it) => [it.region_id, it]));
const lista = alertas(evaluar(protocolos.items, puntos.items, pronPorComuna), priorizar(pronostico, puntos.items));
const hoy = new Date(pronostico.items[0].dias[0].fecha + "T12:00:00");
hoy.setDate(hoy.getDate() - 1);
const fecha = new Intl.DateTimeFormat("es-CL", { weekday: "long", day: "numeric", month: "long" }).format(hoy);
const ejemplo = Boolean(pronostico.ejemplo || puntos.ejemplo);

if (process.argv.includes("--nuevas")) {
  // La memoria de lo ya avisado queda fuera de web/, para que no se publique.
  const memoria = fileURLToPath(new URL("../.alertas-avisadas.json", import.meta.url));
  const antes = existsSync(memoria) ? JSON.parse(readFileSync(memoria, "utf-8")) : [];
  const nuevas = lista.filter((a) => !antes.includes(a.id));
  if (nuevas.length) console.log(textoParte(nuevas, { fecha, ejemplo, maximo: 4 }).replace("Preaviso, parte", "Preaviso, alertas nuevas"));
} else if (process.argv.includes("--marcar")) {
  writeFileSync(fileURLToPath(new URL("../.alertas-avisadas.json", import.meta.url)), JSON.stringify(lista.map((a) => a.id)));
} else {
  console.log(textoParte(lista, { fecha, ejemplo, maximo: 4 }));
}
