// A5 — Laufender Abgleich (inkrementell).
// Zieht NEUE Notizen aus den JSON-Quellen (Memos, tududi) nach 00-Inbox und frischt
// Index + qmd auf. Bereits migrierte Notizen werden per source_id erkannt (Seed aus dem Vault),
// damit nichts doppelt gezogen wird und die Re-Clusterung nicht überschrieben wird.
//
// Trilium wird NICHT automatisch gesynct (Bulk-Export würde die Re-Clusterung überschreiben) —
// Trilium-Änderungen periodisch manuell via pull_trilium.py (s. _system/STATUS.md).
//
// Aufruf:  node _system/scripts/sync.mjs [--no-refresh]
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadEnv, SOURCES, ROOT, slugify, frontmatter } from './lib.mjs';

const STATE = join(ROOT, '_system', '.sync-state.json');
const QMD_JS = '<PFAD-ZU>/node_modules/@tobilu/qmd/dist/cli/qmd.js';
const env = loadEnv();

const loadState = () => existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { seeded: false, sources: {} };
const saveState = s => writeFileSync(STATE, JSON.stringify(s, null, 2) + '\n', 'utf8');
const ids = (s, src) => (s.sources[src] = s.sources[src] || { ids: [] }).ids;

// Seed: vorhandene source_id je Quelle aus dem Vault-Frontmatter sammeln.
function seedFromVault(state) {
  const walk = (d, acc = []) => {
    for (const n of readdirSync(d)) {
      if (n === '_system' || n.startsWith('.')) continue;
      const p = join(d, n), st = statSync(p);
      if (st.isDirectory()) walk(p, acc);
      else if (n.toLowerCase().endsWith('.md')) acc.push(p);
    }
    return acc;
  };
  for (const p of walk(ROOT)) {
    const m = readFileSync(p, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const src = (m[1].match(/^source:\s*"?(.*?)"?\s*$/m) || [])[1];
    const sid = (m[1].match(/^source_id:\s*"?(.*?)"?\s*$/m) || [])[1];
    if (src && sid && !ids(state, src).includes(sid)) ids(state, src).push(sid);
  }
  state.seeded = true;
}

const titleFromContent = (content, fallback) => {
  const line = (content || '').split(/\r?\n/).map(s => s.replace(/^#+\s*/, '').trim())
    .find(s => s && !/^#[\wäöüß-]/.test(s));
  return (line || fallback).replace(/#[\wäöüß-]+/g, '').trim().slice(0, 80) || fallback;
};

function writeNote(subdir, fname, fm, body) {
  const dir = join(ROOT, '00-Inbox', subdir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fname), fm + '\n' + (body || '').trim() + '\n', 'utf8');
}

async function syncMemos(state) {
  const tok = env[SOURCES.memos.auth_env]; if (!tok) return 0;
  const known = ids(state, 'memos'); let neu = 0, pageToken = '';
  do {
    const url = new URL(SOURCES.memos.base_url + '/api/v1/memos');
    url.searchParams.set('pageSize', '200'); if (pageToken) url.searchParams.set('pageToken', pageToken);
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + tok } });
    if (!r.ok) throw new Error('Memos HTTP ' + r.status);
    const j = await r.json();
    for (const m of j.memos || []) {
      const id = (m.name || '').split('/').pop();
      if (known.includes(id)) continue;
      const title = (m.property && m.property.title) || titleFromContent(m.content, id);
      const created = m.createTime || '';
      writeNote('memos', `${created.slice(0, 10) || 'undatiert'}-${slugify(title)}.md`,
        frontmatter({ title, source: 'memos', source_id: id, created, updated: m.updateTime || '', tags: m.tags || [] }),
        m.content);
      known.push(id); neu++;
    }
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return neu;
}

async function syncTududi(state) {
  const tok = env[SOURCES.tududi.auth_env]; if (!tok) return 0;
  const known = ids(state, 'tududi'); let neu = 0;
  const r = await fetch(SOURCES.tududi.base_url + '/api/notes', { headers: { Authorization: 'Bearer ' + tok } });
  if (!r.ok) throw new Error('tududi HTTP ' + r.status);
  const data = await r.json();
  for (const n of (Array.isArray(data) ? data : data.notes || [])) {
    const id = n.uid || String(n.id);
    if (known.includes(id)) continue;
    const title = (n.title || '').trim() || ('tududi-' + n.id);
    const created = n.created_at || '';
    writeNote('tududi', `${created.slice(0, 10) || 'undatiert'}-${slugify(title)}.md`,
      frontmatter({ title, source: 'tududi', source_id: id, project: (n.Project && n.Project.name) || '', created, updated: n.updated_at || '', tags: (n.Tags || []).map(t => t.name || t) }),
      n.content);
    known.push(id); neu++;
  }
  return neu;
}

const state = loadState();
if (!state.seeded) { console.log('Erster Lauf: Seed aus Vault (Altbestand markieren)...'); seedFromVault(state); }

const nMemos = await syncMemos(state);
const nTududi = await syncTududi(state);
saveState(state);
console.log(`Neue Notizen → 00-Inbox: Memos ${nMemos}, tududi ${nTududi}`);

if (!process.argv.includes('--no-refresh') && (nMemos + nTududi) > 0) {
  console.log('Frische Index + qmd auf...');
  execFileSync('node', [join(ROOT, '_system/scripts/build-index.mjs')], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', [QMD_JS, 'update'], { cwd: ROOT, stdio: 'inherit' });
  execFileSync('node', [QMD_JS, 'embed'], { cwd: ROOT, stdio: 'inherit' });
} else {
  console.log('Keine neuen Notizen — Index/qmd unverändert.');
}
