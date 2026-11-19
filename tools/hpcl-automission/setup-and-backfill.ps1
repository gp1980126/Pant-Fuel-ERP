$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $Node) { throw "Node.js 22+ is required. Install Node.js, reopen PowerShell, and run this setup again." }
$version = (& node --version).Trim()
if ([version]($version.TrimStart("v")) -lt [version]"22.0.0") { throw "Node.js 22+ required. Detected $version" }
try { $browser = Invoke-RestMethod -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 5 } catch { throw "Edge CDP port 9222 is not available. Start Edge with --remote-debugging-port=9222. HPCL login can be completed in the visible Edge window during this manual backfill." }
Write-Host "Edge CDP connected: $($browser.Browser)"
Set-Location $Project
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
Write-Host ""
Write-Host "Running DOWNLOAD-ONLY historical backfill."
Write-Host "If HPCL login/CAPTCHA is required, complete it manually in the visible Edge window."
Write-Host "No StationMitra page will be opened and no purchase record will be imported."
node .\agent.js --mode backfill --interactive-login
if ($LASTEXITCODE -ne 0) { throw "Backfill failed. See logs\agent.jsonl." }
if (-not (Test-Path ".\data\manifest-backfill.json")) { throw "Backfill manifest missing." }
Write-Host ""
Write-Host "Download-only backfill completed."
Write-Host "Review data\manifest-backfill.json, data\pdf\ and logs\agent.jsonl."
Write-Host "Hourly download-only scheduling is a separate step: run .\install-hourly-task.ps1 only after reviewing the backfill."
