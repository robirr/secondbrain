import {
  LayoutDashboard, Layers, Globe, Disc3, Cloud, Share2, BrainCircuit, Cable,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getIcon } from '../icons'
import { clusterMeta } from '../data/load'
import { useStore } from '../store'

// Die Inbox steht fest in der Navigation, auch wenn sie leer ist: sie ist kein Wissenscluster,
// sondern der Eingang. Ohne festen Platz taucht sie erst auf, wenn Hermes etwas einwirft — ein
// Navigationspunkt, den man nie gesehen hat und deshalb nicht sucht. „0" ist auch eine Auskunft.
const INBOX_ORDNER = '00-Inbox'
// Das Wiki ist kein Cluster wie die anderen: es ist die verdichtete Schicht mit eigenen
// Seitentypen und Zustaenden. Als Punktwolke war davon nichts zu sehen, darum oeffnet die Zeile
// das Seitenverzeichnis. Die Landkarte bleibt erreichbar — ueber den Knopf dort oder per
// Doppelklick auf das Wiki-Tortenstueck in der Uebersicht.
const WIKI_ORDNER = '09-Wiki'

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
  const systemPage = useStore((s) => s.systemPage)
  const setSystemPage = useStore((s) => s.setSystemPage)
  const noteCount = useStore((s) => s.rawNotes.length)
  const inboxCount = useStore((s) => s.rawNotes.filter((n) => n.cluster === INBOX_ORDNER).length)

  // echte Cluster (aus der Landkarte) als Sprungziele
  const clusters = nodes
    .filter((n) => n.type === 'knowledge' && n.meta?.Ordner && n.meta.Ordner !== INBOX_ORDNER)
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
            <InboxZeile count={inboxCount} on={drill === INBOX_ORDNER}
              onClick={() => (drill === INBOX_ORDNER ? exitDrill() : enterDrill(INBOX_ORDNER))} />
            <NavButton label="Übersicht" icon={LayoutDashboard} on={!drill && !systemPage} onClick={exitDrill} />
            {clusters.map((c) => {
              const Icon = getIcon(c.icon)
              const wiki = c.folder === WIKI_ORDNER
              const on = wiki ? systemPage === 'wiki' : drill === c.folder && !systemPage
              return (
                <li key={c.folder}>
                  <button
                    onClick={() => {
                      if (wiki) setSystemPage(systemPage === 'wiki' ? null : 'wiki')
                      else if (on) exitDrill()
                      else enterDrill(c.folder)
                    }}
                    className={rowCls(on)}
                    title={wiki ? 'Seitenverzeichnis des Wikis öffnen' : `In „${c.name}" springen`}
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
              const on = view === key && !systemPage
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
        {/* System — nicht die Notizen, sondern das Drumherum */}
        <div className="mb-2">
          <div className="eyebrow px-3 pb-2">System</div>
          <ul className="space-y-0.5">
            <NavButton label="Verbindungen" icon={Cable} on={systemPage === 'verbindungen'}
              onClick={() => setSystemPage(systemPage === 'verbindungen' ? null : 'verbindungen')} />
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

/**
 * Eingang. Ruhig, solange nichts wartet — dann grau wie die Cluster-Zähler daneben.
 * Sobald etwas eintrifft, bekommt der Zähler Farbe und eine Kontur: die Zeile soll dann den Blick
 * ziehen, ohne zu lärmen. Ziel des Klicks ist der ganz normale Drill in 00-Inbox.
 */
function InboxZeile({ count, on, onClick }: { count: number; on: boolean; onClick: () => void }) {
  const m = clusterMeta('00-Inbox')
  const Icon = getIcon(m.icon)
  const wartet = count > 0
  return (
    <li>
      <button
        onClick={onClick}
        className={rowCls(on)}
        title={wartet
          ? `${count} ${count === 1 ? 'Notiz wartet' : 'Notizen warten'} auf das Einsortieren`
          : 'Nichts wartet. Hier legen der Capture-Kanal und die Konnektoren ab.'}
      >
        {on && <ActiveBar />}
        {/* Farbe ueber die Utility-Klasse, nicht ueber das color-Attribut: eine var() im
            Praesentationsattribut wird hier nicht aufgeloest, das Icon bliebe grau. */}
        <Icon
          size={16}
          strokeWidth={1.8}
          className={wartet ? 'text-c-kreativitaet' : on ? 'text-muted' : 'text-faint group-hover:text-muted'}
        />
        <span className="truncate">Inbox</span>
        {wartet ? (
          <span className="ml-auto rounded-full border border-[rgba(255,157,77,0.35)] bg-[rgba(255,157,77,0.12)] px-1.5 py-px font-mono text-[10px] text-c-kreativitaet">
            {count}
          </span>
        ) : (
          <span className="ml-auto font-mono text-[10px] text-faint">0</span>
        )}
      </button>
    </li>
  )
}
