# Android emulator: window "stuck" in the taskbar

See `docs/launching-the-app.md` for the full step-by-step startup procedure (emulator, Metro,
Docker/Postgres, backend, app launch) — this doc is specifically about diagnosing and fixing
things once something's already gone wrong.

## Symptom

The emulator shows up in the taskbar (and `adb devices` shows it as a real, fully-booted
device), but clicking the taskbar icon does nothing — no window appears, or only a tiny
thumbnail preview is visible.

## Cause

The emulator's window (`qemu-system-x86_64.exe`) gets positioned **off-screen** — its
coordinates end up outside your monitor's bounds (e.g. `Top=-1012`), so Windows still tracks
it as an open, visible, non-minimized window, but there's nothing to click into.

**Update (2026-09-19): this is not limited to automated/background launches.** It was originally
assumed to only happen when the emulator is launched by an automated process (e.g. a Claude Code
tool call) rather than run by hand, on the theory that the child process doesn't inherit a normal
desktop window-placement context. That theory doesn't hold: it reproduced identically
(`Top=-1012`, same exact coordinates) on a launch the user ran themselves, directly, from their
own already-open PowerShell terminal — no automation involved at all. So the real trigger is still
unknown; don't assume "I launched it manually" rules this out. Always check position before
assuming the emulator is genuinely inaccessible.

One theory that was raised and specifically ruled out: **Windows Session 0 isolation** (where a
process is invisible to the interactive desktop because it's running in the non-interactive
services session). Checked directly with `Get-Process -Name qemu-system-x86_64 | Select
SessionId` — the process was in `SessionId 1` (the normal interactive session), not `0`, with a
real non-zero `MainWindowHandle`. So this is purely a window-position bug, not a session/isolation
issue, regardless of how the emulator was launched.

This is **not** a crash and **not** a "wrong session" issue — `tasklist /V` will show it running
in your normal interactive `Console` session, same user, status `Running`. It's purely a window
position bug.

## Fix

Run this in **Windows PowerShell** (not Git Bash — needs the Win32 API):

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Fix {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@

$proc = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
if (-not $proc) {
    Write-Output "Emulator process not found — is it running? (check: adb devices)"
} else {
    $h = $proc.MainWindowHandle
    $rect = New-Object RECT
    [Win32Fix]::GetWindowRect($h, [ref]$rect) | Out-Null
    Write-Output "Current position: Left=$($rect.Left) Top=$($rect.Top) Right=$($rect.Right) Bottom=$($rect.Bottom)"

    # Move it to a sane on-screen spot, keep its existing size
    $width = $rect.Right - $rect.Left
    $height = $rect.Bottom - $rect.Top
    [Win32Fix]::SetWindowPos($h, [IntPtr]::Zero, 50, 50, $width, $height, 0x0040) # SWP_SHOWWINDOW
    [Win32Fix]::SetForegroundWindow($h)
    Write-Output "Moved to (50, 50) and focused."
}
```

If `Current position` shows a `Top` or `Left` value that's a large negative number, or larger
than your monitor's resolution, that confirms this is the bug — the `SetWindowPos` call above
fixes it immediately, no restart needed.

## Quick check without fixing anything

To just confirm whether this is what's happening (position/visibility only, no changes):

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32Check {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
}
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
"@
$proc = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
$rect = New-Object RECT
[Win32Check]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
"$($rect.Left), $($rect.Top), $($rect.Right), $($rect.Bottom)"
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Screen]::AllScreens | ForEach-Object { $_.Bounds }
```

Compare the window rect against your screen bounds — if the window rect falls outside every
screen's bounds, it's off-screen.

## If it keeps happening

This isn't guaranteed to happen every single launch, but it's been consistently reproducible —
both when Claude Code launches the emulator via a background shell command, and (confirmed
2026-09-19) on a launch the user ran themselves by hand from their own terminal. It is **not**
safe to assume a manual launch is immune. If you're driving Claude Code and it just booted the
emulator for you, it's worth asking it to run the position check itself before declaring the
emulator "ready" — a well-behaved session should catch this proactively rather than making you ask
twice.

**Important caveat if Claude Code is checking on your behalf**: `adb exec-out screencap` reads the
emulator's framebuffer directly over ADB and works perfectly even when the window is off-screen —
it never proves the window is visible on your actual desktop. Don't accept "confirmed via
screenshot" as proof the window is usable; the only real confirmation is the person at the
keyboard actually seeing/clicking it, or a direct `GetWindowRect` check against real screen bounds
(`[System.Windows.Forms.Screen]::AllScreens`) like the one in this doc.

## Separate issue: resizing (not just moving) the window can minimize it instead

**Symptom**: you run a `SetWindowPos` call that changes both size *and* position (e.g. trying to
shrink the window by some percentage), and afterward the emulator seems to have vanished again —
"it's still not small," or it looks like the fix didn't apply at all.

**Cause**: the window didn't fail to resize — it got **minimized**. Confirmed directly
(2026-09-19): `GetWindowRect` on the process afterward returned `Left=-25600, Top=-25600,
Width=159, Height=27` — that is **not** a real position, it's the placeholder rect Windows reports
for any minimized window, regardless of its actual restored size. `IsIconic(hWnd)` on the same
handle returned `True`, confirming it. So the resize math wasn't wrong, and the window wasn't
"stuck small" — it just wasn't being displayed at all anymore.

Root cause is still not fully pinned down, but the likely explanation: the emulator's UI is a
Qt application that manages its own render surface tied to the AVD's actual pixel resolution.
A pure position-only `SetWindowPos` (no size change) has been reliable. A `SetWindowPos` call that
also changes `cx`/`cy` appears to be a different, riskier code path — plausibly Qt's own
resize-event handling reacting badly to an external, non-native resize request. Treat resizing via
raw `SetWindowPos` as unreliable until this is understood better; moving is fine, resizing is not.

**Fix**: restore before doing anything else — a `SetWindowPos` call alone will not undo a minimized
state.

```powershell
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
$h = $proc.MainWindowHandle
[Win32Restore]::ShowWindow($h, 9) | Out-Null   # SW_RESTORE
Start-Sleep -Milliseconds 300
[Win32Restore]::SetWindowPos($h, [IntPtr]::Zero, 100, 100, 500, 700, 0x0040) | Out-Null  # SWP_SHOWWINDOW
[Win32Restore]::SetForegroundWindow($h) | Out-Null
```

**Always check `IsIconic` alongside `GetWindowRect`** when diagnosing "the window looks wrong" —
a minimized window's rect will look like nonsense coordinates, and math done against it (like a
percentage-based resize) is meaningless.

