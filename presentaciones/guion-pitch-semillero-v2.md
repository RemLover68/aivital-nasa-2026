# Guion del pitch de Preaviso (v2): estructura del pitch del Semillero

Duración objetivo: 3 minutos. Texto hablado: 395 palabras contadas en la tabla, cerca de 2.8 minutos a 140 palabras por minuto (se ajustan con las pausas).
Láminas: `preaviso-pitch-semillero-v2.html` (10 láminas; la 10 es de fuentes y no se habla).
Cambios respecto de la v1, a partir de la revisión de un jurado de innovación: se abre con la escena del 17 de enero y no con el nombre del equipo; la tarjeta de producto muestra la salida concreta; se agrega un dato propio de resultado (al aviso, los incendios grandes se parecen a los demás); se fija un criterio de éxito numérico para el piloto; se recorta el guion; "cliente" pasa a "primer cliente objetivo"; el cierre es una promesa comprobable.

| # | Lámina | Tiempo | Texto |
|---|---|---|---|
| 1 | Gancho | 18 s | El 17 de enero de 2026 empezaron 67 incendios en un solo día, y 12 de ellos llegaron a 50 hectáreas o más. Si eras el despachador, ¿cuál atendías primero? Somos AIVital y esto es Preaviso. |
| 2 | Problema | 22 s | Chile destina más de 160 mil millones de pesos por temporada a prevenir y combatir incendios. Y 122 incendios, el 2,4 % del total, queman el 87 % de las hectáreas. |
| 3 | Producto | 28 s | Preaviso ordena los incendios del día. Calcula la probabilidad de que cada uno no se controle ese día, explica por qué, y muestra qué hospitales o subestaciones quedan en su camino. Decide siempre la persona. La tarjeta es una maqueta. |
| 4 | Quién hace qué | 20 s | Botón Rojo, de CONAF, anticipa las comunas con riesgo antes del fuego. Wildfire Analyst simula un incendio a la vez. Firecatch y OroraTech detectan que hay fuego. Nosotros ordenamos todos los incendios del día. No encontramos otra herramienta que lo haga; es una búsqueda propia, no una certeza. |
| 5 | Avance | 12 s | Ya trabajamos con datos reales: 182 capas públicas de CONAF, 5.117 incendios con su hora de inicio, y 153 bases de datos mapeadas. La pantalla de despacho es lo que sigue. |
| 6 | Validación 1 | 28 s | Un dato propio. Al momento del aviso, un incendio que será grande se parece a los demás: el 71 % de los grandes empieza entre las 13 y las 18 horas, y el 66 % del resto también. Por eso hacen falta clima, relieve y satélite. Un estudio de Estados Unidos con 38 mil incendios encontró señal así. Si ocurre en Chile es lo primero que medimos. |
| 7 | Validación 2 | 32 s | Nuestro primer cliente objetivo es CONAF, que pasa a ser SERNAFOR. Hay precedente: el Consejo Regional de Biobío aprobó 1.361 millones de pesos para cámaras de CONAF. Aún no hemos conversado con ellos: es nuestra hipótesis. Proponemos una prueba con la temporada pasada, revisada por un despachador, y luego una temporada en modo sombra. Criterio de éxito: que dos de cada tres incendios grandes queden en el primer tercio de la lista. Al azar, uno de cada tres. |
| 8 | Modelo | 12 s | Licencia anual por región, con un piloto sin costo. Después, la capa de exposición para Senapred y municipios. El precio lo fijaremos en el piloto. |
| 9 | Cierre | 15 s | Danos una hora con un despachador y repetimos el 17 de enero con nuestra lista. Que sea él quien diga si habría cambiado una decisión. Muchas gracias. |

## Fuentes de cada cifra
- Más de 160 mil millones por temporada: ministra de Agricultura, 11 de nov. de 2025. https://www.minvu.gob.cl/noticia/gobierno-presenta-los-avances-de-la-estrategia-integral-para-prevenir-incendios-forestales-ante-inicio-de-temporada-de-alto-riesgo/
- 67 y 12 del 17 de enero; 122 incendios, 87,1 %; 71 % y 66 % entre 13 y 18 h; matorral y sin combustible: cálculo propio sobre el registro público de CONAF (capa `incendios_totales`, jul. 2025 a may. 2026). https://services5.arcgis.com/A1ELWse9bRAi2JiV/arcgis/rest/services/incendios_totales/FeatureServer/0
- Dos aviones y brigada, 77 aeronaves: DF, 9 de enero de 2025. https://www.df.cl/economia-y-politica/pais/conaf-advierte-alto-riesgo-de-incendios-este-domingo-con-evento
- Wildfire Analyst en CONAF desde 2011: presentación de CONAF, 2019. https://cifag.cl/wp-content/uploads/2019/04/Presentacion-CONAF-Talca-19-03-2019.pdf
- SERNAFOR (Ley 21.744): Terram, 2025. https://www.terram.cl/descargar/Balance-Ambiental-2025-Forestal.pdf.
- Cámaras de Biobío, $1.361.392.000 (15 cámaras): Emol, 8 de enero de 2024. https://www.emol.com/noticias/Nacional/2024/01/08/1117761/prevencion-incendios-conaf-verano-2024.html
- Estudio de EE. UU. (38.128 incendios): WildfireIA. https://labrai.github.io/WildfireIA/

## Notas de ejecución
- El gancho se dice despacio y se espera un segundo tras la pregunta.
- Decir en voz alta: "la tarjeta es una maqueta" y "aún no hemos conversado con ellos".
- El 87 % describe lo ocurrido; no es una promesa de predicción. El dato de la lámina 6 es la razón de que haga falta un motor.
- El criterio de éxito (2 de cada 3 en el primer tercio) es una propuesta nuestra, no un resultado. Si preguntan de dónde sale: el azar daría 1 de cada 3.
- Preguntas duras probables: (1) ¿ya lo hace Wildfire Analyst? (simula un incendio a la vez; no encontramos un ordenador de todos; es búsqueda propia). (2) ¿Quién paga? (presupuesto de CONAF o financiamiento regional; no hay precio aún). (3) Si un despachador con 20 años de experiencia ya prioriza bien, ¿en qué caso habría cambiado una decisión? (eso es exactamente lo que mide la prueba con un despachador, y por eso la pedimos).
- Si vas corto de tiempo: cortar la lámina 5 y dejar la 8 en una frase.
- Pendiente: ensayar con cronómetro.
