// Baustein 2b — Bestandsaufnahme der Verbindungen (deterministisch, ohne KI).
// Schreibt integrations.json neben graph.json: was ist als Quelle DEKLARIERT (lib.mjs),
// was davon existiert WIRKLICH (Skript vorhanden? Token gesetzt?) und wie viel davon
// liegt im Bestand (Notizen je Herkunft). Grundlage der Ansicht „Verbindungen".
//
// REGEL: niemals Geheimnisse. Von den Tokens steht hier nur der Variablenname und ob er
// gesetzt ist — nie der Wert. Aus _system/.env werden ausschliesslich *_PORT und *_HOST
// im Klartext übernommen (Weissliste). Die Datei wird über HTTP ausgeliefert
// (/data/integrations.json), deshalb diese Regel.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, HERE_DIR, SOURCES, loadEnv } from './lib.mjs';

// Welche Skript-Sammlung beschreiben wir? Bevorzugt die im Vault — das sind die, die Roman
// von Hand aufruft (mit seinen Tokens). Liegt dort keine (Indexlauf im Container), dann die
// mitgelieferte neben diesem Code. Die Ansicht sagt, welche es war.
const VAULT_SCRIPTS = join(ROOT, '_system', 'scripts');
const SCRIPTS = existsSync(VAULT_SCRIPTS) ? VAULT_SCRIPTS : HERE_DIR;
const SCRIPTS_LABEL = SCRIPTS === VAULT_SCRIPTS ? '_system/scripts' : HERE_DIR;
const NO_CMD = new Set(['lib.mjs', 'integrations.mjs']);   // Bibliotheken, nicht aufrufbar
const PLAIN_ENV = /_(PORT|HOST)$/;                          // Weissliste für Klartext-Werte
const CONTAINER_MOUNT = '/usr/share/nginx/html/data';       // so heisst der Vault IM Container

// Welchen Pfad zeigen wir als „den Vault"? Im Container ist ROOT der Mount-Punkt — der hilft
// niemandem weiter. Steht VAULT_HOST_PATH in docker-compose.yml, gewinnt der; sonst sagen wir
// offen, dass es der Pfad im Container ist.
const vaultPath = () => process.env.VAULT_HOST_PATH || ROOT;
const vaultPathIsMount = () => !process.env.VAULT_HOST_PATH && ROOT === CONTAINER_MOUNT;

