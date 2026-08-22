// Gemeinsame Helfer für die Quell-Konnektoren (zero-dependency).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const HERE_DIR = HERE;               // wo dieser Code liegt (nicht der Vault!)

// Vault-Wurzel. Normalerweise zwei Ebenen ueber diesem Skript (_system/scripts/..).
// Im Container liegt der Code aber ausserhalb des Vaults, der unter VAULT gemountet ist —
// darum die Uebersteuerung. VAULT_ROOT gewinnt (wie in vite.config.ts), dann VAULT.
export const ROOT = process.env.VAULT_ROOT || process.env.VAULT || join(HERE, '..', '..');
const SYSTEM = join(ROOT, '_system');       // _system IMMER relativ zur Vault-Wurzel

// Maschinen-Konfig der Quellen (spiegelt _system/sources.config.yaml).
// Die Konnektoren brauchen nur base_url/auth_env. Die übrigen Felder BESCHREIBEN die
// Verbindung für die Ansicht „Verbindungen" — sie sind die erklärte Absicht.
// Was davon wirklich gilt (Skript vorhanden? Token gesetzt? Notizen im Bestand?),
// misst integrations.mjs beim Indexlauf und stellt es daneben.
export const SOURCES = {
  memos: {
    label: 'Memos', type: 'memos', mode: 'pull',
    base_url: 'http://192.168.1.20:5230', auth_env: 'MEMOS_TOKEN',
    transport: 'REST-API v1', format: 'Markdown (nativ)', scope: 'alle Notizen',
    script: 'pull-memos.mjs', sync: 'auto',
    note: 'Markdown-native API — der Inhalt wird unverändert übernommen.',
  },
  trilium: {
    label: 'Trilium', type: 'trilium', mode: 'pull',
    base_url: 'http://192.168.1.20:54321', auth_env: 'TRILIUM_ETAPI_TOKEN',
    transport: 'ETAPI', format: 'intern → Export nach .md', scope: 'hierarchische Notizen',
    script: 'pull_trilium.py', sync: 'manuell',
    note: 'Absichtlich NICHT im automatischen Abgleich: ein Bulk-Export würde die Re-Clusterung überschreiben.',
  },
  karakeep: {
    label: 'Karakeep', type: 'karakeep', mode: 'pull',
    base_url: 'http://192.168.1.20:3000', auth_env: 'KARAKEEP_TOKEN',
    transport: 'REST-API', format: 'JSON (+ Inhalt)', scope: 'nur Notizen/Highlights',
    script: null, sync: 'keiner', skipped: true,
    note: 'Bewusst übersprungen (A4): dort liegen 322 reine Link-Lesezeichen und keine eigenen '
      + 'Notizen/Highlights — für Lesezeichen ist das Brain nicht da. Darum gibt es keinen Konnektor.',
  },
  tududi: {
    label: 'tududi', type: 'tududi', mode: 'pull',
    base_url: 'http://192.168.1.20:3002', auth_env: 'TUDUDI_TOKEN',
    transport: 'REST-API', format: 'JSON', scope: 'nur Notizen, keine To-dos',
    script: 'pull-tududi.mjs', sync: 'auto',
    note: 'To-dos bleiben aussen vor — das Brain ist für Wissen, nicht für Aufgaben.',
  },
  hermes: {
    label: 'Hermes Agent', type: 'hermes-agent', mode: 'push',
    base_url: 'http://192.168.1.17', auth_env: 'CAPTURE_TOKEN',
    transport: 'HTTP-Endpoint (Port aus CAPTURE_PORT)', format: 'Markdown', scope: 'auf Zuruf',
    script: 'capture-server.mjs', sync: 'push', target: '00-Inbox',
    note: 'Kein Pull: der Agent legt .md in die Inbox. Ablage-Mechanik noch nicht fertig entworfen (A5).',
  },
};

// Liest _system/.env (KEY=VALUE, eine Zeile je Eintrag).
export function loadEnv() {
  const env = {};
  try {
    for (const line of readFileSync(join(SYSTEM, '.env'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) env[m[1]] = m[2];
    }
  } catch { /* keine .env → leer */ }
  return env;
}

const UML = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' };
export function slugify(s, max = 60) {
  return (s || '')
    .toLowerCase()
    .replace(/[äöüß]/g, m => UML[m])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max) || 'notiz';
}

// Minimales YAML-Frontmatter (Strings + String-Arrays).
export function frontmatter(obj) {
  const esc = v => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  let out = '---\n';
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) out += `${k}: [${v.map(x => `"${esc(x)}"`).join(', ')}]\n`;
    else out += `${k}: "${esc(v)}"\n`;
  }
  return out + '---\n';
}
