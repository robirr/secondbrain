#!/usr/bin/env bash
# Startet qmd (im Hintergrund) UND nginx (im Vordergrund) in EINEM Container.
# Die UI ist sofort erreichbar; die Suche wird aktiv, sobald qmd bereit ist.
set -u

QMD_PORT=8181
VAULT="${VAULT:-/usr/share/nginx/html/data}"
export QMD_URL="${QMD_URL:-http://127.0.0.1:${QMD_PORT}}"

# 1) nginx-Konfiguration aus Vorlage erzeugen (interner qmd-Proxy)
mkdir -p /etc/nginx/conf.d
envsubst '${QMD_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

# 2) qmd im Hintergrund vorbereiten & starten — blockiert die UI nicht
(
  mkdir -p "$HOME"
  cd "$HOME" || exit 0   # relative Index-DB landet dann im persistenten Volume

  if [ -d "$VAULT" ]; then
    if ! qmd collection list 2>/dev/null | grep -qw brain; then
      echo "[qmd] Sammlung 'brain' anlegen -> $VAULT"
      qmd collection add "$VAULT" --name brain || true
      qmd context add qmd://brain "Persoenlicher Second Brain" || true
    fi
    echo "[qmd] Index aktualisieren ..."
    qmd update || true
    echo "[qmd] Embeddings erzeugen (erster Start laedt lokale Modelle, ~2-3 GB, dauert) ..."
    qmd embed || true
  else
    echo "[qmd] Kein Vault unter $VAULT gemountet — Suche bleibt inaktiv, App laeuft weiter."
  fi

  echo "[qmd] MCP-HTTP-Dienst auf :$QMD_PORT starten ..."
  exec qmd mcp --http --port "$QMD_PORT"
) &

# 3) nginx im Vordergrund = Hauptprozess des Containers
echo "[app] nginx startet auf :80"
exec nginx -g 'daemon off;'
