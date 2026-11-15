# memory.md · aivital-nasa-2026-front

## Preferencias y correcciones del usuario
- El producto debe permitir actuar, no solo mirar: cada pantalla termina en una acción con responsable.
- Lo que un competidor hace bien se adopta. La diferenciación está en traducir el riesgo a consecuencias para personas.
- El acierto del motor es tema del pitch, no una función del producto.
- El back no se toca desde este repo.
- Primero se deja lista la definición del producto y las presentaciones, y se avisa dónde quedan. WhatsApp va al final (14-11-2026).
- El pitch parte con el impacto en dinero. Todo lo que se use se cuantifica en dinero, con fuente (14-11-2026).
- Las presentaciones van fuera del Drive, en `presentaciones/`.

- Producto nuevo (14-11-2026): usuario = personal municipal, cliente = municipios; el modelo predice por periodo fijo (5 rangos), con vista Chile y vista comuna con grilla; recomendaciones solo sobre causas modificables.

## Pendientes por confirmar
- Revisión del back contra el commit de esta conexión; el back aún no publica focos satelitales de 2026 ni la probabilidad de no control real.
- Supuestos inventados que revisar: valor de vida estadística $1.500 millones, propiedad $15 millones/ha, combate $2,5 millones/ha, y costos/eficacia de las 4 acciones (`scripts/generar_prediccion.py`).
- Qué predice hoy el motor (riesgo por zona, punto de inicio o avance). De eso depende la capa de prevención de igniciones.
- Si se borran las copias originales de front y back en serverus (`~/jose/`): siguen ahí.
- Extensión del contrato con el back (pronóstico a cinco días, humo, interfaz, presión de ignición, contraste).
- A qué chat de WhatsApp van las alertas y cada cuánto. La prueba fue a "Notas✏️", chat propio de José.
- El ahorro en dinero para un cliente no está medido: faltan costo de un día de faena detenida y costo de urgencia respiratoria en Chile.
- Compilar en rempc no se pudo: desde aivital-box solo entra el acceso del navegador. Se compiló en serverus.

