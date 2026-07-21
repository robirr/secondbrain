import { X, Crosshair, Share2, Waypoints, ExternalLink } from 'lucide-react'
import type { Status } from '../data/demo'
import { useStore } from '../store'

const TYPE_LABEL: Record<string, string> = {
  orchestrator: 'Orchestrator', core: 'Systemkern', knowledge: 'Wissenscluster',
  project: 'Projekt', external: 'Externes System',
}
const STATUS_LABEL: Record<Status, string> = { active: 'aktiv', inactive: 'inaktiv', warning: 'Achtung', archived: 'archiviert' }
const STATUS_COLOR: Record<Status, string> = { active: '#57d07f', inactive: '#8798b5', warning: '#f6c344', archived: '#565d70' }

export default function InspectorPanel() {
  const { selected, setSelected, setHovered, nodes, edges } = useStore()
  const node = nodes.find((n) => n.id === selected)
  if (!node) return null

  const connections = edges
    .filter((e) => e.source === node.id || e.target === node.id)
    .map((e) => (e.source === node.id ? e.target : e.source))
  const connNodes = [...new Set(connections)].map((id) => nodes.find((n) => n.id === id)!).filter(Boolean)

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="eyebrow mb-1">{TYPE_LABEL[node.type] ?? node.type}</div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: node.color, boxShadow: `0 0 8px ${node.color}` }} />
            <div className="truncate text-[15px] font-semibold tracking-tight">{node.name}</div>
          </div>
        </div>
        <button onClick={() => setSelected(null)} title="Schließen"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {node.description && <p className="text-[13px] leading-relaxed text-muted">{node.description}</p>}

        {node.status && (
          <Field label="Status">
            <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: STATUS_COLOR[node.status] }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[node.status] }} />
              {STATUS_LABEL[node.status]}
            </span>
          </Field>
        )}

        {node.meta && Object.entries(node.meta).map(([k, v]) => (
          <Field key={k} label={k}><span className="text-[13px] text-ink">{v}</span></Field>
        ))}

        <div>
          <div className="eyebrow mb-2">Verbindungen · {connNodes.length}</div>
          <div className="space-y-1">
            {connNodes.map((n) => (
              <button key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                onClick={() => setSelected(n.id)}
                className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: n.color }} />
                <span className="truncate">{n.name}</span>
                <span className="ml-auto text-[10px] text-faint">{TYPE_LABEL[n.type]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-line p-4">
        <Action icon={Crosshair} label="Fokussieren" onClick={() => setSelected(node.id)} />
        <Action icon={Waypoints} label="Beziehungen" onClick={() => setSelected(node.id)} />
        <Action icon={Share2} label="Im Graph" onClick={() => useStore.getState().setSetting('view', 'graph')} />
        <Action icon={ExternalLink} label="Öffnen" onClick={() => {}} muted />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-faint">{label}</span>
      {children}
    </div>
  )
}

function Action({ icon: Icon, label, onClick, muted }: { icon: typeof X; label: string; onClick: () => void; muted?: boolean }) {
  return (
    <button onClick={onClick}
      className={['flex items-center justify-center gap-2 rounded-lg border border-line px-3 py-2 text-[12px] transition-colors hover:bg-white/[0.06]',
        muted ? 'text-faint' : 'text-muted hover:text-ink'].join(' ')}>
      <Icon size={13} /> {label}
    </button>
  )
}
