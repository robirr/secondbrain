# SETUP — Second Brain von Grund auf nachbauen

Dieses Repo enthält alles, um das komplette System nachzubauen: die **Pipeline-Skripte**
(`system/scripts/`), die **Spezifikation** & das **Wiki-Schema** (`docs/`), die **Brain-First-Regeln**
(`CLAUDE.md` / `AGENTS.md`) und die **Visualisierungs-App** (Repo-Wurzel + `docker-compose.yml`).

> Nicht im Repo (bewusst): deine Notizen, Tokens (`.env`), maschinenspezifische Konfig. Host-Adressen
> sind als `<NAS-IP>` anonymisiert — vor Gebrauch anpassen.

## Architektur (5 Bausteine)
1. **Vault** — deine Notizen als `.md` (einzige Wahrheit). Ordner-Konvention z.B. `00-Inbox`, `01-Daily`,
   `09-Wiki` (KI-gepflegt), `10-Beruf`, `20-Privat`, `40-Ressourcen`, `50-Projekte`, `90-Archiv`.
2. **Indexer** (`system/scripts/build-index.mjs`, ohne KI) → `INDEX.md` (Katalog) + `graph.json` (Landkarte).
3. **qmd** — lokale Hybridsuche (eigene lokale Modelle, modell-neutral).
4. **Regelwerk** — `CLAUDE.md` / `AGENTS.md` (Brain-First-Leiter) + Wiki-Schicht (`docs/WIKI-SCHEMA.md`).
5. **App** — Visualisierung (React/Vite → nginx via Docker).

## Voraussetzungen
Node ≥ 20, Python 3.11, Docker; qmd (`npm i -g @tobilu/qmd`); optional Obsidian o.Ä. als Editor.

## Schritte
**1) Vault anlegen** — Notizen als `.md` in Themen-Cluster ordnen (siehe Konvention oben). Bestehende
Quellen konsolidieren (siehe „Konnektoren").

**2) Indexer**
```bash
node system/scripts/build-index.mjs      # erzeugt INDEX.md + graph.json im Vault
```

**3) qmd (Suche)**
```bash
qmd collection add /pfad/zum/vault --name brain
qmd context add qmd://brain "Persönlicher Second Brain"
qmd embed                                # lädt einmalig lokale Modelle (~2–3 GB)
qmd mcp --http --daemon                  # HTTP-Dienst auf Port 8181 (für App & Agenten)
```

**4) Brain-First-Regeln** — `CLAUDE.md` (Claude Code) bzw. `AGENTS.md` (andere Agenten) in die
Vault-Wurzel legen. Definiert die Suchleiter Katalog → Wiki → qmd → EINE Datei → Antwort.

**5) Wiki-Schicht** — Ordner `09-Wiki/` + `WIKI-SCHEMA.md` (aus `docs/`). Der Agent arbeitet Quellen
per „Ingest" ein und markiert Widersprüche (siehe `AGENTS.md`).

**6) Konnektoren & Abgleich** (optional, für Import aus anderen Tools)
```bash
cp system/.env.example system/.env       # Tokens eintragen (nur ENV, nie im Code)
cp system/sources.config.example.yaml system/sources.config.yaml   # Hosts anpassen
node system/scripts/pull-memos.mjs       # Memos -> .md
python system/scripts/pull_trilium.py    # Trilium -> .md (ETAPI-Export)
node system/scripts/pull-tududi.mjs      # tududi-Notizen -> .md
node system/scripts/sync.mjs             # inkrementeller Abgleich + Index/qmd-Refresh
node system/scripts/capture-server.mjs   # HTTP-Capture (Push-Kanal, z.B. für Agenten)
```
Hinweise: In `system/scripts/lib.mjs` die `<NAS-IP>` durch echte Hosts ersetzen; in `sync.mjs` `QMD_JS`
auf deinen qmd-Pfad setzen (oder qmd auf PATH).

**7) App deployen** (Docker/Unraid) — **alles in einem Container**
```bash
cp .env.example .env
#  SECOND_BRAIN_DATA -> Vault-WURZEL (graph.json + .md-Dateien)   — EINZIGE Pflichtangabe
docker compose up -d --build             # -> http://<HOST>:8686
```
Das Image enthält App **und** qmd. Beim ersten Start richtet der Container qmd selbst ein
(Sammlung `brain` auf dem gemounteten Vault, Modell-Download ~2–3 GB, Embeddings) — das dauert
einmalig. Modelle + Index liegen im Volume `qmd-home` und bleiben erhalten. Schritt 3 (qmd auf dem
Host) ist damit für den Betrieb **nicht** nötig — nur praktisch für lokale Entwicklung mit `npm run dev`.
Externe Agenten sprechen qmd über den Container an: MCP unter `http://<HOST>:8686/qmd/mcp`.

## Modell-Unabhängigkeit
- **Daten, Indexer, qmd, App** hängen nicht an einem bestimmten LLM.
- Das antwortende/​pflegende **Modell ist frei** (Claude, anderes Cloud-LLM, oder lokal via **Ollama**):
  Zugriff auf Vault + qmd + `AGENTS.md`-Regeln genügt. qmd bietet HTTP *und* MCP → jeder MCP-Client nutzbar.