```powershell
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32IsIconicCheck {
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$proc = Get-Process -Name "qemu-system-x86_64" -ErrorAction SilentlyContinue
[Win32IsIconicCheck]::IsIconic($proc.MainWindowHandle)
```

## Separate issue: app shows a blank white screen — stale Metro process holding port 8081

**Symptom**: the emulator window itself is fine (correctly positioned, visible), the app launches
without crashing, but the screen is just blank white — no splash, no content, nothing. `adb logcat
-s ReactNativeJS:*` shows **no output at all**, not even a startup log line, meaning the JS bundle
never actually ran.

**Cause** (confirmed 2026-09-19): a `node` process from an earlier, already-ended session was
still holding port 8081, but was no longer actually serving anything (curl to
`http://localhost:8081/status` timed out — connection never even completed). Starting a fresh
`npx react-native start` failed outright with `EADDRINUSE: address already in use :::8081`. Worse,
the app on the device didn't even try to retry the connection — its own dev-support layer logged
`Packager connection already open, nooping`, meaning it believed a valid connection already
existed (from whatever it last talked to) and silently did nothing further.

**Fix**:
1. Find what's actually holding the port and confirm it's stale, don't just kill on sight:
   ```powershell
   Get-NetTCPConnection -LocalPort 8081 -State Listen | Select-Object OwningProcess
   Get-Process -Id <that PID> | Select-Object Id, ProcessName, Path, StartTime
   ```
   A `node.exe` process with a `StartTime` from a previous session (not the current one) is the
   giveaway.
2. `Stop-Process -Id <PID> -Force`.
3. Start Metro again (`npx react-native start`) and wait for the real `Welcome to Metro` banner.
4. Re-run `adb reverse tcp:8081 tcp:8081`.
5. **Force-stop the app before relaunching it** — `adb shell am force-stop <package>` — then
   `am start`. Just bringing the existing instance back to the foreground is not enough; it's the
   one that logged "nooping" and needs to be killed to drop its stale connection state.
6. Verify the fix actually worked by tailing Metro's own log for a `BUNDLE ./index.js` line
   reaching completion (not just 0%) — that's the real signal the device pulled a fresh bundle,
   more reliable than eyeballing the emulator screen alone.

## Known-good size for this user

Confirmed comfortable and "perfect" (2026-09-19): position `(100, 100)`, size `500 × 700`. If
starting fresh and the person wants this same size without fighting the resize-minimizes-it issue
above, prefer setting it once via the emulator's own `-scale` launch flag (goes through the
emulator's native rendering path, not an external resize) rather than repositioning afterward —
e.g. `-scale 0.5` gets close, then a **position-only** `SetWindowPos` (no size change) to `(100,
100)` if it lands off-screen per the main issue in this doc.
