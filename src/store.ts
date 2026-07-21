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

interface State {
  selected: string | null
  hovered: string | null
  settings: Settings
  nodes: VizNode[]
  edges: VizEdge[]
  dataSource: 'demo' | 'live'
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  loadData: () => Promise<void>
}

export const useStore = create<State>((set) => ({
  selected: null,
  hovered: null,
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
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  loadData: async () => {
    try {
      const res = await fetch('data/graph.json', { cache: 'no-store' })
      if (!res.ok) return // keine produktiven Daten gemountet → Demo behalten
      const g = await res.json()
      if (!g || !Array.isArray(g.nodes) || g.nodes.length === 0) return
      const { nodes, edges } = mapGraph(g)
      set({ nodes, edges, dataSource: 'live', selected: null })
    } catch {
      /* Demo-Daten behalten */
    }
  },
}))
