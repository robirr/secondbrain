import { useEffect, useRef, useState } from 'react'
import { Search as SearchIcon, Loader2, Sparkles, CornerDownLeft } from 'lucide-react'
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

// Suchbegriffe im Text hervorheben (eigenständige Wörter ab 2 Zeichen)
function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
function highlight(text: string, query: string) {
  const terms = query.trim().split(/\s+/).filter((t) => t.length >= 2).map(escapeRegExp)
  if (terms.length === 0) return text
  const re = new RegExp(`(${terms.join('|')})`, 'gi')
  return text.split(re).map((part, i) =>
    re.test(part) ? <mark key={i} className="rounded bg-c-wissen/25 px-0.5 text-ink">{part}</mark> : part)
}

// ---- qmd über das MCP-Protokoll (POST /qmd/mcp) -----------------------------
// qmd bietet HTTP nur als MCP-Server an (kein /query). Ablauf: initialize ->
// notifications/initialized -> tools/call "query". Session-ID wird zwischengespeichert.
const MCP = '/qmd/mcp'
const MCP_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }
let sessionId: string | null = null

async function parseMcp(res: Response): Promise<unknown> {
  const text = await res.text()
  if ((res.headers.get('Content-Type') || '').includes('text/event-stream')) {
    const line = text.split('\n').filter((l) => l.startsWith('data:')).pop()
    return line ? JSON.parse(line.slice(5).trim()) : null
  }
  return text ? JSON.parse(text) : null
}

async function ensureSession(): Promise<void> {
  if (sessionId) return
  const res = await fetch(MCP, {
    method: 'POST', headers: MCP_HEADERS,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'second-brain-app', version: '1.0' } },
    }),
  })
  if (!res.ok) throw new Error('init HTTP ' + res.status)
  const sid = res.headers.get('Mcp-Session-Id') || res.headers.get('mcp-session-id')
  if (!sid) throw new Error('keine Session-ID')
  sessionId = sid
  // Handshake abschließen (Notification, ohne Antwortauswertung)
  await fetch(MCP, {
    method: 'POST', headers: { ...MCP_HEADERS, 'Mcp-Session-Id': sessionId },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  })
}

async function qmdQuery(query: string): Promise<QmdResult[]> {
  const call = {
    jsonrpc: '2.0', id: 1, method: 'tools/call',
    params: { name: 'query', arguments: { searches: [{ type: 'lex', query }, { type: 'vec', query }], limit: 10, rerank: false } },
  }
  const send = async () => {
    await ensureSession()
    return fetch(MCP, { method: 'POST', headers: { ...MCP_HEADERS, 'Mcp-Session-Id': sessionId as string }, body: JSON.stringify(call) })
  }
  let res = await send()
  if (res.status === 404) { sessionId = null; res = await send() } // Session abgelaufen → neu
  if (!res.ok) throw new Error('HTTP ' + res.status)
  const data = (await parseMcp(res)) as { result?: { structuredContent?: { results?: QmdResult[] } } } | null
  const results = data?.result?.structuredContent?.results
  return Array.isArray(results) ? results : []
}
// ---------------------------------------------------------------------------

export default function Search() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<QmdResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { nodes, setSelected, setHovered, setOpenNote } = useStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!open || !results?.length) return
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, results])

  async function run() {
    const query = q.trim()
    if (!query) { setResults(null); return }
    setLoading(true); setError(null); setOpen(true); setActive(0)
    try {
      setResults(await qmdQuery(query))
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

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return }
    if (e.key === 'Enter') {
      if (open && results && results.length > 0) { e.preventDefault(); choose(results[active]) }
      else run()
      return
    }
    if (!open || !results?.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % results.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i - 1 + results.length) % results.length) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(results.length - 1) }
  }

  const showDropdown = open && (loading || error || results)

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <label className="glass flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-muted transition-colors focus-within:border-[rgba(139,124,246,0.4)]">
        {loading ? <Loader2 size={15} className="animate-spin text-c-wissen" /> : <SearchIcon size={15} className="text-faint" />}
        <input
          ref={inputRef} value={q}
          role="combobox" aria-expanded={!!showDropdown} aria-controls="qmd-results"
          aria-activedescendant={open && results?.length ? `qmd-r-${active}` : undefined}
          onChange={(e) => { setQ(e.target.value); if (!e.target.value.trim()) { setResults(null); setError(null); setOpen(false) } }}
          onFocus={() => { if (results || error) setOpen(true) }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="w-full bg-transparent text-[13.5px] text-ink placeholder:text-faint focus:outline-none"
          placeholder="Bedeutungssuche in deinem Wissen …" />
        <span className="hidden items-center gap-1 text-[10px] text-faint sm:flex"><Sparkles size={11} /> qmd</span>
        <kbd className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[10px] text-faint">⌘K</kbd>
      </label>

      {showDropdown && (
        <div id="qmd-results" ref={listRef} role="listbox"
          className="glass fade-up absolute left-0 right-0 top-full z-30 mt-2 max-h-[26rem] overflow-y-auto rounded-xl p-1.5">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-faint">
              <Loader2 size={13} className="animate-spin text-c-wissen" /> Suche läuft …
            </div>
          )}

          {!loading && error && (
            <div className="px-3 py-2 text-[12px] text-faint">{error} — läuft der qmd-Dienst (Modell/Index bereit)?</div>
          )}

          {!loading && !error && results && results.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-faint">Keine Treffer für „{q.trim()}".</div>
          )}

          {!loading && !error && results && results.map((r, i) => (
            <button key={r.docid} id={`qmd-r-${i}`} data-idx={i} role="option" aria-selected={i === active}
              onMouseEnter={() => { setActive(i); const id = clusterIdFromFile(r.file); if (id) setHovered(id) }}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={(e) => { e.preventDefault(); choose(r) }}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${i === active ? 'bg-white/[0.08]' : 'hover:bg-white/[0.06]'}`}>
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-ink">{highlight(r.title || r.file, q)}</span>
                <span className="ml-auto shrink-0 font-mono text-[10px] text-c-wissen">{Math.round(r.score * 100)}%</span>
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-faint">{highlight(cleanSnippet(r.snippet), q)}</div>
            </button>
          ))}

          {!loading && !error && results && results.length > 0 && (
            <div className="mt-1 flex items-center gap-3 border-t border-line px-3 pt-1.5 text-[10px] text-faint">
              <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> navigieren</span>
              <span className="flex items-center gap-1"><CornerDownLeft size={10} /> öffnen</span>
              <span className="flex items-center gap-1"><kbd className="font-mono">esc</kbd> schließen</span>
              <span className="ml-auto">{results.length} Treffer</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
