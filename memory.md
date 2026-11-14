# memory.md · aivital-nasa-2026-front

## Preferencias y correcciones del usuario
- El producto debe permitir actuar, no solo mirar: cada pantalla termina en una acción con responsable.
- Lo que un competidor hace bien se adopta. La diferenciación está en traducir el riesgo a consecuencias para personas.
- El acierto del motor es tema del pitch, no una función del producto.
- El back no se toca desde este repo.
- Primero se deja lista la definición del producto y las presentaciones, y se avisa dónde quedan. WhatsApp va al final (14-11-2026).
- El pitch parte con el impacto en dinero. Todo lo que se use se cuantifica en dinero, con fuente (14-11-2026).
- Las presentaciones van fuera del Drive, en `presentaciones/`.

## Pendientes por confirmar
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
