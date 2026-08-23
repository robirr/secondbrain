# Vault-Spiegel: die Notizen von diesem Rechner auf den Ordner, den der Container liest.
# Aufruf:  powershell -ExecutionPolicy Bypass -File _system/scripts/sync-vault.ps1 -Ziel <Pfad>
#
# Echter Spiegel (robocopy /MIR): Geloeschtes und Umbenanntes verschwindet auch am Ziel, sonst
# sammeln sich dort Geisternotizen, die in Suche und Ansicht auftauchen.
#
# 00-Inbox laeuft in BEIDE Richtungen: erst wird geholt, was der Hermes-Agent am Ziel abgelegt
# hat, dann gespiegelt. Ohne diesen Schritt loescht /MIR jede Zustellung wieder weg.
#
# NIE angefasst: _system (Tokens!), Punktordner (.git, .claude, .qmd, node_modules) und die drei
# abgeleiteten Dateien INDEX.md, graph.json, integrations.json - die baut der Container selbst.
#
# Sicherung vor Unfaellen: der Lauf verweigert sich, wenn dieser Rechner auffaellig wenige
# Notizen hat (unter 50) oder wenn der Spiegel mehr als ein Fuenftel des Zielbestands loeschen
# wuerde. -Erzwingen uebergeht das, -Testlauf zeigt nur, was passieren wuerde.
#
# ACHTUNG Kodierung: diese Datei MUSS mit UTF-8-BOM gespeichert bleiben und nur ASCII-
# Interpunktion enthalten. Windows PowerShell 5.1 liest BOM-lose Dateien als CP1252; aus einem
# Gedankenstrich (E2 80 94) wird dabei ein typografisches Anfuehrungszeichen, das der Parser als
# String-Begrenzer nimmt - er verschluckt dann stillschweigend die folgenden Zeilen.
[CmdletBinding()]
param(
  # Zielordner (der Vault, den der Container mountet), z. B. Z:\appdata\secondbrain\vault.
  # Ohne Angabe wird die Umgebungsvariable SECOND_BRAIN_MIRROR benutzt.
  [string]$Ziel = $env:SECOND_BRAIN_MIRROR,
  # Quelle: standardmaessig die Vault-Wurzel zwei Ebenen ueber diesem Skript.
  [string]$Quelle,
  [switch]$Testlauf,
  [switch]$Erzwingen,
  # Nach dem Spiegeln im Container neu ableiten und den Suchindex nachziehen (braucht SSH).
  [switch]$KeinNachziehen,
  # Den LOKALEN qmd-Index nicht nachziehen (sonst wird er nach jeder Aenderung mitgepflegt).
  [switch]$KeinLokalerIndex,
  [string]$NasHost = 'unraid',
  [string]$QmdBefehl = "$env:APPDATA\npm\qmd.cmd"
)

$ErrorActionPreference = 'Stop'

if (-not $Quelle) { $Quelle = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent }
if (-not $Ziel) {
  Write-Host 'Kein Ziel angegeben. Entweder -Ziel <Pfad> setzen oder SECOND_BRAIN_MIRROR' -ForegroundColor Yellow
  Write-Host 'als Umgebungsvariable (z. B. Z:\appdata\secondbrain\vault).' -ForegroundColor Yellow
  exit 2
}

$AusOrdner  = @('_system', '.git', '.claude', '.qmd', 'node_modules')
$AusDateien = @('INDEX.md', 'graph.json', 'integrations.json', '.gitignore', '.mcp.json')
$AusMuster  = '\\(_system|\.git|\.claude|\.qmd|node_modules)\\'

function Notizen($pfad) {
  if (-not (Test-Path -LiteralPath $pfad)) { return 0 }
  $treffer = Get-ChildItem -LiteralPath $pfad -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch $AusMuster }
  return ($treffer | Measure-Object).Count
}

