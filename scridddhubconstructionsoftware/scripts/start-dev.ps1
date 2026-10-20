# Starts everything needed to use the app on the laptop's Android emulator, in order:
# Docker → Postgres → backend → emulator (window moved on-screen) → port forwarding → app.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1
# Each step is skipped if it's already running, so it's safe to run again.
#
# The installed app is a release build with its code inside (docs/android-emulator-troubleshooting.md,
# "Building a demo APK"), so Metro isn't needed. Pass -Metro to also start Metro for development.
param([switch]$Metro)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$emulator = "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe"
function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }

Step 'Docker and the database'
if (-not (Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
    Start-Process "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
}
for ($i = 0; $i -lt 40; $i++) {
    & $docker start scridddhubconstructionsoftware-postgres-1 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { break }
    Start-Sleep 4
}
if ($LASTEXITCODE -ne 0) { Write-Host 'Postgres did not start. Open Docker Desktop and check.' -ForegroundColor Red; exit 1 }
Write-Host 'Postgres is up.'

Step 'Backend (bin\scridddhub-server.exe, port 8080)'
$backend = Join-Path $root 'backend'
if (-not (Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Sleep 3 # let Postgres accept connections
    Start-Process -FilePath "$backend\bin\scridddhub-server.exe" -WorkingDirectory $backend -WindowStyle Hidden `
        -RedirectStandardOutput "$env:TEMP\server.out" -RedirectStandardError "$env:TEMP\server.log"
    Start-Sleep 5
}
try { Invoke-WebRequest -UseBasicParsing http://localhost:8080/record-requests?status=queued -TimeoutSec 5 | Out-Null; Write-Host 'Backend is up.' }
catch { Write-Host "Backend not answering. See $env:TEMP\server.log" -ForegroundColor Red }

if ($Metro) {
    Step 'Metro (development only)'
    if (-not (Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue)) {
        Start-Process -FilePath cmd.exe -ArgumentList '/c', "npx react-native start > `"$env:TEMP\metro.log`" 2>&1" `
            -WorkingDirectory (Join-Path $root 'mobile-app') -WindowStyle Hidden
    }
}

Step 'Emulator (Pixel_8_Pro)'
if (-not (Get-Process qemu-system-x86_64 -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $emulator -ArgumentList '-avd', 'Pixel_8_Pro', '-no-snapshot-load'
}
for ($i = 0; $i -lt 60; $i++) {
    if ((& $adb shell getprop sys.boot_completed 2>$null) -match '1') { break }
    Start-Sleep 5
}
Write-Host 'Emulator booted.'

# The emulator window often opens above the top of the screen; move it back (position only).
Add-Type @"
using System; using System.Runtime.InteropServices;
public class EmuWin {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
$win = Get-Process qemu-system-x86_64 | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
if ($win) { [EmuWin]::SetWindowPos($win.MainWindowHandle, [IntPtr]::Zero, 100, 0, 0, 0, 0x0041) | Out-Null; [EmuWin]::SetForegroundWindow($win.MainWindowHandle) | Out-Null }

Step 'Connect the emulator to the laptop and open the app'
& $adb reverse tcp:8080 tcp:8080 | Out-Null
if ($Metro) { & $adb reverse tcp:8081 tcp:8081 | Out-Null }
& $adb shell svc wifi enable 2>$null
& $adb shell am start -n com.scridddhub.mobileapp/.MainActivity 2>$null | Out-Null
Write-Host "`nReady. The app is opening on the emulator." -ForegroundColor Green
