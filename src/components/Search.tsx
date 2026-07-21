import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, Loader2, Sparkles } from 'lucide-react'
import { useStore } from '../store'

interface QmdResult { docid: string; file: string; title: string; score: number; snippet: string }

// qmd-Snippet für die Anzeige säubern
function cleanSnippet(s: string): string {
  return (s || '')
    .replace(/@@[^\n]*@@[^\n]*/g, '')
    .replace(/^\s*\d+:\s?/gm, '')
    .replace(/[#*`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cluster-Ordner aus dem Dateipfad ableiten (für die Graf-Markierung)
function clusterIdFromFile(file: string): string | null {
  const parts = file.replace(/^qmd:\/\//, '').split('/').filter(Boolean)
  const seg = parts.find((p) => /^[0-9]/.test(p))
  return seg ? `cl:${seg}` : null
}

export default function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<QmdResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { nodes, setSelected, setHovered, setOpenNote } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
      if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function run() {
    const query = q.trim()
    if (!query) { setResults(null); return }
    setLoading(true); setError(null); setOpen(true)
    try {
      const res = await fetch('/qmd/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searches: [{ type: 'vec', query }, { type: 'lex', query }], limit: 10, rerank: false }),
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setResults(Array.isArray(data.results) ? data.results : [])
    } catch {
      setError('qmd nicht erreichbar')
      setResults(null)
    } finally {
      setLoading(false)
    }
  }

  const choose = (r: QmdResult) => {
    setOpenNote(r.file)
    const id = clusterIdFromFile(r.file)
    if (id && nodes.some((n) => n.id === id)) setSelected(id)
    setOpen(false)
  }

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <label className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-muted transition-colors focus-within:border-[rgba(139,124,246,0.4)]">
        {loading ? <Loader2 size={15} className="animate-spin text-c-wissen" /> : <SearchIcon size={15} className="text-faint" />}
        <input
          ref={inputRef} value={q}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value.trim()) { setResults(null); setError(null) } }}
          onFocus={() => { if (results || error) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => { if (e.key === 'Enter') run() }}
          className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-faint focus:outline-none"
          placeholder="Bedeutungssuche in deinem Wissen …" />
        <span className="hidden items-center gap-1 text-[10px] text-faint sm:flex"><Sparkles size={11} /> qmd</span>
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</kbd>
      </label>

      {open && error && (
        <div className="glass absolute left-0 right-0 top-full z-30 mt-2 rounded-xl px-4 py-3 text-[12px] text-faint">
          {error} — läuft der qmd-HTTP-Dienst?
        </div>
      )}

      {open && results && (
        <div className="glass fade-up absolute left-0 right-0 top-full z-30 mt-2 max-h-[26rem] overflow-y-auto rounded-xl p-1.5">
          {results.length === 0 && <div className="px-3 py-2 text-[12px] text-faint">Keine Treffer.</div>}
          {results.map((r) => (
            <button key={r.docid}
              onMouseEnter={() => { const id = clusterIdFromFile(r.file); if (id) setHovered(id) }}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={(e) => { e.preventDefault(); choose(r) }}
              className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.06]">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{r.title || r.file}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-c-wissen">{Math.round(r.score * 100)}%</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-faint">{cleanSnippet(r.snippet)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
