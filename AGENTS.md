# AGENTS.md — Second Brain (modell-neutrale Arbeitsanweisung)

Diese Datei beschreibt, wie **ein beliebiger KI-Agent** (Claude, GPT/Codex, Cursor, ein lokales
Ollama-Modell …) mit diesem Second Brain arbeitet. Sie ist bewusst tool-unabhängig — `CLAUDE.md`
ist dieselbe Regel für Claude Code. Nichts hier ist an ein bestimmtes Modell gebunden.

## Grundprinzipien
- **Markdown ist die einzige Wahrheit.** Alle Notizen liegen als `.md` im Vault. Abgeleitete
  Sichten (Katalog `INDEX.md`, Landkarte `graph.json`, Suchindex, Wiki) sind wegwerf- und neu baubar.
- **Der Mensch entscheidet.** Die KI findet, verdichtet, markiert und schlägt vor — sie entscheidet nicht.
- **Deterministisch vor KI:** Katalog/Landkarte/Abgleich sind normaler Code; KI nur, wo Verstehen nötig ist.

## Brain-First — die Suchleiter (bei JEDER Wissensfrage, in dieser Reihenfolge)
1. **`INDEX.md` lesen** — der Katalog (eine Zeile je Bereich/wichtiger Datei).
2. **`09-Wiki/` prüfen** — liegt das Wissen dort schon verdichtet?
3. **Bedeutungssuche via qmd** — lokale Hybridsuche (Stichwort + Bedeutung). Zugriff:
   CLI `qmd query "…"`, HTTP `POST /query` (`{searches:[{type:'vec'|'lex',query}]}`), oder MCP-Server
   (`qmd mcp` — funktioniert mit **jedem MCP-fähigen Client**, nicht nur Claude).
4. **Genau EINE Datei öffnen** — die beste — und nur die relevante Sektion lesen.
5. **Erst dann antworten.** Kein blindes Durchsuchen ganzer Ordner, nicht den halben Vault einlesen.

## Wiki pflegen (Vertrauen / „sauber bleiben")
Vor jeder Wiki-Arbeit `09-Wiki/WIKI-SCHEMA.md` lesen und strikt befolgen:
- Seitentypen: Quelle, Thema, Entität, Synthese — alles quervernetzt.
- **Ingest**: neue Quelle lesen → über das Seitenverzeichnis **nur betroffene Seiten** öffnen →
  aktualisieren/anlegen, Verweise setzen, **Widersprüche markieren (nie überschreiben)**.
- Konfliktauflösung: die **Quelle** korrigieren (nicht den Hinweis löschen) — dann verschwindet die
  Markierung beim nächsten Ingest. Jeder Ingest wird protokolliert.

## Grenzen
- Kein Zugriff auf `_system/` als Wissen (Skripte/Konfig). Tasks/Lesezeichen sind kein Wissen.
- Datum immer absolut. Keine erfundenen Fakten; jede Aussage mit Quelle.

## Modell-Austausch
- Suche (qmd) nutzt **eigene lokale Modelle**, unabhängig vom Chat-Modell.
- Das antwortende/​pflegende Modell ist frei wählbar (Cloud oder lokal via Ollama). Nur Zugriff auf den
  Vault + qmd + diese Regeln nötig. Qualität der Wiki-Pflege variiert je nach Modellfähigkeit.
