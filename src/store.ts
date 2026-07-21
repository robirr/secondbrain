import { create } from 'zustand'
import { NODES as DEMO_NODES, EDGES as DEMO_EDGES } from './data/demo'
import type { VizNode, VizEdge } from './data/demo'
import { mapGraph } from './data/load'

export type FilterKey = 'alle' | 'wissen' | 'projekte' | 'extern' | 'aktiv'

export interface Settings {
  view: string
  detail: number
  layers: number
  animation: boolean
  labels: boolean
  verbindungen: boolean
  extern: boolean
  filter: FilterKey
}

export interface RawNote { id: string; title: string; cluster: string }

interface State {
  selected: string | null
  hovered: string | null
  openNote: string | null // Dateipfad der geöffneten Notiz (Lesepanel)
  drill: string | null // Cluster-Ordner, in den hineingezoomt wird
  drillReturnView: string
  settings: Settings
  nodes: VizNode[]
  edges: VizEdge[]
  rawNotes: RawNote[]
  dataSource: 'demo' | 'live'
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
  setOpenNote: (path: string | null) => void
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
  drill: null,
  drillReturnView: 'ring',
  rawNotes: [],
  settings: {
    view: 'ring',
    detail: 75,
    layers: 4,
    animation: true,
    labels: true,
    verbindungen: false, // Standard: Verbindungen nur bei Hover
    extern: true,
    filter: 'alle',
  },
  nodes: DEMO_NODES,
  edges: DEMO_EDGES,
  dataSource: 'demo',
  setSelected: (id) => set({ selected: id }),
  setHovered: (id) => set({ hovered: id }),
  setOpenNote: (path) => set({ openNote: path }),
  enterDrill: (folder) => set((s) => ({
    drill: folder,
    drillReturnView: s.drill ? s.drillReturnView : s.settings.view,
    settings: { ...s.settings, view: 'ring' },
    selected: null,
  })),
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
      const rawNotes: RawNote[] = g.nodes.map((n: RawNote) => ({ id: n.id, title: n.title, cluster: n.cluster }))
      set({ nodes, edges, rawNotes, dataSource: 'live', selected: null })
    } catch {
      /* Demo-Daten behalten */
    }
  },
}))
