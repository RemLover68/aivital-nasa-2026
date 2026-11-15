# Guion del pitch de Preaviso (v1): estructura del pitch del Semillero

Duración objetivo: 3 minutos (180 s). Texto hablado: 485 palabras contadas en la tabla, cerca de 3:30 a ritmo normal (140 palabras por minuto): se pasa de los 3 minutos. La v2 lo corrige.
Láminas: `preaviso-pitch-semillero-v1.html` (11 láminas; la 11 es de fuentes y no se habla).
Estructura tomada del guion del Demo Day del Semillero (Intake Assist). Cambios respecto de aquel: se quita la lámina de uso de fondos (esta vez no hubo financiamiento) y la frase de iteración con usuarios (no iteramos con ellos). Se mantienen problema, momento crítico, producto, quién hace qué, avance, validación en dos láminas, oportunidad y modelo, y cierre.

| # | Lámina | Tiempo | Texto |
|---|---|---|---|
| 1 | Portada | 5 s | Buenas tardes. Somos AIVital y les presentamos Preaviso: una herramienta para decidir qué incendio atender primero. |
| 2 | Problema | 17 s | Chile destina más de 160 mil millones de pesos por temporada a prevenir y combatir incendios forestales. Y el registro de CONAF muestra algo llamativo: 122 incendios, el 2,4 % del total, queman el 87 % de las hectáreas. |
| 3 | Momento crítico | 20 s | El 17 de enero de 2026 empezaron 67 incendios en un solo día, 12 de ellos llegaron a 50 hectáreas o más. CONAF manda dos aviones y una brigada helitransportada apenas sabe hacia dónde va el fuego, con unas 77 aeronaves para toda la temporada. Hay que elegir en minutos. |
| 4 | Producto | 28 s | Preaviso hace tres cosas. Cuando avisan un incendio, entra solo desde el registro y el satélite. Calcula la probabilidad de que no se controle ese día, explica por qué, y muestra qué hospitales, subestaciones y colegios quedan en su camino, con una hora aproximada. Y entrega al despachador la lista ordenada. Decide siempre la persona. Esta tarjeta es una maqueta. |
| 5 | Quién hace qué | 25 s | Hoy cada herramienta mira una parte. Botón Rojo, de CONAF, anticipa las comunas con riesgo antes del fuego. Wildfire Analyst, que CONAF usa desde 2011, simula un incendio a la vez. Firecatch, en Chile, y OroraTech detectan que hay fuego. Nosotros ordenamos todos los incendios del día, con el porqué y lo que hay en su camino, sobre lo que CONAF ya usa. No encontramos otra herramienta que lo haga; es una búsqueda propia, no una certeza. |
| 6 | Avance | 15 s | Ya trabajamos con datos reales: descargamos 182 capas públicas de CONAF, con 5.117 incendios, cada uno con su hora de inicio, y mapeamos 153 bases de datos para sumar clima y satélite. La pantalla de despacho es lo que sigue en construcción. |
| 7 | Validación 1 | 20 s | Lo que comprobamos en el registro: 686 incendios no se controlaron el día en que empezaron y reúnen el 88 % de las hectáreas. Un estudio de Estados Unidos con más de 38 mil incendios muestra que el fracaso del primer ataque se puede anticipar con datos del momento del aviso. Eso describe lo ocurrido; que se pueda en Chile es lo primero que vamos a medir. |
| 8 | Validación 2 | 25 s | Nuestro cliente es CONAF, que pasa a ser SERNAFOR. Hay un precedente: el Consejo Regional de Biobío aprobó 1.361 millones de pesos para cámaras de detección de CONAF. Aún no hemos conversado con CONAF; este camino es nuestra hipótesis. Primero, una prueba retrospectiva con la temporada pasada. Segundo, un despachador revisa los casos. Tercero, una temporada en modo sombra, sin tocar el despacho. |
| 9 | Oportunidad y modelo | 18 s | Cobramos una licencia anual por región, empezando con un piloto sin costo. Después, la capa de exposición para Senapred y municipios. El precio lo fijaremos en el piloto: como referencia de escala, una región aprobó 1.361 millones por 15 cámaras. |
| 10 | Cierre | 15 s | Les dejo una pregunta: ¿qué incendio habrían atendido primero el 17 de enero? Pedimos una hora con una jefatura regional de CONAF para repetir ese día con su despachador. Muchas gracias. |

## Fuentes de cada cifra
- Más de 160 mil millones por temporada: ministra de Agricultura, 11 de nov. de 2025. https://www.minvu.gob.cl/noticia/gobierno-presenta-los-avances-de-la-estrategia-integral-para-prevenir-incendios-forestales-ante-inicio-de-temporada-de-alto-riesgo/
- 122 incendios, 87,1 %, 78.568 ha, 686 no controlados el mismo día, 17 de enero (67 y 12): cálculo propio sobre el registro público de CONAF (capa `incendios_totales`, jul. 2025 a may. 2026). https://services5.arcgis.com/A1ELWse9bRAi2JiV/arcgis/rest/services/incendios_totales/FeatureServer/0
- Despacho de dos aviones y brigada, 77 aeronaves: DF, 9 de enero de 2025. https://www.df.cl/economia-y-politica/pais/conaf-advierte-alto-riesgo-de-incendios-este-domingo-con-evento
- Wildfire Analyst en CONAF desde 2011: presentación de CONAF, 2019. https://cifag.cl/wp-content/uploads/2019/04/Presentacion-CONAF-Talca-19-03-2019.pdf
- Cámaras de Biobío, $1.361.392.000: Emol, 8 de enero de 2024. https://www.emol.com/noticias/Nacional/2024/01/08/1117761/prevencion-incendios-conaf-verano-2024.html
- Estudio de EE. UU. (38.128 incendios): WildfireIA. https://labrai.github.io/WildfireIA/

## Notas de ejecución
- Cifras que se dicen tal cual: 160 mil millones, 2,4 %, 87 %, 67 y 12, 686 y 88 %, 1.361 millones. Decirlas despacio.
- Decir en voz alta antes de que pregunten: "Aún no hemos conversado con CONAF" y "la tarjeta es una maqueta".
- El 87 % y el 88 % describen lo ocurrido. No son una promesa de predicción. Si preguntan por qué se puede predecir, la respuesta es el estudio de EE. UU. más la prueba retrospectiva que vamos a hacer.
- Evitar siglas sin explicar (SIDCO, FNDR). Decir "el sistema de registro de CONAF" y "financiamiento regional".
- Si vas corto de tiempo: acortar la lámina 6 a una frase y la 9 a "licencia anual por región, con piloto sin costo".
- Preguntas probables: ¿ya tienen CONAF y Wildfire Analyst algo igual? (no encontramos un ordenador de todos los incendios; es búsqueda propia); ¿quién paga? (presupuesto de CONAF o financiamiento regional; no hay precio aún); ¿y si el modelo se equivoca? (decide siempre la persona, modo sombra una temporada).
- Pendiente: ensayar con cronómetro.
