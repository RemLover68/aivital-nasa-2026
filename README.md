# aivital-nasa-2026-front

Front del equipo **AIVital** para NASA Space Apps 2026. Maqueta de **Preaviso**: una plataforma que toma la
predicción de incendios y humo y la convierte cada mañana en acciones con responsable.

El back vive en un repo aparte (`hackaton-nasa-2026-back`, antes `aivital-incendios-back`) y publica archivos estáticos según su
contrato 0.2 (la copia local del back en `../aivital-incendios-back` sigue en 0.1). Investigación y documentos: Google Drive,
`space-apps-26-aivital`.

## Objetivo

Una sola pantalla con País, Región y Comuna donde los **incendios del día** van sobre el **mapa de riesgo del día**. Para cada incendio avisado:
la probabilidad de que no se controle el día de inicio, el porqué, los activos que tiene en el camino con un tiempo aproximado de llegada y la
cola de todos los incendios por prioridad (`guia-front-mvp.md`). Los que llegan al umbral (50 %) quedan en alerta, con borde del color de su
nivel. Por comuna y por celda, el riesgo con causas (modificables o no por el municipio) y recomendaciones con costo y beneficio.
Usuario: analista o despachador de CONAF y personal municipal [hipótesis]. Apoyo a la decisión, no orden operativa. El contrato de datos que
debe publicar el back está en `web/datos/ext/CONTRATO.md`.

## Hecho

- **Conectado al back** (15-11-2026, contrato 0.4, `https://marcelo-corro.github.io/hackaton-nasa-2026-datos/`; código en `web/js/riesgo.js` y `back` de `web/js/api.js`):
  País coloreado por comuna con el campo `nivel` de cada archivo y la fecha de los datos (1-ene-2026, `valido_para`) visible; selector 24 h, 48 h y 7 días
  (el de 7 días muestra la nota orientativa). Región de Valparaíso con las tarjetas de `alertas/05.json` en su orden, el clima por comuna y mapa con las
  alertas numeradas; las demás regiones solo muestran el riesgo por comuna. Comuna con sectores de `sectores/{id}.geojson` coloreados por
  `percentil_en_comuna`, ficha con probabilidades (foco 24 h con 2 decimales), rasgos, historial y recomendaciones con enlace a su fuente (`recomendaciones.json`),
  focos históricos opcionales y la nota del modelo junto al mapa. Si el back no responde se dice, sin datos inventados en su lugar. Pruebas: `tests/riesgo.test.mjs`.
- **Modo visión** (apagado por defecto, botón del menú lateral): los incendios del registro de CONAF con probabilidad de no control, factores, avance y activos
  inventados, siempre con la etiqueta grande "Datos de ejemplo, no son del modelo" (panel, ficha y mapa).
- **Versión fusionada** (rama `fusion-pais-region-comuna`; la anterior, con Triaje aparte y horas, quedó en la rama `respaldo-triaje-v1` y la
  etiqueta `triaje-v1`): navegación País, Región y Comuna, selector de un solo día (16, 17 o 18 de enero de 2026, inicia el 17) sin horas ni tablero.
  País pintado por región (promedio de sus comunas); región con sus comunas completas y una grilla gruesa (cada celda promedia unas cuatro de
  comuna); comuna con grilla fina de 8x8 a 12x12 celdas, resumen a la izquierda y a la derecha Incendios, Recomendaciones o Causas.
  Mapa satelital en color (Esri World Imagery), celdas al 30 % de opacidad, paneles al 85 % de opacidad y leyenda translúcida.
- **Incendios del día** (`web/js/triaje.js`, `web/js/region.js`): cola ordenada con borde de alerta, puntos en el mapa con anillo del color del nivel,
  ficha con probabilidad, por qué (aporte de cada factor) y en el camino (cono de avance y activos con tiempo de llegada). Cada incendio se
  ubica en su comuna por el contorno que contiene el punto. Datos: `scripts/generar_triaje.py` toma del registro de CONAF los incendios (67 el 17 de
  enero, 12 de 50 ha o más) e inventa probabilidad, factores, avance y activos sin usar el resultado real. Enlace directo:
  `#comuna=13502&incendio=805123868&dia=2026-01-17`.