if (-not (Test-Path -LiteralPath $Quelle)) { Write-Host "Quelle nicht gefunden: $Quelle" -ForegroundColor Red; exit 2 }
if (-not (Test-Path -LiteralPath $Ziel))   { Write-Host "Ziel nicht erreichbar: $Ziel" -ForegroundColor Red; exit 2 }

# --- Einholen: was der Push-Kanal auf der NAS abgelegt hat, zuerst hierher ---------------------
# Der Spiegel unten ist ein /MIR: er loescht am Ziel alles, was hier nicht existiert. Notizen, die
# Hermes ueber den Capture-Kanal direkt in die NAS-Inbox legt, wuerden damit vernichtet, bevor sie
# jemand gesehen hat - am 23.08.2026 genau so passiert, die Testnotiz war nach neun Sekunden weg.
# Darum werden diese Ordner VOR dem Spiegeln in die Gegenrichtung geholt: kopieren, nie loeschen.
$EinholOrdner = @('00-Inbox\hermes')
$eingeholt = 0
foreach ($ordner in $EinholOrdner) {
  $von = Join-Path $Ziel $ordner
  if (-not (Test-Path -LiteralPath $von)) { continue }
  $nach = Join-Path $Quelle $ordner
  $neue = @()
  foreach ($d in (Get-ChildItem -LiteralPath $von -Recurse -File -ErrorAction SilentlyContinue)) {
    $rel = $d.FullName.Substring($von.Length).TrimStart('\')
    if (-not (Test-Path -LiteralPath (Join-Path $nach $rel))) { $neue += $rel }
  }
  if ($neue.Count -eq 0) { continue }
  if ($Testlauf) {
    Write-Host "Testlauf: $($neue.Count) Datei(en) wuerden aus $ordner eingeholt." -ForegroundColor Cyan
    foreach ($rel in $neue) { Write-Host "  wuerde einholen: $ordner\$rel" -ForegroundColor Cyan }
    continue
  }
  if (-not (Test-Path -LiteralPath $nach)) { New-Item -ItemType Directory -Path $nach -Force | Out-Null }
  # /XC /XN /XO: nur holen, was hier FEHLT. Ohne diese drei wuerde robocopy auch bestehende
  # Notizen mit der Fassung vom Ziel ueberschreiben - der Rueckkanal darf nur ergaenzen.
  $null = & robocopy $von $nach '/E' '/XC' '/XN' '/XO' '/FFT' '/R:2' '/W:5' '/NP' '/NDL' '/NJH' '/NFL'
  if ($LASTEXITCODE -ge 8) {
    Write-Host "Abbruch: Einholen aus $ordner fehlgeschlagen (robocopy $LASTEXITCODE)." -ForegroundColor Red
    Write-Host 'Ohne diesen Schritt wuerde der Spiegel die Notizen dort loeschen.' -ForegroundColor Yellow
    exit 4
  }
  foreach ($rel in $neue) { Write-Host "  eingeholt: $ordner\$rel" -ForegroundColor Green }
  $eingeholt += $neue.Count
}
if ($eingeholt -gt 0) {
  Write-Host "$eingeholt Notiz(en) vom Push-Kanal eingeholt - sie ueberleben den Spiegel."
}
$quellZahl = Notizen $Quelle
$zielZahl  = Notizen $Ziel
Write-Host "Quelle: $Quelle  ($quellZahl Notizen)"
Write-Host "Ziel:   $Ziel  ($zielZahl Notizen)"

# --- Sicherungen ---
if ($quellZahl -lt 50 -and -not $Erzwingen) {
  Write-Host "Abbruch: nur $quellZahl Notizen in der Quelle - das sieht nach einem Unfall aus." -ForegroundColor Red
  Write-Host 'Wenn das wirklich stimmt: noch einmal mit -Erzwingen aufrufen.' -ForegroundColor Yellow
  exit 3
}
if ($zielZahl -gt 0) {
  $grenze = [math]::Floor($zielZahl * 0.8)
  if ($quellZahl -lt $grenze -and -not $Erzwingen) {
    Write-Host "Abbruch: der Spiegel wuerde am Ziel von $zielZahl auf $quellZahl Notizen kuerzen." -ForegroundColor Red
    Write-Host 'Mehr als ein Fuenftel Verlust - bitte pruefen, sonst mit -Erzwingen aufrufen.' -ForegroundColor Yellow
    exit 3
  }
}

# --- Spiegeln ---
# /DCOPY:T = nur Zeitstempel der Ordner uebernehmen, KEINE Attribute. Ordner, die der Container
# als root angelegt hat (00-Inbox/hermes), lassen ihre Attribute ueber die Freigabe nicht aendern:
# robocopy meldete dort FEHLER 5 Zugriff verweigert, obwohl alle Dateien fehlerfrei durchgingen.
$argumente = @($Quelle, $Ziel, '/MIR', '/FFT', '/DCOPY:T', '/R:2', '/W:5', '/NP', '/NDL', '/NJH')
foreach ($d in $AusOrdner)  { $argumente += '/XD'; $argumente += $d }
foreach ($f in $AusDateien) { $argumente += '/XF'; $argumente += $f }
if ($Testlauf) { $argumente += '/L' }

if ($Testlauf) { Write-Host 'Testlauf - es wird nichts geschrieben.' -ForegroundColor Cyan }
$ausgabe = & robocopy @argumente
$code = $LASTEXITCODE
if ($null -eq $code) { $code = 0 }

# Nur die Zeilen zeigen, die eine Datei nennen (robocopy schreibt sonst viel Rahmen).
$ausgabe | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*-+\s*$' } |
  Select-Object -Last 12 | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }

# robocopy: 0 = nichts zu tun, 1 = kopiert, 2 = Ueberzaehliges entfernt, 3 = beides, ab 8 = Fehler
if ($code -ge 8) {
  Write-Host "robocopy meldet Fehler (Code $code) - Spiegel unvollstaendig." -ForegroundColor Red
  exit 1
}
$was = @()
if ($code -band 1) { $was += 'kopiert/aktualisiert' }
if ($code -band 2) { $was += 'Ueberzaehliges am Ziel entfernt' }
if ($was.Count -eq 0) { $was += 'nichts zu tun' }
Write-Host ("Spiegel fertig: " + ($was -join ', ') + " (Code $code)") -ForegroundColor Green

if ($Testlauf) { exit 0 }

# --- Nachpruefung: hat der Spiegel wirklich gespiegelt? -----------------------------------------
# Dem Rueckgabewert allein ist nicht zu trauen. Am 23.08.2026 meldete robocopy Code 0 ("nichts zu
# tun") und liess dabei eine Datei am Ziel stehen, die es hier nicht mehr gab - der root-eigene
# Ordner 00-Inbox/hermes laesst ueber die Freigabe kein Loeschen zu. Wer nur den Code liest, haelt
# einen auseinandergelaufenen Spiegel fuer erledigt; beim naechsten Lauf holt der Rueckkanal die
# Datei sogar wieder her. Darum wird das Ergebnis nachgezaehlt, nicht geglaubt.
$relQuelle = @{}
Get-ChildItem -LiteralPath $Quelle -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $AusMuster } |
  ForEach-Object { $relQuelle[$_.FullName.Substring($Quelle.Length).TrimStart('\')] = $true }
$ueberzaehlig = @()
Get-ChildItem -LiteralPath $Ziel -Recurse -File -Filter *.md -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch $AusMuster } |
  ForEach-Object {
    $rel = $_.FullName.Substring($Ziel.Length).TrimStart('\')
    if (-not $relQuelle.ContainsKey($rel)) { $ueberzaehlig += $rel }
  }
if ($ueberzaehlig.Count -gt 0) {
  Write-Host "ACHTUNG: $($ueberzaehlig.Count) Notiz(en) liegen noch am Ziel, die es hier nicht gibt:" -ForegroundColor Red
  $ueberzaehlig | Select-Object -First 10 | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host 'Der Spiegel konnte sie nicht entfernen - meist fehlt der Freigabe das Schreibrecht auf' -ForegroundColor Yellow
  Write-Host 'dem Ordner, den der Container als root angelegt hat. Auf dem NAS einmalig:' -ForegroundColor Yellow
  Write-Host '  chown -R nobody:users <vault>/00-Inbox/hermes; chmod 777 <vault>/00-Inbox/hermes' -ForegroundColor Yellow
} else {
  Write-Host 'Nachpruefung: am Ziel liegt keine Notiz, die es hier nicht gibt.' -ForegroundColor DarkGray
}

# --- Lokalen Suchindex nachziehen ---------------------------------------------------------------
# Auf dem NAS pflegt der Container den Index, lokal pflegte ihn NIEMAND: am 23.08.2026 war der
# lokale Index einen Monat alt (221 Dokumente, keine einzige Wiki-Seite). Damit ist die
# Bedeutungssuche in Claude Code blind fuer alles Neue - genau das, was die Suchleiter braucht.
if (-not $KeinLokalerIndex) {
  if (Test-Path -LiteralPath $QmdBefehl) {
    Write-Host 'Lokalen Suchindex nachziehen ...'
    & $QmdBefehl update | Select-Object -Last 3
    # embed dauert Minuten -> abgekoppelt starten, die Stichwortsuche geht sofort
    Start-Process -FilePath $QmdBefehl -ArgumentList 'embed' -WorkingDirectory $Quelle -WindowStyle Hidden
    Write-Host 'Lokale Einbettungen laufen im Hintergrund.' -ForegroundColor DarkGray
  } else {
    Write-Host "qmd nicht gefunden ($QmdBefehl) - lokaler Index bleibt alt." -ForegroundColor Yellow
  }
}

if ($KeinNachziehen) { Write-Host 'Nachziehen im Container uebersprungen (-KeinNachziehen).'; exit 0 }

# --- Im Container nachziehen: neu ableiten + Suchindex aktualisieren ---
Write-Host 'Im Container neu ableiten ...'
ssh -o BatchMode=yes -o ConnectTimeout=10 $NasHost 'docker exec second-brain node /app/scripts/build-index.mjs'
if (-not $?) {
  Write-Host 'Nachziehen nicht moeglich (SSH/Docker). Der naechste Containerstart leitet ohnehin ab.' -ForegroundColor Yellow
  exit 0
}
Write-Host 'Suchindex nachziehen (Stichwortsuche sofort) ...'
ssh -o BatchMode=yes -o ConnectTimeout=10 $NasHost 'docker exec -w /qmd-home second-brain qmd update'

# Ohne diesen Schritt bleibt die BEDEUTUNGSsuche blind fuer alles Neue: qmd update pflegt nur den
# Stichwortindex, die Vektoren entstehen erst bei embed. Laeuft abgekoppelt weiter (-d), weil es
# je nach Menge Minuten dauert - die Stichwortsuche funktioniert in der Zwischenzeit schon.
#
# Erst pruefen, ob schon ein Lauf aktiv ist: zwei gleichzeitige embed-Prozesse blockieren sich am
# selben SQLite-Index und bleiben stehen (am 23.08.2026 genau so passiert). Ein abgebrochener
# SSH-Aufruf beendet den Prozess IM Container nicht - er laeuft dort weiter.
Write-Host 'Einbettungen im Hintergrund nachziehen (Bedeutungssuche folgt) ...'
$embedBefehl = 'if docker exec second-brain pgrep -f "cli/qmd.js embed" >/dev/null 2>&1; ' +
  'then echo "embed laeuft schon - nicht neu gestartet"; ' +
  'else docker exec -d -w /qmd-home second-brain qmd embed && echo "embed gestartet"; fi'
ssh -o BatchMode=yes -o ConnectTimeout=10 $NasHost $embedBefehl
Write-Host 'Stand pruefen mit:  ssh unraid "docker exec -w /qmd-home second-brain qmd status"' -ForegroundColor DarkGray
Write-Host 'Fertig.' -ForegroundColor Green
