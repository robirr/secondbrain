import type { VizNode, VizEdge } from './demo'

// graph.json (Indexer-Landkarte)
export interface GraphJson {
  nodes: { id: string; title: string; cluster: string; tags?: string[]; size?: number }[]
  edges: { source: string; target: string }[]
}

// Cluster-Ordner → Anzeige/Farbe/Icon (konsistent mit dem Farbkonzept)
const CLUSTER_META: Record<string, { label: string; color: string; icon: string }> = {
  '00-Inbox': { label: 'Inbox', color: '#8798b5', icon: 'grip' },
  '01-Daily': { label: 'Daily / Kalender', color: '#2dd4bf', icon: 'calendar' },
  '05-Vorlagen': { label: 'Vorlagen', color: '#8798b5', icon: 'file-text' },
  '09-Wiki': { label: 'Wiki', color: '#8b7cf6', icon: 'book-open' },
  '10-Beruf': { label: 'Beruf', color: '#2dd4bf', icon: 'briefcase' },
  '20-Privat': { label: 'Privat', color: '#ff7a70', icon: 'users' },
  '30-Ideen': { label: 'Ideen', color: '#ff9d4d', icon: 'lightbulb' },
  '40-Ressourcen': { label: 'Ressourcen', color: '#8b7cf6', icon: 'book-open' },
  '50-Projekte': { label: 'Projekte', color: '#4c8dff', icon: 'rocket' },
  '90-Archiv': { label: 'Archiv', color: '#565d70', icon: 'archive' },
}
const metaFor = (cl: string) =>
  CLUSTER_META[cl] ?? { label: cl.replace(/^[0-9]+[-_]/, '') || cl, color: '#8798b5', icon: 'grip' }

/** graph.json → aggregiert nach Cluster (Second-Brain-Zentrum + Cluster-Hubs + Cross-Cluster-Kanten). */
export function mapGraph(g: GraphJson): { nodes: VizNode[]; edges: VizEdge[] } {
  const byCluster = new Map<string, number>()
  for (const n of g.nodes) byCluster.set(n.cluster, (byCluster.get(n.cluster) || 0) + 1)

  const orchestrator: VizNode = {
    id: 'brain', name: 'Second Brain', type: 'orchestrator', ring: 0, color: '#8b7cf6', icon: 'brain',
    status: 'active', description: `Wissensbasis mit ${g.nodes.length} Notizen in ${byCluster.size} Clustern.`,
    meta: { Notizen: String(g.nodes.length), Cluster: String(byCluster.size) },
  }

  const clusterNodes: VizNode[] = [...byCluster.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([cl, count]) => {
      const m = metaFor(cl)
      return {
        id: `cl:${cl}`, name: m.label, type: 'knowledge', ring: 2, color: m.color, icon: m.icon,
        status: 'active', description: `Cluster „${m.label}" — ${count} Notizen.`,
        meta: { Notizen: String(count), Ordner: cl },
      } as VizNode
    })

  // Notiz-Kanten auf Cluster-Paare aggregieren
  const idCluster = new Map(g.nodes.map((n) => [n.id, n.cluster]))
  const pairs = new Set<string>()
  for (const e of g.edges) {
    const a = idCluster.get(e.source), b = idCluster.get(e.target)
    if (!a || !b || a === b) continue
    pairs.add([a, b].sort().join('__'))
  }
  const edges: VizEdge[] = [
    ...clusterNodes.map((c) => ({ source: 'brain', target: c.id, kind: 'contains' as const })),
    ...[...pairs].map((k) => { const [a, b] = k.split('__'); return { source: `cl:${a}`, target: `cl:${b}`, kind: 'depends-on' as const } }),
  ]
  return { nodes: [orchestrator, ...clusterNodes], edges }
}
