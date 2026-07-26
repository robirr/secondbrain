// Dev-/Preview-Auslieferung des Vaults unter /data — spiegelt die nginx-Regel der Produktion.
// Dort liefert nginx das gemountete Volume; hier lesen wir direkt aus der Vault-Wurzel, damit
// Notizen, Bilder und graph.json lokal genauso erreichbar sind (sonst ist F2 nicht prüfbar).
// Läuft NUR im Dev-/Preview-Server (apply: 'serve') — am Produktionsbuild ändert sich nichts.
import { createReadStream, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'

const MIME: Record<string, string> = {
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
}

const safeDecode = (s: string): string => { try { return decodeURIComponent(s) } catch { return s } }

export function vaultDev(root: string): Plugin {
  // Wie nginx: unter /data gibt es nur Dateien oder 404 — nie den SPA-Fallback. Sonst bekäme
  // das Lesepanel bei einem Tippfehler index.html als „Notiz" statt eines Fehlers.
  const deny = (res: ServerResponse): void => { res.statusCode = 404; res.end('Not found') }

  const handler: Connect.NextHandleFunction = (req, res, _next) => {
    const path = (req.url || '').split(/[?#]/)[0]
    const segs = path.split('/').filter(Boolean).map(safeDecode)
    // Ausbruch, Systemordner und Punktdateien sperren (kein _system/.env über HTTP)
    const blocked = segs.some((s) => s === '.' || s === '..' || s === '_system' || s.startsWith('.'))
    if (segs.length === 0 || blocked) return deny(res)

    const abs = resolve(root, ...segs)
    if (abs !== root && !abs.startsWith(root + sep)) return deny(res) // ausserhalb der Wurzel

    let size: number
    try {
      const st = statSync(abs)
      if (!st.isFile()) return deny(res) // Ordner werden nicht ausgeliefert
      size = st.size
    } catch {
      return deny(res)
    }

    res.setHeader('Content-Type', MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Content-Length', String(size))
    res.setHeader('Cache-Control', 'no-store')
    createReadStream(abs).pipe(res)
  }

  // Als PRE-Middleware registriert: Vites SPA-Fallback würde sonst vorher mit index.html
  // antworten. Entspricht der Produktion, wo `location /data/` vor dem SPA-Fallback greift.
  return {
    name: 'vault-dev',
    apply: 'serve',
    configureServer: (server) => { server.middlewares.use('/data', handler) },
    configurePreviewServer: (server) => { server.middlewares.use('/data', handler) },
  }
}
