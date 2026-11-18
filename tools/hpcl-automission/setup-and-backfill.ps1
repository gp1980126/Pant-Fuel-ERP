$ErrorActionPreference = "Stop"
$Project = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $Node) { throw "Node.js 22+ is required. Install Node.js, reopen PowerShell, and run this setup again." }
$version = (& node --version).Trim()
if ([version]($version.TrimStart("v")) -lt [version]"22.0.0") { throw "Node.js 22+ required. Detected $version" }
$edge = "http://127.0.0.1:9222/json/version"
try { $browser = Invoke-RestMethod -Uri $edge -TimeoutSec 5 } catch { throw "Edge CDP port 9222 is not available. Start Edge with --remote-debugging-port=9222 and sign in to HPCL + StationMitra first." }
Write-Host "Edge CDP connected: $($browser.Browser)"
Set-Location $Project
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed." }
Write-Host ""
Write-Host "Starting historical backfill. READY-only StationMitra imports are enabled; DUPLICATE/INVALID or mismatched rows are held."
node .\agent.js --mode backfill --import-ready
if ($LASTEXITCODE -ne 0) { throw "Backfill failed. See logs\agent.jsonl." }
Write-Host "Backfill run finished. Review data\manifest-backfill.json before installing hourly task."
