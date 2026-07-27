import { useMemo } from 'react'
import { useStore } from './store'
import { clusterMeta } from './data/load'
import type { VizNode, VizEdge } from './data/demo'

export const isNoteId = (id: string) => /\.md$/i.test(id)

/** Punktgröße einer Notiz aus ihrer Dateilänge (logarithmisch: 45 B … 20 kB → 3 … 9 px).
 *  Gemeinsam von Ebenen- und Ring-Ansicht genutzt, damit ein Punkt überall dasselbe bedeutet. */
export function dotSize(bytes: number | undefined): number {
  const s = Math.max(45, Math.min(bytes ?? 45, 20000))
  return 3 + ((Math.log(s) - Math.log(45)) / (Math.log(20000) - Math.log(45))) * 6
}

/** Anzuzeigende Knoten/Kanten: Basis-Cluster, oder im Drill die Notizen eines Clusters. */
export function useDisplayNodes(): { nodes: VizNode[]; edges: VizEdge[]; isDrill: boolean } {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const rawNotes = useStore((s) => s.rawNotes)
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
