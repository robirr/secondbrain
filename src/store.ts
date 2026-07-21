import { create } from 'zustand'

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
  setSelected: (id: string | null) => void
  setHovered: (id: string | null) => void
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
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
  setSelected: (id) => set({ selected: id }),
  setHovered: (id) => set({ hovered: id }),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
}))
