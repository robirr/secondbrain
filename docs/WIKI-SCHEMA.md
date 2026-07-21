# WIKI-SCHEMA — Arbeitsanweisung für die KI-gepflegte Wiki-Schicht

**Vor jeder Wiki-Arbeit liest die KI zuerst diese Datei und hält sich strikt daran.**
Der Ordner `09-Wiki/` wird **ausschließlich von der KI** gepflegt — Roman fasst ihn nicht an.

## Grundregeln (nicht verhandelbar)

1. **Markdown im Vault ist die einzige Wahrheit.** Das Wiki ist eine *abgeleitete, verdichtete
   Sicht* — jederzeit neu baubar, nie die primäre Quelle.
2. **Nie überschreiben bei Konflikt.** Widersprechen sich neue und bestehende Informationen,
   werden **beide** mit Quelle festgehalten und der Konflikt **markiert**. Welcher Stand gilt,
   entscheidet Roman.
3. **Immer verlinken & Quellen nennen.** Jede Aussage verweist auf ihre Quell-Notiz(en).
4. **Erst lesen, was betroffen ist.** Über das `_seitenverzeichnis.md` nur die betroffenen
   Seiten öffnen — nicht das ganze Wiki.
5. **Jeder Ingest wird protokolliert** in `_ingest-log.md`.

## Seitentypen

| Typ | Zweck | Ablage |
|-----|-------|--------|
| **Quelle** | Was kam rein (1 Ingest-Quelle: Notiz/Transkript/Artikel) — Kurzfassung + Herkunft | `09-Wiki/Quellen/` |
| **Thema** | Ein Sachthema, verdichtet aus mehreren Quellen | `09-Wiki/Themen/` |
| **Entität** | Person, Projekt, Firma, Ort | `09-Wiki/Entitaeten/` |
| **Synthese** | Verdichtung über mehrere Themen/Quellen (die eigentliche Einsicht) | `09-Wiki/Synthese/` |

## Frontmatter jeder Wiki-Seite

```yaml
---
type: thema            # quelle | thema | entitaet | synthese
title: "..."
aliases: ["...", "..."]   # alternative Bezeichnungen (für Auffindbarkeit)
sources: ["50-Projekte/..md"]   # Quell-Notizen (Pfade)
updated: "YYYY-MM-DD"
status: aktiv          # aktiv | konflikt (mind. ein offener Widerspruch)
---
```

## Verlinkung

- Wiki-intern: `[[Themen/Camper – Elektrik]]` (Wikilink, ohne `.md`).
- Auf Quell-Notizen: relativer Markdown-Link `[Titel](../50-Projekte/....md)`.

## Widerspruchs-Markierung (der wichtigste Mechanismus)

Widersprüche werden mit diesem Callout markiert — **nichts wird gelöscht oder überschrieben**:

```markdown
> [!widerspruch] Widerspruch — Roman entscheidet
> - **A:** <Aussage A>  ·  Quelle: [A-Notiz](../pfad/a.md)
> - **B:** <Aussage B>  ·  Quelle: [B-Notiz](../pfad/b.md)
> Auflösung: die **Quelle** korrigieren (nicht diesen Hinweis löschen); beim nächsten
> Ingest verschwindet die Markierung automatisch, wenn kein Widerspruch mehr besteht.
```

Die Seite bekommt dann `status: konflikt`. Erst wenn die Quelle bereinigt ist, wird der Callout
beim nächsten Ingest entfernt und `status: aktiv` gesetzt.

## Was passt vs. was widerspricht

- **Passt / ergänzt:** in die betroffene(n) Seite(n) einarbeiten (verdichten, verlinken).
- **Fehlt:** neue Seite anlegen, im `_seitenverzeichnis.md` eintragen.
- **Widerspricht:** markieren (s. o.), nicht auflösen.

## Ablauf-Referenz

Der konkrete Einarbeitungs-Ablauf steht im Skill `wiki-ingest` (`.claude/skills/wiki-ingest/`).
