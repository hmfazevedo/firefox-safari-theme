<#
.SYNOPSIS
  Installs (or removes) the Safari-style Firefox theme: after a Firefox update that broke it, on a new profile or on another PC.

.DESCRIPTION
  1. Copies profile\chrome\* and profile\user.js into the Firefox profile. Files that get replaced are kept in
     <profile>\theme-backup\<date>\.
  2. Copies loader\config.js and loader\defaults\pref\config-prefs.js into Firefox's installation folder
     (e.g. C:\Program Files\Mozilla Firefox): this is what loads safari-theme.uc.js. It needs administrator rights: the script
     restarts itself elevated (a permission prompt appears).
  Then QUIT Firefox COMPLETELY (no firefox.exe process left) and start it again.

  Windows PowerShell 5.1 or later. If scripts are blocked: powershell -ExecutionPolicy Bypass -File .\install.ps1

.PARAMETER ProfilePath
  Profile folder. Default: the profile Firefox uses by default (installs.ini / profiles.ini).

.PARAMETER FirefoxPath
  Firefox installation folder. Default: found from the registry, otherwise C:\Program Files\Mozilla Firefox.

.PARAMETER SkipLoader
  Does not touch the installation folder (no elevation). The theme CSS then works, but not the script (address text centring,
  tint, compact mode button...).

.PARAMETER SkipUserJs
  Does not replace user.js (useful if you edited it by hand and want to keep it).

