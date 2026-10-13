<#
.SYNOPSIS
  Remet en place la personnalisation « Firefox façon Safari » : après une mise à jour qui l'a cassée,
  une réinstallation de Firefox ou sur un autre PC.

.DESCRIPTION
  1. Copie profil\chrome\* et profil\user.js dans le profil Firefox (les fichiers remplacés sont gardés dans
     <profil>\sauvegarde-avant-restauration\<date>\).
  2. Copie installation\config.js et installation\defaults\pref\config-prefs.js dans le dossier d'installation de
     Firefox (C:\Program Files\Mozilla Firefox) : c'est ce qui charge urlbar-domaine.uc.js. Il faut les droits
     administrateur : le script se relance seul en élevé (une fenêtre d'autorisation s'affiche).
  Ensuite : quitter COMPLÈTEMENT Firefox (aucun processus firefox.exe) et le relancer.

.PARAMETER Profil
  Dossier du profil. Par défaut : le seul profil « default-release » trouvé dans profiles.ini.

.PARAMETER DossierFirefox
  Dossier d'installation de Firefox (défaut : C:\Program Files\Mozilla Firefox).

.PARAMETER SansInstallation
  Ne touche pas au dossier d'installation (pas d'élévation).

.PARAMETER SansUserJs
  Ne remplace pas user.js (utile si vous l'avez modifié à la main et voulez le garder).

.PARAMETER Simuler
  Affiche ce qui serait fait, sans rien copier.

.PARAMETER ForcerSiOuvert
  Continue même si Firefox est ouvert (déconseillé : user.js et le script ne sont relus qu'au démarrage).

.EXAMPLE
  .\restaurer.ps1 -Simuler
  .\restaurer.ps1
  .\restaurer.ps1 -Profil "C:\Users\moi\AppData\Roaming\Mozilla\Firefox\Profiles\xxxx.default-release" -SansInstallation
#>
param(
  [string]$Profil,
  [string]$DossierFirefox = 'C:\Program Files\Mozilla Firefox',
  [switch]$SansInstallation,
  [switch]$SansUserJs,
  [switch]$Simuler,
  [switch]$ForcerSiOuvert,
  [switch]$Eleve   # interne : relance élevée, ne fait que l'installation
)
$ErrorActionPreference = 'Stop'
$racine = $PSScriptRoot

function Installer-DansFirefox {
  if (-not (Test-Path (Join-Path $DossierFirefox 'firefox.exe'))) {
    throw "firefox.exe introuvable dans '$DossierFirefox' (utilisez -DossierFirefox)."
  }
  foreach ($rel in @('config.js', 'defaults\pref\config-prefs.js')) {
    $src = Join-Path $racine "installation\$rel"
    $dst = Join-Path $DossierFirefox $rel
    New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
    Copy-Item $src $dst -Force
    Write-Host "  installé : $dst"
  }
}

if ($Eleve) {
  Installer-DansFirefox
  Start-Sleep -Seconds 2
  exit 0
}

function Trouver-Profil {
  $base = Join-Path $env:APPDATA 'Mozilla\Firefox'
  $ini = Join-Path $base 'profiles.ini'
  if (-not (Test-Path $ini)) { throw "profiles.ini introuvable ($ini) : indiquez le profil avec -Profil." }
  $chemins = [regex]::Matches((Get-Content $ini -Raw), '(?m)^Path=(.+)$') |
    ForEach-Object { Join-Path $base $_.Groups[1].Value.Trim().Replace('/', '\') } |
    Where-Object { (Test-Path $_) -and ($_ -match 'default-release') } | Select-Object -Unique
  if (@($chemins).Count -eq 1) { return @($chemins)[0] }
  throw "Profil « default-release » introuvable ou ambigu ($(@($chemins).Count) trouvés) : indiquez-le avec -Profil."
}

if (-not $Profil) { $Profil = Trouver-Profil }
if (-not (Test-Path $Profil)) { throw "Profil introuvable : $Profil" }
Write-Host "Profil           : $Profil"
Write-Host "Dossier Firefox  : $DossierFirefox"

if ((Get-Process firefox -ErrorAction SilentlyContinue) -and -not $Simuler -and -not $ForcerSiOuvert) {
  throw "Firefox est ouvert : quittez-le COMPLÈTEMENT (aucun firefox.exe dans le Gestionnaire des tâches) puis relancez ce script."
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$sauvegarde = Join-Path $Profil "sauvegarde-avant-restauration\$stamp"

function Copier-Fichier([string]$src, [string]$dst) {
  if ($Simuler) { Write-Host "  [simulation] $src -> $dst"; return }
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  if (Test-Path $dst) {
    $rel = $dst.Substring($Profil.Length).TrimStart('\')
    $copie = Join-Path $sauvegarde $rel
    New-Item -ItemType Directory -Force (Split-Path $copie) | Out-Null
    Copy-Item $dst $copie -Force
  }
  Copy-Item $src $dst -Force
  Write-Host "  copié : $dst"
}

Write-Host "`n1/2  Fichiers du profil"
foreach ($f in Get-ChildItem (Join-Path $racine 'profil\chrome') -File) {
  Copier-Fichier $f.FullName (Join-Path $Profil "chrome\$($f.Name)")
}
if (-not $SansUserJs) {
  Copier-Fichier (Join-Path $racine 'profil\user.js') (Join-Path $Profil 'user.js')
} else {
  Write-Host "  user.js : ignoré (-SansUserJs)"
}

Write-Host "`n2/2  Chargeur dans le dossier d'installation de Firefox"
if ($SansInstallation) {
  Write-Host "  ignoré (-SansInstallation)"
} elseif ($Simuler) {
  Write-Host "  [simulation] installation\config.js et defaults\pref\config-prefs.js -> $DossierFirefox"
} else {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($admin) {
    Installer-DansFirefox
  } else {
    Write-Host "  droits administrateur nécessaires : acceptez la fenêtre d'autorisation..."
    $args2 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Eleve', '-DossierFirefox', "`"$DossierFirefox`"")
    Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList $args2
    foreach ($rel in @('config.js', 'defaults\pref\config-prefs.js')) {
      $ok = (Test-Path (Join-Path $DossierFirefox $rel)) -and
            ((Get-FileHash (Join-Path $DossierFirefox $rel)).Hash -eq (Get-FileHash (Join-Path $racine "installation\$rel")).Hash)
      Write-Host ("  {0} : {1}" -f $rel, $(if ($ok) { 'OK' } else { 'NON INSTALLÉ (autorisation refusée ?)' }))
    }
  }
}

Write-Host "`nTerminé. Quittez COMPLÈTEMENT Firefox (tous les firefox.exe) puis relancez-le."
if (-not $Simuler -and (Test-Path $sauvegarde)) { Write-Host "Anciennes versions gardées dans : $sauvegarde" }
