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

# 2) qmd im Hintergrund vorbereiten & starten — blockiert die UI nicht
(
  cd "$HOME" 2>/dev/null || true   # relative Index-DB landet dann im persistenten Volume

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

# 3) nginx im Vordergrund = Hauptprozess des Containers
echo "[app] nginx startet auf :80"
exec nginx -g 'daemon off;'
