param([string]$Prefix = 'p', [string]$Marker = 'ffclean')
# Captures EVERY Firefox window of the test profile (main window + panels / menus, which are separate windows)
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class SA { [StructLayout(LayoutKind.Sequential)] public struct R{public int l,t,r,b;}
 public delegate bool EP(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
 [DllImport("user32.dll")] public static extern bool EnumWindows(EP cb, IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
 [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder sb, int n);
 public static List<IntPtr> Find(uint[] pids){ var r=new List<IntPtr>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(Array.IndexOf(pids,p)>=0 && IsWindowVisible(h)){ var c=new StringBuilder(64); GetClassName(h,c,64); if(c.ToString().StartsWith("Mozilla")) r.Add(h);} return true;}, IntPtr.Zero); return r; } }
'@
[void][SA]::SetProcessDPIAware()
$pids = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | Where-Object { $_.CommandLine -match $Marker } | ForEach-Object { [uint32]$_.ProcessId })
if (-not $pids.Count) { 'no process found'; exit 1 }
$i = 0
foreach ($h in [SA]::Find($pids)) {
  $r = New-Object SA+R; [void][SA]::GetWindowRect($h, [ref]$r)
  $w = $r.r - $r.l; $ht = $r.b - $r.t
  if ($w -lt 20 -or $ht -lt 20) { continue }
  $bmp = New-Object System.Drawing.Bitmap $w, $ht
  $g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc()
  [void][SA]::PrintWindow($h, $dc, 2); $g.ReleaseHdc($dc); $g.Dispose()
  $f = Join-Path $PSScriptRoot ("{0}_{1}_{2}x{3}.png" -f $Prefix, $i, $w, $ht)
  $bmp.Save($f, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  "{0} -> {1} (x={2},y={3})" -f $h, (Split-Path $f -Leaf), $r.l, $r.t
  $i++
}
