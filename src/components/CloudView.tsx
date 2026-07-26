import { useEffect, useRef, useState } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { getIcon } from '../icons'
import { useStore } from '../store'
import { useClouds, useTreeLevel, type ClusterCloud } from '../data/cloud'

// Ruhepositionen der bis zu 10 Wolken (x%, y%) — organisch verteilt.
const POS: [number, number][] = [
  [20, 30], [50, 20], [80, 30],
  [30, 56], [64, 52], [86, 60],
  [18, 80], [44, 82], [70, 82], [90, 82],
]

// Sonnenblumen-Verteilung in einem Ring-Band (rMin..rMax) — gleichmäßig, überlappungsarm.
function bandPos(i: number, n: number, rMin: number, rMax: number): { x: number; y: number } {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const t = i + 0.5
  const r = rMin + (rMax - rMin) * Math.sqrt(t / Math.max(n, 1))
  const a = t * golden
  return { x: Math.cos(a) * r, y: Math.sin(a) * r }
}

const radiusOf = (count: number) => 84 + Math.min(count, 160) * 0.5

interface Pt { x: number; y: number }

/** Beschriftungen auf einem Ring: von oben aus abwechselnd links/rechts der nächste freie
 *  Platz. Kandidaten, die den Wolkennamen oder eine bereits gesetzte Beschriftung berühren,
 *  werden übersprungen — es werden also eher weniger Labels gezeigt als überlappende. */
function pickRing(n: number, r: number, blocked: Box[], w: number, h: number): Pt[] {
  const out: Pt[] = []
  const steps = 24
  for (let i = 0; i < steps && out.length < n; i++) {
    const a = -Math.PI / 2 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * ((Math.PI * 2) / steps)
    const p = { x: Math.cos(a) * r, y: Math.sin(a) * r }
    const clash = [...blocked, ...out.map((q) => ({ x: q.x, y: q.y, w, h }))]
      .some((b) => Math.abs(b.x - p.x) < (b.w + w) / 2 && Math.abs(b.y - p.y) < (b.h + h) / 2)
    if (!clash) out.push(p)
  }
  return out
}

interface Box { x: number; y: number; w: number; h: number }

/** Platzierung auf einem versetzten Raster INNERHALB der verfügbaren Fläche.
 *  Eine Zelle ist so groß wie das Element (`cw`×`ch`), deshalb können sich zwei Elemente
 *  nie überdecken; alles bleibt im sichtbaren Bereich, weil nur Zellen innerhalb der Box
 *  entstehen. Gesperrte Rechtecke (Hub + Titel, bereits gesetzte Pillen) werden übersprungen.
 *  Sortiert nach Abstand zur Mitte — es füllt sich von innen nach außen wie eine Wolke. */
function placeCells(n: number, area: { w: number; h: number }, blocked: Box[], cw: number, ch: number): { pts: Pt[]; inside: number } {
  if (n <= 0) return { pts: [], inside: 0 }
  const halfW = area.w / 2 - cw / 2 - 6
  const halfH = area.h / 2 - ch / 2 - 6
  if (halfW < cw / 2 || halfH < ch / 2) return { pts: [], inside: 0 }
  const cols = Math.floor(halfW / cw)
  const rows = Math.floor(halfH / ch)
  const free: { x: number; y: number; d: number }[] = []
  for (let gy = -rows; gy <= rows; gy++) {
    for (let gx = -cols; gx <= cols; gx++) {
      const x = gx * cw + (Math.abs(gy) % 2 ? cw / 2 : 0)
      const y = gy * ch
      if (Math.abs(x) > halfW) continue
      if (blocked.some((b) => Math.abs(b.x - x) < (b.w + cw) / 2 && Math.abs(b.y - y) < (b.h + ch) / 2)) continue
      free.push({ x, y, d: Math.hypot(x, y * 1.35) }) // y stärker gewichtet → breite, flache Wolke
    }
  }
  free.sort((a, b) => a.d - b.d || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x))
  const out: Pt[] = free.slice(0, n).map(({ x, y }) => ({ x, y }))
  const inside = out.length
  // Reicht die Fläche nicht, wird NICHTS unterschlagen: der Rest kommt auf Ringe ausserhalb.
  // Lieber ein Element am Rand als eine fehlende Notiz — und niemals eine Lücke im Array.
  for (let i = 0; out.length < n; i++) {
    const ring = 1 + Math.floor(i / 12)
    const a = ((i % 12) / 12) * Math.PI * 2 - Math.PI / 2
    const r = Math.max(halfW, halfH) + ring * ch
    out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return { pts: out, inside }
}

