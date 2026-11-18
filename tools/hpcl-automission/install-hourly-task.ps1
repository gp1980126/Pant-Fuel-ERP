$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = (Get-Command node.exe).Source
# Auto-imports only when StationMitra PDF Preview marks every row READY and invoice/fuel/date checks pass.
$Action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Project\agent.js`" --mode daily --import-ready" -WorkingDirectory $Project
$Trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$Trigger.Repetition = (New-ScheduledTaskRepetitionSettings -Interval (New-TimeSpan -Hours 1) -Duration (New-TimeSpan -Hours 14))
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
Register-ScheduledTask -TaskName "StationMitra HPCL Automission" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Hourly HPCL invoice discovery, PDF preview validation and READY-only import." -Force | Out-Null
Write-Host "Scheduled daily 8 AM to 10 PM, every hour."
Write-Host "Keep Edge open and logged in to HPCL and StationMitra."
