import { useMemo } from 'react'
import { passesFilter } from '../data/demo'
import type { VizNode } from '../data/demo'
import { getIcon } from '../icons'
import { useStore } from '../store'

const C = 500
const R_CORE = 172, R_KNOW = 322, R_OUT = 452
const SIZE = { orchestrator: 52, core: 25, knowledge: 30, project: 21, external: 17 } as const

type Pos = { x: number; y: number; deg: number }

function ring(list: VizNode[], radius: number, start = -90): Record<string, Pos> {
  const out: Record<string, Pos> = {}
  const step = 360 / Math.max(1, list.length)
  list.forEach((n, i) => {
    const deg = start + i * step
    const rad = (deg * Math.PI) / 180
    out[n.id] = { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad), deg }
  })
  return out
}

const ringVisible = (ring: number, layers: number) =>
  ring === 0 || (ring === 1 && layers >= 2) || (ring === 2 && layers >= 3) || (ring === 3 && layers >= 4)

export default function RingView() {
  const { hovered, selected, settings, setHovered, setSelected, nodes, edges } = useStore()

  const orchestrator = useMemo(() => nodes.find((n) => n.type === 'orchestrator'), [nodes])
  const core = useMemo(() => nodes.filter((n) => n.type === 'core'), [nodes])
  const knowledge = useMemo(() => nodes.filter((n) => n.type === 'knowledge'), [nodes])
  const outer = useMemo(() => nodes.filter((n) => n.type === 'project' || n.type === 'external'), [nodes])
  const centerId = orchestrator?.id ?? 'brain'

  const pos = useMemo(() => ({
    [centerId]: { x: C, y: C, deg: 0 },
    ...ring(core, R_CORE),
    ...ring(knowledge, R_KNOW, -90),
    ...ring(outer, R_OUT, -90),
  } as Record<string, Pos>), [core, knowledge, outer, centerId])

  const visible = useMemo(() => nodes.filter(
    (n) => (settings.extern || n.type !== 'external') && ringVisible(n.ring, settings.layers) && passesFilter(n, settings.filter)
  ), [nodes, settings.extern, settings.layers, settings.filter])
  const visibleIds = useMemo(() => new Set(visible.map((n) => n.id)), [visible])

  const focus = hovered ?? selected
  const neighbors = useMemo(() => {
    if (!focus) return null
    const set = new Set<string>([focus])
    edges.forEach((e) => { if (e.source === focus) set.add(e.target); if (e.target === focus) set.add(e.source) })
    return set
  }, [focus, edges])

  const baseEdges = settings.verbindungen ? edges.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)) : []
  const focusEdges = focus ? edges.filter((e) => (e.source === focus || e.target === focus) && visibleIds.has(e.source) && visibleIds.has(e.target)) : []
  const dim = (id: string) => (neighbors && !neighbors.has(id) ? 0.2 : 1)
  const edgeColor = (kind: string, strong: boolean) =>
    kind === 'integrates' ? `rgba(135,152,181,${strong ? 0.5 : 0.14})` : `rgba(139,124,246,${strong ? 0.6 : 0.12})`

  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      <div className="relative aspect-square max-h-full max-w-full" style={{ width: 'min(100%, calc(100vh - 8rem))' }}>
        <svg viewBox="0 0 1000 1000" className="h-full w-full overflow-visible">
          {[R_CORE, R_KNOW, R_OUT].map((r) => (
            <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
          ))}
          {settings.layers >= 2 && core.map((n) => pos[n.id] && (
            <line key={n.id} x1={C} y1={C} x2={pos[n.id].x} y2={pos[n.id].y} stroke="rgba(139,124,246,0.09)" strokeWidth={1} />
          ))}
          {[...baseEdges, ...focusEdges].map((e, i) => {
            const a = pos[e.source], b = pos[e.target]; if (!a || !b) return null
            const strong = focusEdges.includes(e)
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edgeColor(e.kind, strong)}
              strokeWidth={strong ? 1.75 : 1} strokeDasharray={e.kind === 'integrates' ? '4 4' : undefined} />
          })}

          {visible.map((n) => pos[n.id] && (
            <Node key={n.id} n={n} p={pos[n.id]} opacity={dim(n.id)} focused={focus === n.id} settings={settings}
              onEnter={() => setHovered(n.id)} onLeave={() => setHovered(null)}
              onClick={() => setSelected(selected === n.id ? null : n.id)} />
          ))}
        </svg>
      </div>
    </div>
  )
}

function Node({ n, p, opacity, focused, settings, onEnter, onLeave, onClick }: {
  n: VizNode; p: Pos; opacity: number; focused: boolean; settings: { labels: boolean; detail: number }
  onEnter: () => void; onLeave: () => void; onClick: () => void
}) {
  const Icon = getIcon(n.icon)
  const r = SIZE[n.type]
  const orch = n.type === 'orchestrator'
  const showLabel = settings.labels && (n.type !== 'external' || focused)
  const showCount = n.type === 'knowledge' && settings.labels && settings.detail >= 60 && n.meta?.Notizen
  const right = Math.cos((p.deg * Math.PI) / 180) >= 0
  const labelX = orch ? 0 : right ? r + 10 : -(r + 10)
  const anchor = orch ? 'middle' : right ? 'start' : 'end'
  const labelY = orch ? r + 22 : showCount ? 0 : 4

  return (
    <g transform={`translate(${p.x},${p.y})`} opacity={opacity}
       onMouseEnter={onEnter} onMouseLeave={onLeave} onClick={onClick}
       className="cursor-pointer transition-opacity duration-300">
      {orch && <>
        <circle r={r + 14} fill="none" stroke={n.color} strokeOpacity={0.18} strokeWidth={1} />
        <circle r={r + 7} fill="none" stroke={n.color} strokeOpacity={0.35} strokeWidth={1} />
      </>}
      <circle r={r} fill={orch ? 'rgba(139,124,246,0.16)' : 'rgba(255,255,255,0.04)'}
        stroke={n.color} strokeOpacity={focused ? 0.95 : 0.5} strokeWidth={focused ? 2 : 1.25}
        style={{ filter: focused || orch ? `drop-shadow(0 0 10px ${n.color})` : undefined }} />
      {n.status === 'warning' && <circle r={4} cx={r * 0.7} cy={-r * 0.7} fill="#f6c344" stroke="#0b0c10" strokeWidth={1.5} />}
      <g transform={`translate(${-(orch ? 15 : 9)},${-(orch ? 15 : 9)})`} style={{ pointerEvents: 'none' }}>
        <Icon size={orch ? 30 : 18} color={n.color} strokeWidth={1.6} />
      </g>
      {showLabel && (
        <text x={labelX} y={labelY} textAnchor={anchor} fontSize={orch ? 15 : 12.5}
          fill={focused ? '#e8eaf0' : '#a8afc2'} fontFamily="var(--font-sans)" style={{ pointerEvents: 'none' }}>
          {n.name}
        </text>
      )}
      {showCount && (
        <text x={labelX} y={13} textAnchor={anchor} fontSize={10} fill="#565d70"
          fontFamily="var(--font-mono)" style={{ pointerEvents: 'none' }}>
          {n.meta!.Notizen} Notizen
        </text>
      )}
    </g>
  )
}
