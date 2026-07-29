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

/** Anzuzeigende Knoten/Kanten: Basis-Cluster, oder im Drill die Notizen eines Clusters. */
export function useDisplayNodes(): { nodes: VizNode[]; edges: VizEdge[]; isDrill: boolean } {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const rawNotes = useVisibleNotes() // der Filter der Leiste wirkt auch im Drill
  const drill = useStore((s) => s.drill)
  return useMemo(() => {
    if (!drill) return { nodes, edges, isDrill: false }
    const m = clusterMeta(drill)
    const hub: VizNode = {
      id: `cl:${drill}`, name: m.label, type: 'orchestrator', ring: 0, color: m.color, icon: m.icon,
      status: 'active', description: `Cluster „${m.label}"`, meta: { Ordner: drill },
    }
    const notes: VizNode[] = rawNotes.filter((r) => r.cluster === drill).map((r) => ({
      id: r.id,
      name: r.title || (r.id.split('/').pop() || r.id).replace(/\.md$/i, ''),
      type: 'knowledge', ring: 2, color: m.color, icon: 'file-text', meta: { isNote: '1' },
    }))
    const dedges: VizEdge[] = notes.map((n) => ({ source: hub.id, target: n.id, kind: 'contains' }))
    return { nodes: [hub, ...notes], edges: dedges, isDrill: true }
  }, [nodes, edges, rawNotes, drill])
}
