# aivital-nasa-2026-front

Front del equipo **AIVital** para NASA Space Apps 2026. Maqueta de **Preaviso**: una plataforma que toma la
predicción de incendios y humo y la convierte cada mañana en acciones con responsable.

El back vive en un repo aparte (`aivital-incendios-back`) y publica archivos estáticos según su
contrato 0.2 (la copia local del back en `../aivital-incendios-back` sigue en 0.1). Investigación y documentos: Google Drive,
`space-apps-26-aivital`.

## Objetivo

Mostrar cómo se pasa de mirar incendios a actuar antes: riesgo de foco, humo esperado y alza de urgencias
respiratorias por comuna, ordenados por prioridad, cruzados con los lugares de cada cliente y con protocolos que
dicen qué hacer y quién. Dos fronts: una plataforma web para quien decide y una app de Android para quien está en
terreno. El informe interno de producto, con la definición, la evidencia y el plan de validación, está en
`web/producto.html`.

## Hecho

- Plataforma web sin paso de compilación (HTML, CSS y JavaScript en módulos) en `web/`, con nueve vistas: parte de
  hoy, prioridad, mapa, mis puntos, protocolos, registro, comunas, contraste y fuentes.
- Prioridad por comuna con seis factores de peso editable (`priorizar` en `web/js/logica.js`).
- Ficha de comuna tomada de la guía del back: calendario de 25 años, serie armonizada frente a la cruda, mes contra
  lo normal, total por año, descarga de focos por rango y enlace `?comuna=05109`.
- Lectura del contrato 0.2 del back en `https://marcelo-corro.github.io/aivital-incendios-datos/`: contornos,
  calendario y focos reales de 345 comunas (14-11-2026). Si el back no responde, usa la copia de ejemplo.
- Vista de terreno (`web/movil.html`) y app de Android (`app-android/`, Capacitor 8.5.3) con alertas, vibración,
  tareas por rol y casilla de hecho. APK de prueba instalado en un S20 y alerta de un evento simulado comprobada.
- Envío del parte: botones de WhatsApp y correo en la web, `scripts/parte.mjs` para sacar el texto y
  `scripts/enviar_alertas_wsp.sh` para mandar las alertas nuevas por el servicio de WhatsApp de serverus (probado
  con un chat propio el 14-11-2026).
- Datos de ejemplo de 26 comunas y 37 puntos (`scripts/generar_datos_sinteticos.py`). Los 26 códigos de comuna se
  compararon con los contornos del back.
- Pruebas de las reglas (`tests/logica.test.mjs`, 16).
- Dos presentaciones en HTML (`presentaciones/`), generadas con `presentaciones/generar.py`.
- Servicio en aivital-box, puerto 7093 (`aivital-incendios-front.service`).

## Falta

- El back todavía no publica riesgo ni métricas: el pronóstico, el humo, la salud, la presión de ignición y el
  contraste son de ejemplo. Hay que acordar con el back la extensión (`web/datos/ext/`).
- Programar el envío por WhatsApp (falta decidir el chat de destino y cada cuánto) y el aviso con la app cerrada
  (hoy la app avisa solo abierta).
- Textos en inglés para la demo de Space Apps.
- Carga de puntos desde una planilla y guardar acciones, umbrales y pesos en un servidor (hoy quedan en cada navegador).
- Medir en dinero el ahorro del cliente (ver "Valor en dinero" en el informe).

## Cómo correrlo

```bash
python3 scripts/generar_datos_sinteticos.py      # regenera web/datos/
python3 -m http.server 7093 --directory web      # abrir http://localhost:7093
node --test tests/logica.test.mjs                # pruebas
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
| Extensión propuesta | `BASE_EXT` en `config.js`, o `?ext=https://.../` en la URL |
| Un endpoint con otra forma | La función correspondiente de `api.js` |

Si el back publica riesgo, la app arma un solo día con `riesgo/ultimo.json` y las capas de humo y salud quedan sin
dato. Si el riesgo viene vacío, como hoy, usa el pronóstico de ejemplo y lo avisa en la franja amarilla.

## Estructura

```
├── scripts/                              # datos de ejemplo, parte en texto, evento simulado, compilar el APK
├── tests/logica.test.mjs                 # reglas de aviso, prioridad, historia y contraste
├── presentaciones/                       # generar.py y los dos pitch en HTML
├── app-android/                          # proyecto Capacitor: configuración, ícono y APK
└── web/                                  # lo que se publica
    ├── index.html                        # plataforma web
    ├── movil.html                        # vista de terreno (portada de la app)
    ├── producto.html                     # informe interno de producto, con fuentes
    ├── css/  js/  img/
    ├── datos/                            # copia de ejemplo del contrato 0.2
    │   └── ext/                          # extensión propuesta (sintético)
    └── vendor/leaflet/                   # Leaflet 1.9.4, licencia BSD de 2 cláusulas
```

El mapa base se pide a OpenStreetMap desde el navegador de quien mira la app. Las tipografías vienen de Google Fonts.
