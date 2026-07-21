import {
  LayoutDashboard, FolderKanban, BookOpen, Sparkles, Workflow, Activity,
  Boxes, Layers, Globe, Disc3, Cloud, Share2,
  FileText, StickyNote, Files, Database, Archive,
  Settings, Plug, Shield, User,
  Plus, HelpCircle, Moon, BrainCircuit,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../store'
import QmdSearch from './QmdSearch'

const VIEW_KEY: Record<string, string> = {
  Architektur: 'architektur', Ebenen: 'ebenen', Globus: 'globus', Ring: 'ring', Cloud: 'cloud', Graph: 'graph',
}

type Item = { label: string; icon: LucideIcon; badge?: string }
type Section = { title: string; items: Item[] }

const SECTIONS: Section[] = [
  {
    title: 'Navigation',
    items: [
      { label: 'Übersicht', icon: LayoutDashboard },
      { label: 'Projekte', icon: FolderKanban },
      { label: 'Wissen', icon: BookOpen },
      { label: 'Skills', icon: Sparkles },
      { label: 'Workflows', icon: Workflow },
      { label: 'Aktivitäten', icon: Activity },
    ],
  },
  {
    title: 'Ansichten',
    items: [
      { label: 'Architektur', icon: Boxes },
      { label: 'Ebenen', icon: Layers },
      { label: 'Globus', icon: Globe },
      { label: 'Ring', icon: Disc3 },
      { label: 'Cloud', icon: Cloud },
      { label: 'Graph', icon: Share2 },
    ],
  },
  {
    title: 'Daten',
    items: [
      { label: 'Dokumente', icon: FileText },
      { label: 'Notizen', icon: StickyNote },
      { label: 'Dateien', icon: Files },
      { label: 'Quellen', icon: Database },
      { label: 'Archive', icon: Archive },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Einstellungen', icon: Settings },
      { label: 'Integrationen', icon: Plug },
      { label: 'Sicherheit', icon: Shield },
      { label: 'Profil', icon: User },
    ],
  },
]

export default function Sidebar() {
  const [active, setActive] = useState('Übersicht')
  const view = useStore((s) => s.settings.view)
  const setSetting = useStore((s) => s.setSetting)

  return (
    <aside className="glass relative z-20 flex h-full w-[248px] shrink-0 flex-col border-y-0 border-l-0">
      {/* Marke */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-[rgba(139,124,246,0.12)] glow-violet">
          <BrainCircuit size={17} className="text-c-wissen" />
        </div>
        <div className="text-[15px] font-semibold tracking-tight">Second&nbsp;Brain</div>
      </div>

      {/* qmd-Bedeutungssuche (oben links) */}
      <QmdSearch />

      {/* Sektionen */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mb-5">
            <div className="eyebrow px-3 pb-2">{section.title}</div>
            <ul className="space-y-0.5">
              {section.items.map(({ label, icon: Icon }) => {
                const isView = section.title === 'Ansichten'
                const on = isView ? view === VIEW_KEY[label] : active === label
                return (
                  <li key={label}>
                    <button
                      onClick={() => (isView ? setSetting('view', VIEW_KEY[label]) : setActive(label))}
                      className={[
                        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-[7px] text-[13.5px] transition-colors',
                        on ? 'bg-white/[0.06] text-ink' : 'text-muted hover:bg-white/[0.03] hover:text-ink',
                      ].join(' ')}
                    >
                      {on && <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-c-wissen" />}
                      <Icon size={16} className={on ? 'text-c-wissen' : 'text-faint group-hover:text-muted'} />
                      <span className="truncate">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Fußzeile */}
      <div className="border-t border-line p-3">
        <button className="mb-2 flex w-full items-center gap-2.5 rounded-lg border border-line bg-white/[0.02] px-3 py-2 text-[13px] text-ink transition-colors hover:bg-white/[0.05]">
          <Plus size={15} className="text-c-wissen" /> Neuer Eintrag
        </button>
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            <FooterIcon icon={HelpCircle} title="Hilfe" />
            <FooterIcon icon={Moon} title="Theme" />
          </div>
          <div className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5">
            <div className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#8b7cf6] to-[#4c8dff] text-[10px] font-semibold text-white">R</div>
            <span className="text-[12px] text-muted">Roman</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

function FooterIcon({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <button title={title} className="grid h-8 w-8 place-items-center rounded-lg text-faint transition-colors hover:bg-white/[0.05] hover:text-ink">
      <Icon size={16} />
    </button>
  )
}
