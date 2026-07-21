import { useMemo } from 'react'
import { getIcon } from '../icons'
import { useStore } from '../store'
import { useDisplayNodes, isNoteId } from '../display'

const GROUPS: { title: string; hint: string; type: string }[] = [
  { title: 'Orchestrator', hint: 'Steuerung & Entscheidungen', type: 'orchestrator' },
  { title: 'Systemkern', hint: 'Memory · Skills · Workflows · Tools …', type: 'core' },
  { title: 'Wissen & Organisation', hint: 'Cluster & Notizen', type: 'knowledge' },
  { title: 'Aktive Welt', hint: 'Projekte & Prozesse', type: 'project' },
  { title: 'Externe Systeme', hint: 'Dienste & Datenquellen', type: 'external' },
]

export default function LayerView() {
  const { selected, setSelected, setHovered, setOpenNote, enterDrill } = useStore()
  const { nodes } = useDisplayNodes()
  const layers = useMemo(
    () => GROUPS.map((g) => ({ ...g, nodes: nodes.filter((n) => n.type === g.type) })).filter((g) => g.nodes.length),
    [nodes],
  )

  return (
    <div className="flex h-full w-full flex-col justify-center gap-3 overflow-y-auto p-8">
      {layers.map((layer, i) => (
        <div key={layer.title} className="glass fade-up rounded-2xl px-5 py-4" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="mb-3 flex items-baseline gap-3">
            <span className="font-mono text-[11px] text-c-wissen">L{i + 1}</span>
            <span className="text-[13.5px] font-semibold text-ink">{layer.title}</span>
            <span className="eyebrow">{layer.hint}</span>
            <span className="ml-auto font-mono text-[11px] text-faint">{layer.nodes.length}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {layer.nodes.map((n) => {
              const Icon = getIcon(n.icon)
              const on = selected === n.id
              return (
                <button key={n.id}
                  onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                  onClick={() => (isNoteId(n.id) ? setOpenNote(n.id) : setSelected(on ? null : n.id))}
                  onDoubleClick={() => { if (n.meta?.Ordner) enterDrill(n.meta.Ordner as string) }}
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
