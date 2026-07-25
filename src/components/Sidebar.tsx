import {
  LayoutDashboard, Layers, Globe, Disc3, Cloud, Share2, BrainCircuit,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getIcon } from '../icons'
import { useStore } from '../store'

// Ansichten (funktional — schalten settings.view)
const VIEWS: { label: string; key: string; icon: LucideIcon }[] = [
  { label: 'Ring', key: 'ring', icon: Disc3 },
  { label: 'Ebenen', key: 'ebenen', icon: Layers },
  { label: 'Globus', key: 'globus', icon: Globe },
  { label: 'Cloud', key: 'cloud', icon: Cloud },
  { label: 'Graph', key: 'graph', icon: Share2 },
]

export default function Sidebar() {
  const nodes = useStore((s) => s.nodes)
  const drill = useStore((s) => s.drill)
  const view = useStore((s) => s.settings.view)
  const setSetting = useStore((s) => s.setSetting)
  const enterDrill = useStore((s) => s.enterDrill)
  const exitDrill = useStore((s) => s.exitDrill)
  const dataSource = useStore((s) => s.dataSource)
  const noteCount = useStore((s) => s.rawNotes.length)

  // echte Cluster (aus der Landkarte) als Sprungziele
  const clusters = nodes
    .filter((n) => n.type === 'knowledge' && n.meta?.Ordner)
    .map((n) => ({ folder: n.meta!.Ordner as string, name: n.name, color: n.color, icon: n.icon, count: Number(String(n.meta!.Notizen ?? '').replace(/\D/g, '')) || 0 }))

  return (
    <aside className="glass relative z-20 flex h-full w-[248px] shrink-0 flex-col border-y-0 border-l-0">
      {/* Marke */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-[rgba(139,124,246,0.12)] glow-violet">
          <BrainCircuit size={17} className="text-c-wissen" />
        </div>
        <div className="text-[15px] font-semibold tracking-tight">Second&nbsp;Brain</div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {/* Navigation — Übersicht + echte Cluster (Doppelklick-Ziel = Drill) */}
        <div className="mb-5">
          <div className="eyebrow px-3 pb-2">Navigation</div>
          <ul className="space-y-0.5">
            <NavButton label="Übersicht" icon={LayoutDashboard} on={!drill} onClick={exitDrill} />
            {clusters.map((c) => {
              const Icon = getIcon(c.icon)
              const on = drill === c.folder
              return (
                <li key={c.folder}>
                  <button
                    onClick={() => (on ? exitDrill() : enterDrill(c.folder))}
                    className={rowCls(on)}
                    title={`In „${c.name}" springen`}
                  >
                    {on && <ActiveBar />}
                    <Icon size={16} color={on ? c.color : undefined} className={on ? '' : 'text-faint group-hover:text-muted'} strokeWidth={1.8} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-faint">{c.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Ansichten — schalten die Visualisierung */}
        <div className="mb-5">
          <div className="eyebrow px-3 pb-2">Ansichten</div>
          <ul className="space-y-0.5">
            {VIEWS.map(({ label, key, icon: Icon }) => {
              const on = view === key
              return (
                <li key={key}>
                  <button onClick={() => setSetting('view', key)} className={rowCls(on)}>
                    {on && <ActiveBar />}
                    <Icon size={16} className={on ? 'text-c-wissen' : 'text-faint group-hover:text-muted'} />
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </nav>

      {/* Fußzeile — ehrlicher Status + Nutzer */}
      <div className="border-t border-line p-3">
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dataSource === 'live' ? 'bg-c-beruf' : 'bg-faint'}`}
            style={dataSource === 'live' ? { boxShadow: '0 0 8px -1px var(--color-c-beruf)' } : undefined} />
          <span className="text-[12px] text-muted">
            {dataSource === 'live' ? 'Live' : 'Demo'} · {noteCount} Notizen
          </span>
          <span className="eyebrow ml-auto">nur Lesen</span>
        </div>
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] text-faint">graph.json</span>
          <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#8b7cf6] to-[#4c8dff] text-[10px] font-semibold text-white">R</div>
            <span className="text-[12px] text-muted">Roman</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

const rowCls = (on: boolean) =>
  [
    'group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13.5px] transition-colors',
    on ? 'bg-white/[0.06] text-ink' : 'text-muted hover:bg-white/[0.03] hover:text-ink',
  ].join(' ')

const ActiveBar = () => <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-c-wissen" />

function NavButton({ label, icon: Icon, on, onClick }: { label: string; icon: LucideIcon; on: boolean; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className={rowCls(on)}>
        {on && <ActiveBar />}
        <Icon size={16} className={on ? 'text-c-wissen' : 'text-faint group-hover:text-muted'} />
        <span className="truncate">{label}</span>
      </button>
    </li>
  )
}
