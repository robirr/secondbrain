import { useEffect } from 'react'
import Starfield from './components/Starfield'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import RightPanel from './components/RightPanel'
import ViewSwitcher from './components/ViewSwitcher'
import NotePanel from './components/NotePanel'
import ConnectionsPage from './components/ConnectionsPage'
import { clusterMeta } from './data/load'
import { useVisibleNotes } from './display'
import { useStore } from './store'
import { ChevronLeft, Layers as LayersIcon } from 'lucide-react'

export default function App() {
  const loadData = useStore((s) => s.loadData)
  const systemPage = useStore((s) => s.systemPage)
  useEffect(() => { loadData() }, [loadData])
  return (
    <div className="relative flex h-screen w-screen overflow-hidden text-ink">
      <Starfield />
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(60% 55% at 50% 42%, rgba(139,124,246,0.10), transparent 70%)' }} />

      <Sidebar />

      <main className="relative z-10 flex min-w-0 flex-1 flex-col">
        <Topbar />
        <section className="relative flex-1 overflow-hidden">
          {systemPage === 'verbindungen' ? <ConnectionsPage /> : (
            <>
              <ViewSwitcher />
              <DrillBar />
              <Legend />
            </>
          )}
        </section>
      </main>

      {/* Die Einstellungsleiste regelt die Visualisierung — auf der Systemseite hätte sie nichts zu tun. */}
      {!systemPage && <RightPanel />}
      <NotePanel />
    </div>
  )
}

function DrillBar() {
  const drill = useStore((s) => s.drill)
  const exitDrill = useStore((s) => s.exitDrill)
  const rawNotes = useVisibleNotes()
  if (!drill) return null
  const m = clusterMeta(drill)
  const count = rawNotes.filter((r) => r.cluster === drill).length
  return (
    <div className="glass fade-up absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4">
      <button onClick={exitDrill}
        className="flex items-center gap-1 rounded-full bg-white/[0.06] px-2.5 py-1 text-[12px] text-muted transition-colors hover:text-ink">
        <ChevronLeft size={14} /> Übersicht
      </button>
      <LayersIcon size={13} style={{ color: m.color }} />
      <span className="text-[13px] font-medium text-ink">{m.label}</span>
      <span className="font-mono text-[11px] text-faint">{count} Notizen</span>
    </div>
  )
}

// Legende der WIRKLICH vorhandenen Bereiche (aus der Landkarte), mit sichtbarer Anzahl.
function Legend() {
  const nodes = useStore((s) => s.nodes)
  const visible = useVisibleNotes()
  const clusters = nodes.filter((n) => n.type === 'knowledge' && n.meta?.Ordner)
  if (clusters.length === 0) return null
  return (
    <div className="glass fade-up absolute bottom-5 left-5 rounded-2xl px-4 py-3">
      <div className="eyebrow mb-2">Bereiche</div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
        {clusters.map((c) => {
          const n = visible.filter((r) => r.cluster === c.meta!.Ordner).length
          return (
            <div key={c.id} className={`flex items-center gap-2 text-[11.5px] ${n ? 'text-muted' : 'text-faint/50'}`}>
              <span className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.color, boxShadow: n ? `0 0 8px -1px ${c.color}` : undefined, opacity: n ? 1 : 0.35 }} />
              {c.name}
              <span className="ml-auto font-mono text-[10px] text-faint">{n}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
