# Registers (or updates) the Windows scheduled task that runs the infrastructure pipeline.
#   Daily at 1 PM:          powershell -ExecutionPolicy Bypass -File scripts\register_infra_schedule.ps1 -Frequency Daily -At 13:00
#   Weekly, Sunday 11 AM:   powershell -ExecutionPolicy Bypass -File scripts\register_infra_schedule.ps1 -Frequency Weekly -Day Sunday -At 11:00
#   Remove it:              Unregister-ScheduledTask -TaskName "ScridddHub infra pipeline" -Confirm:$false
#
# The laptop must be on for a run; if it was off at the scheduled time, the task starts as soon as
# it's back on (StartWhenAvailable). Each run is capped at -MaxDuration (default 2h).
param(
    [ValidateSet("Daily", "Weekly")][string]$Frequency = "Daily",
    [string]$At = "13:00",
    [ValidateSet("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")][string]$Day = "Sunday",
    [string]$MaxDuration = "2h"
)

$taskName = "ScridddHub infra pipeline"
$script = Join-Path $PSScriptRoot "run_infra_pipeline.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -MaxDuration $MaxDuration" `
    -WorkingDirectory (Split-Path -Parent $PSScriptRoot)

if ($Frequency -eq "Daily") {
    $trigger = New-ScheduledTaskTrigger -Daily -At $At
} else {
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek $Day -At $At
}

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3) `
    -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "Refreshes ScridddHub's planned-infrastructure list from official sources (services/plannedinfrastructure)." `
    -Force | Out-Null

$when = if ($Frequency -eq "Daily") { "every day at $At" } else { "every $Day at $At" }
Write-Output "Registered '$taskName': $when, up to $MaxDuration per run. Logs: logs\infra_pipeline\"
