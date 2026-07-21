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
# danach erreichbar unter  http://<NAS-IP>:8080
```
Das Image baut die App (Vite) und liefert sie statisch über nginx aus (SPA-Fallback).
Port anpassen in `docker-compose.yml` (Standard `8080:80`).

Ohne Compose:
```bash
docker build -t second-brain-app .
docker run -d --restart unless-stopped -p 8080:80 --name second-brain-app second-brain-app
```

## Struktur
- `src/components/` — Sidebar, Topbar, Search, ViewSwitcher, RingView, CloudView, LayerView,
  GraphView, GlobeView, InspectorPanel, ViewSettingsPanel, RightPanel, Starfield
- `src/data/` — `demo.ts` (Knoten/Kanten), `clusters.ts` (Farben)
- `src/store.ts` — Zustand (Auswahl, Hover, Ansicht-Einstellungen, Filter)
