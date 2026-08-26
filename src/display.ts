import { useMemo } from 'react'
import { useStore } from './store'
import type { RawNote } from './store'
import { clusterMeta } from './data/load'
import type { VizNode, VizEdge } from './data/demo'

export const isNoteId = (id: string) => /\.md$/i.test(id)

/** Punktgröße einer Notiz aus ihrer Dateilänge (logarithmisch: 45 B … 20 kB → 3 … 9 px).
 *  Gemeinsam von Ebenen- und Ring-Ansicht genutzt, damit ein Punkt überall dasselbe bedeutet. */
export function dotSize(bytes: number | undefined): number {
  const s = Math.max(45, Math.min(bytes ?? 45, 20000))
  return 3 + ((Math.log(s) - Math.log(45)) / (Math.log(20000) - Math.log(45))) * 6
}

/** Notizen, die der Filter der Leiste übrig lässt — eine Quelle für ALLE Ansichten, damit
 *  überall dasselbe zu sehen ist. Gefiltertes wird ausgeblendet, nicht nur abgeblendet. */
export function useVisibleNotes(): RawNote[] {
  const rawNotes = useStore((s) => s.rawNotes)
  const noteEdges = useStore((s) => s.noteEdges)
  const { clusters, source, orphans } = useStore((s) => s.settings)
  return useMemo(() => {
    if (!clusters && !source && !orphans) return rawNotes
    const linked = new Set<string>()
    if (orphans) for (const e of noteEdges) { linked.add(e.source); linked.add(e.target) }
    return rawNotes.filter((n) => {
      if (clusters && !clusters.includes(n.cluster)) return false
      if (source && (n.source || 'ohne Angabe') !== source) return false
      if (orphans && linked.has(n.id)) return false
      return true
    })
  }, [rawNotes, noteEdges, clusters, source, orphans])
}

/** Ist überhaupt ein Filter gesetzt? (für den Hinweis in der Leiste) */
export function useFilterActive(): boolean {
  const { clusters, source, orphans } = useStore((s) => s.settings)
  return !!clusters || !!source || orphans
}

/**
 * Warum ist die Ansicht leer? Drei Gründe, drei Sätze.
 * Vorher stand hier für JEDEN Fall ohne aktiven Filter "graph.json fehlt" — beim Sprung in einen
 * leeren Cluster (etwa die Inbox, wenn nichts wartet) war das eine glatte Falschaussage.
 */
export function useEmptyMessage(): string {
  const drill = useStore((s) => s.drill)
  const hatDaten = useStore((s) => s.rawNotes.length > 0)
  const gefiltert = useFilterActive()
  if (!hatDaten) return 'Keine Landkarte geladen (graph.json fehlt).'
  if (drill) {
    const name = drillLabel(drill)
    return gefiltert
      ? `In „${name}" lässt der Filter keine Notiz übrig.`
      : `In „${name}" liegt gerade nichts.`
  }
  return gefiltert ? 'Der Filter lässt keine Notiz übrig.' : 'Keine Landkarte geladen (graph.json fehlt).'
}

// --- Drill über mehrere Ordnerebenen -----------------------------------------------------------
// Der Drill-Pfad war früher immer ein Cluster ('09-Wiki'). Jetzt kann er tiefer gehen
// ('00-Inbox/hermes'), denn 199 von 232 Notizen liegen in einem Unterordner — flach dargestellt
// sieht man einer Notiz nicht an, aus welchem Kanal oder Projektordner sie stammt.

/** Drill-Pfad → oberster Cluster ('50-Projekte/Camper & Travel' → '50-Projekte'). */
export const drillCluster = (pfad: string): string => pfad.split('/')[0]

/** Ordnerknoten tragen ein Präfix, damit ihre Id nie mit einer Notiz-Id verwechselt wird. */
const DIR = 'dir:'
export const isFolderId = (id: string): boolean => id.startsWith(DIR)
export const folderPath = (id: string): string => id.slice(DIR.length)

/** Anzeigename eines Drill-Pfades: der Cluster mit Klarnamen, ein Unterordner wie im Vault. */
export function drillLabel(pfad: string): string {
  const teile = pfad.split('/')
  return teile.length === 1 ? clusterMeta(teile[0]).label : teile[teile.length - 1]
}

/** Was liegt in diesem Ordner? Notizen DIREKT darin und die unmittelbaren Unterordner
 *  (mit der Zahl aller Notizen darunter, auch aus tieferen Ebenen). */
export function ordnerInhalt(pfad: string, notes: RawNote[]): {
  direkt: RawNote[]; unterordner: { name: string; pfad: string; anzahl: number }[]
} {
  const praefix = pfad + '/'
  const darin = notes.filter((r) => r.id.startsWith(praefix))
  const direkt = darin.filter((r) => !r.id.slice(praefix.length).includes('/'))
  const zaehler = new Map<string, number>()
  for (const r of darin) {
    const rest = r.id.slice(praefix.length)
    const i = rest.indexOf('/')
    if (i > 0) zaehler.set(rest.slice(0, i), (zaehler.get(rest.slice(0, i)) ?? 0) + 1)
  }
  const unterordner = [...zaehler.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, anzahl]) => ({ name, pfad: praefix + name, anzahl }))
  return { direkt, unterordner }
}

/** Anzuzeigende Knoten/Kanten: Basis-Cluster, oder im Drill der Inhalt eines Ordners. */
export function useDisplayNodes(): { nodes: VizNode[]; edges: VizEdge[]; isDrill: boolean } {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const rawNotes = useVisibleNotes() // der Filter der Leiste wirkt auch im Drill
  const drill = useStore((s) => s.drill)
  return useMemo(() => {
    if (!drill) return { nodes, edges, isDrill: false }
    const cluster = drillCluster(drill)
    const m = clusterMeta(cluster)
    const imCluster = drill === cluster
    const hub: VizNode = {
      id: `cl:${drill}`, name: drillLabel(drill), type: 'orchestrator', ring: 0, color: m.color,
      icon: imCluster ? m.icon : 'folder-open', status: 'active',
      description: imCluster ? `Cluster „${m.label}"` : `Ordner „${drill}"`,
      meta: { Ordner: drill },
    }
    const { direkt, unterordner } = ordnerInhalt(drill, rawNotes)
    // Ordner zuerst: sie sind Wegweiser, die Notizen daneben sind Ziele.
    const ordner: VizNode[] = unterordner.map((o) => ({
      id: DIR + o.pfad, name: `${o.name} · ${o.anzahl}`, type: 'knowledge', ring: 2,
      color: m.color, icon: 'folder',
      meta: { isFolder: '1', Ordner: o.pfad, Notizen: String(o.anzahl) },
    }))
    const notizen: VizNode[] = direkt.map((r) => ({
      id: r.id,
      name: r.title || (r.id.split('/').pop() || r.id).replace(/\.md$/i, ''),
      type: 'knowledge', ring: 2, color: m.color, icon: 'file-text', meta: { isNote: '1' },
    }))
    const kinder = [...ordner, ...notizen]
    const dedges: VizEdge[] = kinder.map((n) => ({ source: hub.id, target: n.id, kind: 'contains' }))
    return { nodes: [hub, ...kinder], edges: dedges, isDrill: true }
  }, [nodes, edges, rawNotes, drill])
}
