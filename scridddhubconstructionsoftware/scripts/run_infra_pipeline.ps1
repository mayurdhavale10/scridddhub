# Scheduled planned-infrastructure run (Step D, services/plannedinfrastructure/PIPELINE_PLAN.md).
# Searches areas users asked about (Step C queue), then refreshes every registered official source,
# within a time budget. Stops cleanly if Groq's daily token quota runs out; the next run continues.
#
# Run by the Windows scheduled task created with scripts/register_infra_schedule.ps1, or by hand:
#   powershell -ExecutionPolicy Bypass -File scripts\run_infra_pipeline.ps1 -MaxDuration 2h
param(
    [string]$MaxDuration = "2h"
)

# NOT "Stop": in Windows PowerShell 5.1 that turns any stderr line from a native program into a
# fatal error, even when redirected. docker (when the daemon is down), go and the pipeline itself
# (which logs to stderr) all write there, so the 2026-09-28 run died silently on its first
# `docker ps`. Every native step checks $LASTEXITCODE instead, and the trap logs anything else.
$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $PSScriptRoot            # scridddhubconstructionsoftware\
$backend = Join-Path $root "backend"
$logDir = Join-Path $root "logs\infra_pipeline"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("run_" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".log")

# UTF-8 throughout: Tee-Object/Out-File write UTF-16 in PowerShell 5.1, which garbles the file once
# cmd appends the pipeline's own (UTF-8) output to it.
function Write-Log($msg) {
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg"
    Add-Content -Path $log -Value $line -Encoding UTF8
    Write-Output $line
}
# Runs a native command with stdout+stderr appended to the log as plain text (PowerShell's own
# redirection would wrap each stderr line in an error record). Returns its exit code.
function Invoke-Logged([string]$commandLine) {
    # The extra outer quotes survive cmd's quote stripping when the line starts with a quoted path.
    cmd /c "`"$commandLine >> `"$log`" 2>&1`""
    return $LASTEXITCODE
}
trap { Write-Log "unexpected error: $_"; exit 1 }

Write-Log "scheduled infrastructure run starting (budget $MaxDuration)"

# 1. Docker Desktop + Postgres (Docker isn't on PATH on this machine - see docs/starting-the-backend.md).
$docker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
& $docker ps *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Log "starting Docker Desktop"
    Start-Process -FilePath (Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\Docker Desktop.exe")
    $deadline = (Get-Date).AddMinutes(5)
    do { Start-Sleep 5; & $docker ps *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
    if ($LASTEXITCODE -ne 0) { Write-Log "Docker did not start within 5 minutes - giving up this run"; exit 1 }
}
Push-Location $root
Invoke-Logged "`"$docker`" compose up -d postgres" | Out-Null
$deadline = (Get-Date).AddMinutes(2)
do { Start-Sleep 2; & $docker exec scridddhubconstructionsoftware-postgres-1 pg_isready -U scridddhub -d scridddhub *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
Pop-Location
if ($LASTEXITCODE -ne 0) { Write-Log "Postgres not ready - giving up this run"; exit 1 }

# 2. Build and run the pipeline.
Push-Location $backend
$bin = Join-Path $backend "bin\infra_pipeline.exe"
if ((Invoke-Logged "go build -o `"$bin`" ./cmd/infra_pipeline") -ne 0) { Write-Log "build failed"; Pop-Location; exit 1 }
$code = Invoke-Logged "`"$bin`" --scheduled --max-duration $MaxDuration"
Pop-Location

Write-Log "scheduled infrastructure run finished (exit $code) - log: $log"
exit $code
