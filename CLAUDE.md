# Second Brain — Regelwerk (Brain-First)

Dies ist Romans **Second Brain**: rund 210 Quellnotizen aus mehreren Quellen (Memos, Trilium,
tududi) plus eine KI-gepflegte Wiki-Schicht mit 28 verdichteten Seiten. **Markdown ist die einzige Wahrheit.** Abgeleitete Sichten
(`INDEX.md`, `graph.json`, `integrations.json`, `.qmd/`) sind jederzeit neu baubar und wegwerfbar.

## Brain-First — die Suchleiter (bei JEDER Wissensfrage, in dieser Reihenfolge)

1. **`INDEX.md` lesen** — der Katalog (eine Zeile je Notiz, gruppiert nach Cluster). Steht die
   passende Quelle dort, gehe direkt zu ihr.
2. **`09-Wiki/` prüfen** — liegt das Wissen dort schon verdichtet? **Das Wiki ist aktiv**
   (28 Inhaltsseiten: 26 Themen, 2 Entitäten — alle Cluster verdichtet): `09-Wiki/_seitenverzeichnis.md` ist der
   Einstieg, er nennt je Seite Stichworte und Status.
3. **qmd-Suche** — über den MCP-Server **`qmd`**: Tool `query` (hybrid, beste Qualität), alt.
   `search` (Stichwort) / `vsearch` (Bedeutung). Kandidaten prüfen, **ohne** Dateien zu öffnen.
4. **Genau EINE Datei öffnen** — die beste (qmd `get` oder direkt lesen), nur die relevante Sektion.
5. **Erst dann antworten.** Kein blindes Durchsuchen ganzer Ordner, nicht den halben Vault einlesen.

## Struktur (Cluster)

`00-Inbox` · `01-Daily` · `05-Vorlagen` · `09-Wiki` (KI-gepflegt) · `10-Beruf` · `20-Privat` ·
`30-Ideen` · `40-Ressourcen` · `50-Projekte` · `90-Archiv`
`_system/` = Skripte, Konfig, Import-Assets — **kein Wissen, nicht durchsuchen.**

## qmd (lokale Hybridsuche)

- MCP-Server `qmd` stellt die Tools `query`, `get`, `multi_get`, `status` bereit. Collection: **brain**.
- Läuft komplett **lokal** (kleine Modelle in `~/.cache/qmd/`), keine Cloud, keine API-Kosten.
- **Nach Änderungen am Bestand** neu ableiten:
  `node _system/scripts/build-index.mjs`  (Katalog + Landkarte + Verbindungen) und  `qmd update`  (Index).
  Auf dem NAS macht der Container beides bei jedem Start selbst. **Der lokale Index wird
  davon nicht berührt** — dafür `_system/scripts/sync-vault.ps1` (zieht lokal und im
  Container nach) oder von Hand `qmd update` + `qmd embed`.
  Neue/veränderte Inhalte danach mit `qmd embed` einbetten.

## 09-Wiki (verdichtete Schicht — **aktiv seit 23.08.2026**)

Verdichtete, verlinkte Seiten, **ausschließlich KI-gepflegt**. Widersprüche werden **markiert,
nie überschrieben** — welcher Stand gilt, entscheidet der Mensch (Quelle korrigieren, nicht den
Hinweis löschen).

- Regeln und Seitentypen: `09-Wiki/WIKI-SCHEMA.md` · Katalog: `_seitenverzeichnis.md` ·
  Protokoll jedes Ingests: `_ingest-log.md`.
- **Vor jeder Wiki-Arbeit** das Schema lesen und nur die betroffenen Seiten öffnen.
- Offene Widersprüche stehen im Seitenverzeichnis; sie werden **nicht** von der KI aufgelöst.
- Bestandsmängel (Doubletten, leere Notizen, tote Verweise) sammelt
  `09-Wiki/Themen/Bestandspflege - Lint-Befunde.md`; das Werkzeug dazu ist
  `_system/scripts/lint-fix.mjs` (Testlauf ist die Voreinstellung).

## Grundprinzipien

- Deterministischer Code vor KI (Indexer ohne KI). KI nur, wo Verstehen nötig ist.
- **Die KI entscheidet nicht selbst** — sie findet, markiert und schlägt vor. Roman entscheidet.
