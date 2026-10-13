<#
.SYNOPSIS
  Copie la personnalisation ACTUELLE (profil + chargeur du dossier d'installation) dans ce dépôt, pour la committer.

.DESCRIPTION
  À lancer après chaque modification dans le profil. Copie userChrome.css, userContent.css, urlbar-domaine.uc.js,
  urlbar-domaine.manifest, user.js, config.js et config-prefs.js, puis affiche `git status`.
  Lecture seule côté Firefox : rien n'est modifié dans le profil ni dans C:\Program Files.

.PARAMETER Profil
  Dossier du profil (défaut : le seul profil « default-release » de profiles.ini).

.PARAMETER DossierFirefox
  Dossier d'installation de Firefox (défaut : C:\Program Files\Mozilla Firefox).
#>
param(
  [string]$Profil,
  [string]$DossierFirefox = 'C:\Program Files\Mozilla Firefox'
)
$ErrorActionPreference = 'Stop'
$racine = $PSScriptRoot

if (-not $Profil) {
  $base = Join-Path $env:APPDATA 'Mozilla\Firefox'
  $chemins = [regex]::Matches((Get-Content (Join-Path $base 'profiles.ini') -Raw), '(?m)^Path=(.+)$') |
    ForEach-Object { Join-Path $base $_.Groups[1].Value.Trim().Replace('/', '\') } |
    Where-Object { (Test-Path $_) -and ($_ -match 'default-release') } | Select-Object -Unique
  if (@($chemins).Count -ne 1) { throw "Profil « default-release » introuvable ou ambigu : indiquez-le avec -Profil." }
  $Profil = @($chemins)[0]
}
Write-Host "Profil : $Profil"

$paires = @(
  @{ De = "$Profil\chrome\userChrome.css";            Vers = "$racine\profil\chrome\userChrome.css" },
  @{ De = "$Profil\chrome\userContent.css";          Vers = "$racine\profil\chrome\userContent.css" },
  @{ De = "$Profil\chrome\urlbar-domaine.uc.js";     Vers = "$racine\profil\chrome\urlbar-domaine.uc.js" },
  @{ De = "$Profil\chrome\urlbar-domaine.manifest";  Vers = "$racine\profil\chrome\urlbar-domaine.manifest" },
  @{ De = "$Profil\user.js";                         Vers = "$racine\profil\user.js" },
  @{ De = "$DossierFirefox\config.js";               Vers = "$racine\installation\config.js" },
  @{ De = "$DossierFirefox\defaults\pref\config-prefs.js"; Vers = "$racine\installation\defaults\pref\config-prefs.js" }
)
foreach ($p in $paires) {
  if (Test-Path $p.De) {
    Copy-Item $p.De $p.Vers -Force
    Write-Host "  copié : $($p.De)"
  } else {
    Write-Warning "absent, ignoré : $($p.De)"
  }
}
Write-Host ""
git -C $racine status --short
