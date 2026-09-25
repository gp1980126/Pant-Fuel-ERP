@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm ci
  if errorlevel 1 (
    echo npm ci failed.
    pause
    exit /b 1
  )
)

echo Starting StationMitra Local Station Mode...
echo RELCON read is READ-ONLY and uses the local Vite proxy to 192.168.0.188.
start "" http://127.0.0.1:5173
call npm run dev
