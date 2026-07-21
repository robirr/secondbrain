import { SlidersHorizontal, Bell } from 'lucide-react'
import Search from './Search'

export default function Topbar() {
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 px-6">
      <div>
        <div className="text-[15px] font-semibold tracking-tight leading-none">Übersicht</div>
        <div className="eyebrow mt-1">Dein Wissenssystem auf einen Blick</div>
      </div>

      {/* Globale Suche */}
      <Search />

      <div className="flex items-center gap-1.5">
        <TopIcon icon={SlidersHorizontal} title="Ansicht konfigurieren" />
        <TopIcon icon={Bell} title="Benachrichtigungen" />
      </div>
    </header>
  )
}

function TopIcon({ icon: Icon, title }: { icon: typeof Bell; title: string }) {
  return (
    <button title={title} className="glass grid h-9 w-9 place-items-center rounded-xl text-muted transition-colors hover:text-ink">
      <Icon size={16} />
    </button>
  )
}
