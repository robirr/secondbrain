import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { getIcon } from '../icons'
import { useStore } from '../store'

const TYPE_LABEL: Record<string, string> = {
  orchestrator: 'Orchestrator', core: 'Systemkern', knowledge: 'Wissen', project: 'Projekt', external: 'Extern',
}

export default function Search() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const setSelected = useStore((s) => s.setSelected)
  const setHovered = useStore((s) => s.setHovered)
  const nodes = useStore((s) => s.nodes)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = q.trim()
    ? nodes.filter((n) => n.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8)
    : []

  const choose = (id: string) => { setSelected(id); setQ(''); setOpen(false); inputRef.current?.blur() }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <label className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-muted transition-colors focus-within:border-[rgba(139,124,246,0.4)]">
        <SearchIcon size={15} className="text-faint" />
        <input
          ref={inputRef} value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) choose(results[0].id) }}
          className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-faint focus:outline-none"
          placeholder="Suche in deinem Wissen …" />
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</kbd>
      </label>

      {open && results.length > 0 && (
        <div className="glass fade-up absolute left-0 right-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-xl p-1.5">
          {results.map((n) => {
            const Icon = getIcon(n.icon)
            return (
              <button key={n.id}
                onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                onMouseDown={(e) => { e.preventDefault(); choose(n.id) }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${n.color}1f` }}>
                  <Icon size={15} color={n.color} strokeWidth={1.7} />
                </span>
                <span className="truncate text-[13px] text-ink">{n.name}</span>
                <span className="ml-auto text-[10px] text-faint">{TYPE_LABEL[n.type]}</span>
              </button>
            )
          })}
        </div>
      )}
      {open && q.trim() && results.length === 0 && (
        <div className="glass absolute left-0 right-0 top-full z-30 mt-2 rounded-xl px-4 py-3 text-[12.5px] text-faint">
          Keine Treffer für „{q}".
        </div>
      )}
    </div>
  )
}
