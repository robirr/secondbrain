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

export interface RawNote {
  id: string; title: string; cluster: string; size?: number; source?: string | null
  // Nur die Wiki-Schicht fuellt diese Felder (siehe 09-Wiki/WIKI-SCHEMA.md).
  type?: string | null; status?: string | null; updated?: string | null; aliases?: string[]
}
export interface NoteEdge { source: string; target: string } // Vault-relative Notiz-Ids

interface State {
  selected: string | null
  hovered: string | null
  openNote: string | null // Dateipfad der geöffneten Notiz (Lesepanel)
  // Ganzseitig lesen statt in der Schublade. Im Wiki der Normalfall: dort ist die Notiz das
  // Ziel, nicht eine Randbemerkung zur Landkarte dahinter.
  noteVollseite: boolean
  noteHistory: string[] // Lesepfad im Panel (ältester zuerst); openNote selbst nicht enthalten
  drill: string | null // Ordner, in den hineingezoomt wird — Cluster ODER Unterordner ('00-Inbox/hermes')
  drillReturnView: string
  systemPage: string | null // Systemseite statt Visualisierung ('verbindungen') — null = Ansichten
  settings: Settings
  nodes: VizNode[]
  edges: VizEdge[]
  rawNotes: RawNote[]
  noteEdges: NoteEdge[] // Notiz-Kanten aus graph.json, UNaggregiert (für Rück-/Verweise)
  dataSource: 'demo' | 'live'
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
  setOpenNote: (path: string | null) => void
  setSystemPage: (page: string | null) => void
  openNoteVoll: (path: string | null) => void // Notiz ganzseitig oeffnen (Wiki)
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
  noteVollseite: false,
  drill: null,
  drillReturnView: 'ring',
  systemPage: null,
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
  setSystemPage: (page) => set({ systemPage: page }),
  setHovered: (id) => set({ hovered: id }),
  // Einstieg von aussen (Suche, Inspector, Wolke) beginnt einen neuen Lesepfad
  setOpenNote: (path) => set({ openNote: path, noteHistory: [], noteVollseite: false }),
  // Wie setOpenNote, aber ganzseitig. pushNote laesst das Flag stehen — ein Verweis INNERHALB
  // einer ganzseitig gelesenen Notiz bleibt damit ebenfalls ganzseitig.
  openNoteVoll: (path) => set({ openNote: path, noteHistory: [], noteVollseite: true }),
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
    // Der Bereichsfilter kennt nur Cluster; bei einem Unterordner zaehlt sein Cluster.
    const cluster = folder.split('/')[0]
    const clusters = s.settings.clusters && !s.settings.clusters.includes(cluster) ? null : s.settings.clusters
    return {
      drill: folder,
      drillReturnView: s.drill ? s.drillReturnView : s.settings.view,
      settings: { ...s.settings, view, clusters },
      selected: null,
      systemPage: null,
    }
  }),
  exitDrill: () => set((s) => ({ drill: null, settings: { ...s.settings, view: s.drillReturnView }, selected: null, systemPage: null })),
  // Eine Ansicht zu wählen heisst: zurück zur Visualisierung.
  setSetting: (key, value) => set((s) => ({
    settings: { ...s.settings, [key]: value },
    systemPage: key === 'view' ? null : s.systemPage,
  })),
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
        type: n.type, status: n.status, updated: n.updated, aliases: n.aliases,
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
