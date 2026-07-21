# Second Brain — Ansicht

Visuelle Überblick-Oberfläche für das Second-Brain-System: zentraler KI-Orchestrator, Systemkern,
Wissenscluster, Projekte und externe Systeme in mehreren Ansichten (Architektur/Ring, Ebenen,
Globus, Cloud, Graph). Dark-Mode, Glassmorphism, Suche, Filter, Detail-Inspector.

> Nutzt aktuell **Demo-Daten** (`src/data/demo.ts`). Nächster Schritt: an reale Daten
> (`graph.json` / Vault) koppeln.

**Stack:** React 19 · TypeScript · Vite · Tailwind v4 · Zustand · lucide-react · Three.js / R3F (Globus).

## Entwicklung
```bash
npm install
npm run dev        # http://localhost:5173
```

## Deployment via Docker (z. B. auf dem NAS)
```bash
# im Projektordner
docker compose up -d --build
# danach erreichbar unter  http://<NAS-IP>:8686
```
Das Image baut die App (Vite) und liefert sie statisch über nginx aus (SPA-Fallback).
Port anpassen in `docker-compose.yml` (Standard `8686:80`).

Ohne Compose:
```bash
docker build -t second-brain-app .
docker run -d --restart unless-stopped -p 8686:80 --name second-brain-app second-brain-app
```

## Produktive Daten einbinden (NAS)
Die produktiven Daten liegen auf dem NAS und werden read-only in den Container gemountet.
```bash
cp .env.example .env
# in .env den Pfad setzen, z.B.:
# SECOND_BRAIN_DATA=/mnt/user/appdata/secondbrain/data
docker compose up -d --build
```
Der Ordner wird unter `/data` im Container bereitgestellt (die App lädt daraus z.B. `graph.json`).
Ist `SECOND_BRAIN_DATA` nicht gesetzt, wird `./data` verwendet.

> Status: das Mount/Pfad-Setup ist fertig. Das Laden der realen Daten in die Ansichten
> (Mapping `graph.json` → Knoten/Cluster) ist der nächste App-Schritt.

## qmd-Bedeutungssuche (Suchfeld oben links)
Das Suchfeld oben links in der Sidebar nutzt **qmd** (lokale Hybridsuche über die echten Notizen).
Die App ruft gleich-Origin `/qmd/query` auf; nginx (prod) bzw. Vite (dev) proxen das an den
qmd-HTTP-Dienst.

**qmd-Dienst auf dem NAS starten:**
```bash
qmd mcp --http --daemon        # Port 8181; qmd muss die Vault-Collection kennen (qmd collection add …)
```
Adresse in `.env` setzen (Standard `host.docker.internal:8181`, alternativ NAS-IP):
```
QMD_URL=http://192.168.1.20:8181
```
Läuft kein qmd-Dienst, zeigt das Feld „qmd nicht erreichbar" — die App bleibt sonst voll funktionsfähig.

## Struktur
- `src/components/` — Sidebar, Topbar, Search, ViewSwitcher, RingView, CloudView, LayerView,
  GraphView, GlobeView, InspectorPanel, ViewSettingsPanel, RightPanel, Starfield
- `src/data/` — `demo.ts` (Knoten/Kanten), `clusters.ts` (Farben)
- `src/store.ts` — Zustand (Auswahl, Hover, Ansicht-Einstellungen, Filter)
