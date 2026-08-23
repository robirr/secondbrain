#!/usr/bin/env bash
# Startet qmd (im Hintergrund) UND nginx (im Vordergrund) in EINEM Container.
# Der qmd-Dienst startet SOFORT (lexikalische Suche gleich verfügbar); die
# Embeddings werden PARALLEL im Hintergrund erzeugt (Bedeutungssuche kommt dazu,
# sobald sie fertig sind). Nichts blockiert die UI oder den Neustart.
set -u

QMD_PORT=8181
VAULT="${VAULT:-/usr/share/nginx/html/data}"
export QMD_URL="${QMD_URL:-http://127.0.0.1:${QMD_PORT}}"

# qmd bindet seinen HTTP-Dienst an "localhost". Ohne diese Zeile löst Node das in
# manchen Containern zu IPv6 (::1) auf — dann kommt nginx (127.0.0.1) nicht dran und
# die Suche schlägt fehl. IPv4-first erzwingen -> qmd lauscht auf 127.0.0.1.
export NODE_OPTIONS="--dns-result-order=ipv4first${NODE_OPTIONS:+ $NODE_OPTIONS}"

# 1) nginx-Konfiguration aus Vorlage erzeugen (interner qmd-Proxy)
mkdir -p /etc/nginx/conf.d
envsubst '${QMD_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 2) Katalog + Landkarte + Verbindungen ableiten. Schreibt AUSSCHLIESSLICH die drei
#    Dateien INDEX.md, graph.json und integrations.json in die Vault-Wurzel; .md-Notizen
#    werden nur gelesen. Abschaltbar mit BRAIN_BUILD_INDEX=0.
build_index() {
  if [ "${BRAIN_BUILD_INDEX:-1}" != "1" ]; then
    echo "[index] abgeschaltet (BRAIN_BUILD_INDEX=0) — vorhandene Dateien bleiben."
    return
  fi
  if [ ! -d "$VAULT" ]; then
    echo "[index] kein Vault unter $VAULT gemountet — nichts abzuleiten."
    return
  fi
  # Sicherung: sieht der Ordner ueberhaupt wie ein Vault aus? (mindestens ein NN-Cluster)
  if ! ls -d "$VAULT"/[0-9][0-9]-* >/dev/null 2>&1; then
    echo "[index] $VAULT enthaelt keinen Cluster-Ordner (NN-Name) — sicherheitshalber nichts geschrieben."
    return
  fi
  if ! touch "$VAULT/.brain-write-probe" 2>/dev/null; then
    echo "[index] Vault ist read-only gemountet — INDEX.md/graph.json/integrations.json bleiben unveraendert."
    echo "[index] Fuer automatisches Ableiten in docker-compose.yml den Mount von :ro auf :rw stellen."
    return
  fi
  rm -f "$VAULT/.brain-write-probe"
  echo "[index] Katalog, Landkarte und Verbindungen ableiten ..."
  if VAULT_ROOT="$VAULT" node /app/scripts/build-index.mjs; then
    echo "[index] fertig."
  else
    echo "[index] fehlgeschlagen — der alte Stand bleibt liegen."
  fi
}

# 3) qmd im Hintergrund vorbereiten & starten — blockiert die UI nicht
(
  cd "$HOME" 2>/dev/null || true   # relative Index-DB landet dann im persistenten Volume

  build_index                      # erst ableiten, dann indexieren: qmd sieht den neuen Stand

  if [ -d "$VAULT" ]; then
    if ! qmd collection list 2>/dev/null | grep -qw brain; then
      echo "[qmd] Sammlung 'brain' anlegen -> $VAULT"
      qmd collection add "$VAULT" --name brain || true
      qmd context add qmd://brain "Persoenlicher Second Brain" || true
    fi
    echo "[qmd] Index aktualisieren ..."
    qmd update || true
  else
    echo "[qmd] Kein Vault unter $VAULT gemountet — Suche bleibt inaktiv, App laeuft weiter."
  fi

  echo "[qmd] MCP-HTTP-Dienst auf :$QMD_PORT starten (Suche sofort verfuegbar) ..."
  qmd mcp --http --port "$QMD_PORT" &
  MCP_PID=$!

  # Embeddings PARALLEL nachziehen — Bedeutungssuche danach verfuegbar.
  # Erststart laedt einmalig das lokale Modell (~350 MB) und kann dauern;
  # laeuft aber im Hintergrund, waehrend der Dienst schon lexikalisch antwortet.
  if [ -d "$VAULT" ]; then
    ( echo "[qmd] Embeddings im Hintergrund erzeugen ..."; qmd embed && echo "[qmd] Embeddings fertig." || echo "[qmd] embed uebersprungen/fehlgeschlagen." ) &
  fi

  wait "$MCP_PID"
) &

# 4) Capture-Server: Push-Kanal fuer Hermes und andere Agenten (POST /capture -> 00-Inbox/hermes).
#    Startet NUR mit gesetztem CAPTURE_TOKEN -- ein offener Endpunkt liesse jeden im Netz in den
#    Vault schreiben. Und nur, wenn der Vault beschreibbar ist; bei :ro waere er sinnlos.
if [ -n "${CAPTURE_TOKEN:-}" ]; then
  if touch "$VAULT/.brain-write-probe" 2>/dev/null; then
    rm -f "$VAULT/.brain-write-probe"
    echo "[capture] starte Push-Kanal auf Port ${CAPTURE_PORT:-8765}"
    ( VAULT_ROOT="$VAULT" node /app/scripts/capture-server.mjs & )
  else
    echo "[capture] Vault ist read-only gemountet - Push-Kanal nicht gestartet."
  fi
else
  echo "[capture] kein CAPTURE_TOKEN gesetzt - Push-Kanal bleibt aus (so gewollt, siehe docker-compose.yml)."
fi

# 5) nginx im Vordergrund = Hauptprozess des Containers
echo "[app] nginx startet auf :80"
exec nginx -g 'daemon off;'
