// Markdown einer Notiz rendern — mit aufgelösten internen Links, echten Bildern und
// sichtbar markierten toten Verweisen. Entschieden wird ausschliesslich in data/notes.ts.
import { useMemo, useState } from 'react'
import { ArrowUpRight, ImageOff, Unlink } from 'lucide-react'
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkVaultLinks, { WIKI_SCHEME } from '../remark-vault-links'
import remarkCallouts from '../remark-callouts'
import { buildByBase, classifyHref, dataUrl, dirOf, imageUrl } from '../data/notes'
import type { DeadReason, LinkCtx } from '../data/notes'
import { useStore } from '../store'

const DEAD_TITLE: Record<DeadReason, string> = {
  pfad: 'Ziel nicht im Index — Datei fehlt oder wurde verschoben',
  wiki: 'Wiki-Seite existiert noch nicht',
  trilium: 'Trilium-interner Verweis — beim Import nicht mitgekommen',
}

function NoteImage({ src, alt, fromDir }: { src: string; alt: string; fromDir: string }) {
  const [broken, setBroken] = useState(false)
  const url = imageUrl(src, fromDir)
  if (!url || broken) return <span className="img-missing"><ImageOff size={12} /> Bild fehlt: {alt || src}</span>
  // kein loading="lazy": im Scrollcontainer des Panels bleiben solche Bilder sonst leer
  return <img src={url} alt={alt} onError={() => setBroken(true)} />
}

function makeComponents(ctx: LinkCtx, open: (id: string) => void): Components {
  return {
    a({ href, children }) {
      const k = classifyHref(href || '', ctx)
      if (k.kind === 'note') {
        // Echtes href: Statuszeile, Mittelklick und „in neuem Tab" bleiben ehrlich.
        return (
          <a href={dataUrl(k.id)} title={k.id}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
              e.preventDefault()
              open(k.id)
            }}>{children}</a>
        )
      }
      if (k.kind === 'anchor') return <a href={k.url}>{children}</a>
      if (k.kind === 'asset' || k.kind === 'external')
        return <a href={k.url} target="_blank" rel="noreferrer noopener">{children}<ArrowUpRight size={11} /></a>
      return <span className="dead" title={DEAD_TITLE[k.reason]}>{children}<Unlink size={11} /></span>
    },
    img({ src, alt }) {
      return <NoteImage src={typeof src === 'string' ? src : ''} alt={alt || ''} fromDir={ctx.fromDir} />
    },
  }
}

export default function NoteMarkdown({ body, noteId }: { body: string; noteId: string }) {
  const rawNotes = useStore((s) => s.rawNotes)
  const pushNote = useStore((s) => s.pushNote)
  const ids = useMemo(() => new Set(rawNotes.map((r) => r.id)), [rawNotes])
  const byBase = useMemo(() => buildByBase(rawNotes), [rawNotes])
  const ctx = useMemo<LinkCtx>(() => ({ fromDir: dirOf(noteId), ids, byBase }), [noteId, ids, byBase])
  const components = useMemo(() => makeComponents(ctx, pushNote), [ctx, pushNote])
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkVaultLinks, remarkCallouts]}
      // defaultUrlTransform würde das unbekannte Schema "wiki:" wegkürzen
      urlTransform={(url) => (url.startsWith(WIKI_SCHEME) ? url : defaultUrlTransform(url))}
      components={components}
    >{body}</ReactMarkdown>
  )
}