- **Riesgo de un día** (`web/js/sintetico.js`): sin datos del back, se calcula en el navegador con semilla por comuna y día; la tasa diaria se calibró
  para que las 345 comunas sumen unos 65 incendios, como un día punta de enero.
- Reglas puras en `web/js/prediccion.js` (beneficio, razón beneficio/costo, orden, rangos). Lectura con fallback en `web/js/api.js`:
  pide a `BASE_PREDICCION` (`config.js`, o `?pred=`) y, si falla, usa la copia de ejemplo de `web/datos/ext/`.
- Respaldo sintético (`web/js/sintetico.js`): si una comuna no tiene datos en el back ni en la copia de ejemplo (319 de las 345), su
  detalle se calcula en el navegador con la misma fórmula y una semilla fija por comuna. El pie de página lo dice.
- Rediseño de la pantalla (15-11-2026): sin cabecera; menú lateral izquierdo con el selector de día (único lugar donde se dice la fecha) y Chile con sus 16 regiones
  de norte a sur como desplegables con sus comunas (punto del nivel de riesgo e insignia con los incendios del día; reemplaza al buscador de comuna). Paleta de
  bomberos 60-30-10 (carbón y papel cálido; rojo de camión; ámbar de detalle). Dos tarjetas grandes (incendios y, más llamativa, en alerta; cifras que suben al entrar).
  País y región parten el panel en mitades: incendios a la izquierda, regiones o comunas a la derecha. Leyenda vertical en el país; el mapa parte acercado a la zona
  de los incendios del día (en enero todos caen entre Maule y Los Lagos) y un botón pasa a todo Chile. Transiciones suaves entre vistas, listas y desplegables.
- Diseño (14-11-2026): fondo con imagen satelital difuminada de Chile central (NASA Worldview, MODIS Terra, `web/img/fondo-difuminado.jpg`)
  bajo un velo claro, paneles casi opacos con bordes redondeados, nivel de riesgo dicho con palabras además del color, las 4 causas
  principales a la vista y el resto plegado. El periodo se elige en la barra superior y el mapa usa todo el alto de la pantalla, sin
  desplazar la página. El origen de los datos (ejemplo o sintético) se dice solo en el pie y en Metodología, sin aviso superior.
- Datos de ejemplo deterministas (`scripts/generar_prediccion.py`, semilla por comuna): 345 comunas x 5 rangos y detalle de 26 comunas.
  Todo se ve marcado como "ejemplo" en pantalla. Contornos de respaldo: `scripts/preparar_contornos.py`.
- Lectura del contrato 0.2 del back (contornos reales de 345 comunas). Vista de terreno (`web/movil.html`) y app de Android
  (`app-android/`) intactas: siguen con el producto anterior (alertas, protocolos) y sus datos de ejemplo.
- Pruebas: 48 (`tests/logica.test.mjs` del producto anterior, `tests/prediccion.test.mjs` del riesgo por periodo, `tests/triaje.test.mjs` del triaje).
- Dos presentaciones en HTML (`presentaciones/`) y servicio en aivital-box, puerto 7093.

## Falta

- El back no publica el triaje: probabilidad, factores, avance, activos y acierto son de ejemplo (`triaje-AAAA-MM-DD.json`). El tablero de acierto
  se calcula en el front con esas probabilidades de ejemplo y no mide ningún modelo real hasta que el back entregue las suyas.
- Los activos del camino son genéricos e inventados (caserío, escuela, posta, ruta, línea eléctrica): falta una fuente real de infraestructura.
- Por decidir: pasar la versión fusionada a `main` (hoy solo está en la rama `fusion-pais-region-comuna`, servida en el puerto 7093 desde esa rama).
- El back no publica la predicción: todo número es de ejemplo. Hay que acordar el contrato (`web/datos/ext/CONTRATO.md`), en
  especial cómo se calculan las causas (contribución al modelo), `vidas_si_incendio` y los costos de cada acción.
- Los supuestos (valor de vida estadística, valor de propiedad por hectárea, costo de combate) y los costos de las acciones son
  inventados: validar con fuentes y con un municipio.
- Probar con personal municipal si la grilla y el orden de recomendaciones bastan; textos en inglés para la demo.
- `web/movil.html`, `web/producto.html` y la app de Android quedaron del producto anterior y ya no se enlazan desde la web; decidir si se actualizan o se retiran.
- Medir el beneficio en dinero con datos reales y guardar los supuestos en un servidor (hoy quedan en cada navegador).