## Decisiones
- 20261114-1335 [aivital-box] front y back copiados de serverus:~/jose a /aivital con rsync, hash idéntico | pedido del usuario | revertir: rm -r /aivital/aivital-nasa-2026-front /aivital/aivital-incendios-back | backup: originales en serverus
- 20261114-1340 [aivital-box] maqueta estática sin compilación (HTML+JS módulos, Leaflet 1.9.4 local) | se conecta a los JSON del contrato sin servidor | revertir: borrar web/ | backup: ninguno
- 20261114-1342 [aivital-box] servicio aivital-incendios-front.service en puerto 7093 (python http.server, usuario aivital) | acceso del equipo | revertir: sudo systemctl disable --now aivital-incendios-front && sudo rm /etc/systemd/system/aivital-incendios-front.service | backup: ninguno
- 20261114-1350 [aivital-box] README reescrito con Objetivo/Hecho/Falta | el anterior decía "por definir" | revertir: copia en serverus:~/jose/aivital-nasa-2026-front/README.md | backup: borrado
- 20261114-1432 [aivital-box] producto.html reemplazado: de ficha comercial a informe interno (problemas, cadena de datos, herramientas, valor, funciones, candidatos, riesgos, validación, brechas, fuentes) | el usuario no quería material de venta | revertir: copia de la ficha anterior en el scratchpad de la sesión, se pierde al limpiar | backup: ficha anterior en scratchpad
- 20261114-1545 [aivital-box] creado /aivital/GoogleDrive/space-apps-26-aivital/continuar-jose.md con estado y pendientes para sesión nueva | pedido de José | revertir: borrar el archivo | backup: ninguno
- 20261114-1610 [aivital-box] segunda iteración del front: vistas prioridad, comunas, contraste y fuentes, vista de terreno, contrato 0.2 con datos reales del back por defecto | encargo de José y guía del back | revertir: git no tiene commits, no hay copia anterior | backup: borrado tras verificar
- 20261114-1625 [serverus] carpeta ~/preaviso-build con copia del repo y proyecto Android generado (Capacitor 8.5.3) | rempc sin acceso, serverus tiene SDK y adb al S20 | revertir: rm -r ~/preaviso-build | backup: ninguno
- 20261114-1627 [S20] instalada la app cl.aivital.preaviso (APK de prueba) y concedido el permiso de avisos por adb | pedido de José | revertir: adb uninstall cl.aivital.preaviso | backup: ninguno
- 20261114-1650 [aivital-box] presentaciones/ con dos pitch HTML y enlace web/presentaciones para verlas en el puerto 7093 | pedido de José, fuera del Drive | revertir: rm -r presentaciones web/presentaciones | backup: ninguno
- 20261114-1700 [aivital-box] producto.html v2 (definición del producto, valor en dinero, fuentes 53 a 57) y copia en el Drive, carpeta "front y producto" | pedido de José | revertir: no hay copia de la v1 | backup: borrado tras comparar
- 20261114-1712 [aivital-box] continuar-jose.md (Drive, front y producto): sección 0 con lo hecho y lo pendiente | continuidad entre sesiones | revertir: borrar la sección 0 | backup: borrado tras comparar
- 20261114-1745 [aivital-box] scripts/enviar_alertas_wsp.sh: manda alertas nuevas por el servicio de WhatsApp de serverus, sin programar | pedido de José, destino por decidir | revertir: borrar el script | backup: ninguno
- 20261114-2040 [aivital-box] web/ reorientada al producto nuevo (vista Chile, vista comuna con grilla, causas, recomendaciones); contrato en web/datos/ext/CONTRATO.md; datos de ejemplo con scripts/generar_prediccion.py | nuevo enfoque para municipios | revertir: git checkout -- . && git clean -fd web tests scripts | backup: commit único
- 20261114-2041 [aivital-box] eliminados web/js/vistas-datos.js y web/css/app.css; nav sin protocolos/registro/contraste/puntos (movil.html y app-android intactos) | ya no calzan con el producto | revertir: git checkout -- web | backup: commit único
- 20261114-2040 [aivital-box] informe-competencia-integrado.html en el Drive (space-apps-26-aivital): une búsqueda de competidores de esta sesión con precision-competidores.html | pedido de José | revertir: borrar el archivo | backup: ninguno
- 20261114-2105 [aivital-box] datos públicos de CONAF (ArcGIS, 182 capas, 814 MB) bajados a /aivital/aivital-datos-conaf (fuera del repo), con manifiesto.json y sha256 | base para el modelo | revertir: rm -r /aivital/aivital-datos-conaf | backup: ninguno
- 20261114-2200 [aivital-box] catálogo de 153 bases, 40 ideas, revisiones y 25 propuestas copiados a Drive space-apps-26-aivital/ideas-y-bases-20261114 | que no se pierdan al limpiar el scratchpad | revertir: borrar la carpeta | backup: ninguno
- 20261114-2200 [aivital-box] web/js/sintetico.js: detalle sintético en el navegador para comunas sin datos del back ni copia de ejemplo; api.js lo usa como último respaldo | pedido de José | revertir: git revert del commit | backup: ninguno
- 20261114-2201 [aivital-box] rediseño de plataforma.css al estilo IntakeAssist (fondo difuminado NASA Worldview, paneles redondeados casi opacos, aviso único, causas plegadas) | pedido de José, con pautas de Axess Lab 2025 y UX Magazine 2014 | revertir: git revert del commit | backup: ninguno
- 20261114-2230 [aivital-box] quitado el aviso superior y las etiquetas de "ejemplo/sintético" (queda en el pie y en Metodología); periodo en la barra superior; mapa a todo el alto sin scroll de página | pedido de José | revertir: git revert del commit | backup: ninguno
- 20261114-2310 [aivital-box] guia-front-mvp.md, lean-canvas-preaviso.md y evaluacion-canvas.md en Drive (front y producto) | pedido de José | revertir: borrar los 3 archivos | backup: ninguno
- 20261114-2300 [aivital-box] sala de triaje (guia-front-mvp.md) como pantalla inicial: vista-triaje.js, triaje.js, scripts/generar_triaje.py, datos triaje-2026-01-16/17/18.json (ejemplo, probabilidad sin usar el resultado real) | pedido de José: producto según la guía, diseño según el actual | revertir: git revert del commit | backup: ninguno
- 20261114-2301 [aivital-box] navegación Triaje, País, Región, Comuna: mapa satelital Esri World Imagery, país por región, región con grilla gruesa, comuna con panel en dos columnas (recomendaciones o causas), leyenda translúcida | pedido de José | revertir: git revert del commit | backup: ninguno
- 20261114-2340 [aivital-box] lean-canvas-preaviso-v2, cliente-ideal y revision-idea-v2 en Drive (front y producto) | pedido de José | revertir: borrar los 3 archivos | backup: ninguno
- 20261114-2355 [aivital-box] presentaciones/preaviso-pitch-semillero-v1.html y v2.html, guion v1 y v2, generar_semillero.py; pitch con estructura del Semillero sin fondos ni iteración; v2 tras revisión de un jurado | pedido de José | revertir: borrar esos 5 archivos | backup: ninguno
- 20261114-2356 [aivital-box] front y producto/mejoras-producto-mitigacion-riesgos.md en Drive | mitigar riesgos detectados | revertir: borrar el archivo | backup: ninguno
- 20261115-0010 [aivital-box] lean-canvas-preaviso-v3.md y guia-front-mvp.md (sección 5b: modo sombra, registro de decisión, sugerencia, criterio de éxito) en Drive front y producto | iterar producto con las mejoras | revertir: borrar v3 y quitar la sección 5b | backup: v2 del canvas queda
- 20261115-0010 [aivital-box] versión fusionada en la rama fusion-pais-region-comuna (País/Región/Comuna con incendios del día encima, selector de día, sin horas ni tablero, alertas con borde); respaldo: rama respaldo-triaje-v1 y etiqueta triaje-v1 | pedido de José | revertir: git switch respaldo-triaje-v1 (el puerto 7093 sirve el árbol de trabajo) | backup: rama y etiqueta en GitHub
- 20261115-0030 [aivital-box] quitada la sugerencia "simular primero" y la historia del pronóstico como función del producto (queda como mejora interna) en canvas v3, guía, mejoras y pitch v1/v2 | pedido de José | revertir: no hay copia; el texto anterior está en esta línea y en la conversación | backup: ninguno
- 20261115-0100 [aivital-box] web/index.html, css/plataforma.css, js/app.js: cabecera reemplazada por menú lateral con día y árbol región/comuna, tarjetas de incendios y alertas, país y región en mitades, leyenda vertical, mapa del país acercado a la zona de incendios, paleta de bomberos y animaciones | pedido de José | revertir: git checkout web/ (los cambios no están commiteados) | backup: git
- 20261115-0100 [aivital-box] presentaciones/preaviso-pitch-inversores-v1.html y guion-pitch-inversores-v1.md hechos con la skill pitch-inversores; guía y mejoras sin modo sombra ni 2 de 3 | pedido de José: pitch tipo inversores, producto a máximo potencial | revertir: borrar esos archivos | backup: ninguno
- 20261115-0130 [aivital-box] presentaciones/preaviso-pitch-inversores-v2.html y guion-pitch-inversores-v2.md (356 palabras, unos 2:35) tras revisión de inversionista escéptico | iterar el pitch | revertir: borrar esos 2 archivos y la función pitch_inv_v2 de generar_semillero.py | backup: v1 queda
- 20261115-0200 [aivital-box] presentaciones/preaviso-pitch-intake-v1.html y guion-pitch-intake-v1.md con la estructura del pitch de Intake Assist (portada, puntos, barra, producto, 4 tarjetas, prototipo, validación, embudo, cierre con QR) | José prefería esa estructura | revertir: borrar esos 2 archivos y las funciones pitch_intake/puntos en generar_semillero.py | backup: v1 y v2 de inversores quedan
- 20261115-0230 [aivital-box] presentaciones/preaviso-pitch-impacto-v2.html y guion-pitch-impacto-v1.md: sin portada, láminas 1-3 con el texto iterado por José, resto con foco en impacto y beneficio | pedido de José | revertir: borrar esos 2 archivos y pitch_impacto*/promedios en generar_semillero.py | backup: intake-v1 y inversores v1/v2 quedan
- 20261115-0230 [aivital-box] web/js/app.js reescrito y web/js/riesgo.js nuevo: País/Región/Comuna leen el back 0.4 (riesgo 24h/48h/7d, alertas/05, sectores, recomendaciones); incendios inventados pasan a «modo visión» apagado con etiqueta grande; IPs del README reemplazadas | encargo del back (José del back) | revertir: git revert del commit | backup: git