.PARAMETER Uninstall
  Removes the theme: the loader files from the installation folder and the theme files from the profile (your user.js is only
  removed if it is identical to this repository's one).

.PARAMETER DryRun
  Shows what would be done, without copying anything.

.PARAMETER Force
  Continues even if Firefox is running (not recommended: user.js and the script are only read at startup).

.EXAMPLE
  .\install.ps1 -DryRun
  .\install.ps1
  .\install.ps1 -ProfilePath "C:\Users\me\AppData\Roaming\Mozilla\Firefox\Profiles\xxxx.default-release" -SkipLoader
  .\install.ps1 -Uninstall
#>
param(
  [string]$ProfilePath,
  [string]$FirefoxPath,
  [switch]$SkipLoader,
  [switch]$SkipUserJs,
  [switch]$Uninstall,
  [switch]$DryRun,
  [switch]$Force,
  [switch]$Elevated   # internal: elevated restart, only handles the installation folder
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$LoaderFiles = @('config.js', 'defaults\pref\config-prefs.js')
$ThemeFiles = @('userChrome.css', 'userContent.css', 'safari-theme.uc.js', 'safari-theme.manifest', 'tint-child.sys.mjs', 'tint-parent.sys.mjs')

function Find-Firefox {
  foreach ($key in 'HKLM:\SOFTWARE\Mozilla\Mozilla Firefox', 'HKLM:\SOFTWARE\WOW6432Node\Mozilla\Mozilla Firefox') {
    if (Test-Path $key) {
      $current = (Get-ItemProperty $key).CurrentVersion
      if ($current) {
        $dir = (Get-ItemProperty "$key\$current\Main" -ErrorAction SilentlyContinue).'Install Directory'
        if ($dir -and (Test-Path (Join-Path $dir 'firefox.exe'))) { return $dir }
      }
    }
  }
  return 'C:\Program Files\Mozilla Firefox'
}
if (-not $FirefoxPath) { $FirefoxPath = Find-Firefox }

function Install-Loader {
  if (-not (Test-Path (Join-Path $FirefoxPath 'firefox.exe'))) {
    throw "firefox.exe not found in '$FirefoxPath' (use -FirefoxPath)."
  }
  foreach ($rel in $LoaderFiles) {
    $src = Join-Path $root "loader\$rel"
    $dst = Join-Path $FirefoxPath $rel
    New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
    Copy-Item $src $dst -Force
    Write-Host "  installed: $dst"
  }
}

function Remove-Loader {
  foreach ($rel in $LoaderFiles) {
    $dst = Join-Path $FirefoxPath $rel
    if (Test-Path $dst) { Remove-Item $dst -Force; Write-Host "  removed: $dst" }
  }
}

if ($Elevated) {
  if ($Uninstall) { Remove-Loader } else { Install-Loader }
  Start-Sleep -Seconds 2
  exit 0
}

function Find-Profile {
  $base = Join-Path $env:APPDATA 'Mozilla\Firefox'
  $ini = Join-Path $base 'profiles.ini'
  if (-not (Test-Path $ini)) { throw "profiles.ini not found ($ini): give the profile with -ProfilePath." }
  $text = Get-Content $ini -Raw
  $resolve = {
    param($path, $relative)
    $p = $path.Trim().Replace('/', '\')
    if ($relative) { Join-Path $base $p } else { $p }
  }
  # 1. The profile of the installation, if Firefox recorded one (installs.ini, Firefox 67+)
  $installs = Join-Path $base 'installs.ini'
  if (Test-Path $installs) {
    $m = [regex]::Match((Get-Content $installs -Raw), '(?m)^Default=(.+)$')
    if ($m.Success) {
      $p = & $resolve $m.Groups[1].Value ($m.Groups[1].Value -notmatch '^[A-Za-z]:')
      if (Test-Path $p) { return $p }
    }
  }
  # 2. A [Profile] section marked Default=1
  foreach ($section in [regex]::Split($text, '(?m)^(?=\[)')) {
    if ($section -match '(?m)^Default=1' -and $section -match '(?m)^Path=(.+)$') {
      $relative = $section -notmatch '(?m)^IsRelative=0'
      $p = & $resolve $Matches[1] $relative
      if (Test-Path $p) { return $p }
    }
  }
  # 3. The only "default-release" profile
  $found = [regex]::Matches($text, '(?m)^Path=(.+)$') | ForEach-Object { & $resolve $_.Groups[1].Value $true } |
    Where-Object { (Test-Path $_) -and ($_ -match 'default-release') } | Select-Object -Unique
  if (@($found).Count -eq 1) { return @($found)[0] }
  throw "Could not tell which profile to use ($(@($found).Count) candidates): give it with -ProfilePath (see about:profiles in Firefox)."
}

if (-not $ProfilePath) { $ProfilePath = Find-Profile }
if (-not (Test-Path $ProfilePath)) { throw "Profile not found: $ProfilePath" }
Write-Host "Profile        : $ProfilePath"
Write-Host "Firefox folder : $FirefoxPath"

if ((Get-Process firefox -ErrorAction SilentlyContinue) -and -not $DryRun -and -not $Force) {
  throw "Firefox is running: quit it COMPLETELY (no firefox.exe left in Task Manager), then run this script again."
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
$backup = Join-Path $ProfilePath "theme-backup\$stamp"

function Copy-ToProfile([string]$src, [string]$dst) {
  if ($DryRun) { Write-Host "  [dry run] $src -> $dst"; return }
  New-Item -ItemType Directory -Force (Split-Path $dst) | Out-Null
  if (Test-Path $dst) {
    $rel = $dst.Substring($ProfilePath.Length).TrimStart('\')
    $keep = Join-Path $backup $rel
    New-Item -ItemType Directory -Force (Split-Path $keep) | Out-Null
    Copy-Item $dst $keep -Force
  }
  Copy-Item $src $dst -Force
  Write-Host "  copied: $dst"
}

function Invoke-Elevated([string]$extra) {
  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  if ($admin) { return $false }
  Write-Host "  administrator rights needed: accept the permission prompt..."
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Elevated', '-FirefoxPath', "`"$FirefoxPath`"") + $extra
  Start-Process powershell.exe -Verb RunAs -Wait -ArgumentList ($argList | Where-Object { $_ })
  return $true
}

if ($Uninstall) {
  Write-Host "`n1/2  Theme files in the profile"
  foreach ($name in $ThemeFiles) {
    $f = Join-Path $ProfilePath "chrome\$name"
    if (Test-Path $f) {
      if ($DryRun) { Write-Host "  [dry run] would remove $f" } else { Remove-Item $f -Force; Write-Host "  removed: $f" }
    }
  }
  $uj = Join-Path $ProfilePath 'user.js'
  if ((Test-Path $uj) -and ((Get-FileHash $uj).Hash -eq (Get-FileHash (Join-Path $root 'profile\user.js')).Hash)) {
    if ($DryRun) { Write-Host "  [dry run] would remove $uj" } else { Remove-Item $uj -Force; Write-Host "  removed: $uj" }
  } else {
    Write-Host "  user.js left alone (it is not this repository's one)"
  }
  Write-Host "`n2/2  Loader in Firefox's installation folder"
  if ($SkipLoader) { Write-Host "  skipped (-SkipLoader)" }
  elseif ($DryRun) { Write-Host "  [dry run] would remove config.js and defaults\pref\config-prefs.js from $FirefoxPath" }
  elseif (-not (Invoke-Elevated '-Uninstall')) { Remove-Loader }
  Write-Host "`nDone. Quit Firefox COMPLETELY and start it again."
  exit 0
}

Write-Host "`n1/2  Profile files"
foreach ($f in Get-ChildItem (Join-Path $root 'profile\chrome') -File) {
  Copy-ToProfile $f.FullName (Join-Path $ProfilePath "chrome\$($f.Name)")
}
if (-not $SkipUserJs) {
  Copy-ToProfile (Join-Path $root 'profile\user.js') (Join-Path $ProfilePath 'user.js')
} else {
  Write-Host "  user.js: skipped (-SkipUserJs)"
}

Write-Host "`n2/2  Loader in Firefox's installation folder"
if ($SkipLoader) {
  Write-Host "  skipped (-SkipLoader)"
} elseif ($DryRun) {
  Write-Host "  [dry run] loader\config.js and defaults\pref\config-prefs.js -> $FirefoxPath"
} else {
  if (-not (Invoke-Elevated $null)) { Install-Loader }
  foreach ($rel in $LoaderFiles) {
    $dst = Join-Path $FirefoxPath $rel
    $ok = (Test-Path $dst) -and ((Get-FileHash $dst).Hash -eq (Get-FileHash (Join-Path $root "loader\$rel")).Hash)
    Write-Host ("  {0}: {1}" -f $rel, $(if ($ok) { 'OK' } else { 'NOT INSTALLED (permission refused?)' }))
  }
}

Write-Host "`nDone. Quit Firefox COMPLETELY (every firefox.exe) and start it again."
if (-not $DryRun -and (Test-Path $backup)) { Write-Host "Previous versions kept in: $backup" }