## Cómo correrlo

```bash
python3 scripts/generar_triaje.py               # regenera web/datos/ext/triaje-*.json desde el registro de CONAF (ejemplo, determinista)
python3 scripts/generar_prediccion.py            # regenera web/datos/ext/prediccion-*.json (ejemplo, determinista)
python3 scripts/preparar_contornos.py            # opcional: renueva los contornos de respaldo desde el back
python3 scripts/generar_datos_sinteticos.py      # regenera web/datos/ (producto anterior: contrato 0.2 de ejemplo)
python3 -m http.server 7093 --directory web      # abrir http://localhost:7093 (ya corre como servicio)
node --test tests/*.test.mjs                     # pruebas
node scripts/parte.mjs                           # el parte en texto, para WhatsApp o correo
python3 scripts/simular_evento.py 07101          # sube el riesgo de Talca para probar alertas (--deshacer lo revierte)
python3 presentaciones/generar.py                # regenera las dos presentaciones
PREAVISO_WSP_CHAT="nombre exacto del chat" scripts/enviar_alertas_wsp.sh   # manda las alertas nuevas por WhatsApp
```

### App de Android

Se compila en una máquina con Node, JDK 21 y el SDK de Android (hoy serverus, en `~/preaviso-build`):

```bash
rsync -a --delete --exclude=.git --exclude=node_modules --exclude=app-android/android --exclude=app-android/www ./ serverus:preaviso-build/
ssh serverus 'cd ~/preaviso-build && bash scripts/compilar_apk.sh "http://<IP-del-servidor>:7093/"'   # dirección del servidor de datos
ssh serverus 'adb -s <IP-del-telefono>:5555 install -r ~/preaviso-build/app-android/android/app/build/outputs/apk/debug/app-debug.apk'
```

La app (`cl.aivital.preaviso`) trae la web dentro, abre en la vista de terreno y pide los datos al servidor indicado.
Revisa el pronóstico cada minuto mientras está abierta. Copia del último APK: `app-android/apk/preaviso-debug.apk`.

En aivital-box ya corre como servicio:

```bash
systemctl status aivital-incendios-front
sudo systemctl restart aivital-incendios-front
```

## Cómo conectar datos reales

Todas las lecturas pasan por `web/js/api.js` y las rutas están en `web/js/config.js`.

| Qué | Dónde se cambia |
|---|---|
| De dónde sale el contrato | Interruptor del pie de página, `?fuente=back` o `?fuente=maqueta` |
| Archivos del contrato 0.2 | `URL_BACK` en `config.js`, o `?base=https://.../` en la URL |
| Predicción por periodo | `BASE_PREDICCION` en `config.js`, o `?pred=https://.../` en la URL (contrato en `web/datos/ext/CONTRATO.md`) |
| Extensión del producto anterior y copia de ejemplo | `BASE_EXT` en `config.js`, o `?ext=https://.../` en la URL |
| Un endpoint con otra forma | La función correspondiente de `api.js` |

El rango elegido y la comuna van en la URL: `index.html#comuna=05801&rango=este-mes`.

## Estructura

```
├── scripts/                              # datos de ejemplo, parte en texto, evento simulado, compilar el APK
├── tests/                                # logica.test.mjs (producto anterior) y prediccion.test.mjs (producto nuevo)
├── presentaciones/                       # generar.py y los dos pitch en HTML
├── app-android/                          # proyecto Capacitor: configuración, ícono y APK
└── web/                                  # lo que se publica
    ├── index.html                        # plataforma web (js/app.js, js/prediccion.js, css/plataforma.css)
    ├── movil.html                        # vista de terreno (portada de la app)
    ├── producto.html                     # informe interno de producto, con fuentes
    ├── css/  js/  img/
    ├── datos/                            # copia de ejemplo del contrato 0.2
    │   └── ext/                          # predicción de ejemplo, CONTRATO.md y contornos de respaldo
    └── vendor/leaflet/                   # Leaflet 1.9.4, licencia BSD de 2 cláusulas
```

El mapa base se pide a OpenStreetMap desde el navegador de quien mira la app. Las tipografías vienen de Google Fonts.