// Ortszeit des Rechners, der indexiert — UTC wäre hier nur verwirrend.
const stamp = ms => {
  const d = new Date(ms), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const changed = p => { try { return stamp(statSync(p).mtimeMs); } catch { return null; } };

// Beschreibung + Aufrufbefehl aus dem Kopfkommentar des Skripts lesen. So kann die Ansicht
// nicht veralten: die Skripte beschreiben sich selbst (erste Kommentarzeile, „Aufruf:"-Zeile).
function describe(file) {
  let lines;
  try { lines = readFileSync(join(SCRIPTS, file), 'utf8').split(/\r?\n/).slice(0, 14); }
  catch { return { description: null, command: null }; }
  const strip = l => l
    .replace(/^#!.*/, '')
    .replace(/^\s*(\/\/+|#+|"""|\*)\s?/, '')
    .replace(/"""\s*$/, '')
    .trim();
  let description = null, command = null;
  for (let i = 0; i < lines.length; i++) {
    const t = strip(lines[i]);
    if (!t) continue;
    if (/^(import|from|const|let|var|export|function|class|require)\b/.test(t)) break;
    const m = t.match(/^(?:Aufruf|Start|Aufrufe|Usage)\s*:\s*(.*)$/i);
    if (m) {
      if (!command) command = m[1].trim() || strip(lines[i + 1] || '') || null;
      continue;
    }
    if (!description) description = t;
  }
  return { description, command: NO_CMD.has(file) ? null : command };
}

// Zustand einer Quelle — gemessen, nicht behauptet. tokenState: gesetzt | fehlt | unbekannt
// ('unbekannt' heisst: in diesem Vault liegt keine .env — z.B. beim Lauf im Container. Dann
// darf hier NICHT 'kein Token' stehen, das waere eine Behauptung ueber etwas Ungesehenes.)
function stateOf(count, tokenState, scriptOk, skipped) {
  if (count > 0) return 'liefert';
  // Eine Quelle, die bewusst nicht angebunden wurde, ist kein Versäumnis.
  if (skipped) return 'übersprungen';
  if (!scriptOk) return 'nicht gebaut';
  if (tokenState === 'fehlt') return 'kein Token';
  return 'bereit';
}

/** notes: [{ rel, cluster, source, mtime }] aus dem Indexlauf. */
export function buildIntegrations({ notes, edges, clusters }) {
  const env = loadEnv();
  const envPath = join(ROOT, '_system', '.env');
  const envFound = existsSync(envPath);
  // Ohne .env wissen wir NICHTS ueber die Tokens — dann 'unbekannt', nicht 'fehlt'.
  const tokenState = name => !envFound ? 'unbekannt'
    : (name && env[name] && env[name].length > 0) ? 'gesetzt' : 'fehlt';

  // Herkunft im Bestand zählen (Frontmatter-Feld `source`).
  const seen = new Map();
  for (const n of notes) {
    const key = (n.source || '').toLowerCase() || '(ohne Angabe)';
    const e = seen.get(key) || { count: 0, newest: 0 };
    e.count++;
    if (n.mtime > e.newest) e.newest = n.mtime;
    seen.set(key, e);
  }

  const state = existsSync(join(ROOT, '_system', '.sync-state.json'))
    ? JSON.parse(readFileSync(join(ROOT, '_system', '.sync-state.json'), 'utf8'))
    : { sources: {} };

  const sources = Object.entries(SOURCES).map(([key, s]) => {
    const found = seen.get(key) || { count: 0, newest: 0 };
    seen.delete(key);
    const scriptOk = Boolean(s.script) && existsSync(join(SCRIPTS, s.script));
    const info = s.script ? describe(s.script) : { description: null, command: null };
    return {
      key,
      label: s.label,
      type: s.type,
      mode: s.mode,                                   // pull | push
      base_url: s.base_url,
      transport: s.transport,
      format: s.format,
      scope: s.scope,
      target: s.target || null,
      sync: s.sync,                                   // auto | manuell | keiner | push
      note: s.note,
      auth_env: s.auth_env,
      token_state: tokenState(s.auth_env),
      script: s.script ? '_system/scripts/' + s.script : null,
      script_exists: scriptOk,
      command: scriptOk ? info.command : null,
      notes: found.count,
      newest: found.newest ? stamp(found.newest) : null,
      tracked_ids: (state.sources?.[key]?.ids || []).length,
      skipped: Boolean(s.skipped),
      state: stateOf(found.count, tokenState(s.auth_env), scriptOk, s.skipped),
    };
  }).sort((a, b) => (a.mode === b.mode ? b.notes - a.notes : a.mode === 'pull' ? -1 : 1));

  // Herkunftswerte im Bestand, die zu keiner deklarierten Quelle gehören.
  const foreign = [...seen.entries()]
    .map(([name, e]) => ({ name, notes: e.count, newest: e.newest ? stamp(e.newest) : null }))
    .sort((a, b) => b.notes - a.notes);

  const tools = (existsSync(SCRIPTS) ? readdirSync(SCRIPTS) : [])
    .filter(f => /\.(mjs|js|py)$/.test(f))
    .sort()
    .map(file => ({
      file: SCRIPTS_LABEL + '/' + file,
      ...describe(file),
      library: NO_CMD.has(file),
      changed: changed(join(SCRIPTS, file)),
    }));

  const derived = [
    { name: 'INDEX.md', path: 'INDEX.md',
      description: 'Katalog — eine Zeile je Notiz, nach Bereich gruppiert.' },
    { name: 'graph.json', path: 'graph.json',
      description: 'Landkarte — Notizen, Bereiche, Verweise. Die Datenquelle dieser Ansicht.' },
    { name: 'integrations.json', path: 'integrations.json',
      description: 'Diese Bestandsaufnahme der Verbindungen.' },
  ].map(d => ({
    ...d,
    command: 'node _system/scripts/build-index.mjs',
    // diese Datei entsteht erst nach dem Lesen ihrer eigenen Zeit — also der Lauf selbst
    changed: d.path === 'integrations.json' ? stamp(Date.now()) : changed(join(ROOT, d.path)),
  }));
  derived.push({
    name: 'qmd-Index', path: null,
    description: 'Lokale Hybridsuche (Stichwort + Bedeutung), Sammlung „brain". Läuft ohne Cloud.',
    command: 'qmd update && qmd embed', changed: null,
  });

  // Geheimnisse: nur Namen und Zustand. Werte NUR aus der Weissliste.
  // Gelistet wird, was in der .env steht UND was die Quellen brauchen — sonst waere die
  // Liste ohne .env leer und man wuesste nicht einmal, welche Tokens gebraucht werden.
  const used = new Map();
  for (const s of Object.values(SOURCES)) if (s.auth_env) used.set(s.auth_env, s.label);
  const names = [...new Set([...Object.keys(env).filter(k => !PLAIN_ENV.test(k)), ...used.keys()])].sort();
  const secrets = names.map(name => ({
    name, state: tokenState(name), used_by: used.get(name) || null,
  }));
  const config = Object.keys(env).filter(k => PLAIN_ENV.test(k)).sort()
    .map(name => ({ name, value: env[name] }));

  // --- Ablage: was liegt in der Inbox und wartet aufs Einsortieren? (gemessen) ---
  const inboxDir = join(ROOT, '00-Inbox');
  const inboxFolders = existsSync(inboxDir)
    ? readdirSync(inboxDir, { withFileTypes: true })
        .filter(e => e.isDirectory())
        .map(e => ({
          name: '00-Inbox/' + e.name,
          notes: notes.filter(n => n.rel.startsWith('00-Inbox/' + e.name + '/')).length,
        }))
        .sort((a, b) => b.notes - a.notes)
    : [];
  const withSource = notes.filter(n => n.source).length;
  const trackedTotal = Object.values(state.sources || {})
    .reduce((sum, x) => sum + ((x && x.ids) ? x.ids.length : 0), 0);
  const inboxWaiting = notes.filter(n => n.cluster === '00-Inbox').length;
  const wikiNotes = notes.filter(n => n.cluster === '09-Wiki').length;
  const capturePort = env.CAPTURE_PORT || '8765';

  // --- Zugang: wie man sich mit dem Brain verbindet. Adressen mit Platzhalter <…> sind
  //     vom Rechner abhängig; 'origin' setzt die Oberflaeche selbst ein (sie kennt ihre URL).
  const access = [
    {
      key: 'web', name: 'Weboberfläche', address: 'origin',
      what: 'Diese Ansicht: lesen, suchen, springen. Sie schreibt nie in den Bestand.',
      auth: 'keine', command: null,
    },
    {
      key: 'mcp', name: 'Suche für Agenten (MCP)', address: 'origin+/qmd/mcp',
      what: 'Die lokale Hybridsuche läuft im selben Container und ist von aussen erreichbar — darüber durchsucht ein Agent (z. B. Claude Code) das Brain, ohne den Ordner zu sehen.',
      auth: 'keine — nur im eigenen Netz erreichbar halten', command: null,
    },
    {
      key: 'capture-http', name: 'Notiz hineinlegen (HTTP)',
      address: `http://<Rechner mit Vault>:${capturePort}/capture`,
      what: 'Der Capture-Server nimmt JSON {title, content, tags} an und legt daraus eine .md in 00-Inbox/hermes. Muss laufen: capture-server.mjs.',
      auth: 'Kopfzeile X-Capture-Token (Wert aus CAPTURE_TOKEN)',
      command: `curl -X POST http://<host>:${capturePort}/capture -H 'X-Capture-Token: <token>' -H 'content-type: application/json' -d '{"title":"Titel","content":"Text","tags":["tag"]}'`,
    },
    {
      key: 'capture-cli', name: 'Notiz hineinlegen (Kommandozeile)', address: null,
      what: 'Dasselbe ohne Server, direkt im Vault-Ordner. Inhalt "-" liest von stdin.',
      auth: 'keine — wer den Ordner hat, darf schreiben',
      command: 'node _system/scripts/capture.mjs "Titel" "Textinhalt" "tag1,tag2"',
    },
    {
      key: 'vault', name: 'Der Vault selbst', address: vaultPath(),
      what: 'Markdown ist die einzige Wahrheit. Dateien direkt bearbeiten ist erlaubt — danach ableiten (siehe Regel 7).'
        + (vaultPathIsMount()
          ? ' Der gezeigte Pfad ist der Mount-Punkt im Container; welcher Ordner das auf dem Wirt ist, steht in docker-compose.yml (VAULT_HOST_PATH setzt ihn hier ein).'
          : ''),
      auth: 'Dateisystem', command: null,
    },
  ];

  // --- Regeln fürs Ablegen und Importieren. Erklärt, und wo möglich gemessen. ---
  const rules = [
    {
      title: 'Alles Neue landet in der Inbox',
      text: 'Die Konnektoren schreiben nach 00-Inbox/<quelle>/. Ausnahme Trilium: der Export legt ganze Zweige direkt in die Ziel-Cluster (MAPPING in pull_trilium.py) — genau deshalb läuft er nicht automatisch.',
      fact: inboxFolders.length
        ? inboxFolders.map(f => `${f.name}: ${f.notes}`).join(' · ')
        : 'derzeit keine Unterordner in 00-Inbox',
    },
    {
      title: 'Dateiname: Datum und Titel',
      text: 'JJJJ-MM-TT-titel-als-slug.md, aus dem Erstelldatum der Quelle. Fehlt das Datum, beginnt der Name mit „undatiert".',
      fact: null,
    },
    {
      title: 'Frontmatter ist der Vertrag',
      text: 'title, source, source_id, created, updated, tags — dazu je Quelle Eigenes (tududi: project, Memos: visibility). Der Indexer liest title, tags und source; ohne source fehlt die Herkunft in dieser Ansicht.',
      fact: `${withSource} von ${notes.length} Notizen tragen ein source-Feld`,
    },
    {
      title: 'source_id verhindert Doppel',
      text: 'Der Abgleich merkt jede gezogene Kennung in _system/.sync-state.json und liest zusätzlich alle source_id aus dem Bestand. Was schon da ist, wird nicht erneut geholt — auch nicht, wenn die Notiz inzwischen umsortiert wurde.',
      fact: `${trackedTotal} Kennungen vermerkt`,
    },
    {
      title: 'Einsortieren entscheidet der Mensch',
      text: 'Aus der Inbox in einen Cluster-Ordner verschieben ist Handarbeit (oder ein Vorschlag der KI). Diese Re-Clusterung ist der Grund, warum kein Bulk-Import einfach darüberschreiben darf.',
      fact: inboxWaiting ? `${inboxWaiting} Notizen warten in der Inbox` : 'nichts wartet in der Inbox',
    },
    {
      title: 'Nur Cluster-Ordner werden indexiert',
      text: 'Wissen liegt in den Cluster-Ordnern. Dateien in der Vault-Wurzel, _system/, Punktordner und readme.md bleiben aussen vor.',
      fact: `${clusters.length} Bereiche im Bestand`,
    },
    {
      title: 'Nach jeder Änderung ableiten',
      text: 'Katalog, Landkarte und diese Bestandsaufnahme entstehen neu, danach der Suchindex. Der Container macht das bei jedem Start von selbst (docker compose up -d) und schreibt dabei nur diese drei Dateien. Von Hand geht es so:',
      fact: null,
      command: 'node _system/scripts/build-index.mjs && qmd update && qmd embed',
    },
    {
      title: 'Verdichten ins Wiki',
      text: 'Die Wiki-Schicht (09-Wiki) ist KI-gepflegt: verdichtete, verlinkte Seiten. Widersprüche werden markiert, nie überschrieben — welcher Stand gilt, entscheidest du.',
      fact: wikiNotes ? `${wikiNotes} Wiki-Seiten` : 'noch keine Wiki-Seiten',
    },
  ].map((r, i) => ({ n: i + 1, command: null, ...r }));

  return {
    generatedBy: '_system/scripts/build-index.mjs',
    generatedAt: stamp(Date.now()),
    vault: {
      notes: notes.length,
      edges: edges.length,
      clusters: clusters.length,
      inbox: inboxWaiting,
      path: vaultPath(),
    },
    sources, foreign, tools, derived, secrets, config, access, rules,
    toolsFrom: SCRIPTS_LABEL,
    envFound,                       // liegt in DIESEM Vault eine _system/.env?
    secretsFile: '_system/.env',
  };
}
