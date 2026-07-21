import { getIcon } from '../icons'
import { useStore } from '../store'

// Organische, überlappungsfreie Platzierung der 10 Cluster (x%, y%).
const POS: [number, number][] = [
  [16, 26], [50, 16], [84, 26],
  [26, 54], [52, 52], [78, 56],
  [17, 82], [43, 84], [69, 84], [91, 66],
]

export default function CloudView() {
  const { selected, setSelected, setHovered, settings, nodes, enterDrill } = useStore()
  const KNOWLEDGE = nodes.filter((n) => n.type === 'knowledge')

  return (
    <div className="relative h-full w-full overflow-hidden">
      {KNOWLEDGE.map((c, i) => {
        const [x, y] = POS[i] ?? [50, 50]
        const on = selected === c.id
        const Icon = getIcon(c.icon)
        return (
          <div key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2 transition-transform duration-300"
            style={{ left: `${x}%`, top: `${y}%`, transform: `translate(-50%,-50%) scale(${on ? 1.06 : 1})` }}>
            {/* Aura */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ background: `radial-gradient(circle, ${c.color}33, transparent 68%)`, filter: 'blur(8px)' }} />
            {/* Sub-Knoten */}
            {Array.from({ length: 9 }).map((_, k) => {
              const a = (k / 9) * Math.PI * 2
              const rad = 60 + (k % 3) * 16
              return <span key={k} className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: 6 - (k % 3), height: 6 - (k % 3), background: c.color, opacity: 0.55,
                  transform: `translate(${Math.cos(a) * rad}px, ${Math.sin(a) * rad}px)`,
                  boxShadow: `0 0 8px -1px ${c.color}` }} />
            })}
            {/* Hub */}
            <button
              onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(on ? null : c.id)}
              onDoubleClick={() => { if (c.meta?.Ordner) enterDrill(c.meta.Ordner as string) }}
              title="Doppelklick: hineinzoomen"
              className="glass relative grid h-16 w-16 place-items-center rounded-2xl transition-colors"
              style={{ borderColor: on ? c.color : undefined, boxShadow: on ? `0 0 20px -4px ${c.color}` : undefined }}>
              <Icon size={22} color={c.color} strokeWidth={1.6} />
            </button>
            {settings.labels && (
              <div className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-center">
                <div className="text-[12.5px] font-medium text-ink">{c.name}</div>
                {settings.detail >= 60 && <div className="font-mono text-[10px] text-faint">{c.meta?.Notizen} Notizen</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
