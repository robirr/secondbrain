#!/usr/bin/env python3
"""A4 - Konnektor Trilium -> .md (via ETAPI Markdown-Export, dann entpacken).

Aufruf:  python _system/scripts/pull_trilium.py [zweig-filter]
  ohne Filter  -> alle Zweige laut MAPPING
  mit Filter   -> nur Zweige, deren Label den Filter enthaelt (z.B. "Arbeit")
"""
import io, sys, zipfile, urllib.request, pathlib

HERE = pathlib.Path(__file__).resolve().parent
SYSTEM = HERE.parent
ROOT = SYSTEM.parent
BASE = "http://<NAS-IP>:54321"

# (noteId, Label/Branch-Tag, Ziel-Cluster)
MAPPING = [
    ("npLz3qaecHfR", "Arbeit",     "10-Beruf"),
    ("VR0gkcSlo4V2", "Privat",     "20-Privat"),
    ("jioBQMuvuPPp", "Config-Code", "40-Ressourcen"),
    ("5bEwtqOCmOSg", "Second-Brain", "40-Ressourcen"),
    ("PLQQwUxyewgv", "Kalender",   "01-Daily"),
]

SKIP_BASENAMES = {"!!!meta.json"}


def load_token():
    for line in (SYSTEM / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("TRILIUM_ETAPI_TOKEN="):
            return line.split("=", 1)[1].strip()
    return None


def export_zip(note_id, token):
    url = f"{BASE}/etapi/notes/{note_id}/export?format=markdown"
    req = urllib.request.Request(url, headers={"Authorization": token})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def migrate(note_id, label, cluster, token, keep_attachments=True):
    z = zipfile.ZipFile(io.BytesIO(export_zip(note_id, token)))
    target = ROOT / cluster
    md = att = skipped = 0
    errors = []
    for info in z.infolist():
        name = info.filename
        if name.endswith("/"):
            continue
        base = name.split("/")[-1]
        if base in SKIP_BASENAMES:
            continue
        if name.lower().endswith(".clone.md"):   # Trilium-Klone = Duplikate
            skipped += 1
            continue
        is_md = name.lower().endswith(".md")
        if not is_md and not keep_attachments:
            continue
        dest = target / name          # Trilium-Hierarchie bleibt erhalten (Top-Ordner = Branch)
        try:
            dest.parent.mkdir(parents=True, exist_ok=True)
            data = z.read(info)
            if is_md:
                text = data.decode("utf-8", errors="replace")
                if not text.lstrip().startswith("---"):
                    text = f"---\nsource: trilium\nbranch: {label}\n---\n\n" + text
                dest.write_text(text, encoding="utf-8")
                md += 1
            else:
                dest.write_bytes(data)
                att += 1
        except OSError as e:
            errors.append(f"{name}: {e}")
    return md, att, skipped, errors


def main():
    token = load_token()
    if not token:
        print("FEHLER: TRILIUM_ETAPI_TOKEN fehlt in _system/.env")
        sys.exit(1)
    only = sys.argv[1] if len(sys.argv) > 1 else None
    tot_md = tot_att = tot_skip = 0
    all_errors = []
    for note_id, label, cluster in MAPPING:
        if only and only.lower() not in label.lower():
            continue
        print(f"Migriere '{label}' -> {cluster} ...", flush=True)
        md, att, skipped, errors = migrate(note_id, label, cluster, token)
        print(f"  {md} Notizen, {att} Anhaenge, {skipped} Klone uebersprungen"
              + (f", {len(errors)} FEHLER" if errors else ""))
        for e in errors[:5]:
            print("    ! " + e)
        tot_md += md; tot_att += att; tot_skip += skipped; all_errors += errors
    print(f"\nGesamt: {tot_md} Notizen, {tot_att} Anhaenge, {tot_skip} Klone uebersprungen, "
          f"{len(all_errors)} Fehler")


main()
