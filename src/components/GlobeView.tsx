// Globus: die Landkarte als Kugel. Jede Notiz ist ein Punkt auf der Oberfläche, jeder Bereich
// bildet einen zusammenhängenden „Kontinent" — dessen Fläche entspricht seinem Umfang. Punktgröße
// = Dateilänge (dieselbe Funktion wie in Ring und Ebenen). Aussen kreisen die Quellen.
// Im Drill füllt der gewählte Ordner die ganze Kugel.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import { getIcon } from '../icons'
import { clusterMeta } from '../data/load'
import { dotSize, useFilterActive, useVisibleNotes } from '../display'
import { fibDir, islandPartition } from '../globe-layout'
import { useStore } from '../store'
import type { RawNote } from '../store'

const R_GLOBE = 1

const meshR = (bytes: number | undefined) => 0.006 + ((dotSize(bytes) - 3) / 6) * 0.017

/** Kleine Notizen blasser, grosse in der volle Bereichsfarbe — dadurch bleibt die Wolke
 *  fein gekörnt, die Farbe der Gegend aber lesbar. */
function dotColor(base: string, bytes: number | undefined): THREE.Color {
  const t = (dotSize(bytes) - 3) / 6
  return new THREE.Color(base).lerp(new THREE.Color('#ffffff'), (1 - t) * 0.5)
}

/** Beschriftung, die nur auf der zugewandten Seite sichtbar ist und NICHT mit der Distanz
 *  skaliert — sonst wachsen die Namen im Vordergrund und überlagern die Kugel. */
