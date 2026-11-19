$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$NodeCommand = Get-Command node.exe -ErrorAction Stop
$Node = $NodeCommand.Source
if (-not (Test-Path (Join-Path $Project "agent.js"))) { throw "agent.js not found in $Project" }

# Windows PowerShell 5.1: -RepetitionInterval is not supported with -Daily.
# Use 15 daily triggers, one for each hour from 08:00 through 22:00.
$Triggers = 8..22 | ForEach-Object {
    New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours($_))
}
if ($Triggers.Count -ne 15) { throw "Expected 15 daily triggers; got $($Triggers.Count)." }

$Action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Project\agent.js`" --mode daily" -WorkingDirectory $Project
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
Register-ScheduledTask -TaskName "StationMitra HPCL Automission" -Action $Action -Trigger $Triggers -Settings $Settings -Description "Hourly HPCL invoice discovery and PDF download only. No StationMitra imports." -Force | Out-Null
Write-Host "Scheduled daily download-only checks at 08:00 through 22:00."
Write-Host "Keep Windows awake and Edge open and signed in to HPCL."
