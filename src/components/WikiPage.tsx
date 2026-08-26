import { useMemo } from 'react'
import { AlertTriangle, BookOpen, Boxes, FileCog, Network } from 'lucide-react'
import { useStore } from '../store'
import type { RawNote } from '../store'

// Die verdichtete Schicht als Wiki lesen, nicht als Punktwolke.
//
// Ein Wiki lebt von einem Verzeichnis: welche Seiten gibt es, welchen Typ haben sie, welche
// tragen einen offenen Widerspruch. Als Ring aus 31 gleichen Punkten war davon nichts zu sehen —
// Themen, Entitaeten und Verwaltungsseiten lagen ununterscheidbar nebeneinander.
//
// Alles hier Gezeigte steht in graph.json: type, status, updated und aliases kommen aus der
// Frontmatter jeder Seite (siehe 09-Wiki/WIKI-SCHEMA.md), die Verweiszahl aus den Notiz-Kanten.
// Nichts wird geraten, nichts geschaetzt.

const WIKI = '09-Wiki'

/** Verwaltungsseiten: Regeln und Protokolle, kein Wissen. Sie gehoeren nicht in die Seitenliste. */
const VERWALTUNG: Record<string, string> = {
  '09-Wiki/_seitenverzeichnis.md': 'Seitenverzeichnis',
  '09-Wiki/_ingest-log.md': 'Ingest-Log',
  '09-Wiki/WIKI-SCHEMA.md': 'Schema und Regeln',
  // 09-Wiki/README.md fehlt hier absichtlich: build-index.mjs ueberspringt README-Dateien,
  // die Seite steht also gar nicht in der Landkarte.
}

