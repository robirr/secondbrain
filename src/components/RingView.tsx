// Ring: die Landkarte als Kreis. Jeder Bereich ein Tortenstück, dessen Winkel dem Umfang
// entspricht; darin ein Punkt je echte Notiz (Größe = Dateilänge). Aussen die Quellen als
// Satelliten, in der Mitte das Second Brain. Im Drill zeigt dieselbe Ansicht die Notizen
// eines Ordners als Knotenring (unverändert, weil die Navigation daran hängt).
import { useMemo, useState } from 'react'
import type { VizNode } from '../data/demo'
import { getIcon } from '../icons'
import { useStore } from '../store'
import type { RawNote } from '../store'
import { useDisplayNodes, isNoteId, dotSize, useVisibleNotes, useFilterActive } from '../display'

const C = 500
const R_HOLE = 150 // Innenkante der Tortenstücke (Mitte bleibt für Hub und Quellen frei)
const R_EDGE = 420 // Aussenkante — so weit wie möglich, ohne dass Namen abgeschnitten werden
const R_LABEL = 436 // Bereichsnamen direkt aussen an der Kante
const R_SAT = 126 // Umlaufbahn der Quellen: innen zwischen Hub und Tortenstücken
const R_DASH = 100 // gestrichelter Ring um den Hub
const GAP = 1.2 // Winkellücke zwischen zwei Bereichen (Grad)
const LABEL_H = 34 // Höhe eines Namensblocks (Name + Anzahl)
const LABEL_STEP = 40 // Sprung nach aussen, wenn zwei Namen einander berühren

interface LBox { x0: number; x1: number; y0: number; y1: number }
const overlaps = (a: LBox, b: LBox) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1

/** Kasten eines Bereichsnamens abschätzen (Text wächst nach aussen vom Kreis weg). */
function labelBox(deg: number, r: number, name: string, count: number): LBox {
  const w = Math.max(name.length * 7.6, String(count).length * 6.2 + 52)
  const [x, y] = pol(r, deg)
  const right = Math.cos(rad(deg)) >= 0
  return { x0: right ? x : x - w, x1: right ? x + w : x, y0: y - 13, y1: y - 13 + LABEL_H }
}

const rad = (deg: number) => (deg * Math.PI) / 180
const pol = (r: number, deg: number): [number, number] => [C + r * Math.cos(rad(deg)), C + r * Math.sin(rad(deg))]

