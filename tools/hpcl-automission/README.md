# StationMitra HPCL Automission

A local Windows agent for HPCL invoice discovery, PDF download, StationMitra's existing PDF Preview, and guarded READY-only import. It does not modify StationMitra application code or database schema.

## One-time historical backfill
1. Keep Edge open with the dedicated profile, signed in to HPCL and StationMitra. Edge CDP must be available at http://127.0.0.1:9222.
2. Open PowerShell in this folder.
3. Run: powershell -ExecutionPolicy Bypass -File .\setup-and-backfill.ps1

The setup checks Node.js 22+, verifies Edge CDP, installs dependencies and scans 01-Aug-2026 through 18-Nov-2026 in two HPCL date ranges. It downloads linked PDFs and sends each PDF through the existing StationMitra Purchase PDF Preview. It imports only when every preview row is READY and invoice number, fuel and bill date match the HPCL listing. DUPLICATE, INVALID, missing-PDF, failed-download and mismatched records are held for review.

## Hourly automation
After the historical backfill and manifest have been reviewed, run:
powershell -ExecutionPolicy Bypass -File .\install-hourly-task.ps1

This creates a Windows Task Scheduler task for hourly checks from 8:00 AM through 10:00 PM. It runs daily mode with READY-only import enabled. Keep Windows awake and Edge signed in to HPCL and StationMitra.

## Data and logs
- data\pdf\ — downloaded source PDFs
- data\manifest-backfill.json / manifest-daily.json — source rows, SHA-256 and import status
- logs\agent.jsonl — run and exception log

## Safety
- Uses the logged-in Edge session; no password or OTP is stored.
- Never closes the user's Edge browser.
- Does not write directly to Supabase or bypass the StationMitra Purchase UI.
- StationMitra's existing preview/parser and duplicate checks remain the import gate.
- If the UI, parser, or portal changes, the agent should fail closed and log the item rather than guess.
- Test the first run and inspect the manifest before enabling the hourly task.
