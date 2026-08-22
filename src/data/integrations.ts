// Verbindungs-Bestandsaufnahme aus data/integrations.json (erzeugt vom Indexlauf).
// Enthält bewusst keine Geheimnisse — nur Variablennamen und gesetzt/fehlt.
import { useEffect, useState } from 'react'

export type SourceState = 'liefert' | 'bereit' | 'nicht gebaut' | 'kein Token'

export interface IntSource {
  key: string
  label: string
  type: string
  mode: 'pull' | 'push'
  base_url: string
  transport: string
  format: string
  scope: string
  target: string | null
  sync: string
  note: string
  auth_env: string
  token_set: boolean
  script: string | null
  script_exists: boolean
  command: string | null
  notes: number
  newest: string | null
  tracked_ids: number
  state: SourceState
}

export interface IntForeign { name: string; notes: number; newest: string | null }
export interface IntTool { file: string; description: string | null; command: string | null; library: boolean; changed: string | null }
export interface IntDerived { name: string; path: string | null; description: string; command: string; changed: string | null }
export interface IntSecret { name: string; set: boolean; used_by: string | null }

// Zugangswege. address kann ein Platzhalter sein: 'origin' bzw. 'origin+/qmd/mcp' setzt die
// Oberfläche selbst ein — sie kennt ihre eigene URL, der Indexer kann sie nicht kennen.
export interface IntAccess {
  key: string
  name: string
  address: string | null
  what: string
  auth: string
  command: string | null
}

export interface IntRule { n: number; title: string; text: string; fact: string | null; command: string | null }
export interface IntConfig { name: string; value: string }

export interface Integrations {
  generatedBy: string
  generatedAt: string
  vault: { notes: number; edges: number; clusters: number; inbox: number; path: string }
  sources: IntSource[]
  foreign: IntForeign[]
  tools: IntTool[]
  derived: IntDerived[]
  access: IntAccess[]
  rules: IntRule[]
  secrets: IntSecret[]
  config: IntConfig[]
  secretsFile: string
}

export type IntLoad =
  | { state: 'laden' }
  | { state: 'da'; data: Integrations }
  | { state: 'fehlt' }

// einmal laden und behalten — die Datei ändert sich nur beim Indexlauf
let cache: Promise<Integrations | null> | null = null
function fetchOnce(): Promise<Integrations | null> {
  if (!cache) {
    cache = fetch('data/integrations.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (j && Array.isArray(j.sources) ? (j as Integrations) : null))
      .catch(() => null)
  }
  return cache
}

export function useIntegrations(): IntLoad {
  const [load, setLoad] = useState<IntLoad>({ state: 'laden' })
  useEffect(() => {
    let alive = true
    fetchOnce().then((d) => { if (alive) setLoad(d ? { state: 'da', data: d } : { state: 'fehlt' }) })
    return () => { alive = false }
  }, [])
  return load
}
