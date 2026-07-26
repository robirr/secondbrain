// Deterministische Helfer für die Notizen-Ansicht: Pfade, Frontmatter, Link-Auflösung, Verweise.
// Keine KI, keine Heuristik über den Inhalt — nur der Bestand und die Landkarte (graph.json).
import { useMemo } from 'react'
import { WIKI_SCHEME } from '../remark-vault-links'
import { useStore } from '../store'
import type { RawNote } from '../store'

/** Pfad → Vault-relativ (qmd://-Schema + Collection-Präfix entfernen) */
export function toVaultPath(p: string): string {
  const parts = p.replace(/^qmd:\/\//, '').split('/').filter(Boolean)
  if (parts.length > 1 && !/^[0-9]/.test(parts[0])) parts.shift() // Collection-Präfix (z.B. "brain")
  return parts.join('/')
}

/** Vault-relativer Pfad → URL unter data/ (jedes Segment einzeln kodiert) */
export const dataUrl = (rel: string): string => 'data/' + rel.split('/').map(encodeURIComponent).join('/')

/** Ordner einer Notiz ('' wenn sie direkt in der Vault-Wurzel liegt) */
export const dirOf = (rel: string): string => { const i = rel.lastIndexOf('/'); return i < 0 ? '' : rel.slice(0, i) }

export function safeDecode(s: string): string { try { return decodeURIComponent(s) } catch { return s } }

/** '.' und '..' auflösen (posix, ohne node:path). Führende '..' bleiben stehen — so ist ein
 *  Ausbruch aus dem Vault am Ergebnis erkennbar. */
export function normalizePosix(p: string): string {
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else out.push('..') }
    else out.push(seg)
  }
  return out.join('/')
}

const joinPath = (dir: string, rel: string): string => normalizePosix(dir ? `${dir}/${rel}` : rel)

// Frontmatter-Regex identisch zu _system/scripts/build-index.mjs — damit Body und Titel dort
// und hier deckungsgleich sind.
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** Frontmatter (kleine YAML-Teilmenge: Top-Level-Skalare) vom Body trennen. Blocklisten wie
 *  "sources:" werden übersprungen, Inline-Arrays bleiben als Text. Keine YAML-Abhängigkeit. */
export function splitFrontmatter(raw: string): { fm: Record<string, string>; body: string } {
  const m = raw.match(FM_RE)
  if (!m) return { fm: {}, body: raw }
  const fm: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!kv) continue // Listeneinträge und Fortsetzungszeilen ignorieren
    const v = kv[2].trim().replace(/^\[(.*)\]$/, '$1').replace(/^["']|["']$/g, '').trim()
    if (v) fm[kv[1]] = v // leerer Wert = Blockstart, kein Skalar
  }
  return { fm, body: raw.slice(m[0].length) }
}

/** Titel aus der Landkarte (Frontmatter-Titel oder H1), Dateiname als Rückfall. */
export function noteTitle(rel: string, byId: Map<string, RawNote>): string {
  const t = byId.get(rel)?.title
  if (t && t.trim()) return t.trim()
  return safeDecode(rel.split('/').pop() || '').replace(/\.md$/i, '')
}

/** Wikilink-Auflösung wie im Indexer: Dateiname-Basis ODER Titel, kleingeschrieben, erster gewinnt. */
export function buildByBase(notes: RawNote[]): Map<string, string> {
  const byBase = new Map<string, string>()
  for (const n of notes) {
    const base = (n.id.split('/').pop() || '').replace(/\.md$/i, '').toLowerCase()
    if (base && !byBase.has(base)) byBase.set(base, n.id)
    const t = n.title.toLowerCase()
    if (t && !byBase.has(t)) byBase.set(t, n.id)
  }
  return byBase
}

export interface LinkCtx { fromDir: string; ids: Set<string>; byBase: Map<string, string> }
export type DeadReason = 'pfad' | 'wiki' | 'trilium'
export type LinkKind =
  | { kind: 'note'; id: string }
  | { kind: 'asset'; url: string }
  | { kind: 'external'; url: string }
  | { kind: 'anchor'; url: string }
  | { kind: 'dead'; reason: DeadReason }

