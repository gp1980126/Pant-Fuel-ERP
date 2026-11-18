# StationMitra HPCL Automission

Local discovery/download agent only. It does not connect to Supabase or import into StationMitra. It uses the already logged-in Edge session at 127.0.0.1:9222. Backfill checks 01-Aug-2026 to 18-Nov-2026 in two ranges; daily mode checks today. PDFs, SHA-256 hashes and raw row text are saved under data/. Shared MS/HSD invoice PDFs download once while separate fuel rows are retained. Distinct CNG invoice numbers remain separate.

## Setup
1. Run npm install in this folder.
2. Sign in to HPCL manually in Edge started with --remote-debugging-port=9222 and the dedicated profile.
3. Run npm run backfill.
4. Review data/manifest-backfill.json and data/pdf/.

## Hourly schedule
After review, run PowerShell: powershell -ExecutionPolicy Bypass -File .\install-hourly-task.ps1. This schedules hourly checks from 8 AM to 10 PM. Keep Windows awake and Edge logged in.

Passwords and OTPs are not stored. Import remains disabled until PDF values are verified against StationMitra preview and HPCL source totals.
