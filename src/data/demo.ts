import { CLUSTERS } from './clusters'

export type NodeType = 'orchestrator' | 'core' | 'knowledge' | 'project' | 'external'
export type Status = 'active' | 'inactive' | 'warning' | 'archived'

export interface VizNode {
  id: string
  name: string
  type: NodeType
  ring: 0 | 1 | 2 | 3
  color: string
  icon: string          // Lucide-Key (Mapping in der View)
  status?: Status
  description?: string
  meta?: Record<string, string>
}

export interface VizEdge {
  source: string
  target: string
  kind: 'controls' | 'uses' | 'contains' | 'integrates' | 'depends-on'
}

const V = '#8b7cf6' // Orchestrator-Violett

export const ORCHESTRATOR: VizNode = {
  id: 'claude', name: 'Claude.md', type: 'orchestrator', ring: 0, color: V, icon: 'brain',
  status: 'active', description: 'Zentraler Orchestrator, Systemlogik & Entscheidungsinstanz.',
  meta: { Typ: 'Orchestrator', Status: 'aktiv' },
}

export const CORE: VizNode[] = [
  { id: 'memory', name: 'Memory', icon: 'database', description: 'Persönliche Infos, Ziele, Präferenzen, Historie.' },
  { id: 'skills', name: 'Skills', icon: 'sparkles', description: 'Recherche, Schreiben, Analyse, Planung.' },
  { id: 'workflows', name: 'Workflows', icon: 'workflow', description: 'Automatisierte Abläufe & Prozesse.' },
  { id: 'prompts', name: 'Prompt Library', icon: 'library', description: 'Vorlagen & Konventionen.' },
  { id: 'policies', name: 'Policies', icon: 'scale', description: 'Regeln & Leitplanken.' },
  { id: 'personality', name: 'Personality', icon: 'smile', description: 'Ton, Stil & Verhalten.' },
  { id: 'mcp', name: 'MCP / Connectors', icon: 'plug', description: 'Anbindungen & Integrationen.' },
  { id: 'tools', name: 'Tools', icon: 'wrench', description: 'Werkzeuge & Fähigkeiten.' },
].map((n) => ({ ...n, type: 'core' as const, ring: 1 as const, color: V, status: 'active' as const }))

const KNOWLEDGE_ICON: Record<string, string> = {
  wissen: 'book-open', projekte: 'rocket', beruf: 'briefcase', finanzen: 'landmark',
  gesundheit: 'heart-pulse', beziehungen: 'users', kreativitaet: 'lightbulb',
  spiritualitaet: 'flower', reisen: 'plane', sonstiges: 'grip',
}
const KNOWLEDGE_COUNT: Record<string, number> = {
  wissen: 132, projekte: 87, beruf: 108, finanzen: 64, gesundheit: 73,
  beziehungen: 56, kreativitaet: 91, spiritualitaet: 42, reisen: 39, sonstiges: 51,
}
export const KNOWLEDGE: VizNode[] = CLUSTERS.map((c) => ({
  id: `k-${c.key}`, name: c.label, type: 'knowledge', ring: 2, color: c.color,
  icon: KNOWLEDGE_ICON[c.key] ?? 'grip', status: 'active',
  description: `Wissenscluster „${c.label}".`, meta: { Notizen: String(KNOWLEDGE_COUNT[c.key] ?? 0) },
}))

export const PROJECTS: VizNode[] = [
  { id: 'p-alpha', name: 'Projekt Alpha', icon: 'box', status: 'active', meta: { Fortschritt: '72 %', Owner: 'Roman' } },
  { id: 'p-beta', name: 'Projekt Beta', icon: 'box', status: 'active', meta: { Fortschritt: '38 %', Owner: 'Roman' } },
  { id: 'p-gamma', name: 'Projekt Gamma', icon: 'box', status: 'warning', meta: { Fortschritt: '15 %', Owner: 'Roman' } },
].map((n) => ({ ...n, type: 'project' as const, ring: 3 as const, color: '#4c8dff', description: 'Aktives Projekt.' }))

export const EXTERNAL: VizNode[] = [
  { id: 'x-gdrive', name: 'Google Drive', icon: 'hard-drive' },
  { id: 'x-gmail', name: 'Gmail', icon: 'mail' },
  { id: 'x-cal', name: 'Google Calendar', icon: 'calendar' },
  { id: 'x-github', name: 'GitHub', icon: 'github' },
  { id: 'x-notion', name: 'Notion', icon: 'file-text' },
  { id: 'x-slack', name: 'Slack', icon: 'message-square' },
  { id: 'x-openai', name: 'OpenAI', icon: 'circle' },
  { id: 'x-anthropic', name: 'Anthropic', icon: 'asterisk' },
].map((n) => ({ ...n, type: 'external' as const, ring: 3 as const, color: '#8798b5', status: 'active' as const }))

export const NODES: VizNode[] = [ORCHESTRATOR, ...CORE, ...KNOWLEDGE, ...PROJECTS, ...EXTERNAL]

export const EDGES: VizEdge[] = [
  ...CORE.map((n) => ({ source: 'claude', target: n.id, kind: 'controls' as const })),
  ...KNOWLEDGE.map((n) => ({ source: 'claude', target: n.id, kind: 'contains' as const })),
  ...EXTERNAL.map((n) => ({ source: 'mcp', target: n.id, kind: 'integrates' as const })),
  { source: 'p-alpha', target: 'k-projekte', kind: 'uses' }, { source: 'p-alpha', target: 'workflows', kind: 'uses' },
  { source: 'p-beta', target: 'k-beruf', kind: 'uses' }, { source: 'p-beta', target: 'skills', kind: 'uses' },
  { source: 'p-gamma', target: 'k-finanzen', kind: 'uses' }, { source: 'p-gamma', target: 'memory', kind: 'depends-on' },
  { source: 'skills', target: 'tools', kind: 'uses' }, { source: 'workflows', target: 'mcp', kind: 'uses' },
]

export function passesFilter(n: VizNode, filter: string): boolean {
  if (filter === 'alle') return true
  if (n.type === 'orchestrator') return true // Anker immer sichtbar
  switch (filter) {
    case 'wissen': return n.type === 'knowledge'
    case 'projekte': return n.type === 'project'
    case 'extern': return n.type === 'external'
    case 'aktiv': return n.type === 'project' && n.status === 'active'
    default: return true
  }
}

export const STATS = {
  nodes: NODES.length,
  edges: EDGES.length,
  activeProjects: PROJECTS.filter((p) => p.status === 'active').length,
}
