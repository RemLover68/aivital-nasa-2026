# Guía para armar el front del MVP: sala de triaje del primer ataque

Fecha: 2026-11-14. Reemplaza el alcance de `guia_front.md` (producto anterior de nueve vistas). Para quien construye el front sin tocar el back.

## 1. Qué se construye
**Una sola pantalla de despacho.** Para cada incendio avisado muestra la probabilidad de que no se controle el día de inicio, el porqué, los activos que tiene en el camino con un tiempo aproximado de llegada, y la lista de todos los incendios del día ordenada por prioridad.
- Usuario: analista o despachador de CONAF [hipótesis].
- Todo número que salga de un modelo propio o de ejemplo se marca "ejemplo" mientras no exista el back real.

## 2. Stack (reutilizar lo que ya está en `web/`)
- HTML, CSS y JavaScript en módulos, sin compilación. Leaflet 1.9.4 local en `web/vendor/`.
- Contornos de comunas: `web/datos/ext/contornos-chile.geojson`.
- Servicio estático actual: puerto 7093 (`aivital-incendios-front.service`). No tocarlo; probar en otro puerto.
- Pruebas con `node --test tests/*.test.mjs`.
- No modificar el back (`/aivital/aivital-incendios-back`). Los datos nuevos van por un contrato JSON propio en `web/datos/ext/`.
- Quitar de la navegación lo del producto anterior (riesgo por comuna, grilla, recomendaciones de costo-beneficio). No hace falta borrar archivos si rompe la app móvil.

## 3. Pantalla (un solo layout)
Tres zonas:
1. **Izquierda: cola de incendios** (lista ordenada por prioridad). Cada fila: nombre, comuna, hora de inicio, combustible, prioridad (1 a N) y probabilidad. Filtro por región y por día.
2. **Centro: mapa.** Un punto por incendio, tamaño según prioridad, color según probabilidad. Al elegir uno se dibuja la zona probable de avance (cono según viento y pendiente) y los activos dentro de ella.
3. **Derecha: tarjeta del incendio elegido.**
   - Probabilidad de no control el día de inicio, en grande.
   - "Por qué": barras con el aporte de cada factor (viento de ladera, humedad del combustible fino muerto, tipo de combustible, hora de inicio, pendiente, temperatura).
   - "En el camino": lista de activos (tipo, nombre, distancia, tiempo estimado de llegada, personas estimadas).
   - Aviso visible de qué es dato real y qué es estimación.
4. **Pie: tablero de acierto.** Cuánto acertó el modelo contra el registro: AUC-PR, precisión y recall en el umbral elegido, y cuántos incendios no controlados quedaron entre los primeros de la cola. Con los números de ejemplo hasta que el back los entregue.

## 4. Modo demostración (repetición)
Selector de fecha. Valor inicial: **17 de enero de 2026** (67 incendios, 12 de 50 ha o más). Rango sugerido del 16 al 18 [medido sobre el registro]. Un control "avanzar hora" va revelando los incendios según su hora de inicio y reordena la cola. Al final se muestra qué pasó realmente (superficie final y si se controló el mismo día) junto a lo que el modelo había dicho. Esto es lo que se enseña en la demo.

## 5. Contrato de datos (JSON, lo entrega el back o la copia de ejemplo)
Archivo `web/datos/ext/triaje-<AAAA-MM-DD>.json`:
```
{
  "fecha": "2026-01-17",
  "ejemplo": true,
  "modelo": {"version": "...", "umbral": 0.5},
  "incendios": [{
    "id": "791831373", "nombre": "SANTA REBECA", "comuna": "...", "region": "...",
    "lat": -35.09, "lon": -71.23, "f_inicio": "2026-01-17 13:20",
    "comb_inicial": "Matorral",
    "p_no_control_dia": 0.41,
    "factores": [{"nombre": "viento de ladera", "aporte_pct": 34, "valor": "28 km/h"}],
    "prioridad": 3,
    "avance": {"direccion_grados": 110, "radio_km_1h": 1.5, "radio_km_3h": 4.0},
    "activos": [{"tipo": "hospital", "nombre": "...", "lat": -35.1, "lon": -71.2,
                 "dist_km": 3.2, "eta_h": 2.1, "personas_est": 420}],
    "real": {"sup_total_ha": 0.6, "controlado_mismo_dia": true}
  }],
  "acierto": {"auc_pr": null, "base_azar": null, "precision": null, "recall": null, "temporada": "2025-26"}
}
```
- `real` solo existe en modo repetición.
- Campos de los incendios salen del registro de CONAF (`incendios_totales`: id, nombre, f_inicio, lat, lon, comuna, region, comb_inicial, sup_total). Probabilidad, factores, avance, activos y acierto los calcula el back [hipótesis: aún no existe].
- URL base configurable en `web/js/config.js`; si el fetch falla, usar la copia local. Generar los datos de ejemplo con un script determinista en `scripts/` y marcarlos como ejemplo.

## 6. Reglas de la interfaz
- Español. Sin emojis como íconos: SVG o texto.
- Legible en una oficina con luz de día. Colores de probabilidad con escala secuencial y texto, no solo color.
- Cada número lleva su unidad y su origen (real, modelo o ejemplo).
- Nunca presentar la probabilidad como certeza ni como orden operativa: "apoyo a la decisión".
- No emitir alertas a la población desde este front (es función de Senapred).

## 7. Qué NO construir
Evacuación y rutas a pie, alerta de a dónde ir, ventana de descarga aérea, drones, relevos, pre-posicionamiento, cadena de dependencia, reloj de autonomía, humo y salud, daños post-incendio, seguros, causas y multas. Quedan para segunda etapa o se descartan.

## 8. Criterios de aceptación
1. Con los datos de ejemplo, el 17 de enero de 2026 muestra la cola ordenada y las tres zonas funcionan.
2. Elegir un incendio actualiza mapa, tarjeta y activos sin recargar.
3. El avance de hora reordena la cola y al final aparece el resultado real.
4. Todo dato de ejemplo se ve marcado como ejemplo.
5. Si el back no responde, el front usa la copia local sin error visible.
6. Las pruebas de la lógica de ordenamiento y del modo repetición pasan.
7. Carga sin errores de consola, en pantalla de escritorio y en laptop pequeña.

## 9. Datos y límites que el front debe respetar
- El registro trae la hora de inicio de cada incendio; aviso, despacho, llegada, ataque y control vienen solo con el día [medido].
- El índice de probabilidad por comuna de CONAF cubre solo Valparaíso: no usarlo como dato nacional.
- El pronóstico de CONAF solo guarda 5 días vigentes, sin historia.
- Las celdas de CONAF son de 4 km² en la mayoría, no de 8 km.

## 10. Orden de trabajo sugerido
1. Script de datos de ejemplo del 16 al 18 de enero desde el registro, con probabilidades y activos de ejemplo.
2. Layout de tres zonas con cola y mapa.
3. Tarjeta con factores y activos.
4. Modo repetición con avance de hora.
5. Tablero de acierto.
6. Pruebas y limpieza de la navegación anterior.
7. README y `memory.md` actualizados.
