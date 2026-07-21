import { useState } from 'react'
import { Sparkles, Loader2, CornerDownLeft } from 'lucide-react'
import { useStore } from '../store'

interface QmdResult { docid: string; file: string; title: string; score: number; snippet: string; context?: string }

// qmd-Snippet für die Anzeige säubern: @@-Kontextkopf + Zeilennummern + Markup entfernen
function cleanSnippet(s: string): string {
  return (s || '')
    .replace(/@@[^\n]*@@[^\n]*/g, '')
    .replace(/^\s*\d+:\s?/gm, '')
    .replace(/[#*`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Cluster-Ordner aus dem Dateipfad ableiten (überspringt qmd://-Schema + Collection-Präfix,
// z.B. "brain/20-Privat/…/x.md" -> "cl:20-Privat")
function clusterIdFromFile(file: string): string | null {
  const parts = file.replace(/^qmd:\/\//, '').split('/')
  const seg = parts.find((p) => /^[0-9]/.test(p))
  return seg ? `cl:${seg}` : null
}

export default function QmdSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<QmdResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { nodes, setSelected, setHovered, setOpenNote } = useStore()

  async function run() {
    const query = q.trim()
    if (!query) { setResults(null); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/qmd/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ searches: [{ type: 'vec', query }, { type: 'lex', query }], limit: 8, rerank: false }),
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

  const openResult = (r: QmdResult) => {
    setOpenNote(r.file) // Notiz im Lesepanel öffnen
    const id = clusterIdFromFile(r.file) // zusätzlich Cluster im Graphen markieren
    if (id && nodes.some((n) => n.id === id)) setSelected(id)
  }

  return (
    <div className="px-3 pb-3">
      <div className="eyebrow px-1 pb-1.5 flex items-center gap-1.5"><Sparkles size={11} className="text-c-wissen" /> Bedeutungssuche</div>
      <div className="glass flex items-center gap-2 rounded-lg px-2.5 py-2">
        {loading ? <Loader2 size={14} className="animate-spin text-c-wissen" /> : <Sparkles size={14} className="text-faint" />}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') run(); if (e.key === 'Escape') { setResults(null); setError(null) } }}
          placeholder="qmd fragen …"
          className="w-full bg-transparent text-[12.5px] text-ink placeholder:text-faint focus:outline-none" />
        <button onClick={run} title="Suchen" className="text-faint hover:text-ink"><CornerDownLeft size={13} /></button>
      </div>

      {error && <div className="mt-2 rounded-lg border border-line px-2.5 py-1.5 text-[11px] text-faint">{error} — läuft der qmd-HTTP-Dienst?</div>}

      {results && (
        <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
          {results.length === 0 && <div className="px-1 text-[11px] text-faint">Keine Treffer.</div>}
          {results.map((r) => (
            <button key={r.docid}
              onMouseEnter={() => { const id = clusterIdFromFile(r.file); if (id) setHovered(id) }}
              onMouseLeave={() => setHovered(null)}
              onClick={() => openResult(r)}
              className="w-full rounded-lg border border-line bg-white/[0.02] px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12px] font-medium text-ink">{r.title || r.file}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-c-wissen">{Math.round(r.score * 100)}%</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-faint">{cleanSnippet(r.snippet)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
