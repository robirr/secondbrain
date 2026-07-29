// Ebenen: oben eine Säule je Bereich (ein Punkt = eine echte Notiz, Größe = Länge der Datei),
// unten die Schichten des Systems aus der Spezifikation — jede mit echten Zahlen aus der
// Landkarte. Nichts erfunden: was es im Bestand nicht gibt, steht hier auch nicht.
import { useMemo } from 'react'
import { clusterMeta } from '../data/load'
import { dotSize, useFilterActive, useVisibleNotes } from '../display'
import { useStore } from '../store'
import type { RawNote } from '../store'

const CELL = 14 // Rasterabstand der Punkte

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`

/** Punkte pro Reihe so wählen, dass die Säule schlank und hoch steht (wie im Zielbild). */
const perRow = (n: number) => Math.max(3, Math.min(8, Math.round(Math.sqrt(n / 3)) || 3))

function NoteDots({ notes, color, cols }: { notes: RawNote[]; color: string; cols: number }) {
  const setOpenNote = useStore((s) => s.setOpenNote)
  return (
    <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, ${CELL}px)` }}>
      {notes.map((n) => {
        const d = dotSize(n.size)
        return (
          <button key={n.id} onClick={() => setOpenNote(n.id)}
            title={`${n.title} · ${n.size ?? 0} Bytes`}
            className="group grid place-items-center" style={{ width: CELL, height: CELL }}>
            <span className="rounded-full transition-transform group-hover:scale-[1.9]"
              style={{ width: d, height: d, background: color, boxShadow: `0 0 ${d}px ${color}80` }} />
          </button>
        )
      })}
    </div>
  )
}

export default function LayerView() {
  const rawNotes = useVisibleNotes()
  const filterActive = useFilterActive()
  const noteEdges = useStore((s) => s.noteEdges)
  const enterDrill = useStore((s) => s.enterDrill)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const showLabels = useStore((s) => s.settings.labels)

  // Bereiche (Säulen) — nach Umfang sortiert, größter links
  const columns = useMemo(() => {
    const byCluster = new Map<string, RawNote[]>()
    for (const n of rawNotes) {
      const list = byCluster.get(n.cluster)
      if (list) list.push(n)
      else byCluster.set(n.cluster, [n])
    }
    return [...byCluster.entries()]
      .map(([folder, notes]) => ({ folder, notes, ...clusterMeta(folder) }))
      .sort((a, b) => b.notes.length - a.notes.length)
  }, [rawNotes])

  // Herkunft je Notiz (aus dem Frontmatter, vom Indexer mitgeschrieben)
  const sources = useMemo(() => {
    const by = new Map<string, RawNote[]>()
    for (const n of rawNotes) {
      const key = n.source || 'ohne Angabe'
      const list = by.get(key)
      if (list) list.push(n)
      else by.set(key, [n])
    }
    return [...by.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [rawNotes])

  const wiki = useMemo(() => rawNotes.filter((n) => n.cluster === '09-Wiki'), [rawNotes])
  const linked = useMemo(() => {
    const ids = new Set<string>()
    for (const e of noteEdges) { ids.add(e.source); ids.add(e.target) }
    return rawNotes.filter((n) => ids.has(n.id))
  }, [noteEdges, rawNotes])
  const totalBytes = useMemo(() => rawNotes.reduce((s, n) => s + (n.size ?? 0), 0), [rawNotes])

  if (rawNotes.length === 0)
    return (
      <div className="grid h-full place-items-center text-[13px] text-faint">
        {filterActive ? 'Der Filter lässt keine Notiz übrig.' : 'Keine Landkarte geladen (graph.json fehlt).'}
      </div>
    )

  return (
    <div className="h-full w-full overflow-auto px-8 py-4">
      {/* Bereiche als Säulen — ein Punkt je Notiz, auf gemeinsamer Grundlinie */}
      <div className="flex items-end justify-center gap-4">
        {columns.map((c, i) => (
          // feste Spaltenbreite: sonst zieht die Beschriftung die Säulen unterschiedlich breit
          <div key={c.folder} className="fade-up flex w-[116px] flex-col items-center gap-3" style={{ animationDelay: `${i * 50}ms` }}>
            <NoteDots notes={c.notes} color={c.color} cols={perRow(c.notes.length)} />
            {showLabels && (
              <button onClick={() => enterDrill(c.folder)} title={`In „${c.label}" springen`}
                className="group flex w-full flex-col items-center gap-0.5">
                <span className="text-center text-[10px] uppercase leading-tight tracking-[0.18em] text-faint transition-colors group-hover:text-ink">{c.label}</span>
                <span className="font-mono text-[10px]" style={{ color: c.color }}>{c.notes.length}</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Schichten des Systems — von den Zubringern oben bis zum Fundament unten */}
      <div className="mx-auto mt-6 max-w-[1100px] border-t border-line pt-4">
        <Row label="Quellen" hint="Zubringer — Erfassung bleibt dort">
          <div className="flex flex-wrap items-end gap-6">
            {sources.map(([name, notes]) => (
              <div key={name} className="flex flex-col gap-1.5">
                <NoteDots notes={notes} color="#8798b5" cols={Math.min(60, Math.max(6, Math.ceil(notes.length / 3)))} />
                <span className="font-mono text-[9.5px] text-faint">{name} · {notes.length}</span>
              </div>
            ))}
          </div>
        </Row>

        <Row label="Wiki" hint="verdichtet, KI-gepflegt · markiert Widersprüche">
          {wiki.length === 0 ? (
            <span className="text-[11px] text-faint">noch keine Seiten</span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {wiki.map((n) => (
                <button key={n.id} onClick={() => setOpenNote(n.id)} title={n.id}
                  className="rounded-full border border-line px-2.5 py-1 text-[10.5px] text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
                  style={{ borderColor: '#8b7cf655' }}>
                  {n.title}
                </button>
              ))}
            </div>
          )}
        </Row>

        <Row label="Suche" hint="qmd — Stichwort + Bedeutung, läuft lokal">
          <span className="font-mono text-[10.5px] text-faint">Strg/⌘ + K · lexikalisch + semantisch · keine Cloud</span>
        </Row>

        <Row label="Index" hint="abgeleitet, jederzeit neu baubar">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <NoteDots notes={linked} color="#2dd4bf" cols={Math.min(26, Math.max(8, linked.length))} />
            <span className="font-mono text-[9.5px] text-faint">
              {rawNotes.length} Knoten · {noteEdges.length} Kanten · {rawNotes.length - linked.length} ohne Verweis
            </span>
          </div>
        </Row>

        <Row label="Fundament" hint="Markdown ist die einzige Wahrheit">
          <div className="flex flex-col gap-1.5">
            <div className="flex h-3 w-full min-w-[320px] overflow-hidden rounded-full border border-line">
              {columns.map((c) => (
                <button key={c.folder} onClick={() => enterDrill(c.folder)}
                  title={`${c.label} · ${c.notes.length} Notizen`}
                  style={{ width: `${(c.notes.length / rawNotes.length) * 100}%`, background: `${c.color}cc` }}
                  className="transition-opacity hover:opacity-70" />
              ))}
            </div>
            <span className="font-mono text-[9.5px] text-faint">{rawNotes.length} Dateien · {kb(totalBytes)} · {columns.length} Bereiche</span>
          </div>
        </Row>
      </div>
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-5 rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.02]">
      <div className="w-[120px] shrink-0 pt-0.5 text-right">
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
        <div className="mt-0.5 text-[9.5px] leading-tight text-faint">{hint}</div>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
