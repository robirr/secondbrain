import { NODES, KNOWLEDGE, PROJECTS, EXTERNAL } from '../data/demo'
import type { VizNode } from '../data/demo'
import { getIcon } from '../icons'
import { useStore } from '../store'

const pick = (ids: string[]) => ids.map((id) => NODES.find((n) => n.id === id)!).filter(Boolean)

const LAYERS: { title: string; hint: string; nodes: VizNode[] }[] = [
  { title: 'Orchestrator', hint: 'Steuerung & Entscheidungen', nodes: pick(['claude']) },
  { title: 'Intelligenz', hint: 'Memory · Skills · Prompts · Personality · Policies', nodes: pick(['memory', 'skills', 'prompts', 'personality', 'policies']) },
  { title: 'Organisation', hint: 'Wissen & Projektstruktur', nodes: KNOWLEDGE },
  { title: 'Ausführung', hint: 'Workflows · Tools · Projekte', nodes: [...pick(['workflows', 'tools']), ...PROJECTS] },
  { title: 'Integration', hint: 'MCP / Connectors · Plugins', nodes: pick(['mcp']) },
  { title: 'Externe Systeme', hint: 'Dienste & Datenquellen', nodes: EXTERNAL },
]

export default function LayerView() {
  const { selected, setSelected, setHovered, settings } = useStore()
  const layers = LAYERS.slice(0, Math.max(1, Math.min(6, settings.layers >= 4 ? 6 : settings.layers + 1)))

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 overflow-y-auto p-8">
      {layers.map((layer, i) => (
        <div key={layer.title} className="glass fade-up rounded-2xl px-5 py-4"
          style={{ animationDelay: `${i * 60}ms` }}>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-c-wissen">L{i + 1}</span>
            <span className="text-[13.5px] font-semibold text-ink">{layer.title}</span>
            <span className="eyebrow">{layer.hint}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {layer.nodes.map((n) => {
              const Icon = getIcon(n.icon)
              const on = selected === n.id
              return (
                <button key={n.id}
                  onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected(on ? null : n.id)}
                  className={['flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors',
                    on ? 'text-ink' : 'border-line text-muted hover:bg-white/[0.05] hover:text-ink'].join(' ')}
                  style={on ? { borderColor: n.color, background: `${n.color}1f` } : undefined}>
                  <Icon size={14} color={n.color} strokeWidth={1.7} />
                  {n.name}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
