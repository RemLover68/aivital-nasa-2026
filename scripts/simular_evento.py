"""Sube el riesgo de una comuna en los datos de ejemplo, para probar que las alertas llegan a la app y a WhatsApp.

    python3 scripts/simular_evento.py 07101     # Talca pasa a riesgo muy alto mañana
    python3 scripts/simular_evento.py --deshacer # vuelve a los datos de ejemplo de siempre

Solo toca web/datos/ext/pronostico.json, que es inventado.
"""

import json
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
RUTA = RAIZ / "web" / "datos" / "ext" / "pronostico.json"

if "--deshacer" in sys.argv:
    subprocess.run([sys.executable, str(RAIZ / "scripts" / "generar_datos_sinteticos.py")], check=True)
    sys.exit(0)

comuna = sys.argv[1] if len(sys.argv) > 1 else "07101"
datos = json.loads(RUTA.read_text(encoding="utf-8"))
item = next((it for it in datos["items"] if it["region_id"] == comuna), None)
if item is None:
    sys.exit(f"La comuna {comuna} no está en el pronóstico de ejemplo.")
d = item["dias"][0]
d.update(prob_foco=0.46, nivel="muy_alto", confianza="alta", pm25_humo=92.0, urgencias_resp_extra_pct=33.1,
         urgencias_resp_extra=round(d["urgencias_resp_base"] * 0.331, 1))
RUTA.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
print(f"{item['nombre']}: mañana con probabilidad de foco 46 % y humo 92 µg/m³ (evento simulado).")
