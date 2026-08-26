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

// Eine Notiz wird an zwei Orten gelesen: in der Schublade rechts (aus Ring, Graph, Suche — dort
// will man die Landkarte dahinter behalten) und als ganze Seite im Wiki. Laden, Tastatur und
// Darstellung liegen deshalb hier zentral; die beiden Rahmen sind nur Huellen.

/** Laedt eine Notiz und trennt Frontmatter vom Rumpf. */
function useNoteLaden(rel: string | null) {
  const [body, setBody] = useState('')
  const [fm, setFm] = useState<Record<string, string>>({})
  const [zustand, setZustand] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    if (!rel) return
    const ac = new AbortController() // schnelles Klicken durch Links soll keine Rennen erzeugen
    setZustand('loading'); setBody(''); setFm({})
    fetch(dataUrl(rel), { cache: 'no-store', signal: ac.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text() })
      .then((t) => { const s = splitFrontmatter(t); setFm(s.fm); setBody(s.body); setZustand('idle') })
      .catch((e: unknown) => { if (!(e instanceof Error) || e.name !== 'AbortError') setZustand('error') })
    return () => ac.abort()
  }, [rel])

  return { body, fm, zustand }
}

/** Esc schliesst, Backspace/Alt+← geht im Lesepfad zurueck. Gilt in beiden Rahmen. */
function useLeseTasten() {
  const setOpenNote = useStore((s) => s.setOpenNote)
  const backNote = useStore((s) => s.backNote)
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
}

/** Kopfangaben einer Notiz: Cluster, Titel, Pfad, Herkunft. */
function useNoteKopf(rel: string | null, fm: Record<string, string>) {
  const rawNotes = useStore((s) => s.rawNotes)
  const byId = useMemo(() => new Map(rawNotes.map((r) => [r.id, r])), [rawNotes])
  if (!rel) return null
  const cluster = byId.get(rel)?.cluster ?? rel.split('/')[0]
  return {
    titel: noteTitle(rel, byId),
    cluster,
    farbe: clusterMeta(cluster).color,
    clusterName: clusterMeta(cluster).label,
    herkunft: FM_ORDER.filter((k) => fm[k]).map((k) => `${FM_LABEL[k]}: ${fm[k]}`).join(' · '),
  }
}

/** Rumpf: Markdown und die Verweislisten. In beiden Rahmen identisch. */
function NoteInhalt({ rel, zustand, body }: {
  rel: string; zustand: 'idle' | 'loading' | 'error'; body: string
}) {
  const pushNote = useStore((s) => s.pushNote)
  const links = useNoteLinks(rel)
  return (
    <>
      {zustand === 'loading' && <div className="text-[13px] text-muted">Lade Notiz …</div>}
      {zustand === 'error' && (
        <div className="rounded-xl border border-line bg-white/[0.02] px-4 py-3 text-[12.5px] text-faint">
          Notiz konnte nicht geladen werden — liegt der Vault unter <code>/data</code>?
          <div className="mt-1.5 font-mono text-[11px]">{dataUrl(rel)}</div>
        </div>
      )}
      {zustand === 'idle' && (
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
    </>
  )
}

// ---------------------------------------------------------------- Schublade rechts

export default function NotePanel() {
  const openNote = useStore((s) => s.openNote)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const backNote = useStore((s) => s.backNote)
  const canBack = useStore((s) => s.noteHistory.length > 0)
  const vollseite = useStore((s) => s.noteVollseite)
  const systemPage = useStore((s) => s.systemPage)
  const scrollRef = useRef<HTMLDivElement>(null)

  const rel = openNote ? toVaultPath(openNote) : null
  const { body, fm, zustand } = useNoteLaden(rel)
  const kopf = useNoteKopf(rel, fm)
  useLeseTasten()

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [rel])

  // Im Wiki wird ganzseitig gelesen — dort uebernimmt NoteVollseite. Verlaesst man das Wiki,
  // greift wieder die Schublade, damit eine offene Notiz nicht unsichtbar wird.
  if (!openNote || !rel || !kopf) return null
  if (vollseite && systemPage === 'wiki') return null

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
              <FileText size={11} style={{ color: kopf.farbe }} /> {kopf.clusterName}
            </div>
            <div className="truncate text-[16px] font-semibold tracking-tight">{kopf.titel}</div>
            <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{rel}</div>
            {kopf.herkunft && <div className="mt-1 truncate text-[11px] text-faint">{kopf.herkunft}</div>}
          </div>
          <button onClick={() => setOpenNote(null)} title="Schließen (Esc)"
            className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5">
          <NoteInhalt rel={rel} zustand={zustand} body={body} />
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------- ganze Seite (Wiki)

/**
 * Dieselbe Notiz, aber im Hauptbereich statt in der Schublade.
 * Fliesstext bekommt eine Lesebreite von 820 px — laengere Zeilen sind messbar schwerer zu
 * lesen, „ganze Seite" heisst also nicht „ganze Zeile". Tabellen, Codebloecke und Bilder
 * duerfen die volle Breite nutzen; sie gewinnen dadurch, Prosa nicht.
 */
export function NoteVollseite() {
  const openNote = useStore((s) => s.openNote)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const backNote = useStore((s) => s.backNote)
  const canBack = useStore((s) => s.noteHistory.length > 0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const rel = openNote ? toVaultPath(openNote) : null
  const { body, fm, zustand } = useNoteLaden(rel)
  const kopf = useNoteKopf(rel, fm)
  useLeseTasten()

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }, [rel])
  if (!openNote || !rel || !kopf) return null

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-line bg-[rgba(11,13,18,0.82)] px-8 py-4 backdrop-blur-md">
        <button onClick={() => (canBack ? backNote() : setOpenNote(null))}
          title={canBack ? 'Zurück (Alt+←)' : 'Zum Seitenverzeichnis (Esc)'}
          className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <button onClick={() => setOpenNote(null)}
            className="eyebrow mb-1 flex items-center gap-1.5 transition-colors hover:text-muted">
            <FileText size={11} style={{ color: kopf.farbe }} /> {kopf.clusterName} · Seitenverzeichnis
          </button>
          <div className="text-[19px] font-semibold tracking-tight">{kopf.titel}</div>
          <div className="mt-0.5 truncate font-mono text-[10.5px] text-faint">{rel}</div>
          {kopf.herkunft && <div className="mt-1 text-[11px] text-faint">{kopf.herkunft}</div>}
        </div>
      </div>
      <div className="px-8 pb-16 pt-6">
        <div className="lesebreite">
          <NoteInhalt rel={rel} zustand={zustand} body={body} />
        </div>
      </div>
    </div>
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
