# Second Brain — Regelwerk (Brain-First)

Dies ist Romans **Second Brain**: ~222 Markdown-Notizen, konsolidiert aus mehreren Quellen
(Memos, Trilium, tududi). **Markdown ist die einzige Wahrheit.** Abgeleitete Sichten
(`INDEX.md`, `graph.json`, `.qmd/`) sind jederzeit neu baubar und wegwerfbar.

## Brain-First — die Suchleiter (bei JEDER Wissensfrage, in dieser Reihenfolge)

1. **`INDEX.md` lesen** — der Katalog (eine Zeile je Notiz, gruppiert nach Cluster). Steht die
   passende Quelle dort, gehe direkt zu ihr.
2. **`09-Wiki/` prüfen** — liegt das Wissen dort schon verdichtet? (sobald das Wiki aktiv ist)
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
  `node _system/scripts/build-index.mjs`  (Katalog + Landkarte) und  `qmd update`  (Index).
  Neue/veränderte Inhalte danach mit `qmd embed` einbetten.

## 09-Wiki (verdichtete Schicht — Phase C2/C3, noch nicht aktiv)

Verdichtete, verlinkte Seiten, **ausschließlich KI-gepflegt**. Widersprüche werden **markiert,
nie überschrieben** — welcher Stand gilt, entscheidet der Mensch (Quelle korrigieren, nicht den
Hinweis löschen).

## Grundprinzipien

- Deterministischer Code vor KI (Indexer ohne KI). KI nur, wo Verstehen nötig ist.
- **Die KI entscheidet nicht selbst** — sie findet, markiert und schlägt vor. Roman entscheidet.