export default function WikiPage() {
  const rawNotes = useStore((s) => s.rawNotes)
  const noteEdges = useStore((s) => s.noteEdges)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const enterDrill = useStore((s) => s.enterDrill)

  const daten = useMemo(() => {
    const alle = rawNotes.filter((n) => n.cluster === WIKI)
    const verwaltung = alle.filter((n) => VERWALTUNG[n.id])
    const seiten = alle.filter((n) => !VERWALTUNG[n.id])

    // Verweise je Seite — in beide Richtungen, gezaehlt aus den Kanten der Landkarte.
    const grad = new Map<string, number>()
    for (const e of noteEdges) {
      grad.set(e.source, (grad.get(e.source) ?? 0) + 1)
      grad.set(e.target, (grad.get(e.target) ?? 0) + 1)
    }

    const nachTitel = (a: RawNote, b: RawNote) => (a.title || a.id).localeCompare(b.title || b.id, 'de')
    const themen = seiten.filter((n) => n.type === 'thema').sort(nachTitel)
    const entitaeten = seiten.filter((n) => n.type === 'entitaet').sort(nachTitel)
    // Seiten ohne type: gibt es im Bestand nicht — falls doch, sollen sie nicht verschwinden.
    const ohneTyp = seiten.filter((n) => n.type !== 'thema' && n.type !== 'entitaet').sort(nachTitel)
    const konflikte = seiten.filter((n) => n.status === 'konflikt').sort(nachTitel)
    const stand = seiten.map((n) => n.updated).filter(Boolean).sort().pop() || null

    return { seiten, themen, entitaeten, ohneTyp, konflikte, verwaltung, grad, stand }
  }, [rawNotes, noteEdges])

  if (daten.seiten.length === 0 && daten.verwaltung.length === 0) {
    return (
      <div className="grid h-full place-items-center px-8">
        <div className="glass max-w-[560px] rounded-2xl p-6">
          <div className="eyebrow mb-2">Wiki</div>
          <h2 className="mb-2 text-[16px] font-semibold text-ink">Keine Wiki-Seiten in der Landkarte</h2>
          <p className="text-[13px] leading-relaxed text-muted">
            Im Cluster <code className="font-mono text-[12px] text-ink">09-Wiki</code> liegt nichts, oder{' '}
            <code className="font-mono text-[12px] text-ink">graph.json</code> ist aelter als die Seiten.
            Der Indexlauf im Vault baut sie neu.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-8 pb-12 pt-5">
      <div className="mx-auto max-w-[1060px] space-y-9">

        {/* Kopf: Umfang und Stand, damit klar ist, wie alt das hier ist */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-white/[0.02] px-4 py-3">
          <span className="text-[12.5px] text-muted">
            Verdichtete Schicht, ausschliesslich KI-gepflegt
            {daten.stand && <> · Stand <span className="font-mono text-ink">{daten.stand}</span></>}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[12px] text-faint">
            <span><span className="text-ink">{daten.seiten.length}</span> Seiten</span>
            <span><span className="text-ink">{daten.themen.length}</span> Themen</span>
            <span><span className="text-ink">{daten.entitaeten.length}</span> Entitäten</span>
            <button onClick={() => enterDrill(WIKI)}
              className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted transition-colors hover:border-[rgba(139,124,246,0.4)] hover:text-ink">
              <Network size={12} /> als Landkarte
            </button>
          </div>
        </div>

        {/* Widersprueche zuerst: sie sind der einzige Punkt, der eine Entscheidung braucht. */}
        {daten.konflikte.length > 0 && (
          <section>
            <Kopf icon={AlertTriangle} farbe="var(--color-c-gesundheit)"
              titel="Offene Widersprüche"
              hinweis={`${daten.konflikte.length} ${daten.konflikte.length === 1 ? 'Seite' : 'Seiten'} · löst nur der Mensch auf`} />
            <div className="space-y-2">
              {daten.konflikte.map((n) => (
                <Zeile key={n.id} n={n} grad={daten.grad.get(n.id) ?? 0} onOpen={() => setOpenNote(n.id)} konflikt />
              ))}
            </div>
          </section>
        )}

        {daten.themen.length > 0 && (
          <section>
            <Kopf icon={BookOpen} titel="Themen" hinweis={`${daten.themen.length} Seiten`} />
            <div className="space-y-2">
              {daten.themen.map((n) => (
                <Zeile key={n.id} n={n} grad={daten.grad.get(n.id) ?? 0} onOpen={() => setOpenNote(n.id)}
                  konflikt={n.status === 'konflikt'} />
              ))}
            </div>
          </section>
        )}

        {daten.entitaeten.length > 0 && (
          <section>
            <Kopf icon={Boxes} titel="Entitäten" hinweis={`${daten.entitaeten.length} Seiten · Dinge und Personen mit eigener Geschichte`} />
            <div className="space-y-2">
              {daten.entitaeten.map((n) => (
                <Zeile key={n.id} n={n} grad={daten.grad.get(n.id) ?? 0} onOpen={() => setOpenNote(n.id)}
                  konflikt={n.status === 'konflikt'} />
              ))}
            </div>
          </section>
        )}

        {daten.ohneTyp.length > 0 && (
          <section>
            <Kopf icon={BookOpen} titel="Ohne Seitentyp" hinweis="Frontmatter-Feld type fehlt — gehört nachgetragen" />
            <div className="space-y-2">
              {daten.ohneTyp.map((n) => (
                <Zeile key={n.id} n={n} grad={daten.grad.get(n.id) ?? 0} onOpen={() => setOpenNote(n.id)} />
              ))}
            </div>
          </section>
        )}

        {daten.verwaltung.length > 0 && (
          <section>
            <Kopf icon={FileCog} titel="Verwaltung" hinweis="Regeln und Protokolle, kein Wissen" />
            <div className="flex flex-wrap gap-2">
              {daten.verwaltung.map((n) => (
                <button key={n.id} onClick={() => setOpenNote(n.id)}
                  className="rounded-xl border border-line bg-white/[0.02] px-3.5 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-[rgba(139,124,246,0.4)] hover:text-ink">
                  {VERWALTUNG[n.id]}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function Kopf({ icon: Icon, titel, hinweis, farbe }: {
  icon: typeof BookOpen; titel: string; hinweis?: string; farbe?: string
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2.5">
      <Icon size={15} className="translate-y-[2px]" strokeWidth={1.8}
        style={{ color: farbe ?? 'var(--color-c-wissen)' }} />
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-ink">{titel}</h2>
      {hinweis && <span className="text-[12px] text-faint">{hinweis}</span>}
    </div>
  )
}

/** Eine Seitenzeile: Titel, Stichworte, Stand, Verweiszahl. Klick öffnet sie im Lesepanel —
 *  dort funktionieren Wikilinks, Callouts und Rückverweise schon. */
function Zeile({ n, grad, onOpen, konflikt }: {
  n: RawNote; grad: number; onOpen: () => void; konflikt?: boolean
}) {
  const stichworte = (n.aliases ?? []).slice(0, 5)
  const weitere = Math.max(0, (n.aliases?.length ?? 0) - stichworte.length)
  return (
    <button onClick={onOpen}
      className={[
        'group flex w-full flex-wrap items-baseline gap-x-3 gap-y-1.5 rounded-xl border px-4 py-3 text-left transition-colors',
        konflikt
          ? 'border-[rgba(255,122,112,0.35)] bg-[rgba(255,122,112,0.06)] hover:border-[rgba(255,122,112,0.6)]'
          : 'border-line bg-white/[0.02] hover:border-[rgba(139,124,246,0.4)]',
      ].join(' ')}>
      {konflikt && <AlertTriangle size={13} className="translate-y-[2px] shrink-0 text-c-gesundheit" strokeWidth={2} />}
      <span className="text-[13.5px] font-medium text-ink">{n.title}</span>

      {stichworte.length > 0 && (
        <span className="flex flex-wrap items-baseline gap-1.5">
          {stichworte.map((a) => (
            <span key={a} className="rounded-md border border-line px-1.5 py-px text-[10.5px] text-faint">{a}</span>
          ))}
          {weitere > 0 && <span className="text-[10.5px] text-faint">+{weitere}</span>}
        </span>
      )}

      <span className="ml-auto flex shrink-0 items-baseline gap-3.5 font-mono text-[11px] text-faint">
        {grad > 0 && <span title="Verweise von und zu dieser Seite">{grad} Verweise</span>}
        {n.updated && <span title="Stand laut Frontmatter">{n.updated}</span>}
      </span>
    </button>
  )
}
