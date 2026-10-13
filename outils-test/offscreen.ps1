param([string]$Marker = 'ffclean')
Add-Type @'
using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices;
public class OS { public delegate bool EP(IntPtr h, IntPtr l);
 [DllImport("user32.dll")] public static extern bool EnumWindows(EP cb, IntPtr l);
 [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
 [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder sb, int n);
 [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
 [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
 [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
 public static List<IntPtr> Find(uint[] pids){ var r=new List<IntPtr>(); EnumWindows((h,l)=>{ uint p; GetWindowThreadProcessId(h,out p); if(Array.IndexOf(pids,p)>=0){ var c=new StringBuilder(64); GetClassName(h,c,64); if(c.ToString()=="MozillaWindowClass") r.Add(h);} return true;}, IntPtr.Zero); return r; } }
'@
for ($i = 0; $i -lt 60; $i++) {
  $pids = @(Get-CimInstance Win32_Process -Filter "Name='firefox.exe'" | Where-Object { $_.CommandLine -match $Marker } | ForEach-Object { [uint32]$_.ProcessId })
  if ($pids.Count) { $h = [OS]::Find($pids) | Select-Object -First 1; if ($h) { if ([OS]::IsIconic($h)) { [void][OS]::SendMessage($h,0x112,[IntPtr]0xF120,[IntPtr]0) }; [void][OS]::SetWindowPos($h,[IntPtr]::Zero,-6000,0,0,0,0x0015); "deplace hors ecran"; break } }
  Start-Sleep -Milliseconds 500
}
