import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, FileText, Link2, Quote, X } from 'lucide-react'
import { clusterMeta } from '../data/load'
import { dataUrl, noteTitle, splitFrontmatter, toVaultPath, useNoteLinks } from '../data/notes'
import type { NoteRef } from '../data/notes'
import NoteMarkdown from './NoteMarkdown'
import { useStore } from '../store'

// Herkunft: nur bekannte Felder in fester Reihenfolge — kein Roh-YAML im Kopf.
const FM_ORDER = ['source', 'branch', 'created', 'updated', 'status', 'project', 'type'] as const
const FM_LABEL: Record<string, string> = {
  source: 'Quelle', branch: 'Zweig', created: 'Erstellt', updated: 'Stand',
  status: 'Status', project: 'Projekt', type: 'Typ',
}

export default function NotePanel() {
  const openNote = useStore((s) => s.openNote)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const pushNote = useStore((s) => s.pushNote)
  const backNote = useStore((s) => s.backNote)
  const canBack = useStore((s) => s.noteHistory.length > 0)
  const rawNotes = useStore((s) => s.rawNotes)
  const [body, setBody] = useState('')
  const [fm, setFm] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)

  const rel = openNote ? toVaultPath(openNote) : null
  const byId = useMemo(() => new Map(rawNotes.map((r) => [r.id, r])), [rawNotes])
  const links = useNoteLinks(rel)

  useEffect(() => {
    if (!rel) return
    const ac = new AbortController() // schnelles Klicken durch Links soll keine Rennen erzeugen
    setState('loading'); setBody(''); setFm({})
    fetch(dataUrl(rel), { cache: 'no-store', signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text() })
      .then((t) => { const s = splitFrontmatter(t); setFm(s.fm); setBody(s.body); setState('idle') })
      .catch((e: unknown) => { if (!(e instanceof Error) || e.name !== 'AbortError') setState('error') })
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    return () => ac.abort()
  }, [rel])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenNote(null); return }
      const t = e.target as HTMLElement | null
      // Tippen im Suchfeld nie kapern
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      // Alt+← ist der Browser-Zurück-Shortcut; ohne preventDefault verlässt man die App
      if (e.key === 'Backspace' || (e.altKey && e.key === 'ArrowLeft')) { e.preventDefault(); backNote() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpenNote, backNote])

  if (!openNote || !rel) return null

  const title = noteTitle(rel, byId)
  const cluster = byId.get(rel)?.cluster ?? rel.split('/')[0]
  const color = clusterMeta(cluster).color
  const herkunft = FM_ORDER.filter((k) => fm[k]).map((k) => `${FM_LABEL[k]}: ${fm[k]}`).join(' · ')

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" onClick={() => setOpenNote(null)} />
      <aside className="glass fixed right-0 top-0 z-50 flex h-full w-[min(600px,70vw)] flex-col border-y-0 border-r-0 fade-up">
        <div className="flex items-start gap-2 border-b border-line px-6 py-4">
          {canBack && (
            <button onClick={backNote} title="Zurück (Alt+←)"
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="eyebrow mb-1 flex items-center gap-1.5">
              <FileText size={11} style={{ color }} /> {clusterMeta(cluster).label}
            </div>
            <div className="truncate text-[16px] font-semibold tracking-tight">{title}</div>
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{rel}</div>
            {herkunft && <div className="mt-1 truncate text-[11px] text-faint">{herkunft}</div>}
          </div>
          <button onClick={() => setOpenNote(null)} title="Schließen (Esc)"
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          {state === 'loading' && <div className="text-[13px] text-muted">Lade Notiz …</div>}
          {state === 'error' && (
            <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[12.5px] text-faint">
              Notiz konnte nicht geladen werden — liegt der Vault unter <code>/data</code>?
              <div className="mt-1.5 font-mono text-[11px]">{dataUrl(rel)}</div>
            </div>
          )}
          {state === 'idle' && (
            <>
              <div className="md"><NoteMarkdown body={body} noteId={rel} /></div>
              {(links.out.length > 0 || links.incoming.length > 0) && (
                <div className="mt-8 space-y-4 border-t border-line pt-5">
                  {links.out.length > 0 && <LinkList icon={Link2} label="Verweist auf" items={links.out} onOpen={pushNote} />}
                  {links.incoming.length > 0 && <LinkList icon={Quote} label="Wird erwähnt in" items={links.incoming} onOpen={pushNote} />}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  )
}

function LinkList({ icon: Icon, label, items, onOpen }: {
  icon: typeof Link2; label: string; items: NoteRef[]; onOpen: (id: string) => void
}) {
  return (
    <div>
      <div className="eyebrow mb-2 flex items-center gap-1.5"><Icon size={11} /> {label} · {items.length}</div>
      <div className="space-y-1">
        {items.map((r) => (
          <button key={r.id} onClick={() => onOpen(r.id)} title={r.id}
            className="flex w-full items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-white/[0.05] hover:text-ink">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: clusterMeta(r.cluster).color }} />
            <span className="truncate">{r.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
