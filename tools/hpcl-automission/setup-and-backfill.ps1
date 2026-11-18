$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $Node) { throw "Node.js 22+ is required. Install Node.js, reopen PowerShell, and run this setup again." }
$version = (& node --version).Trim()
if ([version]($version.TrimStart("v")) -lt [version]"22.0.0") { throw "Node.js 22+ required. Detected $version" }
try { $browser = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 5 } catch { throw "Edge CDP port 9222 is not available. Start Edge with --remote-debugging-port=9222 and sign in to HPCL + StationMitra first." }
Write-Host "Edge CDP connected: $($browser.Browser)"
Set-Location $Project
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
Write-Host ""
Write-Host "Starting historical backfill. Only StationMitra Preview rows marked READY with matching invoice, fuel and date can be imported."
node .\agent.js --mode backfill --import-ready
if ($LASTEXITCODE -ne 0) { throw "Backfill failed. See logs\agent.jsonl. Hourly task was NOT installed." }
if (-not (Test-Path ".\data\manifest-backfill.json")) { throw "Backfill manifest missing. Hourly task was NOT installed." }
Write-Host "Backfill finished. Installing hourly 8 AM–10 PM READY-only task."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\install-hourly-task.ps1"
if ($LASTEXITCODE -ne 0) { throw "Backfill completed but hourly task installation failed." }
Write-Host "Automission setup completed. Review data\manifest-backfill.json and logs\agent.jsonl."
