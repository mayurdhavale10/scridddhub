# Starting the backend

The backend has two moving parts that both need to be up: **Postgres** (via Docker) and the
**Go server** itself. Either one missing looks different, so check the right thing rather than
guessing — see the diagnosis section below before assuming a fix worked.

None of this survives a session boundary. Expect to redo all of it at the start of every new
session, even if it was already running earlier.

## 1. Docker Desktop

Docker Desktop isn't reliably on `PATH` on this machine. If `docker ps` doesn't respond:

```powershell
Get-Process | Where-Object { $_.Name -like "*Docker*" }
```

If nothing lists, launch it via its Start Menu shortcut (its actual install path varies, the
shortcut is reliable):

```powershell
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut(
  "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk"
)
Start-Process -FilePath $shortcut.TargetPath
```

Wait for the engine to actually respond before moving on — this can take a minute or more after
launch:

```bash
until "/c/Users/dhava/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe" ps >/dev/null 2>&1; do sleep 3; done
```

(That full path is used because `docker` isn't reliably on `PATH` in Bash/PowerShell tool sessions
here either — under `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`, not
`Program Files`.)

## 2. Postgres container

```bash
cd scridddhubconstructionsoftware
docker compose up -d postgres
```

Wait for the database to actually accept connections, not just for the container to start:

```bash
until docker exec scridddhubconstructionsoftware-postgres-1 pg_isready -U scridddhub -d scridddhub >/dev/null 2>&1; do sleep 1; done
```

## 3. Go server

```bash
cd backend
go run ./cmd/server
```

Wait for it to actually respond over HTTP before assuming it's ready:

```bash
until curl -s http://localhost:8080/projects >/dev/null 2>&1; do sleep 1; done
```

## Diagnosing "could not load land parcels" / "is the backend running?"

The app's own error message is generic and can mean either piece is down. Don't guess — hit the
real endpoint the app itself calls and read the actual error:

```bash
curl -s "http://localhost:8080/projects/<DEV_PROJECT_ID>/land-parcels"
```

(`DEV_PROJECT_ID` is in `mobile-app/src/config/devProject.ts`.)

- **A Postgres connection error** (e.g. `dial tcp 127.0.0.1:5434: ... actively refused`) — the Go
  process is alive but Postgres isn't. Check Docker Desktop is even running first (a surprisingly
  common cause — it's easy to assume it's running when it isn't, since nothing prompts you).
- **Connection refused / timeout on 8080 itself** — the Go server process isn't running at all;
  start it per step 3.
- **A clean `[]` or real JSON** — the backend is genuinely fine; the problem is elsewhere (Metro,
  the app's own state, etc.) — see `docs/launching-the-app.md`.

## After fixing anything backend-side

The app won't automatically retry — bringing it back to the foreground alone does **not** retrigger
its data fetch, since that only runs once on mount. Force-stop and relaunch it fresh:

```bash
adb shell am force-stop com.scridddhub.mobileapp
adb shell am start -n com.scridddhub.mobileapp/.MainActivity
```
