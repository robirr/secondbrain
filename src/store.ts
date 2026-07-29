import { create } from 'zustand'
import { NODES as DEMO_NODES, EDGES as DEMO_EDGES } from './data/demo'
import type { VizNode, VizEdge } from './data/demo'
import { mapGraph } from './data/load'

export interface Settings {
  view: string
  detail: number
  animation: boolean
  labels: boolean
  verbindungen: boolean
  // Notiz-Filter — wirkt in allen Ansichten (Gefiltertes wird ausgeblendet)
  clusters: string[] | null // null = alle Bereiche
  source: string | null // null = alle Quellen
  orphans: boolean // nur Notizen ohne Verweis
}

export interface RawNote { id: string; title: string; cluster: string; size?: number; source?: string | null }
export interface NoteEdge { source: string; target: string } // Vault-relative Notiz-Ids

interface State {
  selected: string | null
  hovered: string | null
  openNote: string | null // Dateipfad der geöffneten Notiz (Lesepanel)
  noteHistory: string[] // Lesepfad im Panel (ältester zuerst); openNote selbst nicht enthalten
  drill: string | null // Cluster-Ordner, in den hineingezoomt wird
  drillReturnView: string
  settings: Settings
  nodes: VizNode[]
  edges: VizEdge[]
  rawNotes: RawNote[]
  noteEdges: NoteEdge[] // Notiz-Kanten aus graph.json, UNaggregiert (für Rück-/Verweise)
  dataSource: 'demo' | 'live'
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
  setOpenNote: (path: string | null) => void
  pushNote: (id: string) => void // Sprung IM Panel (Link/Verweis) — mit Verlauf
  backNote: () => void
  enterDrill: (folder: string) => void
  exitDrill: () => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  applySettings: (s: Partial<Settings>) => void
  loadData: () => Promise<void>
}

export const useStore = create<State>((set) => ({
  selected: null,
  hovered: null,
  openNote: null,
  noteHistory: [],
  drill: null,
  drillReturnView: 'ring',
  rawNotes: [],
  noteEdges: [],
  settings: {
    view: 'ring',
    detail: 75,
    animation: true,
    labels: true,
    verbindungen: false, // Standard: Verbindungen nur bei Hover
    clusters: null,
    source: null,
    orphans: false,
  },
  nodes: DEMO_NODES,
  edges: DEMO_EDGES,
  dataSource: 'demo',
  setSelected: (id) => set({ selected: id }),
  setHovered: (id) => set({ hovered: id }),
  // Einstieg von aussen (Suche, Inspector, Wolke) beginnt einen neuen Lesepfad
  setOpenNote: (path) => set({ openNote: path, noteHistory: [] }),
  // Schritt im Panel: Verlauf wächst; ein Selbstlink ändert nichts
  pushNote: (id) => set((s) => (id === s.openNote ? {} : {
    openNote: id,
    noteHistory: s.openNote ? [...s.noteHistory, s.openNote].slice(-50) : s.noteHistory,
  })),
  backNote: () => set((s) => {
    const h = [...s.noteHistory]
    const prev = h.pop()
    return prev ? { openNote: prev, noteHistory: h } : {}
  }),
  // Ansichten, die einen Ordner selbst darstellen können — dort bleibt man beim Hineingehen.
  // Aus Ebenen/Cloud heraus gibt es keine Ordner-Darstellung, daher der Wechsel auf Ring.
  enterDrill: (folder) => set((s) => {
    const view = ['ring', 'graph', 'globus'].includes(s.settings.view) ? s.settings.view : 'ring'
    // In einen ausgefilterten Bereich zu springen würde eine leere Ansicht zeigen —
    // deshalb fällt der Bereichsfilter dabei weg.
    const clusters = s.settings.clusters && !s.settings.clusters.includes(folder) ? null : s.settings.clusters
    return {
      drill: folder,
      drillReturnView: s.drill ? s.drillReturnView : s.settings.view,
      settings: { ...s.settings, view, clusters },
      selected: null,
    }
  }),
  exitDrill: () => set((s) => ({ drill: null, settings: { ...s.settings, view: s.drillReturnView }, selected: null })),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  applySettings: (partial) => set((s) => ({ settings: { ...s.settings, ...partial } })),
  loadData: async () => {
    try {
      const res = await fetch('data/graph.json', { cache: 'no-store' })
      if (!res.ok) return // keine produktiven Daten gemountet → Demo behalten
      const g = await res.json()
      if (!g || !Array.isArray(g.nodes) || g.nodes.length === 0) return
      const { nodes, edges } = mapGraph(g)
      const rawNotes: RawNote[] = g.nodes.map((n: RawNote) => ({
        id: n.id, title: n.title, cluster: n.cluster, size: n.size, source: n.source,
      }))
      // Notiz-Kanten unverändert übernehmen (mapGraph aggregiert nur für die Cluster-Sicht)
      const noteEdges: NoteEdge[] = Array.isArray(g.edges)
        ? g.edges.map((e: NoteEdge) => ({ source: e.source, target: e.target }))
        : []
      set({ nodes, edges, rawNotes, noteEdges, dataSource: 'live', selected: null })
    } catch {
      /* Demo-Daten behalten */
    }
  },
}))
