// A4 - Konnektor tududi (nur Notizen) -> .md.
// Aufruf:  node _system/scripts/pull-tududi.mjs [ziel-ordner]
// Standard-Ziel: 00-Inbox/tududi
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, SOURCES, ROOT, slugify, frontmatter } from './lib.mjs';

const { base_url, auth_env } = SOURCES.tududi;
const token = loadEnv()[auth_env];
if (!token) { console.error(`FEHLER: ${auth_env} fehlt in _system/.env`); process.exit(1); }

const targetRel = process.argv[2] || '00-Inbox/tududi';
const target = join(ROOT, targetRel);
mkdirSync(target, { recursive: true });

const r = await fetch(base_url + '/api/notes', { headers: { Authorization: 'Bearer ' + token } });
if (!r.ok) { console.error('HTTP ' + r.status); process.exit(1); }
const data = await r.json();
const notes = Array.isArray(data) ? data : (data.notes || []);
console.log(`Gefundene tududi-Notizen: ${notes.length}`);

let written = 0;
for (const n of notes) {
  const title = (n.title || '').trim() || ('tududi-' + n.id);
  const tags = Array.isArray(n.Tags) ? n.Tags.map(t => t.name || t).filter(Boolean) : [];
  const project = n.Project && n.Project.name ? n.Project.name : '';
  const created = n.created_at || '';
  const fname = `${(created || '').slice(0, 10) || 'undatiert'}-${slugify(title)}.md`;
  const fm = frontmatter({
    title,
    source: 'tududi',
    source_id: n.uid || String(n.id),
    project,
    created,
    updated: n.updated_at || '',
    tags,
  });
  writeFileSync(join(target, fname), fm + '\n' + (n.content || '').trim() + '\n', 'utf8');
  written++;
  console.log(`  -> ${targetRel}/${fname}  [projekt: ${project || '-'}, tags: ${tags.join(', ') || '-'}]`);
}
console.log(`Geschrieben: ${written} Dateien nach ${targetRel}`);
