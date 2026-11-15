# aivital-nasa-2026-front

Front del equipo **AIVital** para NASA Space Apps 2026. Maqueta de **Preaviso**: una plataforma que toma la
predicción de incendios y humo y la convierte cada mañana en acciones con responsable.

El back vive en un repo aparte (`aivital-incendios-back`) y publica archivos estáticos según su
contrato 0.2 (la copia local del back en `../aivital-incendios-back` sigue en 0.1). Investigación y documentos: Google Drive,
`space-apps-26-aivital`.

## Objetivo

Que el personal municipal vea, para un periodo fijo (esta semana, la próxima, dentro de dos semanas, este mes, el próximo), qué
comunas de Chile tienen más riesgo de incendio y, dentro de su comuna, en qué celdas se concentra. Por comuna y por celda muestra la
probabilidad de que ocurra un incendio, el tamaño esperado, las causas con su porcentaje (modificables o no por el municipio) y
recomendaciones solo sobre las modificables, con reducción de probabilidad, costo, beneficio en pesos y razón beneficio/costo.
Cliente: municipios. Todo se recalcula al elegir el rango. El contrato de datos que debe publicar el back está en
`web/datos/ext/CONTRATO.md`.

## Hecho

- Plataforma web sin compilación (`web/`): vista Chile (mapa de calor por comuna sobre los 345 contornos del back, comunas más riesgosas,
  buscador), vista comuna (grilla de 8x8 a 12x12 celdas con mapa de calor propio, detalle por celda, causas, recomendaciones con selector
  de orden y supuestos editables) y "Metodología y fuentes".
- Reglas puras en `web/js/prediccion.js` (beneficio, razón beneficio/costo, orden, rangos). Lectura con fallback en `web/js/api.js`:
  pide a `BASE_PREDICCION` (`config.js`, o `?pred=`) y, si falla, usa la copia de ejemplo de `web/datos/ext/`.
- Respaldo sintético (`web/js/sintetico.js`): si una comuna no tiene datos en el back ni en la copia de ejemplo (319 de las 345), su
  detalle se calcula en el navegador con la misma fórmula y una semilla fija por comuna. El pie de página lo dice.
- Diseño (14-11-2026): fondo con imagen satelital difuminada de Chile central (NASA Worldview, MODIS Terra, `web/img/fondo-difuminado.jpg`)
  bajo un velo claro, paneles casi opacos con bordes redondeados, nivel de riesgo dicho con palabras además del color, las 4 causas
  principales a la vista y el resto plegado. El periodo se elige en la barra superior y el mapa usa todo el alto de la pantalla, sin
  desplazar la página. El origen de los datos (ejemplo o sintético) se dice solo en el pie y en Metodología, sin aviso superior.
- Datos de ejemplo deterministas (`scripts/generar_prediccion.py`, semilla por comuna): 345 comunas x 5 rangos y detalle de 26 comunas.
  Todo se ve marcado como "ejemplo" en pantalla. Contornos de respaldo: `scripts/preparar_contornos.py`.
- Lectura del contrato 0.2 del back (contornos reales de 345 comunas). Vista de terreno (`web/movil.html`) y app de Android
  (`app-android/`) intactas: siguen con el producto anterior (alertas, protocolos) y sus datos de ejemplo.
- Pruebas: 35 (`tests/logica.test.mjs` del producto anterior, `tests/prediccion.test.mjs` del nuevo).
- Dos presentaciones en HTML (`presentaciones/`) y servicio en aivital-box, puerto 7093.

## Falta

- El back no publica la predicción: todo número es de ejemplo. Hay que acordar el contrato (`web/datos/ext/CONTRATO.md`), en
  especial cómo se calculan las causas (contribución al modelo), `vidas_si_incendio` y los costos de cada acción.
- Los supuestos (valor de vida estadística, valor de propiedad por hectárea, costo de combate) y los costos de las acciones son
  inventados: validar con fuentes y con un municipio.
- Probar con personal municipal si la grilla y el orden de recomendaciones bastan; textos en inglés para la demo.
- `web/movil.html`, `web/producto.html` y la app de Android quedaron del producto anterior y ya no se enlazan desde la web; decidir si se actualizan o se retiran.
- Medir el beneficio en dinero con datos reales y guardar los supuestos en un servidor (hoy quedan en cada navegador).

## Cómo correrlo

```bash
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
ssh serverus 'cd ~/preaviso-build && bash scripts/compilar_apk.sh "http://100.93.24.53:7093/"'   # dirección del servidor de datos
ssh serverus 'adb -s 100.88.165.6:5555 install -r ~/preaviso-build/app-android/android/app/build/outputs/apk/debug/app-debug.apk'
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
