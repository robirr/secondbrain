import { useEffect, useState } from 'react'
import { ChevronRight, Home, FolderOpen } from 'lucide-react'
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

// Kleiner Zentral-Hub (Icon verkleinert).
function Hub({ icon, color, active, onClick, title }: { icon: string; color: string; active: boolean; onClick?: (e: React.MouseEvent) => void; title?: string }) {
  const Icon = getIcon(icon)
  return (
    <button onClick={onClick} title={title}
      className="glass absolute left-1/2 top-1/2 z-20 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl transition-all"
      style={{ borderColor: active ? color : undefined, boxShadow: active ? `0 0 24px -4px ${color}` : undefined }}>
      <Icon size={16} color={color} strokeWidth={1.7} />
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
      {!minimal && settings.labels && c.subs.slice(0, 6).map((s, k, arr) => {
        const a = (k / arr.length) * Math.PI * 2 - Math.PI / 2
        const r = R * 0.7
        return (
          <div key={k} className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 whitespace-nowrap"
            style={{ transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)` }}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
            <span className="text-[11px] font-medium text-ink/85">{s.name}</span>
            <span className="font-mono text-[9px] text-faint">{s.count}</span>
          </div>
        )
      })}
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
function FocusLevel({ c, path, onDrill, settings }: {
  c: ClusterCloud; path: string[]; onDrill: (p: string[]) => void
  settings: { labels: boolean }
}) {
  const { setOpenNote } = useStore()
  const { folders, notes } = useTreeLevel(path)
  const Rf = 108 + folders.length * 4
  const hasFolders = folders.length > 0

  return (
    <>
      <Nebula color={c.color} r={Math.max(Rf + 60, 180)} />

      {/* Verbindungslinien zu Unterordnern */}
      {folders.map((_, k) => {
        const a = (k / folders.length) * Math.PI * 2 - Math.PI / 2
        const dx = Math.cos(a) * Rf, dy = Math.sin(a) * Rf
        const len = Math.hypot(dx, dy), ang = (Math.atan2(dy, dx) * 180) / Math.PI
        return <div key={`l${k}`} className="pointer-events-none absolute left-1/2 top-1/2 origin-left"
          style={{ width: len, height: 1, transform: `rotate(${ang}deg)`, background: `linear-gradient(90deg, ${c.color}77, transparent)` }} />
      })}

      {/* Unterordner als Sub-Hubs (drill tiefer) */}
      {folders.map((f, k) => {
        const a = (k / folders.length) * Math.PI * 2 - Math.PI / 2
        const dx = Math.cos(a) * Rf, dy = Math.sin(a) * Rf
        return (
          <button key={f.name} onClick={(e) => { e.stopPropagation(); onDrill(f.path) }}
            className="group absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ transform: `translate(${dx}px, ${dy}px)` }} title={`${f.name} öffnen`}>
            <span className="glass grid h-9 w-9 place-items-center rounded-lg transition-all group-hover:scale-110" style={{ boxShadow: `0 0 14px -6px ${c.color}` }}>
              <FolderOpen size={14} color={c.color} strokeWidth={1.7} />
            </span>
            <span className="max-w-[130px] truncate text-[11px] font-medium text-ink">{f.name}</span>
            <span className="font-mono text-[9px] text-faint">{f.count}</span>
          </button>
        )
      })}

      {/* Notizen dieser Ebene als anklickbare Sterne */}
      {notes.map((note, k) => {
        const { x, y } = hasFolders
          ? bandPos(k, notes.length, Rf * 1.35, Rf * 1.35 + 46 + notes.length * 2)
          : bandPos(k, notes.length, 34, 40 + notes.length * 3)
        return (
          <button key={note.id} onClick={(e) => { e.stopPropagation(); setOpenNote(note.id) }}
            className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }} title={note.title}>
            <span className="block rounded-full transition-transform group-hover:scale-[1.8]" style={{ width: 6, height: 6, background: c.color, boxShadow: `0 0 9px ${c.color}` }} />
            <span className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 max-w-[200px] truncate whitespace-nowrap rounded-md border border-line bg-black/85 px-1.5 py-0.5 text-[10px] text-ink opacity-0 transition-opacity group-hover:opacity-100">{note.title}</span>
          </button>
        )
      })}

      {/* Zentral-Hub der aktuellen Ebene */}
      <Hub icon={c.icon} color={c.color} active title={path.length > 1 ? 'aktueller Ordner' : c.name} />
      {settings.labels && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 whitespace-nowrap text-center" style={{ marginTop: 30 }}>
          <div className="max-w-[220px] truncate text-[12.5px] font-semibold text-ink">{path.length > 1 ? path[path.length - 1] : c.name}</div>
          <div className="mt-0.5 font-mono text-[9.5px] text-faint">{folders.length} Ordner · {notes.length} Notizen</div>
        </div>
      )}
    </>
  )
}

export default function CloudView() {
  const { setSelected, settings } = useStore()
  const clouds = useClouds()
  const [path, setPath] = useState<string[]>([])
  const focusedFolder = path[0] ?? null
  const anyFocus = !!focusedFolder
  const focusedCloud = clouds.find((c) => c.folder === focusedFolder)

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
    <div className="relative h-full w-full overflow-hidden" onClick={() => anyFocus && setPath([])}>
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
              ? <FocusLevel c={c} path={path} onDrill={setPath} settings={s} />
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
