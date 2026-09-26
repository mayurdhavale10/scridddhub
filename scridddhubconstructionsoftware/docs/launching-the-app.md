# Launching the app (emulator + full stack)

The full sequence to get from "nothing running" to "app usable on the emulator," in order.
Skipping steps or doing them out of order is the most common cause of a blank or broken app.
None of this — emulator included — reliably survives a new session; expect to redo it each time.

If something in here goes wrong (blank screen, invisible window, etc.), see
`docs/android-emulator-troubleshooting.md` for diagnosis and fixes. This doc is just the sequence.

Steps 3-4 (Docker/Postgres, backend) have their own dedicated doc with more detail and a specific
diagnosis flowchart: `docs/starting-the-backend.md` — use that one if the app loads but shows
"could not load land parcels" or similar.

## 1. Emulator

1. Check if it's already running: `adb devices`. If nothing lists, start from scratch. If
   something lists, don't assume it's *usable* yet — see step 3.
2. Launch it: `emulator -avd Pixel_8_Pro -scale 0.7` (adjust AVD name/scale as needed). This takes
   a while. Wait for `adb devices` to show it, then wait again for
   `adb shell getprop sys.boot_completed` to return `1` — that's "fully booted," not just
   "ADB can see it."
3. **Fix the window position, every time**, not just when something looks wrong — it's happened on
   both automated and manual launches. See the troubleshooting doc's main issue for the exact
   PowerShell fix.
4. Confirm system services actually respond, not just that the window looks fine:
   ```
   adb shell pm list packages <package>
   ```
   with a short timeout. If it hangs, the emulator's services are wedged — kill the
   `qemu-system-x86_64` process and relaunch fresh rather than fighting it.

## 2. Metro (the JS bundler)

**Before starting it, check port 8081 isn't already held by a dead process** — this has caused a
real blank-white-screen failure (see the troubleshooting doc's "stale Metro process" entry).

```
cd mobile-app
npx react-native start
```

Wait for the literal `Welcome to Metro` banner in its output — don't assume it's up just because
the command was issued.

## 3. Docker Desktop + Postgres

Docker Desktop isn't reliably on `PATH` on this machine — its CLI lives at
`%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`, not under `Program Files`. If
`docker ps` doesn't respond, launch Docker Desktop itself via its Start Menu shortcut
(`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk`) and wait for `docker ps` to
succeed before doing anything else.

```
docker compose up -d postgres
```

Then wait for `pg_isready` against that container before moving on.

## 4. Backend

```
cd backend
go run ./cmd/server
```

Wait for its `/projects` endpoint (or similar) to actually respond over HTTP — not just that the
process started without an error.

## 5. Wire the device to your machine

```
adb reverse tcp:8081 tcp:8081
```

Do this *after* Metro is confirmed up. Redo it any time Metro is restarted.

## 6. Launch the app

```
adb shell am force-stop <package>
adb shell am start -n <package>/.MainActivity
```

Force-stopping first matters — a still-running instance can be holding a stale reference to a dead
Metro connection and won't pick up a fresh one just by being brought back to the foreground.

## What needs redoing each session

Steps 2-4 (Metro, Docker/Postgres, backend) do not survive a session boundary and need to be
started fresh every time, even though the emulator itself sometimes does. Always verify each one
actually responds rather than assuming the launch command alone means it's ready.
