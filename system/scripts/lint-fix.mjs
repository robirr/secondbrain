// Bestandspflege — die Befunde des Lint-Laufs abarbeiten. Vorschlag, nicht Automatik.
// Aufruf:  node _system/scripts/lint-fix.mjs                 (Testlauf: zeigt nur, was passieren wuerde)
//          node _system/scripts/lint-fix.mjs --apply         (fuehrt aus)
//          node _system/scripts/lint-fix.mjs --apply --nur=klone,verweise
//
// Drei Aufgaben, einzeln waehlbar:
//   klone      16 Trilium-Klone in 01-Daily/Kalender loeschen (die thematische Fassung bleibt)
//   verweise   die 5 Verweise auf contacts/directory.md auf das echte Verzeichnis umbiegen
//   leere      9 leere "new note" und die leeren Sammelnotizen loeschen
//   sammel     7 Ordner-Sammelnotizen loeschen, die nur ihren eigenen Namen enthalten
//
// Sicherheiten: ein Klon wird nur geloescht, wenn die Zwillingsdatei existiert UND beide bis auf
// die Frontmatter-Zeile `branch:` zeichengleich sind. Eine leere Notiz nur, wenn ohne Frontmatter
// nichts als der Titel uebrig bleibt. Nichts wird ueberschrieben, nur ersetzt oder entfernt.
// Details der Befunde: 09-Wiki/Themen/Bestandspflege - Lint-Befunde.md
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, statSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { ROOT } from './lib.mjs';

const ARG = process.argv.slice(2);
const APPLY = ARG.includes('--apply');
const NUR = (ARG.find(a => a.startsWith('--nur=')) || '').replace('--nur=', '').split(',').filter(Boolean);
const machen = a => NUR.length === 0 || NUR.includes(a);

const p = rel => join(ROOT, ...rel.split('/'));
const lies = rel => readFileSync(p(rel), 'utf8');
const rumpf = s => s.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
const ohneBranch = s => s.replace(/^branch:.*$/m, '').replace(/\s+/g, ' ').trim();

let geplant = 0, getan = 0, verweigert = 0;
const zeile = (zeichen, text) => console.log('  ' + zeichen + ' ' + text);

// ---------------------------------------------------------------- 1) Klone
// Der Kalender-Zwilling wird entfernt, die thematische Fassung bleibt. Zuordnung explizit,
// damit nichts geraten wird.
const KLONE = [
  ['01-Daily/Kalender/2024/09 - September/09 - Monday.md', '10-Beruf/Arbeit/EDU Camp 2024/09 - Monday.md'],
  ['01-Daily/Kalender/2024/09 - September/10 - Tuesday.md', '10-Beruf/Arbeit/EDU Camp 2024/10 - Tuesday.md'],
  ['01-Daily/Kalender/2024/09 - September/11 - Wednesday.md', '10-Beruf/Arbeit/EDU Camp 2024/11 - Wednesday.md'],
  ['01-Daily/Kalender/2024/09 - September/12 - Thursday.md', '10-Beruf/Arbeit/EDU Camp 2024/12 - Thursday.md'],
  ['01-Daily/Kalender/2024/10 - October/24 - Thursday/Meeting erste Absprache mit Vi.md', '10-Beruf/Arbeit/Atupri/LBC Inkasso/Meeting erste Absprache mit Vi.md'],
  ['01-Daily/Kalender/2024/10 - October/24 - Thursday/Meeting Minutes Absprache Ramo.md', '10-Beruf/Arbeit/Atupri/Meeting Minutes/Themen - Meeting mit Caroline Mehli/Meeting Minutes Absprache Ramo.md'],
  ['01-Daily/Kalender/2024/10 - October/24 - Thursday/Meeting Minutes Johson.md', '10-Beruf/Arbeit/Johnson/Meeting Minutes Johson.md'],
  ['01-Daily/Kalender/2024/10 - October/24 - Thursday/Meeting Minutes Johson/28 - Monday.md', '10-Beruf/Arbeit/Johnson/Meeting Minutes Johson/28 - Monday.md'],
  ['01-Daily/Kalender/2024/10 - October/25 - Friday/Themen - Meeting mit Caroline.md', '10-Beruf/Arbeit/Atupri/Meeting Minutes/Themen - Meeting mit Caroline.md'],
  ['01-Daily/Kalender/2024/10 - October/29 - Tuesday/Architecture Inkasso.md', '10-Beruf/Arbeit/Atupri/LBC Inkasso/Architecture Inkasso.md'],
  ['01-Daily/Kalender/2024/10 - October/29 - Tuesday/Import Johnson 2C 2020.md', '10-Beruf/Arbeit/Johnson/Import Johnson 2C 2020.md'],
  ['01-Daily/Kalender/2024/10 - October/29 - Tuesday/Inkasso Onboarding durch Nicol.md', '10-Beruf/Arbeit/Atupri/LBC Inkasso/Inkasso Onboarding durch Nicol.md'],
  ['01-Daily/Kalender/2024/10 - October/29 - Tuesday/PIQ4 Replanung Sumex.md', '10-Beruf/Arbeit/Atupri/PIQ4 Replanung Sumex.md'],
  ['01-Daily/Kalender/2024/10 - October/30 - Wednesday/Architektur Meeting mit David.md', '10-Beruf/Arbeit/Atupri/LBC Inkasso/Architektur Meeting mit David.md'],
  ['01-Daily/Kalender/2024/11 - November/28 - Thursday/Architecture  K3s.md', '40-Ressourcen/CAS Advanced Cloud Computing/Semesterarbeit/Architektur/Architecture  K3s.md'],
  ['01-Daily/Kalender/2024/12 - December/13 - Friday/Ferienübergabe Sabrina.md', '10-Beruf/Arbeit/Atupri/Ferienübergabe Sabrina.md'],
];