function wedgePath(a0: number, a1: number, r0: number, r1: number): string {
  const [x0, y0] = pol(r1, a0), [x1, y1] = pol(r1, a1)
  const [x2, y2] = pol(r0, a1), [x3, y3] = pol(r0, a0)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M${x0},${y0} A${r1},${r1} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${r0},${r0} 0 ${large} 0 ${x3},${y3} Z`
}

const GOLDEN = 0.6180339887

/** Punkte gleichmäßig über die Fläche eines Tortenstücks verteilen: der Radius folgt der
 *  Wurzel (gleiche Fläche je Punkt), der Winkel dem goldenen Schnitt — deterministisch. */
function scatter(n: number, a0: number, span: number): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const t = (k + 0.5) / n
    const r = Math.sqrt(R_HOLE * R_HOLE + t * (R_EDGE * R_EDGE - R_HOLE * R_HOLE))
    const a = a0 + ((k * GOLDEN) % 1) * span
    const [x, y] = pol(r, a)
    return { x, y }
  })
}

interface Wedge {
  folder: string; label: string; color: string; icon: string
  a0: number; a1: number; mid: number; labelR: number
  notes: RawNote[]; pts: { x: number; y: number }[]
}

export default function RingView() {
  const { isDrill } = useDisplayNodes()
  return isDrill ? <DrillRing /> : <ClusterRing />
}

// ---------------------------------------------------------------- Übersicht ---

function ClusterRing() {
  const rawNotes = useVisibleNotes()
  const filterActive = useFilterActive()
  const nodes = useStore((s) => s.nodes)
  const noteEdges = useStore((s) => s.noteEdges)
  const settings = useStore((s) => s.settings)
  const setSelected = useStore((s) => s.setSelected)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const enterDrill = useStore((s) => s.enterDrill)
  const selected = useStore((s) => s.selected)

  const [hoverNote, setHoverNote] = useState<string | null>(null)
  const [hoverWedge, setHoverWedge] = useState<string | null>(null)
  const [pinnedSource, setPinnedSource] = useState<string | null>(null)
  const [hoverSource, setHoverSource] = useState<string | null>(null)
  const activeSource = hoverSource ?? pinnedSource

  const brain = useMemo(() => nodes.find((n) => n.type === 'orchestrator'), [nodes])
  const clusters = useMemo(
    () => nodes.filter((n) => n.type === 'knowledge' && n.meta?.Ordner),
    [nodes],
  )

  // Tortenstücke: Winkel proportional zur Notizenzahl, kleine Bereiche behalten 4° Mindestbreite
  const wedges = useMemo<Wedge[]>(() => {
    const list = clusters
      .map((n) => ({ node: n, folder: n.meta!.Ordner as string }))
      .map((c) => ({ ...c, notes: rawNotes.filter((r) => r.cluster === c.folder) }))
      .filter((c) => c.notes.length > 0)
      .sort((a, b) => b.notes.length - a.notes.length)
    const total = list.reduce((s, c) => s + c.notes.length, 0)
    if (!total) return []
    const raw = list.map((c) => Math.max(4, (c.notes.length / total) * 360))
    const scale = 360 / raw.reduce((s, v) => s + v, 0)
    let a = -90
    const placed: LBox[] = []
    return list.map((c, i) => {
      const width = raw[i] * scale
      const a0 = a + GAP / 2, a1 = a + width - GAP / 2
      a += width
      const mid = (a0 + a1) / 2
      // Schmale Tortenstücke haben fast denselben Mittelwinkel; ihre Namen liegen dann auf
      // gleicher Höhe. Wer kollidiert, wandert auf seinem Strahl nach aussen — deterministisch.
      let labelR = R_LABEL
      for (let guard = 0; guard < 10; guard++) {
        const box = labelBox(mid, labelR, c.node.name, c.notes.length)
        if (!placed.some((p) => overlaps(p, box))) { placed.push(box); break }
        labelR += LABEL_STEP
      }
      return {
        folder: c.folder, label: c.node.name, color: c.node.color, icon: c.node.icon,
        a0, a1, mid, labelR, notes: c.notes, pts: scatter(c.notes.length, a0, a1 - a0),
      }
    })
  }, [clusters, rawNotes])

  // Herkunft der Notizen — Satelliten auf der Umlaufbahn. Sie sitzen auf den Nahtstellen
  // zwischen zwei Bereichen, also möglichst weit weg von den Bereichsnamen (die in der Mitte
  // eines Tortenstücks stehen) — so kann sich nichts überschneiden.
  const sources = useMemo(() => {
    const by = new Map<string, number>()
    for (const n of rawNotes) by.set(n.source || 'ohne Angabe', (by.get(n.source || 'ohne Angabe') ?? 0) + 1)
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([name, count], i, all) => {
      const deg = -90 + (i / all.length) * 360
      const [x, y] = pol(R_SAT, deg)
      return { name, count, x, y, deg }
    })
  }, [rawNotes])

  // Position je Notiz (für die Verbindungslinien)
  const notePos = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>()
    for (const w of wedges) w.notes.forEach((n, k) => m.set(n.id, w.pts[k]))
    return m
  }, [wedges])

  const chords = useMemo(() => {
    if (!settings.verbindungen && !hoverNote) return []
    return noteEdges
      .filter((e) => (settings.verbindungen || e.source === hoverNote || e.target === hoverNote))
      .map((e) => ({ e, a: notePos.get(e.source), b: notePos.get(e.target) }))
      .filter((c): c is { e: typeof c.e; a: { x: number; y: number }; b: { x: number; y: number } } => !!c.a && !!c.b)
  }, [noteEdges, notePos, settings.verbindungen, hoverNote])

  if (rawNotes.length === 0 || wedges.length === 0)
    return (
      <div className="grid h-full place-items-center text-[13px] text-faint">
        {filterActive ? 'Der Filter lässt keine Notiz übrig.' : 'Keine Landkarte geladen (graph.json fehlt).'}
      </div>
    )

  const BrainIcon = getIcon(brain?.icon ?? 'brain')

  return (
    <div className="relative flex h-full w-full items-center justify-center p-3">
      <div className="relative aspect-square max-h-full max-w-full" style={{ height: '100%' }}>
        <svg viewBox="0 0 1000 1000" className="h-full w-full overflow-visible">
          {/* Umlaufbahnen */}
          {[R_SAT, R_EDGE + 8].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(255,255,255,0.05)" />
          ))}

          {/* Tortenstücke — nur eingefärbt, ohne Umrandung. Klick taucht in den Bereich ab. */}
          {wedges.map((w) => (
            <g key={w.folder} className="cursor-pointer" onClick={() => enterDrill(w.folder)}>
              <title>{`${w.label} — ${w.notes.length} Notizen · Klick: hineingehen`}</title>
              <path d={wedgePath(w.a0, w.a1, R_HOLE, R_EDGE)} fill={w.color}
                fillOpacity={hoverWedge === w.folder ? 0.2 : 0.1} stroke="none"
                onMouseOver={() => setHoverWedge(w.folder)} onMouseOut={() => setHoverWedge(null)} />
            </g>
          ))}

          {/* Verbindungen als Sehnen (dauerhaft per Einstellung, sonst beim Zeigen) */}
          {chords.map(({ a, b }, i) => (
            <path key={i} d={`M${a.x},${a.y} Q${C},${C} ${b.x},${b.y}`} fill="none"
              stroke="rgba(139,124,246,0.45)" strokeWidth={1.1} />
          ))}

          {/* Notizen als Punkte. Die unsichtbare Trefferfläche ist grösser als der Punkt,
              sonst sind 3-px-Punkte praktisch nicht anklickbar. */}
          {wedges.map((w) => w.notes.map((n, k) => {
            const p = w.pts[k]
            const d = dotSize(n.size)
            const on = hoverNote === n.id
            const dim = activeSource ? (n.source || 'ohne Angabe') !== activeSource : false
            return (
              <g key={n.id} className="cursor-pointer"
                onMouseOver={() => setHoverNote(n.id)} onMouseOut={() => setHoverNote(null)}
                onClick={(e) => { e.stopPropagation(); setOpenNote(n.id) }}>
                <title>{`${n.title} · ${n.size ?? 0} Bytes · Klick: lesen`}</title>
                <circle cx={p.x} cy={p.y} r={d / 2 + 5} fill="transparent" />
                <circle cx={p.x} cy={p.y} r={d / 2 + (on ? 2.5 : 0)} fill={w.color}
                  fillOpacity={dim ? 0.12 : 0.9} style={{ pointerEvents: 'none' }}
                  stroke={on ? '#e8eaf0' : 'none'} strokeWidth={on ? 1.2 : 0} />
              </g>
            )
          }))}

          {/* Bereichsnamen aussen */}
          {settings.labels && wedges.map((w) => {
            const [lx, ly] = pol(w.labelR, w.mid)
            const right = Math.cos(rad(w.mid)) >= 0
            const on = hoverWedge === w.folder
            return (
              <g key={w.folder} className="cursor-pointer" onClick={() => enterDrill(w.folder)}
                onMouseOver={() => setHoverWedge(w.folder)} onMouseOut={() => setHoverWedge(null)}>
                <title>{`${w.label} — Klick: hineingehen`}</title>
                <text x={lx} y={ly} textAnchor={right ? 'start' : 'end'} fontSize={12.5}
                  fill={on ? '#e8eaf0' : '#a8afc2'} fontFamily="var(--font-sans)" letterSpacing="1.6">
                  {w.label.toUpperCase()}
                </text>
                <text x={lx} y={ly + 15} textAnchor={right ? 'start' : 'end'} fontSize={10.5} fill={w.color}
                  fontFamily="var(--font-mono)">{w.notes.length} Notizen</text>
              </g>
            )
          })}

          {/* Quellen als Satelliten dicht am Hub — sie speisen den Bestand.
              Zeigen hebt ihre Notizen hervor, Klick hält die Hervorhebung fest. */}
          {sources.map((s) => {
            const on = activeSource === s.name
            const r = 4 + Math.min(7, Math.log(s.count + 1) * 1.7)
            return (
              <g key={s.name} className="cursor-pointer"
                onMouseOver={() => setHoverSource(s.name)} onMouseOut={() => setHoverSource(null)}
                onClick={() => setPinnedSource(pinnedSource === s.name ? null : s.name)}>
                <title>{`${s.name} — ${s.count} Notizen · Klick: Hervorhebung festhalten`}</title>
                <circle cx={s.x} cy={s.y} r={r + 6} fill="transparent" />
                <circle cx={s.x} cy={s.y} r={r} fill="rgba(135,152,181,0.18)" style={{ pointerEvents: 'none' }}
                  stroke={on ? '#e8eaf0' : 'rgba(135,152,181,0.65)'} strokeWidth={on ? 1.8 : 1} />
              </g>
            )
          })}

          {/* Legende der Quellen — dort, wo der Kreis nie hinkommt (ausserhalb seines Radius) */}
          {sources.map((s, i) => {
            const on = activeSource === s.name
            const y = 44 + i * 20
            return (
              <g key={`l${s.name}`} className="cursor-pointer"
                onMouseOver={() => setHoverSource(s.name)} onMouseOut={() => setHoverSource(null)}
                onClick={() => setPinnedSource(pinnedSource === s.name ? null : s.name)}>
                <title>{`${s.name} — ${s.count} Notizen · Klick: Hervorhebung festhalten`}</title>
                <rect x={6} y={y - 13} width={210} height={19} fill="transparent" />
                <circle cx={16} cy={y - 4} r={4} fill="rgba(135,152,181,0.25)"
                  stroke={on ? '#e8eaf0' : 'rgba(135,152,181,0.65)'} />
                <text x={30} y={y} fontSize={10.5} fill={on ? '#e8eaf0' : '#565d70'}
                  fontFamily="var(--font-mono)" letterSpacing="1.2">
                  {s.name.toUpperCase()} · {s.count}
                </text>
              </g>
            )
          })}
          {sources.length > 0 && (
            <text x={6} y={26} fontSize={9.5} fill="#565d70" fontFamily="var(--font-mono)" letterSpacing="1.8">
              QUELLEN
            </text>
          )}

          {/* Mitte: das Second Brain */}
          <g className="cursor-pointer" onClick={() => setSelected(selected === 'brain' ? null : 'brain')}>
            <title>{`${brain?.name ?? 'Second Brain'} — ${rawNotes.length} Notizen`}</title>
            <circle cx={C} cy={C} r={R_DASH} fill="none" stroke="#8b7cf6" strokeOpacity={0.35}
              strokeWidth={1.5} strokeDasharray="5 7" />
            <circle cx={C} cy={C} r={54} fill="rgba(139,124,246,0.16)" stroke="#8b7cf6" strokeOpacity={0.6}
              style={{ filter: 'drop-shadow(0 0 12px #8b7cf6)' }} />
            <g transform={`translate(${C - 16},${C - 16})`} style={{ pointerEvents: 'none' }}>
              <BrainIcon size={32} color="#8b7cf6" strokeWidth={1.6} />
            </g>
            {settings.labels && (
              <>
                <text x={C} y={C + 84} textAnchor="middle" fontSize={12.5} fill="#a8afc2"
                  fontFamily="var(--font-sans)" letterSpacing="1.6">SECOND BRAIN</text>
                <text x={C} y={C + 101} textAnchor="middle" fontSize={10.5} fill="#565d70" fontFamily="var(--font-mono)">
                  {rawNotes.length} Notizen · {noteEdges.length} Verknüpfungen
                </text>
              </>
            )}
          </g>
        </svg>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------- Drill ----
// Notizen eines Ordners als Knotenring um den Cluster-Hub (Navigation hängt daran).

const R_CORE = 172, R_KNOW = 322, R_OUT = 452
const SIZE = { orchestrator: 52, core: 25, knowledge: 30, project: 21, external: 17 } as const

type Pos = { x: number; y: number; deg: number }

function ring(list: VizNode[], radius: number, start = -90): Record<string, Pos> {
  const out: Record<string, Pos> = {}
  const step = 360 / Math.max(1, list.length)
  list.forEach((n, i) => {
    const deg = start + i * step
    out[n.id] = { x: C + radius * Math.cos(rad(deg)), y: C + radius * Math.sin(rad(deg)), deg }
  })
  return out
}

function DrillRing() {
  const { hovered, selected, settings, setHovered, setSelected, setOpenNote } = useStore()
  const { nodes, edges } = useDisplayNodes()

  const hub = useMemo(() => nodes.find((n) => n.type === 'orchestrator'), [nodes])
  const notes = useMemo(() => nodes.filter((n) => n.type !== 'orchestrator'), [nodes])
  const centerId = hub?.id ?? 'brain'

  // Bei vielen Notizen auf zwei Ringe verteilen, damit die Titel lesbar bleiben
  const pos = useMemo(() => {
    const inner = notes.length > 22 ? notes.slice(0, Math.ceil(notes.length / 2)) : notes
    const outerList = notes.length > 22 ? notes.slice(Math.ceil(notes.length / 2)) : []
    return {
      [centerId]: { x: C, y: C, deg: 0 },
      ...ring(inner, notes.length > 22 ? R_KNOW : R_CORE + 60),
      ...ring(outerList, R_OUT, -90 + 180 / Math.max(1, outerList.length)),
    } as Record<string, Pos>
  }, [notes, centerId])

  const focus = hovered ?? selected
  const dim = (id: string) => (focus && focus !== id && focus !== centerId ? 0.35 : 1)

  return (
    <div className="relative flex h-full w-full items-center justify-center p-3">
      <div className="relative aspect-square max-h-full max-w-full" style={{ height: '100%' }}>
        <svg viewBox="0 0 1000 1000" className="h-full w-full overflow-visible">
          {[R_CORE, R_KNOW, R_OUT].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(255,255,255,0.05)" />
          ))}
          {edges.map((e, i) => {
            const a = pos[e.source], b = pos[e.target]
            if (!a || !b) return null
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(139,124,246,0.10)" />
          })}
          {nodes.map((n) => pos[n.id] && (
            <Node key={n.id} n={n} p={pos[n.id]} opacity={dim(n.id)} focused={focus === n.id} settings={settings}
              onEnter={() => setHovered(n.id)} onLeave={() => setHovered(null)}
              onClick={() => (isNoteId(n.id) ? setOpenNote(n.id) : setSelected(selected === n.id ? null : n.id))} />
          ))}
        </svg>
      </div>
    </div>
  )
}

function Node({ n, p, opacity, focused, settings, onEnter, onLeave, onClick }: {
  n: VizNode; p: Pos; opacity: number; focused: boolean; settings: { labels: boolean }
  onEnter: () => void; onLeave: () => void; onClick: () => void
}) {
  const Icon = getIcon(n.icon)
  const r = SIZE[n.type]
  const orch = n.type === 'orchestrator'
  const right = Math.cos(rad(p.deg)) >= 0
  const labelX = orch ? 0 : right ? r + 10 : -(r + 10)
  const anchor = orch ? 'middle' : right ? 'start' : 'end'

  return (
    <g transform={`translate(${p.x},${p.y})`} opacity={opacity}
      onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}
      className="cursor-pointer transition-opacity duration-300">
      {orch && <>
        <circle r={r + 14} fill="none" stroke={n.color} strokeOpacity={0.18} />
        <circle r={r + 7} fill="none" stroke={n.color} strokeOpacity={0.35} />
      </>}
      <circle r={r} fill={orch ? 'rgba(139,124,246,0.16)' : 'rgba(255,255,255,0.04)'}
        stroke={n.color} strokeOpacity={focused ? 0.95 : 0.5} strokeWidth={focused ? 2 : 1.25}
        style={{ filter: focused || orch ? `drop-shadow(0 0 10px ${n.color})` : undefined }} />
      <g transform={`translate(${-(orch ? 15 : 9)},${-(orch ? 15 : 9)})`} style={{ pointerEvents: 'none' }}>
        <Icon size={orch ? 30 : 18} color={n.color} strokeWidth={1.6} />
      </g>
      {settings.labels && (
        <text x={labelX} y={orch ? r + 22 : 4} textAnchor={anchor} fontSize={orch ? 15 : 12}
          fill={focused ? '#e8eaf0' : '#a8afc2'} fontFamily="var(--font-sans)" style={{ pointerEvents: 'none' }}>
          {n.name}
        </text>
      )}
    </g>
  )
}
