import { SlidersHorizontal } from 'lucide-react'
import Search from './Search'
import { useStore } from '../store'

export default function Topbar() {
  const selected = useStore((s) => s.selected)
  const setSelected = useStore((s) => s.setSelected)
  const systemPage = useStore((s) => s.systemPage)
  const onSystem = systemPage === 'verbindungen'
  return (
    <header className="relative z-10 flex h-16 shrink-0 items-center gap-4 px-6">
      <div>
        <div className="text-[15px] font-semibold tracking-tight leading-none">
          {onSystem ? 'Verbindungen' : 'Übersicht'}
        </div>
        <div className="eyebrow mt-1">
          {onSystem ? 'Woher das Wissen kommt und was daraus gebaut wird' : 'Dein Wissenssystem auf einen Blick'}
        </div>
      </div>

      {/* Globale Suche */}
      <Search />

      <div className="flex items-center gap-1.5">
        {!onSystem && <button
          title="Ansichtseinstellungen"
          onClick={() => setSelected(null)}
          className={[
            'glass grid h-9 w-9 place-items-center rounded-xl transition-colors',
            selected ? 'text-muted hover:text-ink' : 'text-c-wissen',
          ].join(' ')}
        >
          <SlidersHorizontal size={16} />
        </button>}
      </div>
    </header>
  )
}
