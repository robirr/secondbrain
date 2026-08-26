import { useMemo } from 'react'
import { useStore } from '../store'
import { useDisplayNodes, isNoteId, useVisibleNotes, useEmptyMessage, isFolderId, folderPath } from '../display'

const C = 500, R = 388
const TYPE_ORDER = ['core', 'knowledge', 'project', 'external'] as const

export default function GraphView() {
  const { hovered, selected, setHovered, setSelected, setOpenNote, enterDrill } = useStore()
  const { nodes, edges: allEdges, isDrill } = useDisplayNodes()
  const visible = useVisibleNotes()
  const leerText = useEmptyMessage()

  // Bereiche, in denen der Filter noch Notizen übrig lässt
  const clusterHasNotes = useMemo(() => {
    const s = new Set(visible.map((n) => n.cluster))
    return (folder: unknown) => typeof folder !== 'string' || s.has(folder)
  }, [visible])

  const centerId = useMemo(() => nodes.find((n) => n.type === 'orchestrator')?.id ?? 'brain', [nodes])
  const pos = useMemo(() => {
    const out: Record<string, { x: number; y: number }> = { [centerId]: { x: C, y: C } }
    const others = nodes.filter((n) => n.type !== 'orchestrator')
      .filter((n) => isDrill || clusterHasNotes(n.meta?.Ordner))
      .sort((a, b) => TYPE_ORDER.indexOf(a.type as never) - TYPE_ORDER.indexOf(b.type as never))
    const step = (Math.PI * 2) / Math.max(1, others.length)
    others.forEach((n, i) => {
      const a = -Math.PI / 2 + i * step
      out[n.id] = { x: C + R * Math.cos(a), y: C + R * Math.sin(a) }
    })
    return out
  }, [nodes, centerId, isDrill, clusterHasNotes])

  const focus = hovered ?? selected
  const nb = useMemo(() => {
    if (!focus) return null
    const s = new Set([focus])
    allEdges.forEach((e) => { if (e.source === focus) s.add(e.target); if (e.target === focus) s.add(e.source) })
    return s
  }, [focus, allEdges])

  const edges = allEdges.filter((e) => pos[e.source] && pos[e.target])


  // Drill in einen Cluster ohne Notizen: sonst schwebt nur die Nabe allein im Netz.
  if (isDrill && nodes.filter((n) => n.type !== 'orchestrator').length === 0)
    return <div className="grid h-full place-items-center text-[13px] text-faint">{leerText}</div>
  return (
    <div className="relative flex h-full w-full items-center justify-center p-6">
      <div className="relative aspect-square max-h-full max-w-full" style={{ width: 'min(100%, calc(100vh - 8rem))' }}>
        <svg viewBox="0 0 1000 1000" className="h-full w-full overflow-visible">
          {edges.map((e, i) => {
            const a = pos[e.source], b = pos[e.target]
            const on = focus && (e.source === focus || e.target === focus)
            return <path key={i} d={`M${a.x},${a.y} Q ${C},${C} ${b.x},${b.y}`} fill="none"
              stroke={on ? 'rgba(139,124,246,0.6)' : 'rgba(255,255,255,0.06)'} strokeWidth={on ? 1.6 : 1} />
          })}
          {nodes.filter((n) => pos[n.id]).map((n) => {
            const p = pos[n.id], orch = n.type === 'orchestrator'
            const dim = nb && !nb.has(n.id) ? 0.2 : 1
            const on = focus === n.id
            return (
              <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim}
                 onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
                 onClick={() => {
                   if (isFolderId(n.id)) enterDrill(folderPath(n.id))       // eine Ebene tiefer
                   else if (isNoteId(n.id)) setOpenNote(n.id)
                   else setSelected(selected === n.id ? null : n.id)
                 }}
                 onDoubleClick={() => { if (n.meta?.Ordner && !isDrill) enterDrill(n.meta.Ordner as string) }}
                 className="cursor-pointer transition-opacity duration-300">
                <circle r={orch ? 26 : on ? 11 : 7} fill={n.color} fillOpacity={orch ? 0.25 : 0.9}
                  stroke={n.color} strokeWidth={on || orch ? 2 : 0} style={{ filter: on || orch ? `drop-shadow(0 0 8px ${n.color})` : undefined }} />
                {(orch || on) && (
                  <text x={0} y={orch ? 44 : -16} textAnchor="middle" fontSize={orch ? 15 : 12}
                    fill="#e8eaf0" fontFamily="var(--font-sans)" style={{ pointerEvents: 'none' }}>{n.name}</text>
                )}
              </g>
            )
          })}
        </svg>
        <div className="glass pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] text-muted">
          Beziehungsnetz — Knoten überfahren für Abhängigkeiten
        </div>
      </div>
    </div>
  )
}
