import { useMemo } from 'react'
import { useStore } from '../store'

export interface CloudNote { id: string; title: string }
export interface SubTopic { name: string; count: number }
export interface ClusterCloud {
  id: string          // cl:<Ordner>
  folder: string      // z.B. 40-Ressourcen
  name: string
  color: string
  icon: string
  count: number
  notes: CloudNote[]
  subs: SubTopic[]    // echte Unterordner (nach Notizenzahl), Top 7
}

// Unterordner-Segment einer Notiz-ID innerhalb ihres Clusters ermitteln.
// "40-Ressourcen/Camper/Elektrik.md" -> "Camper"; "40-Ressourcen/x.md" -> null
function subOf(id: string, folder: string): string | null {
  const parts = id.replace(/^qmd:\/\//, '').split('/').filter(Boolean)
  const ci = parts.indexOf(folder)
  const base = ci >= 0 ? ci : 0
  return parts.length > base + 2 ? parts[base + 1] : null
}

export interface TreeFolder { name: string; path: string[]; count: number }
export interface TreeLevel { folders: TreeFolder[]; notes: CloudNote[] }

/** Inhalt EINER Ordner-Ebene: direkte Unterordner (mit Notizenzahl) + Notizen genau in diesem Ordner.
 *  path = ["50-Projekte", "Iveco 9016", ...]. Beliebig tief — so viele Ebenen wie echte Ordner. */
export function useTreeLevel(path: string[]): TreeLevel {
  const rawNotes = useStore((s) => s.rawNotes)
  return useMemo(() => {
    const depth = path.length
    if (depth === 0) return { folders: [], notes: [] }
    const folders = new Map<string, number>()
    const notes: CloudNote[] = []
    for (const r of rawNotes) {
      const parts = r.id.replace(/^qmd:\/\//, '').split('/').filter(Boolean)
      let match = true
      for (let i = 0; i < depth; i++) if (parts[i] !== path[i]) { match = false; break }
      if (!match) continue
      if (parts.length === depth + 1) notes.push({ id: r.id, title: r.title })       // Datei in diesem Ordner
      else if (parts.length > depth + 1) {                                            // liegt in einem Unterordner
        const child = parts[depth]
        folders.set(child, (folders.get(child) || 0) + 1)
      }
    }
    return {
      folders: [...folders.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, path: [...path, name], count })),
      notes: notes.sort((a, b) => a.title.localeCompare(b.title)),
    }
  }, [rawNotes, path])
}

/** Cluster-Wolken für die Cloud-Ansicht: echte Notizen (Sterne) + echte Unterordner (Unterthemen). */
export function useClouds(): ClusterCloud[] {
  const nodes = useStore((s) => s.nodes)
  const rawNotes = useStore((s) => s.rawNotes)
  return useMemo(() => {
    const knowledge = nodes.filter((n) => n.type === 'knowledge')
    return knowledge.map((n) => {
      const folder = (n.meta?.Ordner as string) || n.id.replace(/^cl:/, '')
      const notes = rawNotes.filter((r) => r.cluster === folder)
      const subCount = new Map<string, number>()
      for (const r of notes) {
        const s = subOf(r.id, folder)
        if (s) subCount.set(s, (subCount.get(s) || 0) + 1)
      }
      const subs: SubTopic[] = [...subCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7)
        .map(([name, count]) => ({ name, count }))
      const metaCount = Number(String(n.meta?.Notizen ?? '').replace(/\D/g, '')) || 0
      return {
        id: n.id, folder, name: n.name, color: n.color, icon: n.icon,
        count: notes.length || metaCount,
        notes: notes.map((r) => ({ id: r.id, title: r.title })),
        subs,
      }
    })
  }, [nodes, rawNotes])
}
