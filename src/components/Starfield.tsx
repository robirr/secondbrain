import { useEffect, useRef } from 'react'
import { CLUSTERS } from '../data/clusters'

/** Sehr dezenter, statischer Sternen-Hintergrund (Canvas). Kein Gaming-Look. */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0

    const draw = () => {
      const { innerWidth: w, innerHeight: h } = window
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      // deterministischer Pseudo-Zufall (ruhig, reproduzierbar)
      let seed = 1337
      const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)

      const count = Math.floor((w * h) / 9000)
      for (let i = 0; i < count; i++) {
        const x = rnd() * w
        const y = rnd() * h
        const r = rnd() * 1.1 + 0.2
        const a = rnd() * 0.5 + 0.06
        // wenige Sterne dezent in Cluster-Farben tönen
        if (rnd() > 0.93) {
          const c = CLUSTERS[Math.floor(rnd() * CLUSTERS.length)].color
          ctx.fillStyle = c
          ctx.globalAlpha = a * 0.8
        } else {
          ctx.fillStyle = '#cbd2e6'
          ctx.globalAlpha = a
        }
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    draw()
    const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(raf) }
  }, [])

  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-0" aria-hidden />
}
