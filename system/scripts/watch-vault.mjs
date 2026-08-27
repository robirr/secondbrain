// Wächter: leitet neu ab, sobald sich im Vault etwas ändert — ohne Containerneustart.
//
// Warum es das braucht: Katalog, Landkarte und Suchindex entstanden bisher NUR beim Start des
// Containers. Legt Hermes eine Notiz in die Inbox, taucht sie in Suche und Oberfläche erst nach
// dem nächsten Neustart auf. Am 26.08.2026 lagen so zwei Zustellungen stundenlang unsichtbar da.
//
// Warum ABFRAGEN und nicht inotify: der Vault liegt auf Unraids shfs (FUSE) unter /mnt/user.
// Schreibzugriffe, die über die SMB-Freigabe oder aus einem anderen Container (Hermes hat
// denselben Ordner an einem anderen Pfad gemountet) kommen, erzeugen in DIESEM Container
// verlässlich KEINE inotify-Ereignisse. Ein Abgleich der Dateiliste kostet bei ~230 Dateien
// nichts und merkt jede Änderung, egal wer sie gemacht hat.
//
// Aufruf:  node watch-vault.mjs
// Umgebung:
//   VAULT_ROOT             Vault-Wurzel (sonst zwei Ebenen über diesem Skript)
//   BRAIN_WATCH_SEKUNDEN   Abstand zweier Abfragen, Vorgabe 30
//   BRAIN_WATCH_EMBED=0    nur Stichwortindex nachziehen, keine Vektoren
//   QMD_HOME               Arbeitsordner für qmd (sonst $HOME, sonst /qmd-home)

import { readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync, spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const VAULT = process.env.VAULT_ROOT || join(HIER, '..', '..');
const TAKT = Math.max(5, parseInt(process.env.BRAIN_WATCH_SEKUNDEN || '30', 10));
const MIT_EMBED = process.env.BRAIN_WATCH_EMBED !== '0';
const QMD_HOME = process.env.QMD_HOME || process.env.HOME || '/qmd-home';
const INDEXER = join(HIER, 'build-index.mjs');

// Dieselben Ausschlüsse wie im Indexer — und zusätzlich seine EIGENEN Ausgaben. Ohne das
// löste jeder Lauf den nächsten aus, endlos.
const IGNORE_ORDNER = new Set(['_system', '.git', 'node_modules', '.obsidian', '.trash', '.qmd']);
const ABGELEITET = new Set(['index.md', 'graph.json', 'integrations.json']);

const zeit = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const sage = (t) => console.log(`[watch ${zeit()}] ${t}`);

/**
 * Fingerabdruck des Bestands: Anzahl, Gesamtgröße und die Summe der Änderungszeiten.
 * Erkennt Anlegen, Löschen, Umbenennen und Ändern — ohne Dateiinhalte zu lesen.
 */
function fingerabdruck(dir, tiefe = 0, stand = { anzahl: 0, bytes: 0, zeiten: 0 }) {
  let namen;
  try { namen = readdirSync(dir).sort() } catch { return stand }   // Ordner gerade weg: nächste Runde
  for (const name of namen) {
    if (IGNORE_ORDNER.has(name) || name.startsWith('.')) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p) } catch { continue }                     // Datei zwischen ls und stat weg
    if (st.isDirectory()) { fingerabdruck(p, tiefe + 1, stand); continue }
    const klein = name.toLowerCase();
    if (tiefe === 0 && ABGELEITET.has(klein)) continue;             // eigene Ausgabe nicht mitzählen
    if (!klein.endsWith('.md')) continue;
    stand.anzahl++;
    stand.bytes += st.size;
    stand.zeiten += Math.floor(st.mtimeMs / 1000);
  }
  return stand;
}

const alsText = (s) => `${s.anzahl}/${s.bytes}/${s.zeiten}`;

function laeuftEmbed() {
  try {
    execSync('pgrep -f "cli/qmd.js embed"', { stdio: 'ignore' });
    return true;
  } catch { return false }
}

/** Ableiten und Index nachziehen. Läuft nie zweimal gleichzeitig (siehe beschaeftigt). */
function ableiten(grund) {
  sage(`Änderung erkannt (${grund}) — ableiten ...`);

  const idx = spawnSync(process.execPath, [INDEXER], {
    env: { ...process.env, VAULT_ROOT: VAULT },
    encoding: 'utf8',
  });
  const letzte = (idx.stdout || '').trim().split('\n').filter(Boolean).slice(-2);
  if (idx.status !== 0) {
    sage('build-index fehlgeschlagen — der alte Stand bleibt liegen.');
    if (idx.stderr) sage('  ' + idx.stderr.trim().split('\n')[0]);
    return false;
  }
  for (const z of letzte) sage('  ' + z);

  const upd = spawnSync('qmd', ['update'], { cwd: QMD_HOME, encoding: 'utf8' });
  if (upd.status !== 0) {
    sage('qmd update fehlgeschlagen — Stichwortsuche bleibt auf dem alten Stand.');
    if (upd.stderr) sage('  ' + upd.stderr.trim().split('\n')[0]);
  } else {
    const zeile = (upd.stdout || '').split('\n').find((z) => /Indexed:/.test(z));
    sage('  ' + (zeile ? zeile.trim() : 'qmd update fertig'));
  }

  // Vektoren dauern Minuten und laufen abgekoppelt weiter. Zwei gleichzeitige embed-Prozesse
  // blockieren sich am selben SQLite-Index — darum erst prüfen.
  if (MIT_EMBED) {
    if (laeuftEmbed()) {
      sage('  embed läuft schon — nicht neu gestartet.');
    } else {
      const kind = spawn('qmd', ['embed'], { cwd: QMD_HOME, detached: true, stdio: 'ignore' });
      kind.unref();
      sage('  embed im Hintergrund gestartet (Bedeutungssuche folgt).');
    }
  }
  return true;
}

// --- Hauptschleife -----------------------------------------------------------------------------
// Zwei Abfragen müssen übereinstimmen, bevor abgeleitet wird: wer eine Datei schreibt, ist beim
// ersten Blick oft mitten drin. Erst wenn sich zwei Runden lang nichts mehr bewegt, ist Ruhe.
sage(`beobachtet ${VAULT} · alle ${TAKT} s · embed ${MIT_EMBED ? 'an' : 'aus'}`);

let letzterStand = alsText(fingerabdruck(VAULT));
let wartend = null;
sage(`Ausgangslage: ${letzterStand}`);

setInterval(() => {
  const jetzt = alsText(fingerabdruck(VAULT));
  if (jetzt === letzterStand) { wartend = null; return }

  if (wartend !== jetzt) {
    // Erste Sichtung — eine Runde abwarten, ob noch geschrieben wird.
    wartend = jetzt;
    return;
  }
  // Zweimal derselbe neue Stand: es ist Ruhe eingekehrt.
  const grund = `${letzterStand} -> ${jetzt}`;
  wartend = null;
  if (ableiten(grund)) letzterStand = alsText(fingerabdruck(VAULT));
  else letzterStand = jetzt;   // Fehlgeschlagen: nicht in einer Endlosschleife wiederholen
}, TAKT * 1000);
