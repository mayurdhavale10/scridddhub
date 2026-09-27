# Scheduled planned-infrastructure run (Step D, services/plannedinfrastructure/PIPELINE_PLAN.md).
# Searches areas users asked about (Step C queue), then refreshes every registered official source,
# within a time budget. Stops cleanly if Groq's daily token quota runs out; the next run continues.
#
# Run by the Windows scheduled task created with scripts/register_infra_schedule.ps1, or by hand:
#   powershell -ExecutionPolicy Bypass -File scripts\run_infra_pipeline.ps1 -MaxDuration 2h
param(
    [string]$MaxDuration = "2h"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot            # scridddhubconstructionsoftware\
$backend = Join-Path $root "backend"
$logDir = Join-Path $root "logs\infra_pipeline"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir ("run_" + (Get-Date -Format "yyyy-MM-dd_HHmm") + ".log")

function Write-Log($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Tee-Object -FilePath $log -Append }

Write-Log "scheduled infrastructure run starting (budget $MaxDuration)"

# 1. Docker Desktop + Postgres (Docker isn't on PATH on this machine - see docs/starting-the-backend.md).
$docker = Join-Path $env:LOCALAPPDATA "Programs\DockerDesktop\resources\bin\docker.exe"
& $docker ps *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Log "starting Docker Desktop"
    $lnk = (New-Object -ComObject WScript.Shell).CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Docker Desktop.lnk")
    Start-Process -FilePath $lnk.TargetPath
    $deadline = (Get-Date).AddMinutes(5)
    do { Start-Sleep 5; & $docker ps *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
    if ($LASTEXITCODE -ne 0) { Write-Log "Docker did not start within 5 minutes - giving up this run"; exit 1 }
}
Push-Location $root
& $docker compose up -d postgres *>> $log
$deadline = (Get-Date).AddMinutes(2)
do { Start-Sleep 2; & $docker exec scridddhubconstructionsoftware-postgres-1 pg_isready -U scridddhub -d scridddhub *> $null } while ($LASTEXITCODE -ne 0 -and (Get-Date) -lt $deadline)
Pop-Location
if ($LASTEXITCODE -ne 0) { Write-Log "Postgres not ready - giving up this run"; exit 1 }

# 2. Build and run the pipeline.
Push-Location $backend
$bin = Join-Path $backend "bin\infra_pipeline.exe"
go build -o $bin ./cmd/infra_pipeline *>> $log
if ($LASTEXITCODE -ne 0) { Write-Log "build failed"; Pop-Location; exit 1 }
& $bin --scheduled --max-duration $MaxDuration *>> $log
$code = $LASTEXITCODE
Pop-Location

Write-Log "scheduled infrastructure run finished (exit $code) - log: $log"
exit $code