function Facing({ dir, offset, children }: { dir: THREE.Vector3; offset: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useFrame(({ camera }) => {
    const el = ref.current
    if (!el) return
    const facing = dir.dot(camera.position.clone().normalize())
    const vis = facing > 0.12 ? Math.min(1, (facing - 0.12) * 2.6) : 0
    el.style.opacity = String(vis)
    el.style.pointerEvents = vis > 0.6 ? 'auto' : 'none'
  })
  return (
    <Html position={dir.clone().multiplyScalar(offset).toArray()} center zIndexRange={[12, 0]}>
      {/* unsichtbar heisst auch: nicht klickbar */}
      <div ref={ref} style={{ opacity: 0, pointerEvents: 'none' }}>{children}</div>
    </Html>
  )
}

interface Continent {
  folder: string; label: string; color: string; icon: string
  dir: THREE.Vector3; notes: RawNote[]; pts: THREE.Vector3[]
}

function NoteDot({ note, pos, color, onOpen }: {
  note: RawNote; pos: THREE.Vector3; color: string; onOpen: (id: string) => void
}) {
  const [hot, setHot] = useState(false)
  const r = meshR(note.size)
  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHot(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHot(false); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); onOpen(note.id) }}>
        {/* Trefferfläche etwas grösser als der Punkt */}
        <sphereGeometry args={[Math.max(r * 2.2, 0.022), 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[hot ? r * 1.9 : r, 10, 10]} />
        <meshBasicMaterial color={hot ? '#ffffff' : dotColor(color, note.size)} toneMapped={false} />
      </mesh>
      {r > 0.017 && (
        <mesh>
          <sphereGeometry args={[r * 2.4, 10, 10]} />
          <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {hot && (
        <Html center zIndexRange={[30, 0]}>
          <div className="glass whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] text-ink"
            style={{ transform: 'translateY(-20px)' }}>
            {note.title}
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene({ continents, sources, hub, showLabels, animate, onDrill, onOpen, onHub }: {
  continents: Continent[]
  sources: { name: string; count: number; dir: THREE.Vector3 }[]
  hub: { label: string; icon: string; color: string; sub: string }
  showLabels: boolean; animate: boolean
  onDrill: (folder: string) => void; onOpen: (id: string) => void; onHub: () => void
}) {
  const HubIcon = getIcon(hub.icon)
  return (
    <>
      <ambientLight intensity={0.8} />
      {/* Atmosphäre — sonst wirkt die Punktwolke flach */}
      <mesh scale={1.22}>
        <sphereGeometry args={[R_GLOBE, 32, 32]} />
        <meshBasicMaterial color="#8b7cf6" transparent opacity={0.045} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {continents.map((c) => (
        <group key={c.folder}>
          {c.notes.map((n, k) => (
            <NoteDot key={n.id} note={n} pos={c.pts[k]} color={c.color} onOpen={onOpen} />
          ))}
          {showLabels && (
            <Facing dir={c.dir} offset={R_GLOBE * 1.04}>
              <button onClick={() => onDrill(c.folder)} title={`${c.label} — Klick: hineingehen`}
                className="flex items-center gap-1 whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-ink/70 transition-colors hover:text-ink">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: c.color, boxShadow: `0 0 5px ${c.color}` }} />
                {c.label}
                <span className="font-mono text-[8.5px] normal-case tracking-normal text-faint">{c.notes.length}</span>
              </button>
            </Facing>
          )}
        </group>
      ))}

      {/* Quellen als kleine Trabanten aussen */}
      {sources.map((s) => (
        <group key={s.name}>
          <mesh position={s.dir.clone().multiplyScalar(R_GLOBE * 1.55)}>
            <sphereGeometry args={[0.018 + Math.min(0.026, Math.log(s.count + 1) * 0.006), 10, 10]} />
            <meshBasicMaterial color="#8798b5" toneMapped={false} />
          </mesh>
          {showLabels && (
            <Facing dir={s.dir} offset={R_GLOBE * 1.55}>
              <div className="whitespace-nowrap font-mono text-[8.5px] uppercase tracking-[0.12em] text-faint"
                style={{ transform: 'translateY(-14px)' }}>
                {s.name} · {s.count}
              </div>
            </Facing>
          )}
        </group>
      ))}

      {/* Mitte — feste Größe, damit sie beim Zoomen nicht die Kugel überdeckt */}
      <Html center zIndexRange={[40, 0]}>
        <button onClick={onHub} title={`${hub.label} — ${hub.sub}`}
          className="glass grid h-9 w-9 place-items-center rounded-xl transition-transform hover:scale-110"
          style={{ borderColor: `${hub.color}88`, boxShadow: `0 0 22px -6px ${hub.color}` }}>
          <HubIcon size={16} color={hub.color} strokeWidth={1.7} />
        </button>
      </Html>

      <OrbitControls enablePan={false} enableZoom autoRotate={animate} autoRotateSpeed={0.4}
        minDistance={1.5} maxDistance={5} />
    </>
  )
}

export default function GlobeView() {
  const rawNotes = useVisibleNotes()
  const filterActive = useFilterActive()
  const nodes = useStore((s) => s.nodes)
  const drill = useStore((s) => s.drill)
  const settings = useStore((s) => s.settings)
  const setOpenNote = useStore((s) => s.setOpenNote)
  const setSelected = useStore((s) => s.setSelected)
  const enterDrill = useStore((s) => s.enterDrill)

  // R3F misst die Container-Größe teils erst nach einem resize-Event zuverlässig.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(id)
  }, [])

  const continents = useMemo<Continent[]>(() => {
    const groups = new Map<string, RawNote[]>()
    for (const n of rawNotes) {
      if (drill && n.cluster !== drill) continue
      const list = groups.get(n.cluster)
      if (list) list.push(n)
      else groups.set(n.cluster, [n])
    }
    const list = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
    if (list.length === 0) return []
    // Ein Gitter über die ganze Kugel, in zusammenhängende Gebiete geschnitten — die Fläche
    // eines Bereichs entspricht damit seinem Umfang, und nichts überlappt.
    const { regions } = islandPartition(list.map(([, ns]) => ns.length), R_GLOBE)
    return list.map(([folder, notes], i) => {
      const meta = clusterMeta(folder)
      const node = nodes.find((n) => n.meta?.Ordner === folder)
      return {
        folder, label: node?.name ?? meta.label, color: node?.color ?? meta.color, icon: node?.icon ?? meta.icon,
        dir: regions[i].dir, notes, pts: regions[i].pts,
      }
    })
  }, [rawNotes, nodes, drill])

  const sources = useMemo(() => {
    if (drill) return []
    const by = new Map<string, number>()
    for (const n of rawNotes) by.set(n.source || 'ohne Angabe', (by.get(n.source || 'ohne Angabe') ?? 0) + 1)
    const list = [...by.entries()].sort((a, b) => b[1] - a[1])
    return list.map(([name, count], i) => ({ name, count, dir: fibDir(i, Math.max(list.length, 3)) }))
  }, [rawNotes, drill])

  if (rawNotes.length === 0)
    return (
      <div className="grid h-full place-items-center text-[13px] text-faint">
        {filterActive ? 'Der Filter lässt keine Notiz übrig.' : 'Keine Landkarte geladen (graph.json fehlt).'}
      </div>
    )

  const brain = nodes.find((n) => n.type === 'orchestrator')
  const drillMeta = drill ? clusterMeta(drill) : null
  const hub = drillMeta
    ? { label: drillMeta.label, icon: drillMeta.icon, color: drillMeta.color, sub: `${continents[0]?.notes.length ?? 0} Notizen` }
    : {
      label: brain?.name ?? 'Second Brain', icon: brain?.icon ?? 'brain', color: brain?.color ?? '#8b7cf6',
      sub: `${rawNotes.length} Notizen in ${continents.length} Bereichen`,
    }

  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, 2.9], fov: 45 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <Scene continents={continents} sources={sources} hub={hub}
          showLabels={settings.labels} animate={settings.animation}
          onDrill={enterDrill} onOpen={setOpenNote} onHub={() => setSelected(brain?.id ?? 'brain')} />
      </Canvas>
      <div className="glass pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] text-muted">
        {hub.sub} · ziehen zum Drehen, scrollen zum Zoomen · Punkt anklicken zum Lesen
      </div>
    </div>
  )
}