const maxRadius = (pts: Pt[]): number => pts.reduce((m, p) => Math.max(m, Math.hypot(p.x, p.y)), 0)

// Voluminöser Nebel: breite weiche Wolke + hellerer Kern.
function Nebula({ color, r }: { color: string; r: number }) {
  return (
    <>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: r * 2.9, height: r * 2.9, background: `radial-gradient(circle, ${color}3a 0%, ${color}18 42%, transparent 72%)`, filter: 'blur(14px)' }} />
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: r * 1.5, height: r * 1.5, background: `radial-gradient(circle, ${color}55 0%, ${color}22 45%, transparent 70%)`, filter: 'blur(8px)' }} />
    </>
  )
}

// Kleiner Zentral-Hub (Symbol ~50% kleiner).
function Hub({ icon, color, active, onClick, title }: { icon: string; color: string; active: boolean; onClick?: (e: React.MouseEvent) => void; title?: string }) {
  const Icon = getIcon(icon)
  return (
    <button onClick={onClick} title={title}
      className="glass absolute left-1/2 top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl transition-all"
      style={{ borderColor: active ? color : undefined, boxShadow: active ? `0 0 24px -4px ${color}` : undefined }}>
      <Icon size={9} color={color} strokeWidth={1.8} />
    </button>
  )
}

// Ruhezustand einer Cluster-Wolke: Nebel + Sterne + Hub + Name (+ Top-Unterordner als Labels).
function IdleCloud({ c, minimal, settings }: {
  c: ClusterCloud; minimal: boolean
  settings: { labels: boolean; detail: number }
}) {
  const R = radiusOf(c.count)
  const starCount = minimal ? 0 : Math.min(c.notes.length, Math.round(16 + (settings.detail / 100) * 30))
  // Unterthemen beschriften, aber nie über den Wolkennamen (der sitzt unter dem Hub) —
  // lieber drei lesbare Labels als sechs übereinander.
  const subPos = pickRing(Math.min(6, c.subs.length), R * 0.9, [{ x: 0, y: 52, w: 190, h: 46 }], 122, 20)
  const subs = c.subs.slice(0, subPos.length)
  return (
    <>
      <Nebula color={c.color} r={R} />
      {/* Notiz-Sterne (dekorativ, dichter/heller) */}
      {!minimal && Array.from({ length: starCount }).map((_, k) => {
        const { x, y } = bandPos(k, starCount, R * 0.28, R * 0.92)
        return <span key={k} className="twinkle pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)`, width: 3.5, height: 3.5, background: c.color, boxShadow: `0 0 7px ${c.color}`, animationDuration: `${2.4 + (k % 5) * 0.5}s`, animationDelay: `${(k % 7) * 0.28}s` }} />
      })}
      {/* Top-Unterordner als Labels */}
      {!minimal && settings.labels && subs.map((s, k) => (
        <div key={k} className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap"
          style={{ transform: `translate(${subPos[k].x}px, ${subPos[k].y}px)` }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
          <span className="max-w-[88px] truncate text-[11px] font-medium text-ink/85">{s.name}</span>
          <span className="font-mono text-[9px] text-faint">{s.count}</span>
        </div>
      ))}
      <Hub icon={c.icon} color={c.color} active={false} title="Klick: Wolke öffnen" />
      {settings.labels && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-center" style={{ marginTop: 34 }}>
          <div className="text-[13px] font-semibold text-ink">{c.name}</div>
          <div className="mt-0.5 inline-block rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-faint">{c.count} Notizen</div>
        </div>
      )}
    </>
  )
}

