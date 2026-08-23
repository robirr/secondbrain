# Vault-Spiegel: die Notizen von diesem Rechner auf den Ordner, den der Container liest.
# Aufruf:  powershell -ExecutionPolicy Bypass -File _system/scripts/sync-vault.ps1 -Ziel <Pfad>
#
# Echter Spiegel (robocopy /MIR): Geloeschtes und Umbenanntes verschwindet auch am Ziel, sonst
# sammeln sich dort Geisternotizen, die in Suche und Ansicht auftauchen.
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
  [string]$NasHost = 'unraid'
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
$argumente = @($Quelle, $Ziel, '/MIR', '/FFT', '/R:2', '/W:5', '/NP', '/NDL', '/NJH')
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
if ($KeinNachziehen) { Write-Host 'Nachziehen uebersprungen (-KeinNachziehen).'; exit 0 }

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
