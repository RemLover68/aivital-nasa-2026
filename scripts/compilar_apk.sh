#!/usr/bin/env bash
# Compila la app de Android de Preaviso (APK de prueba). Corre en una máquina con Node, JDK 21 y el SDK de Android.
#   scripts/compilar_apk.sh [dirección del servidor de datos, con / final]
# Deja el APK en app-android/android/app/build/outputs/apk/debug/app-debug.apk
set -euo pipefail
cd "$(dirname "$0")/../app-android"
SERVIDOR="${1:-}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"

# 1. Copia de la web. En la app la portada es la vista de terreno y la plataforma queda como segunda página.
rm -rf www && mkdir www
rsync -a --exclude='*.bak-*' --exclude='presentaciones' ../web/ www/
mv www/index.html www/plataforma.html && mv www/movil.html www/index.html
sed -i 's|href="index.html"|href="plataforma.html"|g' www/plataforma.html www/index.html www/js/movil.js
sed -i 's|href="movil.html"|href="index.html"|g' www/plataforma.html www/js/app.js
sed -i "s|const SERVIDOR_DE_FABRICA = \"\";|const SERVIDOR_DE_FABRICA = \"${SERVIDOR}\";|" www/js/config.js
grep -q "SERVIDOR_DE_FABRICA = \"${SERVIDOR}\"" www/js/config.js

# 2. Dependencias y proyecto nativo (se genera una sola vez).
[ -d node_modules/@capacitor/cli ] || npm install --no-audit --no-fund
[ -d android ] || npx cap add android

# 3. Marca propia: ícono, pantalla de inicio e ícono de los avisos. Se quita lo genérico de la plantilla.
RES=android/app/src/main/res
find "$RES" -name 'splash.png' -delete
find "$RES" -path '*mipmap-*' \( -name 'ic_launcher*.png' -o -name 'ic_launcher*.webp' \) -delete
rm -f "$RES"/drawable/ic_launcher_background.xml "$RES"/drawable-v24/ic_launcher_foreground.xml "$RES"/values/ic_launcher_background.xml
find "$RES" -type d -empty -delete
cp -r recursos/. "$RES"/

# 4. Permisos: leer datos de un servidor sin https dentro de la red privada, vibrar y mostrar avisos.
M=android/app/src/main/AndroidManifest.xml
grep -q 'usesCleartextTraffic' "$M" || sed -i 's|<application|<application android:usesCleartextTraffic="true"|' "$M"
for P in VIBRATE POST_NOTIFICATIONS; do
  grep -q "android.permission.$P" "$M" || sed -i "s|</manifest>|    <uses-permission android:name=\"android.permission.$P\" />\n</manifest>|" "$M"
done

# 5. Sincronizar y compilar.
npx cap sync android
cd android
bash ./gradlew assembleDebug --console=plain
ls -l app/build/outputs/apk/debug/app-debug.apk
