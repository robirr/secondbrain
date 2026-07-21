// A3 — Konnektor Memos → .md (Rohspiegel).
// Aufruf:  node _system/scripts/pull-memos.mjs [ziel-ordner]
// Standard-Ziel: 00-Inbox/memos
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnv, SOURCES, ROOT, slugify, frontmatter } from './lib.mjs';

const { base_url, auth_env } = SOURCES.memos;
const token = loadEnv()[auth_env];
if (!token) { console.error(`FEHLER: ${auth_env} fehlt in _system/.env`); process.exit(1); }

const targetRel = process.argv[2] || '00-Inbox/memos';
const target = join(ROOT, targetRel);
mkdirSync(target, { recursive: true });

async function fetchAll() {
  const out = [];
  let pageToken = '';
  do {
    const url = new URL(base_url + '/api/v1/memos');
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' bei ' + url);
    const j = await r.json();
    out.push(...(j.memos || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

// Titel = erste sinnvolle Zeile ohne reine Tag-/Markup-Zeilen.
function titleOf(content, id) {
  const line = (content || '')
    .split(/\r?\n/)
    .map(s => s.replace(/^#+\s*/, '').trim())
    .find(s => s && !/^#[\wäöüß-]+/.test(s));
  return (line || id).replace(/#[\wäöüß-]+/g, '').trim().slice(0, 80) || id;
}

const memos = await fetchAll();
console.log(`Gefundene Memos: ${memos.length}`);

let written = 0;
for (const m of memos) {
  const id = (m.name || '').split('/').pop();
  const title = (m.property && m.property.title) || titleOf(m.content, id);
  const created = m.createTime || '';
  const fname = `${created.slice(0, 10) || 'undatiert'}-${slugify(title)}.md`;
  const fm = frontmatter({
    title,
    source: 'memos',
    source_id: id,
    created,
    updated: m.updateTime || '',
    tags: m.tags || [],
    visibility: m.visibility || '',
  });
  writeFileSync(join(target, fname), fm + '\n' + (m.content || '').trim() + '\n', 'utf8');
  written++;
  console.log(`  -> ${targetRel}/${fname}  [tags: ${(m.tags || []).join(', ') || '-'}]`);
}
console.log(`Geschrieben: ${written} Dateien nach ${targetRel}`);
