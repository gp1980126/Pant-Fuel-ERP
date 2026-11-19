# StationMitra HPCL Automission

A local Windows agent for HPCL invoice discovery, PDF download, SHA-256 fingerprinting and a review manifest. This version is deliberately **download-only**. Human-assisted image-CAPTCHA login is available only for a manually started backfill.

## One-time historical backfill
1. Start Edge with a dedicated profile and CDP at `http://127.0.0.1:9222`.
2. Open PowerShell in this folder.
3. Run: `powershell -ExecutionPolicy Bypass -File .\\setup-and-backfill.ps1`.
4. If HPCL asks for login, enter credentials and solve the image CAPTCHA yourself in the visible Edge window. Return to PowerShell and press Enter.
5. The agent opens the HPCL dashboard, clicks the Invoices tile itself, and verifies the expected category and date controls before scanning. You do not need to click Invoices manually. If the invoice form cannot be verified, it stops.

The setup checks Node.js 22+, verifies Edge CDP, installs dependencies and scans 01-Aug-2026 through 18-Nov-2026 in two HPCL date ranges. It downloads linked PDFs and writes a manifest. It does **not** open StationMitra, write to Supabase, or import any purchase record.

## Hourly automation
After reviewing the backfill manifest and PDFs, run:
`powershell -ExecutionPolicy Bypass -File .\\install-hourly-task.ps1`

On Windows PowerShell 5.1 this installs 15 daily triggers: 08:00, 09:00, ... 22:00. The scheduled job runs **non-interactive** daily download-only mode. If the HPCL session expires or the invoice form is unavailable, the run stops and logs the error; it never waits for keyboard input. Keep Windows awake and Edge signed in to HPCL. Re-authenticate manually and rerun the backfill command when required.

## Data and logs
- `data\\pdf\\` — downloaded source PDFs
- `data\\manifest-backfill.json` / `manifest-daily.json` — source rows, SHA-256 and review status
- `logs\\agent.jsonl` — run and exception log

## Verification limits and safety
- Uses the user's visible Edge session. For a manual backfill, the user enters credentials and solves the image CAPTCHA directly on the official HPCL page; the agent never reads, stores, logs, or submits credentials or CAPTCHA answers.
- No CAPTCHA solving, bypass, stealth, or authentication circumvention is implemented.
- Scheduled runs are non-interactive and fail closed on expired sessions.
- Verifies the official HPCL hostname and expected invoice form controls before searching.
- Never closes the user's Edge browser.
- Checks that each downloaded response is a PDF and uses pdf-parse to extract text and verify that listed invoice numbers appear in the PDF.
- Preserves distinct invoice+fuel rows and flags conflicting source rows.
- Customer identity is recorded as NOT_VERIFIED_BY_AGENT. Quantity and amount reconciliation is NOT_IMPLEMENTED because the HPCL result-table field mapping has not yet been confirmed.
- Every row remains review-required; no row is auto-imported.
- The `--import-ready` flag is intentionally blocked in this build. Do not re-enable imports until customer identity, HPCL quantity/amount mapping, StationMitra preview reconciliation and duplicate behavior have been tested against known bills.
