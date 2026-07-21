import { useEffect, useState } from 'react'
import { X, FileText, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useStore } from '../store'

// Pfad → Vault-relativ (qmd://-Schema + Collection-Präfix entfernen)
function toVaultPath(p: string): string {
  const parts = p.replace(/^qmd:\/\//, '').split('/').filter(Boolean)
  if (parts.length > 1 && !/^[0-9]/.test(parts[0])) parts.shift() // Collection-Präfix (z.B. "brain")
  return parts.join('/')
}

export default function NotePanel() {
  const openNote = useStore((s) => s.openNote)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const [content, setContent] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!openNote) return
    const rel = toVaultPath(openNote)
    setState('loading'); setContent('')
    fetch('data/' + rel.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error(); return r.text() })
      .then((t) => { setContent(t.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '')); setState('idle') })
      .catch(() => setState('error'))
  }, [openNote])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenNote(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpenNote])

  if (!openNote) return null
  const rel = toVaultPath(openNote)
  const title = decodeURIComponent(rel.split('/').pop() || '').replace(/\.md$/i, '')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpenNote(null)} />
      <aside className="glass fixed right-0 top-0 z-50 flex h-full w-[min(600px,70vw)] flex-col border-y-0 border-r-0 fade-up">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div className="min-w-0">
            <div className="eyebrow mb-1 flex items-center gap-1.5"><FileText size={11} className="text-c-wissen" /> Notiz</div>
            <div className="truncate text-[16px] font-semibold tracking-tight">{title}</div>
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{rel}</div>
          </div>
          <button onClick={() => setOpenNote(null)} title="Schließen (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {state === 'loading' && <div className="text-[13px] text-muted">Lade Notiz …</div>}
          {state === 'error' && (
            <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[12.5px] text-faint">
              Notiz konnte nicht geladen werden. Liegt der Vault (mit den `.md`-Dateien) unter <code>/data</code>?
              <div className="mt-1.5 flex items-center gap-1.5 text-faint"><ExternalLink size={12} /> {rel}</div>
            </div>
          )}
          {state === 'idle' && (
            <div className="md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