// Fokus: eine Ordner-Ebene — Unterordner als anklickbare Sub-Hubs + Notizen als anklickbare Sterne.
function FocusLevel({ c, path, onDrill, area }: {
  c: ClusterCloud; path: string[]; onDrill: (p: string[]) => void
  area: { w: number; h: number }
}) {
  const { setOpenNote } = useStore()
  const { folders, notes } = useTreeLevel(path)

  // Gesperrt ist nur der Hub. Der Name der Ebene steht in der Brotkrume oben — eine zweite
  // Überschrift in der Mitte würde die Fläche blockieren, auf der die Titel Platz brauchen.
  const CENTER: Box = { x: 0, y: 0, w: 58, h: 58 }

  // Unterordner: erst breite Pillen; passen nicht alle in die Fläche, werden sie schmaler.
  const wide = placeCells(folders.length, area, [CENTER], 182, 70)
  const roomy = wide.inside === folders.length
  const pill = roomy ? { cw: 182, ch: 70, max: 150 } : { cw: 124, ch: 54, max: 92 }
  const fPos = (roomy ? wide : placeCells(folders.length, area, [CENTER], pill.cw, pill.ch)).pts
  const blocked: Box[] = [CENTER, ...fPos.map((p) => ({ x: p.x, y: p.y, w: pill.cw, h: pill.ch }))]

  // Notiz-Titel dauerhaft nur, wenn für JEDE Notiz eine Zelle frei ist — sonst Punkte mit Hover.
  const labels = placeCells(notes.length, area, blocked, 140, 34) // Titel ≤ 120 px + Luft
  const showNoteLabels = labels.inside === notes.length
  const nPos = showNoteLabels ? labels.pts : placeCells(notes.length, area, blocked, 26, 26).pts
  const outerR = Math.max(maxRadius(fPos), maxRadius(nPos), 150)

  return (
    <>
      <Nebula color={c.color} r={outerR + 60} />

      {/* Verbindungslinien vom Zentrum zu den Unterthemen */}
      {fPos.map((p, k) => {
        const len = Math.hypot(p.x, p.y), ang = (Math.atan2(p.y, p.x) * 180) / Math.PI
        return <div key={`l${k}`} className="pointer-events-none absolute left-1/2 top-1/2 origin-left"
          style={{ width: len, height: 1, transform: `rotate(${ang}deg)`, background: `linear-gradient(90deg, ${c.color}00 0%, ${c.color}66 30%, ${c.color}22 100%)` }} />
      })}

      {/* Unterthemen als beschriftete Pillen (Klick = eine Ebene tiefer) */}
      {folders.map((f, k) => (
        <button key={f.name} onClick={(e) => { e.stopPropagation(); onDrill(f.path) }}
          className="group absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          style={{ transform: `translate(${fPos[k].x}px, ${fPos[k].y}px)` }} title={`${f.name} öffnen`}>
          <span className="glass block rounded-2xl px-3 py-1.5 text-center transition-all group-hover:scale-105"
            style={{ boxShadow: `0 0 20px -9px ${c.color}` }}>
            <span className="block truncate text-[12px] font-semibold text-ink" style={{ maxWidth: pill.max }}>{f.name}</span>
            <span className="mt-0.5 block font-mono text-[9px] text-faint">{f.count} Notizen</span>
          </span>
        </button>
      ))}

      {/* Notizen dieser Ebene als anklickbare Sterne (mit Titel) */}
      {notes.map((note, k) => {
        const { x, y } = nPos[k]
        return (
          <button key={note.id} onClick={(e) => { e.stopPropagation(); setOpenNote(note.id) }}
            className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }} title={note.title}>
            <span className="block rounded-full transition-transform group-hover:scale-[1.8]" style={{ width: 6, height: 6, background: c.color, boxShadow: `0 0 9px ${c.color}` }} />
            {showNoteLabels ? (
              <span className="max-w-[120px] truncate text-center text-[10px] leading-tight text-ink/75 transition-colors group-hover:text-ink">{note.title}</span>
            ) : (
              <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 max-w-[200px] -translate-x-1/2 truncate whitespace-nowrap rounded-md border border-line bg-black/85 px-1.5 py-0.5 text-[10px] text-ink opacity-0 transition-opacity group-hover:opacity-100">{note.title}</span>
            )}
          </button>
        )
      })}

      {/* Prominenter Zentral-Hub der aktuellen Ebene */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ width: 116, height: 116, background: `radial-gradient(circle, ${c.color}22 0%, transparent 70%)` }} />
      <Hub icon={c.icon} color={c.color} active title={path.length > 1 ? path[path.length - 1] : c.name} />
    </>
  )
}

