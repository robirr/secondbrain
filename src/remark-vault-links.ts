// Zwei Reparaturen am mdast, bevor gerendert wird:
//
//  1. [[Name]] · [[Name|Alias]] · [[Name#Überschrift]]  →  Link mit der URL "wiki:<Name>".
//  2. Text, der wörtlich wie ein Bild/Link aussieht, dessen Ziel aber ein ROHES LEERZEICHEN
//     enthält (`![](09 - Monday_image.png)`) → echter Bild-/Link-Knoten. Solche Ziele sind
//     nach CommonMark ungültig (Leerzeichen nur in <…> erlaubt); der Trilium-Export hat sie
//     nicht kodiert. Im Bestand betrifft das 11 von 13 Bildern und 9 Datei-Links — ohne diese
//     Reparatur bleiben sie als roher Markdown-Text stehen und kein Bild erscheint.
//
// Beides läuft auf dem Baum, nicht auf dem Rohtext: dadurch bleibt [[…]] in Code-Spans und
// Code-Blöcken wörtlich stehen — 09-Wiki/WIKI-SCHEMA.md dokumentiert die Syntax genau so.
export const WIKI_SCHEME = 'wiki:'

interface MdNode { type: string; value?: string; url?: string; alt?: string; children?: MdNode[] }

const SKIP = new Set(['code', 'inlineCode', 'link', 'linkReference', 'definition', 'image', 'imageReference', 'html'])
//            [[wiki]]                      ![alt](ziel) / [text](ziel)
const RE = /\[\[([^\][\n]+)\]\]|(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g

function expand(text: string): MdNode[] | null {
  RE.lastIndex = 0
  const out: MdNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = RE.exec(text))) {
    let node: MdNode | null = null
    if (m[1] !== undefined) {
      const raw = m[1].trim()
      const [target, alias] = raw.split('|')
      const label = (alias ?? target).split('#')[0].trim() || raw
      if (target.trim()) node = { type: 'link', url: WIKI_SCHEME + target.trim(), children: [{ type: 'text', value: label }] }
    } else {
      const dest = m[4].trim()
      // Nur eingreifen, wenn das Ziel ein rohes Leerzeichen hat — sonst hätte CommonMark
      // den Knoten selbst gebaut und wir würden ihm ins Handwerk pfuschen.
      if (/\s/.test(dest) && !/^<.*>$/.test(dest)) {
        node = m[2] === '!'
          ? { type: 'image', url: dest, alt: m[3] }
          : { type: 'link', url: dest, children: [{ type: 'text', value: m[3] || dest }] }
      }
    }
    if (!node) continue
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    out.push(node)
    last = m.index + m[0].length
  }
  if (out.length === 0) return null
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

export default function remarkVaultLinks() {
  return (tree: unknown): void => walk(tree as MdNode)
}

function walk(node: MdNode): void {
  if (!node.children) return
  const next: MdNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      const parts = expand(child.value)
      if (parts) { next.push(...parts); continue }
    } else if (!SKIP.has(child.type)) {
      walk(child)
    }
    next.push(child)
  }
  node.children = next
}
