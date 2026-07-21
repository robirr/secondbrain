// A5 — Capture: eine Notiz in die Inbox ablegen (Push-Kanal, z.B. für Hermes).
// Aufruf:
//   node _system/scripts/capture.mjs "Titel" "Textinhalt" "tag1,tag2"
//   echo "Textinhalt" | node _system/scripts/capture.mjs "Titel" - "tag1"
// Schreibt nach 00-Inbox/hermes/<datum>-<slug>.md mit source: hermes.
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, slugify, frontmatter } from './lib.mjs';

const [, , titleArg, contentArg, tagsArg] = process.argv;
if (!titleArg) {
  console.error('Nutzung: node capture.mjs "Titel" "Inhalt" ["tag1,tag2"]  (Inhalt "-" = von stdin)');
  process.exit(1);
}
let content = contentArg && contentArg !== '-' ? contentArg : '';
if ((!contentArg || contentArg === '-')) {
  try { content = readFileSync(0, 'utf8'); } catch { /* kein stdin */ }
}
const tags = (tagsArg || '').split(',').map(s => s.trim()).filter(Boolean);

const now = new Date();
const iso = now.toISOString();
const date = iso.slice(0, 10);
const dir = join(ROOT, '00-Inbox', 'hermes');
mkdirSync(dir, { recursive: true });
const fname = `${date}-${slugify(titleArg)}.md`;
const fm = frontmatter({ title: titleArg, source: 'hermes', source_id: `hermes-${now.getTime()}`, created: iso, tags });
writeFileSync(join(dir, fname), fm + '\n' + content.trim() + '\n', 'utf8');
console.log(`Abgelegt: 00-Inbox/hermes/${fname}`);
