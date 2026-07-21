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

### Deployment via Docker (z. B. Unraid) — alles in EINEM Container
Das Image wird per GitHub Actions gebaut und liegt öffentlich unter
`ghcr.io/robirr/secondbrain`. Auf dem NAS brauchst du nur `docker-compose.yml` + `.env` —
**kein Repo-Klon, kein lokaler Build**:
```bash
cp .env.example .env
#  SECOND_BRAIN_DATA -> Vault-WURZEL (graph.json + .md-Dateien)   — EINZIGE Pflichtangabe
docker compose up -d             # zieht das fertige Image -> http://<HOST>:8686
```
**Ein Image, ein Container.** Die App (nginx) **und** die qmd-Bedeutungssuche laufen zusammen im
selben Container — kein separater qmd-Dienst, kein `host.docker.internal`. qmd wird beim ersten Start
automatisch eingerichtet: es indexiert den gemounteten Vault und lädt einmalig seine lokalen Modelle
(~2–3 GB). Diese Modelle **und** der Suchindex liegen im Docker-Volume `qmd-home` und überleben
Neustarts. **Erster Start dauert daher länger; die UI ist aber sofort da**, die Suche schaltet sich
zu, sobald qmd fertig ist. Ohne gemounteten Vault läuft die App mit Demo-Daten.

### Daten & Suche
- Ansichten laden `data/graph.json`, aggregiert nach Cluster; Drilldown zeigt einzelne Notizen.
- Lesepanel lädt `data/<cluster>/<datei>.md`.
- Suche ruft `/qmd/query` → nginx proxyt intern auf das mitlaufende qmd (`127.0.0.1:8181`).
- Externe Agenten erreichen qmd über denselben Container: MCP unter `http://<HOST>:8686/qmd/mcp`.

## Modell-Unabhängigkeit
Daten, Indexer, qmd und App hängen an **keinem** bestimmten LLM. Das antwortende/​pflegende Modell ist
frei (Claude, anderes Cloud-LLM oder lokal via Ollama) — Zugriff auf Vault + qmd + `AGENTS.md` genügt.
qmd bietet HTTP **und** MCP, nutzbar von jedem MCP-Client. Details in [`docs/SETUP.md`](docs/SETUP.md).
