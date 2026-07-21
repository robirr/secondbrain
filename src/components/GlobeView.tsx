import { useEffect, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import * as THREE from 'three'
import type { VizNode } from '../data/demo'
import { useStore } from '../store'

// lat/long (Grad) je Wissenskontinent
const LATLON: [number, number][] = [
  [22, -60], [42, 15], [8, 78], [-14, -125], [2, -18],
  [32, 140], [-36, -55], [-18, 45], [-42, 150], [55, -150],
]

function toVec3(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180
  const theta = ((lon + 180) * Math.PI) / 180
  return [-(r * Math.sin(phi) * Math.cos(theta)), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)]
}

function Marker({ node, pos }: { node: VizNode; pos: [number, number, number] }) {
  const { selected, hovered, setSelected, setHovered } = useStore()
  const on = selected === node.id || hovered === node.id
  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHovered(node.id); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHovered(null); document.body.style.cursor = '' }}
        onClick={(e) => { e.stopPropagation(); setSelected(selected === node.id ? null : node.id) }}>
        <sphereGeometry args={[on ? 0.06 : 0.042, 16, 16]} />
        <meshBasicMaterial color={node.color} toneMapped={false} />
      </mesh>
      <pointLight color={node.color} intensity={on ? 0.6 : 0.25} distance={0.6} />
      {on && (
        <Html center distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="glass whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] text-ink" style={{ transform: 'translateY(-22px)' }}>
            {node.name}
          </div>
        </Html>
      )}
    </group>
  )
}

function Scene() {
  const nodes = useStore((s) => s.nodes)
  const knowledge = useMemo(() => nodes.filter((n) => n.type === 'knowledge'), [nodes])
  const markers = useMemo(() => knowledge.map((n, i) => ({ n, pos: toVec3(...(LATLON[i] ?? [0, 0]), 1.02) })), [knowledge])
  return (
    <>
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 2, 4]} intensity={1.2} />
      {/* Kugel */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial color="#0c1018" roughness={0.95} metalness={0.1} />
      </mesh>
      {/* Gitter */}
      <mesh scale={1.002}>
        <sphereGeometry args={[1, 36, 24]} />
        <meshBasicMaterial color="#8b7cf6" wireframe transparent opacity={0.07} />
      </mesh>
      {/* Atmosphäre */}
      <mesh scale={1.18}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#8b7cf6" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
      {markers.map(({ n, pos }) => <Marker key={n.id} node={n} pos={pos} />)}
      <OrbitControls enablePan={false} enableZoom autoRotate autoRotateSpeed={0.45} minDistance={1.6} maxDistance={4} />
    </>
  )
}

export default function GlobeView() {
  // R3F misst die Container-Größe teils erst nach einem resize-Event zuverlässig.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    return () => clearTimeout(id)
  }, [])
  return (
    <div className="absolute inset-0">
      <Canvas camera={{ position: [0, 0, 2.9], fov: 45 }} dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}
        style={{ width: '100%', height: '100%', display: 'block' }}>
        <Scene />
      </Canvas>
      <div className="glass pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] text-muted">
        Globus — ziehen zum Drehen, scrollen zum Zoomen
      </div>
    </div>
  )
}
