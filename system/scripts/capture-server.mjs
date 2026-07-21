// A5 — Capture-Server (HTTP): Push-Kanal für Hermes o.Ä.
// POST /capture   Header: X-Capture-Token: <token>   Body (JSON): {title, content, tags?}
// GET  /health
// Schreibt nach 00-Inbox/hermes/. Token/Port aus _system/.env (CAPTURE_TOKEN, CAPTURE_PORT, CAPTURE_HOST).
// Start:  node _system/scripts/capture-server.mjs
import { createServer } from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, ROOT, slugify, frontmatter } from './lib.mjs';

const env = loadEnv();
const TOKEN = env.CAPTURE_TOKEN || '';
const PORT = parseInt(env.CAPTURE_PORT || '8765', 10);
const HOST = env.CAPTURE_HOST || '0.0.0.0';

function writeNote({ title, content, tags }) {
  const now = new Date(), iso = now.toISOString();
  const dir = join(ROOT, '00-Inbox', 'hermes');
  mkdirSync(dir, { recursive: true });
  const fname = `${iso.slice(0, 10)}-${slugify(title || 'notiz')}.md`;
  const tagList = Array.isArray(tags) ? tags : (tags ? String(tags).split(',').map(s => s.trim()).filter(Boolean) : []);
  const fm = frontmatter({ title: title || 'Ohne Titel', source: 'hermes', source_id: `hermes-${now.getTime()}`, created: iso, tags: tagList });
  writeFileSync(join(dir, fname), fm + '\n' + String(content || '').trim() + '\n', 'utf8');
  return `00-Inbox/hermes/${fname}`;
}

const json = (res, code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };

createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') return json(res, 200, { ok: true });
  if (req.method === 'POST' && req.url === '/capture') {
    if (TOKEN && req.headers['x-capture-token'] !== TOKEN) return json(res, 401, { ok: false, error: 'unauthorized' });
    let body = '';
    req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const file = writeNote(JSON.parse(body || '{}'));
        console.log(new Date().toISOString(), 'capture ->', file);
        json(res, 200, { ok: true, file });
      } catch (e) { json(res, 400, { ok: false, error: String(e && e.message || e) }); }
    });
    return;
  }
  json(res, 404, { ok: false, error: 'not found' });
}).listen(PORT, HOST, () =>
  console.log(`Capture-Server läuft: http://${HOST}:${PORT}  ·  POST /capture · GET /health · Token: ${TOKEN ? 'gesetzt' : 'KEIN (offen!)'}`));
