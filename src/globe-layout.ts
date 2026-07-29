// Geometrie der Globus-Ansicht — reine Funktionen, deterministisch und für sich prüfbar.
//
// Jeder Bereich ist eine runde Insel (Kugelkappe) um ein gleichmäßig verteiltes Zentrum. Die
// Kappenflächen stehen im Verhältnis der Notizenzahlen; ein gemeinsamer Schrumpffaktor sorgt
// dafür, dass sich keine zwei Inseln berühren — dazwischen bleibt dunkler Raum.
//
// Zwei verworfene Ansätze, damit sie nicht wiederkehren:
//  1. Flächentreue Kappen mit festem Faktor -> die grossen überlappten (gemessen 5 von 21 Paaren).
//  2. Die ganze Kugel in Gebiete aufteilen (Streifen bzw. kapazitätsbegrenztes Voronoi) -> bei
//     Anteilen von 31 % bis 2 % muss ein grosses Gebiet um die kleinen herumgreifen und reisst
//     auf (gemessen: Punkte 114° vom eigenen Schwerpunkt entfernt).
import * as THREE from 'three'

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))
const MIN_GAP = (6 * Math.PI) / 180 // Mindestlücke zwischen zwei Inseln

/** k-ter Punkt eines Fibonacci-Gitters mit n Punkten (gleiche Fläche je Punkt). */
export function latticePoint(k: number, n: number, radius = 1): THREE.Vector3 {
  const y = n === 1 ? 0 : 1 - (2 * (k + 0.5)) / n
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const t = GOLDEN_ANGLE * k
  return new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r).multiplyScalar(radius)
}

/** Gleichmäßig verteilte Richtungen — Inselzentren und Trabanten. */
export const fibDir = (i: number, n: number): THREE.Vector3 => latticePoint(i, Math.max(n, 1))

/** Winkelradius einer Kappe mit Flächenanteil `share`, um `pack` verkleinert. */
export const capRadius = (share: number, pack = 1) =>
  Math.acos(Math.max(-1, 1 - 2 * Math.min(1, share) * pack))

/** n Punkte gleichmäßig über die Kugelkappe um `center` (gleiche Fläche je Punkt). */
export function capPoints(n: number, center: THREE.Vector3, capR: number, radius = 1): THREE.Vector3[] {
  const helper = Math.abs(center.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const u = new THREE.Vector3().crossVectors(center, helper).normalize()
  const v = new THREE.Vector3().crossVectors(center, u).normalize()
  const cosR = Math.cos(capR)
  return Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0 : (k + 0.5) / n
    const cosT = 1 - t * (1 - cosR)
    const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT))
    const phi = GOLDEN_ANGLE * k
    return new THREE.Vector3()
      .addScaledVector(center, cosT)
      .addScaledVector(u, Math.cos(phi) * sinT)
      .addScaledVector(v, Math.sin(phi) * sinT)
      .multiplyScalar(radius)
  })
}

/** Grösster gemeinsamer Schrumpffaktor, bei dem keine zwei Inseln einander berühren.
 *  Binäre Suche — passt sich jedem Bestand an, statt eine Zahl zu raten. */
export function fitPack(shares: number[], seeds: THREE.Vector3[]): number {
  const dist: number[][] = seeds.map((a) => seeds.map((b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b))))))
  const fits = (p: number) => {
    for (let i = 0; i < shares.length; i++)
      for (let j = i + 1; j < shares.length; j++)
        if (dist[i][j] < capRadius(shares[i], p) + capRadius(shares[j], p) + MIN_GAP) return false
    return true
  }
  if (fits(1)) return 1
  let lo = 0.02, hi = 1
  for (let step = 0; step < 40; step++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) lo = mid
    else hi = mid
  }
  return lo
}

export interface Region { pts: THREE.Vector3[]; dir: THREE.Vector3; capDeg: number }

/** Inseln für die gegebenen Notizenzahlen (Reihenfolge = Reihenfolge der Bereiche). */
export function islandPartition(counts: number[], radius = 1): { regions: Region[]; pack: number } {
  const total = counts.reduce((s, c) => s + c, 0)
  const seeds = counts.map((_, i) => fibDir(i, counts.length))
  if (total === 0) return { regions: counts.map((_, i) => ({ pts: [], dir: seeds[i], capDeg: 0 })), pack: 1 }
  const shares = counts.map((c) => c / total)
  // Eine einzige Insel (Drill) darf die ganze Kugel füllen.
  const pack = counts.length === 1 ? 1 : fitPack(shares, seeds)
  const regions = counts.map((c, i) => {
    const capR = counts.length === 1 ? Math.PI : capRadius(shares[i], pack)
    return { pts: capPoints(c, seeds[i], capR, radius), dir: seeds[i], capDeg: (capR * 180) / Math.PI }
  })
  return { regions, pack }
}
