// Callouts im mdast erkennen:  > [!widerspruch] Titel  →  Kasten mit Titelzeile.
//
// Die Wiki-Schicht markiert Widersprüche mit genau dieser Syntax (09-Wiki/WIKI-SCHEMA.md).
// Ohne diesen Schritt steht im Lesepanel wörtlich „[!widerspruch]" in einem Zitat — der
// wichtigste Mechanismus des Wikis sähe aus wie ein Textfehler.
//
// Umgesetzt auf dem Baum (nicht am Rohtext), damit die Syntax in Code-Blöcken wörtlich
// stehen bleibt — das Schema selbst zeigt sie ja als Beispiel.

interface MdNode {
  type: string
  value?: string
  children?: MdNode[]
  data?: { hName?: string; hProperties?: Record<string, string> }
}

// [!typ] am Anfang der ersten Zeile; der Rest der Zeile ist der Titel.
const MARKER = /^\[!([A-Za-zÄÖÜäöüß-]+)\]\s*(.*)$/

export default function remarkCallouts() {
  return (tree: MdNode) => {
    walk(tree)
  }
}

function walk(node: MdNode): void {
  if (!node.children) return
  for (const child of node.children) {
    if (child.type === 'blockquote') convert(child)
    walk(child)
  }
}

function convert(quote: MdNode): void {
  const first = quote.children?.[0]
  if (!first || first.type !== 'paragraph') return
  const text = first.children?.[0]
  if (!text || text.type !== 'text' || !text.value) return

  // Nur die ERSTE Zeile prüfen: der Titel endet am Zeilenumbruch.
  const nl = text.value.indexOf('\n')
  const head = nl === -1 ? text.value : text.value.slice(0, nl)
  const m = MARKER.exec(head)
  if (!m) return

  const [, typ, titel] = m
  quote.data = {
    ...quote.data,
    hProperties: { ...quote.data?.hProperties, className: 'callout', 'data-callout': typ.toLowerCase() },
  }

  // Marker aus dem Text nehmen; der Rest der ersten Zeile wird die Titelzeile.
  const rest = nl === -1 ? '' : text.value.slice(nl + 1)
  text.value = titel
  if (rest) {
    // Folgetext bleibt Inhalt: als eigener Absatz hinter der Titelzeile.
    const weitere = first.children!.slice(1)
    first.children = [{ type: 'text', value: titel }]
    quote.children!.splice(1, 0, { type: 'paragraph', children: [{ type: 'text', value: rest }, ...weitere] })
  }
  first.data = { ...first.data, hProperties: { ...first.data?.hProperties, className: 'callout-title' } }
}
