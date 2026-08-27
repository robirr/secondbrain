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
  # Den Rueckkanal ueberspringen (nur dann spiegelt der Lauf blind von hier nach dort).
  [switch]$KeinEinholen,
  # Vor dem Spiegeln auf dem NAS Eigentuemer und Gruppenrechte geradeziehen (braucht SSH).
  [switch]$KeinRechteAbgleich,
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

# --- Einholen: was auf der NAS entstanden oder neuer ist, zuerst hierher ----------------------
# Der Spiegel unten ist ein /MIR: er loescht am Ziel alles, was hier nicht existiert, und
# ueberschreibt dort jede Aenderung. Anfangs betraf das nur den Push-Kanal (00-Inbox/hermes) --
# am 23.08.2026 war eine zugestellte Testnotiz nach neun Sekunden weg. Seit Hermes den ganzen
# Vault schreibend gemountet hat, reicht das nicht mehr: am 26.08.2026 wurden vier Notizen
# ausserhalb der Inbox auf der NAS geloescht, und der naechste Spiegellauf machte das rueckgaengig,
# ohne ein Wort zu sagen. Darum wird jetzt der GANZE Vault in die Gegenrichtung geprueft.
#
# Zwei Regeln, absichtlich unsymmetrisch:
#   1. Was auf der NAS NEU oder NEUER ist, wird hierher geholt.
#   2. Was hier existiert und auf der NAS FEHLT, wird NICHT hier geloescht - es wird gemeldet.
# Regel 2 ist der Sicherheitsgurt: eine Loeschung ist nicht umkehrbar, ein doppelt vorhandener
# Text schon. Wer auf der NAS etwas loeschen will, sagt es hier - dann verschwindet es an beiden
# Orten. Sonst legt der Spiegel es dort wieder an, und die Meldung sagt, dass er das tut.
$eingeholt = 0
if (-not $KeinEinholen) {
  # Zielbestand aufnehmen (dieselben Ausschluesse wie beim Spiegeln)
  function Dateien($wurzel) {
    $treffer = @{}
    if (-not (Test-Path -LiteralPath $wurzel)) { return $treffer }
    foreach ($d in (Get-ChildItem -LiteralPath $wurzel -Recurse -File -ErrorAction SilentlyContinue)) {
      $rel = $d.FullName.Substring($wurzel.Length).TrimStart('\')
      # Erstes Pfadsegment gegen die Ausschlussliste. $AusMuster verlangt Backslashes ringsum
      # und greift bei einem relativen Pfad wie '_system\...' deshalb NICHT - dieser Fehler
      # liess den Rueckkanal die Bauartefakte unter _system mitnehmen (171 Dateien).
      if ($AusOrdner -contains ($rel -split '\\')[0]) { continue }
      if (('\' + $rel) -match $AusMuster) { continue }
      if ($AusDateien -contains (Split-Path $rel -Leaf)) { continue }
      $treffer[$rel] = $d
    }
    return $treffer
  }
  $imZiel = Dateien $Ziel
  $inQuelle = Dateien $Quelle

  $neuDort = @(); $neuerDort = @(); $fehltDort = @()
  foreach ($rel in $imZiel.Keys) {
    if (-not $inQuelle.ContainsKey($rel)) { $neuDort += $rel; continue }
    # 2 Sekunden Toleranz: /FFT im Spiegel arbeitet mit dieser Genauigkeit, sonst gilt eine
    # Datei nach jedem Lauf faelschlich als "neuer".
    $dz = $imZiel[$rel]; $dq = $inQuelle[$rel]
    if ($dz.LastWriteTimeUtc -gt $dq.LastWriteTimeUtc.AddSeconds(2)) { $neuerDort += $rel }
  }
  foreach ($rel in $inQuelle.Keys) { if (-not $imZiel.ContainsKey($rel)) { $fehltDort += $rel } }

  $zuHolen = @($neuDort) + @($neuerDort)
  if ($zuHolen.Count -gt 0) {
    if ($Testlauf) {
      Write-Host "Testlauf: $($zuHolen.Count) Datei(en) wuerden von der NAS eingeholt." -ForegroundColor Cyan
      foreach ($rel in $neuDort)   { Write-Host "  wuerde einholen (neu):    $rel" -ForegroundColor Cyan }
      foreach ($rel in $neuerDort) { Write-Host "  wuerde einholen (neuer):  $rel" -ForegroundColor Cyan }
    } else {
      # /XO: aeltere Quelldateien (hier: die NAS-Seite) ueberspringen. Ohne das wuerde eine hier
      # gemachte Aenderung von der aelteren Fassung der NAS ueberschrieben.
      $holArgs = @($Ziel, $Quelle, '/E', '/XO', '/FFT', '/DCOPY:D', '/R:2', '/W:5', '/NP', '/NDL', '/NJH', '/NFL')
      foreach ($d in $AusOrdner)  { $holArgs += '/XD'; $holArgs += $d }
      foreach ($dd in $AusDateien) { $holArgs += '/XF'; $holArgs += $dd }
      $null = & robocopy @holArgs
      if ($LASTEXITCODE -ge 8) {
        Write-Host "Abbruch: Einholen von der NAS fehlgeschlagen (robocopy $LASTEXITCODE)." -ForegroundColor Red
        Write-Host 'Ohne diesen Schritt wuerde der Spiegel dortige Aenderungen ueberschreiben.' -ForegroundColor Yellow
        exit 4
      }
      foreach ($rel in $neuDort)   { Write-Host "  eingeholt (neu):   $rel" -ForegroundColor Green }
      foreach ($rel in $neuerDort) { Write-Host "  eingeholt (neuer): $rel" -ForegroundColor Green }
      $eingeholt = $zuHolen.Count
      Write-Host "$eingeholt Datei(en) von der NAS eingeholt - sie ueberleben den Spiegel."
    }
  }

  if ($fehltDort.Count -gt 0) {
    Write-Host "" 
    Write-Host "$($fehltDort.Count) Datei(en) gibt es hier, aber nicht mehr auf der NAS." -ForegroundColor Yellow
    Write-Host 'Der Spiegel legt sie dort gleich wieder an. Wenn sie WEG sollen: hier loeschen.' -ForegroundColor Yellow
    foreach ($rel in ($fehltDort | Select-Object -First 12)) { Write-Host "  $rel" -ForegroundColor DarkGray }
    if ($fehltDort.Count -gt 12) { Write-Host "  ... und $($fehltDort.Count - 12) weitere" -ForegroundColor DarkGray }
    Write-Host "" 
  }
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

# --- Rechte auf dem Ziel geradeziehen ----------------------------------------------------------
# Hermes laeuft im eigenen Container als root und schreibt direkt in den gemounteten Vault; so
# entstehen Dateien als root:root 644. Ueber die SMB-Freigabe (Benutzer nobody) sind die dann
# unantastbar: robocopy kann sie nicht aktualisieren, Windows nicht bearbeiten, und der Ordner
# laesst keinen Zeitstempel setzen. Am 23.08.2026 hat der Spiegel deswegen eine zugestellte
# Notiz als ueberzaehlig geloescht. Hermes ist nicht aenderbar - also raeumt der Spiegel vorher auf.
#
# Laeuft IM Container second-brain: der hat den Vault gemountet, ist root und der Pfad ist bekannt.
# Nur was noetig ist: Eigentuemer auf 99:100 (nobody:users) und Gruppenschreibrecht dort ergaenzen,
# wo es fehlt. Kein pauschales chmod, sonst gehen bewusst gesetzte Rechte verloren.
if (-not $KeinRechteAbgleich) {
  # KEINE doppelten Anfuehrungszeichen in diesem Befehl: PowerShell 5.1 verstuemmelt sie beim
  # Uebergeben an ein natives Programm. Am 23.08.2026 zerfiel der Befehl deshalb unterwegs,
  # chown lief mit leerem Pfad - und die Erfolgsmeldung kam trotzdem, weil sie an einem echo hing.
  # Darum wird jetzt das ERGEBNIS gemessen: die Zahl der Dateien, die danach noch nicht
  # schreibbar sind. 0 heisst gut, alles andere ist ein Befund.
  $datenPfad = '/usr/share/nginx/html/data'
  $rechteBefehl = "docker exec second-brain sh -c 'chown -R 99:100 $datenPfad; find $datenPfad ! -perm -o+w -exec chmod a+w {} + ; find $datenPfad ! -perm -o+w | wc -l'"
  $r = (ssh -o BatchMode=yes -o ConnectTimeout=10 $NasHost $rechteBefehl 2>&1) -join ' '
  if ($r -match '(^|\s)0(\s|$)') {
    Write-Host 'Rechte am Ziel geradegezogen: alles schreibbar (nobody:users).' -ForegroundColor DarkGray
  } else {
    Write-Host 'Rechteabgleich unvollstaendig - der Spiegel kann an fremden Dateien scheitern.' -ForegroundColor Yellow
    Write-Host "  Antwort: $r" -ForegroundColor DarkGray
  }
}

# --- Spiegeln ---
# /DCOPY:D = Ordner-Metadaten gar nicht uebernehmen (weder Attribute noch Zeitstempel). Ordner, die der Container
# als root angelegt hat (00-Inbox/hermes), lassen ihre Attribute ueber die Freigabe nicht aendern:
# robocopy meldete dort FEHLER 5 Zugriff verweigert, obwohl alle Dateien fehlerfrei durchgingen.
# Ordner-Zeitstempel haben in einem Spiegel keinen Wert - der Verzicht kostet nichts.
$argumente = @($Quelle, $Ziel, '/MIR', '/FFT', '/DCOPY:D', '/R:2', '/W:5', '/NP', '/NDL', '/NJH')
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
