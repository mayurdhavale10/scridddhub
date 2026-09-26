Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Restore {
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
}
"@
$proc = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
if ($proc) {
    $h = $proc.MainWindowHandle
    [Win32Restore]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
    Start-Sleep -Milliseconds 300
    [Win32Restore]::SetWindowPos($h, [IntPtr]::Zero, 100, 100, 500, 700, 0x0040) | Out-Null  # SWP_SHOWWINDOW
    [Win32Restore]::SetForegroundWindow($h) | Out-Null
    Write-Output "Emulator restored and positioned."
} else {
    Write-Output "Emulator process not found."
}