// Endung = echte Datei; ohne Endung ist es ein Ordner-/Fragmentlink und damit tot.
const HAS_EXT = /\.[a-z0-9]{1,5}$/i

/** Link-Ziel einordnen — die einzige Stelle, an der über Links entschieden wird. */
export function classifyHref(href: string, ctx: LinkCtx): LinkKind {
  const h = (href || '').trim()
  if (!h) return { kind: 'dead', reason: 'pfad' }

  if (h.startsWith(WIKI_SCHEME)) {
    const name = safeDecode(h.slice(WIKI_SCHEME.length)).split(/[|#]/)[0].trim().replace(/\.md$/i, '')
    const hit = ctx.byBase.get(name.toLowerCase())
      ?? ctx.byBase.get((name.split('/').pop() || '').toLowerCase()) // [[Themen/Seite]] → "Seite"
    return hit ? { kind: 'note', id: hit } : { kind: 'dead', reason: 'wiki' }
  }
  if (/^#root\//.test(h)) return { kind: 'dead', reason: 'trilium' } // Restlink aus dem Trilium-Import
  if (h.startsWith('#')) return { kind: 'anchor', url: h }
  if (h.startsWith('//')) return { kind: 'external', url: h }
  if (/^[a-z][a-z0-9+.-]*:/i.test(h))
    return /^(https?|mailto|tel):/i.test(h) ? { kind: 'external', url: h } : { kind: 'dead', reason: 'pfad' }
  if (h.startsWith('/')) return { kind: 'dead', reason: 'pfad' }

  const target = joinPath(ctx.fromDir, safeDecode(h.split(/[#?]/)[0]))
  if (!target || target.startsWith('..')) return { kind: 'dead', reason: 'pfad' }
  if (/\.md$/i.test(target))
    return ctx.ids.has(target) ? { kind: 'note', id: target } : { kind: 'dead', reason: 'pfad' }
  return HAS_EXT.test(target.split('/').pop() || '')
    ? { kind: 'asset', url: dataUrl(target) }
    : { kind: 'dead', reason: 'pfad' }
}

/** Bildquelle → URL unter data/. Bewusst OHNE Endungsprüfung: im Bestand gibt es abgeschnittene
 *  Dateinamen (z.B. „… _image.p"), die trotzdem existieren. null = Ausbruch aus dem Vault. */
export function imageUrl(src: string, fromDir: string): string | null {
  const s = (src || '').trim()
  if (!s) return null
  if (/^(https?:|data:|\/\/)/i.test(s) || s.startsWith('/')) return s
  const target = joinPath(fromDir, safeDecode(s.split(/[#?]/)[0]))
  if (!target || target.startsWith('..')) return null
  return dataUrl(target)
}

export interface NoteRef { id: string; title: string; cluster: string }

/** Verweise dieser Notiz — aus den Notiz-Kanten der Landkarte, NICHT aus dem Text nachgerechnet.
 *  Eine Wahrheit, jederzeit mit build-index.mjs neu baubar. */
export function useNoteLinks(id: string | null): { out: NoteRef[]; incoming: NoteRef[] } {
  const noteEdges = useStore((s) => s.noteEdges)
  const rawNotes = useStore((s) => s.rawNotes)
  return useMemo(() => {
    if (!id) return { out: [], incoming: [] }
    const byId = new Map(rawNotes.map((r) => [r.id, r]))
    const pick = (ids: string[]): NoteRef[] => [...new Set(ids)]
      .filter((x) => byId.has(x))
      .map((x) => ({ id: x, title: noteTitle(x, byId), cluster: byId.get(x)!.cluster }))
      .sort((a, b) => a.title.localeCompare(b.title))
    return {
      out: pick(noteEdges.filter((e) => e.source === id).map((e) => e.target)),
      incoming: pick(noteEdges.filter((e) => e.target === id).map((e) => e.source)),
    }
  }, [id, noteEdges, rawNotes])
}
