$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = (Get-Command node.exe).Source
$Action = New-ScheduledTaskAction -Execute $Node -Argument "`"$Project\agent.js`" --mode daily" -WorkingDirectory $Project
$Trigger = New-ScheduledTaskTrigger -Daily -At 8:00AM
$Trigger.Repetition = (New-ScheduledTaskRepetitionSettings -Interval (New-TimeSpan -Hours 1) -Duration (New-TimeSpan -Hours 14))
$Settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 45)
Register-ScheduledTask -TaskName "StationMitra HPCL Automission" -Action $Action -Trigger $Trigger -Settings $Settings -Description "Hourly HPCL bill discovery and local PDF review; no StationMitra import." -Force | Out-Null
Write-Host "Scheduled 8 AM to 10 PM hourly. Keep Edge logged in and open."
