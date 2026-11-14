#!/usr/bin/env bash
# Manda por WhatsApp las alertas que todavía no se han avisado. Usa el servicio de WhatsApp que corre en serverus,
# así que el mensaje sale desde la cuenta de quien tiene ese servicio.
#   PREAVISO_WSP_CHAT="nombre exacto del chat" scripts/enviar_alertas_wsp.sh
# No está programado: se corre a mano o desde un temporizador cuando se decida a quién avisar y cada cuánto.
set -euo pipefail
cd "$(dirname "$0")/.."
CHAT="${PREAVISO_WSP_CHAT:?Falta PREAVISO_WSP_CHAT con el nombre exacto del chat de destino}"
WA="${PREAVISO_WA_MJS:-$HOME/.claude/skills/whatsapp/wa.mjs}"
NODO_REMOTO="${PREAVISO_NODE_REMOTO:-/home/desanto/.local/bin/node}"

TEXTO="$(node scripts/parte.mjs --nuevas)"
if [ -z "$TEXTO" ]; then echo "Sin alertas nuevas: no se envía nada."; exit 0; fi

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
printf '%s' "$CHAT" > "$TMP/chat"; printf '%s' "$TEXTO" > "$TMP/texto"
R="/tmp/preaviso-wsp-$$"
ssh -o BatchMode=yes serverus "mkdir -p $R"
scp -q -o BatchMode=yes "$WA" "$TMP/chat" "$TMP/texto" "serverus:$R/"
SALIDA="$(timeout 300 ssh -o BatchMode=yes serverus "$NODO_REMOTO $R/wa.mjs enviar \"\$(cat $R/chat)\" \"\$(cat $R/texto)\"; rm -rf $R")"
echo "$SALIDA" | head -c 400; echo
if echo "$SALIDA" | grep -q '"ok": *true'; then
  node scripts/parte.mjs --marcar
  echo "Enviado a: $CHAT"
else
  echo "No se envió. Las alertas quedan pendientes para el próximo intento." >&2
  exit 1
fi
