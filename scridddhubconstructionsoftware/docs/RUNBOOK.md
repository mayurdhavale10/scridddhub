# RUNBOOK — Full startup process for this machine

> **This is the single source of truth for any AI or developer starting the dev environment.
> Follow `docs/launching-the-app.md`, `docs/starting-the-backend.md`, and
> `docs/android-emulator-troubleshooting.md` strictly. Do not improvise.**

---

## The correct startup order (strict — do not skip or reorder)

### Step 1: Docker Desktop first (BEFORE the emulator)
**Why this matters:** Both Docker and the Android emulator use the Windows Hypervisor (WHPX/WSL2).
Starting the emulator while Docker is still booting causes `WHPX: Unexpected VP exit code 4` —
the emulator boots `offline` and never recovers without a full kill and restart.

```powershell
# Check if Docker processes exist
Get-Process | Where-Object { $_.Name -like "*Docker*" }

# If nothing, launch via shortcut (actual install path varies — shortcut is reliable)
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk"
)
Start-Process -FilePath $shortcut.TargetPath

# Poll until the engine actually responds (can take 1–2 minutes)
# docker is NOT reliably on PATH — use the full path:
$docker = "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe"
while (-not (& $docker ps 2>$null)) { Start-Sleep 3 }
Write-Output "Docker engine is up."
```

### Step 2: Postgres container
```powershell
cd C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware
& $docker compose up -d postgres

# Wait for DB to actually accept connections:
while (-not (& $docker exec scridddhubconstructionsoftware-postgres-1 pg_isready -U scridddhub -d scridddhub 2>$null)) { Start-Sleep 1 }
Write-Output "Postgres is ready."
```

### Step 3: Go backend
```powershell
# In a separate terminal — this is a long-running process
cd C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware\backend
go run ./cmd/server
# Wait for: "scridddhub backend listening on :8080"
```

### Step 4: Metro bundler
**Before starting, kill any stale node process on port 8081 — it causes blank white screen.**
```powershell
# Kill anything holding 8081 first
Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# In a separate terminal — this is a long-running process
cd C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware\mobile-app
npx react-native start
# Wait for: "Welcome to Metro" banner
```

### Step 5: Emulator (AFTER Docker is confirmed up)
```powershell
# Check if already running
adb devices

# If offline or nothing listed, kill any remnant and start fresh
Get-Process qemu-system-x86_64,emulator -ErrorAction SilentlyContinue | Stop-Process -Force
adb kill-server; adb start-server

# Launch fresh
emulator -avd Pixel_8_Pro -scale 0.7

# Wait for full boot (not just ADB visible — wait for sys.boot_completed = 1)
while ((adb shell getprop sys.boot_completed 2>$null) -ne '1') { Start-Sleep 2 }
Write-Output "Emulator fully booted."
```

### Step 6: Fix emulator window position (ALWAYS — happens every launch)
```powershell
# Run the pre-existing fix script (already in repo root)
powershell.exe -ExecutionPolicy Bypass -File .\fix_emulator.ps1
```
This script does a `SW_RESTORE` + `SetWindowPos` to move the window to `(100, 0)`.
**Do NOT also resize** — resizing via SetWindowPos minimizes the Qt window. See
`docs/android-emulator-troubleshooting.md` for full explanation.

### Step 7: Wire device and launch app
```powershell
# Wire Metro to emulator
adb reverse tcp:8081 tcp:8081

# If this is the first run after a fresh system boot, build first (see §3 below)
# Otherwise, force-stop stale instance and relaunch
adb shell am force-stop com.scridddhub.mobileapp
adb shell am start -n com.scridddhub.mobileapp/.MainActivity
```

---

## §2 — When the emulator screen is black

**Cause:** The APK on the emulator is stale — it was installed in a previous session and
has never been built against this Metro instance. `adb logcat -s ReactNativeJS:*` will show
zero output if this is the case.

**Fix — build the APK fresh using the subst workaround (avoids 260-char path limit):**
```powershell
# Map a short drive letter to the mobile-app folder
subst S: "C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware\mobile-app"

# Clear the C++ build cache (safe — just a cache)
Remove-Item -Recurse -Force "C:\Users\dhava\Downloads\scridddhub\scridddhubconstructionsoftware\mobile-app\android\app\.cxx" -ErrorAction SilentlyContinue

# Build and install (x86_64 = emulator arch, faster)
Set-Location S:\android
.\gradlew.bat app:installDebug -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=x86_64

# Cleanup the drive mapping
subst S: /D

# Launch the freshly installed app
adb shell am force-stop com.scridddhub.mobileapp
adb shell am start -n com.scridddhub.mobileapp/.MainActivity
```
This only needs to be done once per session (or after adding a native module).
Plain JS changes reload through Metro automatically.

---

## §3 — Package name and project IDs
- **App package:** `com.scridddhub.mobileapp`
- **Main activity:** `com.scridddhub.mobileapp/.MainActivity`
- **DEV_PROJECT_ID:** `1b8c981b-0cd1-4ebb-803c-2e15f62b92d9` (Wagholi Phase 1)
- **DEV_ORG_ID:** `11111111-1111-1111-1111-111111111111`
- **Backend port:** `:8080`
- **Metro port:** `:8081`
- **Postgres port:** `:5434` (mapped to container's 5432)
- **Docker binary path:** `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`

---

## §4 — What AI sessions must NOT do

1. **Do not start the emulator before verifying `docker ps` actually responds.**
2. **Do not assume a launch command succeeding = the process is ready.** Verify:
   - Docker: poll `docker ps` until it returns a real response
   - Metro: wait for `Welcome to Metro` banner
   - Backend: wait for "listening on :8080" log line
   - Emulator: wait for `sys.boot_completed = 1`
3. **Do not run extra diagnostic commands that aren't in the docs** when the basic sequence
   hasn't been fully completed correctly yet.
4. **Always run `fix_emulator.ps1` after boot** — the off-screen window bug happens on
   every launch (both manual and automated, confirmed).
5. **Do not resize the emulator window via SetWindowPos** — only move it. Resizing
   causes it to minimize silently.
