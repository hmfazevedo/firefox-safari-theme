<#
.SYNOPSIS
  Developer tool: copies the CURRENT customisation (profile + loader from the installation folder) into this repository, to commit it.

.DESCRIPTION
  Run it after every change made inside the profile. Copies the theme files, user.js, config.js and config-prefs.js, then shows
  `git status`. Read-only on the Firefox side: nothing is modified in the profile or in the installation folder.

.PARAMETER ProfilePath
  Profile folder (default: the profile used by default, from profiles.ini).

.PARAMETER FirefoxPath
  Firefox installation folder (default: C:\Program Files\Mozilla Firefox).
#>
param(
  [string]$ProfilePath,
  [string]$FirefoxPath = 'C:\Program Files\Mozilla Firefox'
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot

if (-not $ProfilePath) {
  $base = Join-Path $env:APPDATA 'Mozilla\Firefox'
  $found = [regex]::Matches((Get-Content (Join-Path $base 'profiles.ini') -Raw), '(?m)^Path=(.+)$') |
    ForEach-Object { Join-Path $base $_.Groups[1].Value.Trim().Replace('/', '\') } |
    Where-Object { (Test-Path $_) -and ($_ -match 'default-release') } | Select-Object -Unique
  if (@($found).Count -ne 1) { throw "Could not tell which profile to use: give it with -ProfilePath." }
  $ProfilePath = @($found)[0]
}
Write-Host "Profile: $ProfilePath"

$pairs = @(
  @{ From = "$ProfilePath\chrome\userChrome.css";          To = "$root\profile\chrome\userChrome.css" },
  @{ From = "$ProfilePath\chrome\userContent.css";         To = "$root\profile\chrome\userContent.css" },
  @{ From = "$ProfilePath\chrome\safari-theme.uc.js";      To = "$root\profile\chrome\safari-theme.uc.js" },
  @{ From = "$ProfilePath\chrome\safari-theme.manifest";   To = "$root\profile\chrome\safari-theme.manifest" },
  @{ From = "$ProfilePath\chrome\tint-child.sys.mjs";      To = "$root\profile\chrome\tint-child.sys.mjs" },
  @{ From = "$ProfilePath\chrome\tint-parent.sys.mjs";     To = "$root\profile\chrome\tint-parent.sys.mjs" },
  @{ From = "$ProfilePath\user.js";                        To = "$root\profile\user.js" },
  @{ From = "$FirefoxPath\config.js";                      To = "$root\loader\config.js" },
  @{ From = "$FirefoxPath\defaults\pref\config-prefs.js";  To = "$root\loader\defaults\pref\config-prefs.js" }
)
foreach ($p in $pairs) {
  if (Test-Path $p.From) {
    Copy-Item $p.From $p.To -Force
    Write-Host "  copied: $($p.From)"
  } else {
    Write-Warning "missing, skipped: $($p.From)"
  }
}
Write-Host ""
git -C $root status --short