export default function CloudView() {
  const { setSelected, settings } = useStore()
  const clouds = useClouds()
  const [path, setPath] = useState<string[]>([])
  // Tatsächlich verfügbare Fläche (der Inspector rechts verkleinert sie) — die Fokus-Ebene
  // legt ihre Beschriftungen nur innerhalb dieser Box ab, damit nichts abgeschnitten wird.
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ w: 700, h: 560 }) // vorsichtiger Startwert
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    // Direkt messen (ein ResizeObserver allein liefert in inaktiven Tabs nichts) …
    const read = () => setArea({ w: el.clientWidth, h: el.clientHeight })
    read()
    // … und bei Größenänderungen nachziehen.
    const ro = new ResizeObserver(read)
    ro.observe(el)
    window.addEventListener('resize', read)
    return () => { ro.disconnect(); window.removeEventListener('resize', read) }
  }, [])
  const focusedFolder = path[0] ?? null
  const anyFocus = !!focusedFolder
  const focusedCloud = clouds.find((c) => c.folder === focusedFolder)
  const level = useTreeLevel(path) // nur für die Zählung in der Brotkrume

  // Inspector rechts auf den fokussierten Cluster setzen
  useEffect(() => { setSelected(focusedFolder ? `cl:${focusedFolder}` : null) }, [focusedFolder, setSelected])

  // Esc: eine Ebene zurück (bzw. Überblick)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPath((p) => p.slice(0, -1)) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const s = { labels: settings.labels, detail: settings.detail }

  return (
    <div ref={areaRef} className="relative h-full w-full overflow-hidden" onClick={() => anyFocus && setPath([])}>
      {clouds.map((c, i) => {
        const [px, py] = POS[i] ?? [50, 50]
        const isFocus = c.folder === focusedFolder
        const dimmed = anyFocus && !isFocus
        const vx = px - 50, vy = py - 50
        const x = isFocus ? 50 : dimmed ? Math.max(3, Math.min(97, px + vx * 0.7)) : px
        const y = isFocus ? 50 : dimmed ? Math.max(4, Math.min(96, py + vy * 0.7)) : py
        const scale = isFocus ? 1 : dimmed ? 0.55 : 1
        return (
          <div key={c.id} className={settings.animation && !isFocus && !dimmed ? 'cloud-float' : ''}
            onClick={(e) => { e.stopPropagation(); if (!isFocus) setPath([c.folder]) }}
            style={{
              position: 'absolute', left: `${x}%`, top: `${y}%`,
              transform: `translate(-50%,-50%) scale(${scale})`,
              opacity: dimmed ? 0.2 : 1,
              zIndex: isFocus ? 30 : dimmed ? 1 : 10,
              transition: 'left .6s cubic-bezier(0.22,1,0.36,1), top .6s cubic-bezier(0.22,1,0.36,1), transform .6s cubic-bezier(0.22,1,0.36,1), opacity .5s',
              cursor: isFocus ? 'default' : 'pointer',
              animationDuration: `${9 + i * 0.6}s`, animationDelay: `${i * 0.5}s`,
            }}>
            {isFocus
              ? <FocusLevel c={c} path={path} onDrill={setPath} area={area} />
              : <IdleCloud c={c} minimal={dimmed} settings={s} />}
          </div>
        )
      })}

      {/* Brotkrumen-Navigation */}
      {anyFocus && focusedCloud && (
        <div className="glass fade-up absolute left-1/2 top-4 z-40 flex max-w-[80%] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-full px-3 py-1.5 text-[12px]"
          onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setPath([])} className="flex items-center gap-1 text-faint transition-colors hover:text-ink" title="Zur Übersicht">
            <Home size={13} /> Übersicht
          </button>
          {path.map((seg, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <ChevronRight size={12} className="text-faint" />
              <button onClick={() => setPath(path.slice(0, i + 1))}
                className={`max-w-[180px] truncate transition-colors hover:text-ink ${i === path.length - 1 ? 'font-medium text-ink' : 'text-muted'}`}>
                {i === 0 ? focusedCloud.name : seg}
              </button>
            </span>
          ))}
          {/* Zählung der aktuellen Ebene — steht hier statt als zweite Überschrift in der Mitte */}
          <span className="ml-1.5 shrink-0 border-l border-line pl-2 font-mono text-[10.5px] text-faint">
            {level.folders.length} Ordner · {level.notes.length} Notizen
          </span>
        </div>
      )}

      {/* Hinweis */}
      {anyFocus && (
        <div className="glass fade-up absolute bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] text-muted">
          Ordner öffnen zum Vertiefen · Notiz-Stern anklicken zum Lesen · <span className="text-faint">Esc</span> zurück
        </div>
      )}
    </div>
  )
}
