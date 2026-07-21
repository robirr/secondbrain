# Second Brain

Ein lokales, modell-neutrales Wissenssystem: Notizen als Markdown (einzige Wahrheit), lokale
Bedeutungssuche (qmd), eine KI-gepflegte Wiki-Schicht (markiert Widersprüche statt sie zu
überschreiben) und eine Visualisierungs-App. Läuft komplett auf eigener Hardware (z. B. NAS).

> **Vollständige Nachbau-Anleitung: [`docs/SETUP.md`](docs/SETUP.md).**
> Modell-neutrale Agenten-Regeln: [`AGENTS.md`](AGENTS.md) (bzw. `CLAUDE.md` für Claude Code).

## Repo-Struktur
| Ort | Inhalt |
|-----|--------|
| Wurzel (`src/`, `package.json`, `Dockerfile`, `docker-compose.yml`, `nginx.conf.template`) | **Visualisierungs-App** (React + TS + Tailwind + Three.js) |
| `system/scripts/` | **Pipeline** ohne Geheimnisse: Indexer (`build-index.mjs`), Konnektoren (`pull-*.mjs`, `pull_trilium.py`), Abgleich (`sync.mjs`), Capture (`capture*.mjs`) |
| `system/*.example` | Konfig-Vorlagen (Hosts/Tokens werden lokal gesetzt, nie committet) |
| `docs/SPEZIFIKATION.md` | der „Vertrag" (Ziel, Fähigkeiten, Architektur) |
| `docs/WIKI-SCHEMA.md` | Regeln der KI-gepflegten Wiki-Schicht |
| `docs/SETUP.md` | Schritt-für-Schritt-Nachbau |
| `AGENTS.md` / `CLAUDE.md` | Brain-First-Regelwerk (modell-neutral bzw. für Claude Code) |

**Nicht im Repo:** Notizen, Tokens (`.env`), maschinenspezifische Konfig. Host-IPs sind als `<NAS-IP>` anonymisiert.

## Die App

Ansichten: Architektur/Ring, Ebenen, Globus (WebGL), Cloud, Graph — dieselbe Datenquelle, nur andere
Darstellung. qmd-Bedeutungssuche oben, Detail-Inspector, Cluster-Drilldown bis zur Notiz, Notiz-Lesepanel,
Presets, Screenshot-Export. Dark-Mode/Glassmorphism.

### Entwicklung
```bash
npm install
npm run dev          # http://localhost:5173  (Dev-Proxy /qmd -> localhost:8181)
```

### Deployment via Docker (z. B. Unraid)
```bash
cp .env.example .env
#  SECOND_BRAIN_DATA -> Vault-WURZEL (graph.json + .md-Dateien)  -> Ansichten & Lesepanel
#  QMD_URL           -> qmd-HTTP-Dienst (z.B. http://<NAS-IP>:8181)  -> Bedeutungssuche
docker compose up -d --build     # -> http://<HOST>:8686
```
Multi-Stage-Build: Vite baut die App, nginx liefert sie statisch aus (SPA-Fallback), proxyt `/qmd` und
liefert die gemounteten Daten unter `/data`. Ohne Daten/qmd läuft die App mit Demo-Daten weiter.

### Daten & Suche
- Ansichten laden `data/graph.json`, aggregiert nach Cluster; Drilldown zeigt einzelne Notizen.
- Lesepanel lädt `data/<cluster>/<datei>.md`.
- Suche ruft `/qmd/query` (nginx/Vite-Proxy → qmd-HTTP-Dienst).

## Modell-Unabhängigkeit
Daten, Indexer, qmd und App hängen an **keinem** bestimmten LLM. Das antwortende/​pflegende Modell ist
frei (Claude, anderes Cloud-LLM oder lokal via Ollama) — Zugriff auf Vault + qmd + `AGENTS.md` genügt.
qmd bietet HTTP **und** MCP, nutzbar von jedem MCP-Client. Details in [`docs/SETUP.md`](docs/SETUP.md).
