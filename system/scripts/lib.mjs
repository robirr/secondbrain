// Gemeinsame Helfer für die Quell-Konnektoren (zero-dependency).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..'); // Second-Brain-Wurzel
const SYSTEM = join(HERE, '..');            // _system

// Maschinen-Konfig der Quellen (spiegelt _system/sources.config.yaml).
export const SOURCES = {
  memos:    { base_url: 'http://<NAS-IP>:5230',  auth_env: 'MEMOS_TOKEN' },
  trilium:  { base_url: 'http://<NAS-IP>:54321', auth_env: 'TRILIUM_ETAPI_TOKEN' },
  karakeep: { base_url: 'http://<NAS-IP>:3000',  auth_env: 'KARAKEEP_TOKEN' },
  tududi:   { base_url: 'http://<NAS-IP>:3002',  auth_env: 'TUDUDI_TOKEN' },
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