if (machen('klone')) {
  console.log('\n[klone] Kalender-Zwillinge entfernen, thematische Fassung behalten');
  for (const [weg, bleibt] of KLONE) {
    geplant++;
    if (!existsSync(p(weg))) { zeile('-', 'schon weg: ' + weg); continue; }
    if (!existsSync(p(bleibt))) { zeile('!', 'ABBRUCH, Zwilling fehlt: ' + bleibt); verweigert++; continue; }
    const a = lies(weg), b = lies(bleibt);
    if (ohneBranch(a) !== ohneBranch(b)) {
      zeile('!', 'ABBRUCH, Inhalte unterscheiden sich: ' + weg);
      verweigert++;
      continue;
    }
    if (APPLY) { unlinkSync(p(weg)); getan++; zeile('x', 'geloescht: ' + weg); }
    else zeile('~', 'wuerde loeschen: ' + weg);
  }
}

// ---------------------------------------------------------------- 2) Verweise
const ECHTES_VERZEICHNIS = '20-Privat/👤 Personen & Kontakte/Dienstleister/Kontakte Verzeichnis (OpenClaw.md';
const VERWEISE = [
  '50-Projekte/Camper & Travel/Iveco 9016 Umbau.md',
  '50-Projekte/Dachsanierung Projekt.md',
  '40-Ressourcen/Immobilien/Dachrenovation.md',
  '40-Ressourcen/IoT & Smart Home/Heizung BIO WIN 2.md',
  '40-Ressourcen/Netzwerk & Infrastruktur/Monzoon XGS-PON Internet.md',
];

// Relativer, prozentkodierter Pfad von der Notiz zum Verzeichnis.
// encodeURIComponent laesst Klammern stehen — in einem Markdown-Linkziel ist eine unbalancierte
// Klammer nach CommonMark ungueltig und der Link rendert nicht. Darum zusaetzlich %28/%29.
function zielPfad(vonRel) {
  const tiefe = vonRel.split('/').length - 1;
  const hinauf = '../'.repeat(tiefe);
  const pfad = ECHTES_VERZEICHNIS.split('/')
    .map(t => encodeURIComponent(t).replace(/\(/g, '%28').replace(/\)/g, '%29'))
    .join('/');
  return hinauf + pfad;
}

if (machen('verweise')) {
  console.log('\n[verweise] contacts/directory.md auf das echte Verzeichnis umbiegen');
  if (!existsSync(p(ECHTES_VERZEICHNIS))) {
    zeile('!', 'ABBRUCH: Zielverzeichnis nicht gefunden — ' + ECHTES_VERZEICHNIS);
    verweigert++;
  } else for (const rel of VERWEISE) {
    geplant++;
    if (!existsSync(p(rel))) { zeile('!', 'fehlt: ' + rel); verweigert++; continue; }
    const alt = lies(rel);
    // [Text](irgendwas/contacts/directory.md#anker)  ->  [Text](<neuer Pfad>)
    // Ziel UND Beschriftung: ein Link, der weiter "contacts/directory.md" heisst, nennt eine
    // Datei, die es nicht gibt — der Leser sucht sie dann.
    const neu = alt
      .replace(/\[contacts\/directory\.md\]\([^)]*\)/g, '[Kontakte Verzeichnis](' + zielPfad(rel) + ')')
      .replace(/\(([^)]*contacts\/directory\.md)(#[^)]*)?\)/g, () => '(' + zielPfad(rel) + ')');
    if (neu === alt) { zeile('-', 'kein Treffer: ' + rel); continue; }
    if (APPLY) { writeFileSync(p(rel), neu, 'utf8'); getan++; zeile('x', 'Verweis gesetzt: ' + rel); }
    else zeile('~', 'wuerde umbiegen: ' + rel);
  }
}

// ---------------------------------------------------------------- 2b) Sammelnotizen
//
// Trilium-Erbe: dort war jeder Ordner selbst eine Notiz. Im Markdown-Vault leistet der Ordner
// das schon, diese Dateien enthalten nur noch ihren eigenen Namen. Die Liste ist explizit und
// nicht geraten — und vor dem Loeschen wird jede Datei geprueft UND gesichert, damit ein
// spaeter dazugekommener Inhalt nicht mitgeht.
const SAMMEL = [
  '40-Ressourcen/AI & LLM.md',
  '40-Ressourcen/Immobilien.md',
  '40-Ressourcen/IoT & Smart Home.md',
  '40-Ressourcen/Netzwerk & Infrastruktur.md',
  '40-Ressourcen/Finanzen & Trading.md',
  '40-Ressourcen/Handwerk & DIY.md',
  '40-Ressourcen/CAS Advanced Cloud Computing.md',
];

/** Kopie unter _system/geloescht-<datum>-<aufgabe>/ ablegen, Ordnerstruktur erhalten. */
function sichern(rel, aufgabe) {
  const datum = new Date().toISOString().slice(0, 10);
  const ziel = join(ROOT, '_system', 'geloescht-' + datum + '-' + aufgabe, ...rel.split('/'));
  mkdirSync(ziel.slice(0, ziel.lastIndexOf(sep)), { recursive: true });
  copyFileSync(p(rel), ziel);
  return relative(ROOT, ziel).split(sep).join('/');
}

if (machen('sammel')) {
  console.log('\n[sammel] Ordner-Sammelnotizen entfernen (enthalten nur ihren eigenen Namen)');
  for (const rel of SAMMEL) {
    geplant++;
    if (!existsSync(p(rel))) { zeile('-', 'schon weg: ' + rel); continue; }
    const roh = lies(rel);
    const koerper = rumpf(roh)
      .replace(/^#\s+.+$/m, '')            // ATX-Ueberschrift
      .replace(/^.+\n[=-]{3,}\s*$/m, '')   // Setext-Ueberschrift (Name mit ==== darunter)
      .trim();
    const name = rel.split('/').pop().replace(/\.md$/i, '');
    // Zwei Sicherungen: nichts Verlinktes, und kaum Text. Ein Ordner, der inzwischen echten
    // Inhalt bekommen hat, faellt damit raus statt still zu verschwinden.
    if (/\]\(/.test(koerper) || /\[\[/.test(koerper)) {
      zeile('!', 'ABBRUCH, enthaelt Verweise: ' + rel); verweigert++; continue;
    }
    const ohneNamen = koerper.split(name).join('').trim();
    if (ohneNamen.length > 120) {
      zeile('!', 'ABBRUCH, enthaelt Inhalt (' + ohneNamen.length + ' Zeichen ueber den Namen hinaus): ' + rel);
      verweigert++; continue;
    }
    if (APPLY) {
      const kopie = sichern(rel, 'sammel');
      unlinkSync(p(rel));
      getan++;
      zeile('x', 'geloescht: ' + rel + '  (Sicherung: ' + kopie + ')');
    } else {
      zeile('~', 'wuerde loeschen: ' + rel + (ohneNamen ? '  [ausser dem Namen: "' + ohneNamen.slice(0, 60) + '"]' : ''));
    }
  }
}

// ---------------------------------------------------------------- 3) Leere
//
// WICHTIG: manche leeren Notizen sind Beweismittel. Die Wiki-Schicht verweist absichtlich auf sie
// ("die Anforderungsnotiz ist leer", "diese Sammelnotiz enthaelt nur ihren Namen"). Wird die Datei
// geloescht, stirbt der Beleg und der Verweis wird tot. Darum werden alle Notizen geschont, auf
// die eine Wiki-Seite zeigt — ermittelt aus graph.json, nicht geraten.
// Zwei Wiki-Seiten sind selbst die Arbeitsliste — ihre Verweise sind Auftraege, keine Belege.
// Wuerden sie mitzaehlen, blockierte die Liste ihre eigene Abarbeitung.
const PFLEGESEITEN = [
  '09-Wiki/Themen/Bestandspflege - Lint-Befunde.md',
  '09-Wiki/Themen/Kalender als Zeitindex (01-Daily).md',
];

function vomWikiVerlinkt() {
  try {
    const g = JSON.parse(readFileSync(join(ROOT, 'graph.json'), 'utf8'));
    return new Set(g.edges
      .filter(e => e.source.startsWith('09-Wiki/') && !PFLEGESEITEN.includes(e.source))
      .map(e => e.target));
  } catch {
    console.log('  ! graph.json nicht lesbar — zur Sicherheit wird nichts geloescht.');
    return null;
  }
}

if (machen('leere')) {
  console.log('\n[leere] Notizen ohne Inhalt entfernen (Titel allein zaehlt nicht als Inhalt)');
  const geschont = vomWikiVerlinkt();
  if (geschont === null) { verweigert++; }
  const alle = [];
  (function lauf(dir) {
    for (const name of readdirSync(dir).sort()) {
      if (name === '_system' || name === '.git' || name === 'node_modules' || name.startsWith('.')) continue;
      const abs = join(dir, name);
      if (statSync(abs).isDirectory()) lauf(abs);
      else if (name.toLowerCase().endsWith('.md')) alle.push(relative(ROOT, abs).split(sep).join('/'));
    }
  })(ROOT);

  for (const rel of alle) {
    if (rel.startsWith('09-Wiki/')) continue;              // die Wiki-Schicht nie
    if (rel.split('/').length === 1) continue;             // Wurzeldateien nie
    const text = rumpf(lies(rel));
    const titel = (text.match(/^#\s+(.+)$/m) || [])[1] || '';
    const restlich = text.replace(/^#\s+.+$/m, '').replace(/^[\s*_-]+$/gm, '').trim();
    if (restlich.length > 0) continue;                      // hat Inhalt
    geplant++;
    const wie = titel ? 'nur Titel "' + titel + '"' : 'voellig leer';
    if (geschont === null) { zeile('!', 'uebersprungen (kein graph.json): ' + rel); continue; }
    if (geschont.has(rel)) {
      zeile('o', 'geschont, Wiki verweist darauf als Beleg: ' + rel);
      continue;
    }
    if (APPLY) { unlinkSync(p(rel)); getan++; zeile('x', 'geloescht (' + wie + '): ' + rel); }
    else zeile('~', 'wuerde loeschen (' + wie + '): ' + rel);
  }
}

console.log('\n' + (APPLY ? 'Ausgefuehrt' : 'Testlauf') + ': ' + geplant + ' Faelle geprueft, '
  + (APPLY ? getan + ' geaendert, ' : '') + verweigert + ' verweigert.');
if (!APPLY) console.log('Nichts geaendert. Mit --apply ausfuehren.');
else console.log('Danach neu ableiten:  node _system/scripts/build-index.mjs');
