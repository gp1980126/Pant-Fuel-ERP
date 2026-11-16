# StationMitra Isolated Hardening Plan — 2026-11-16

## Safety boundary

- Git branch: `audit/isolation-hardening-2026-11-16`, created from `main` at `5468953cc93449c402a4c465ad779a5dbed5478a`.
- Vercel Preview environment for this branch explicitly targets Supabase project `vzfmhppgninuinvmwyjn` (`stationmitra-phase12-test`).
- Production candidate Supabase project is `fhklvjnzilysrxhwimpw` (`PumpPro-SATAT`); it was queried read-only only.
- No Production database writes, migrations, merges, or Production deployments are authorized by this plan.

## Backup checkpoint

- The existing `public.app_state_manual_backup_20261017` has one row for `SATAT-FILLING-STATION`, version 1004, created 2026-10-17. It does not match the current app_state version 1919 and is not a current recovery point.
- A private logical snapshot was created in `stationmitra_recovery.app_state_snapshot_20261116` on the Test project.
- Verification: 4 source rows, 4 snapshot rows, 4 exact payload matches; all payload hashes match; RLS is enabled; anon/authenticated have no schema usage.
- Snapshot total payload size: 3,178,630 bytes. Snapshot time: 2026-11-16 04:35:24 UTC.
- This is a same-project logical recovery snapshot, not an independently stored/off-site backup or a tested point-in-time restore.

## Isolation checkpoint

- Test project ref `vzfmhppgninuinvmwyjn` and Production candidate `fhklvjnzilysrxhwimpw` are distinct Supabase projects.
- The Vercel preview branch has branch-scoped `VITE_STATIONMITRA_ENV=test`, `VITE_SUPABASE_URL`, and a publishable key for the Test project only.
- No Test/Preview environment variable was added to Production target settings.

## Findings requiring remediation

1. `public.app_state_manual_backup_20261017` on Test has RLS disabled. Supabase Security Advisor reports this as an externally facing error. Do not enable RLS without a reviewed access policy; the old table is not used as the new snapshot.
2. Test Security Advisor reports 13 authenticated-callable SECURITY DEFINER functions, including `save_app_state`, plus leaked-password protection disabled. Review each function's intended callers and privileges before changing grants.
3. Test app state is version 1919; old manual backup is version 1004.
4. `previousPending()` sums raw duplicate daily-payment rows instead of canonical daily payments.
5. `cloudSaveState()` currently treats any later Cloud version as proof that its own payload was saved. Verify the stored payload before reporting success.
6. `package.json` references three scripts that are absent from the current main tree: `scripts/parse-check.mjs`, `scripts/regression-check.mjs`, and `scripts/release-check.mjs`.

## Six workstreams

1. Cloud and data-integrity firewall: idempotent save confirmation, optimistic concurrency, payload hash, duplicate and date integrity.
2. Payment reconciliation firewall: canonical payment selection, signed excess/short netting, recoveries and credit treatment.
3. Fuel stock firewall: opening + purchases - net sales, nozzle uniqueness, dip reconciliation and tank-filling linkage.
4. Financial-year firewall: isolate FY-scoped sales, purchase, credit, ledger, stock, opening balances and P&L.
5. Automated regression suite: parse/build, accounting fixtures, duplicate/fingerprint fixtures, FY and stock checks.
6. Release safety: isolated preview, backup/hash verification, security advisor review, approval gate and no automatic Production promotion.

## Release gate

No merge to `main`, no Production Supabase migration, no Production environment change, and no Production deployment until the Test preview build, regression suite, database security review, backup/restore validation and explicit release approval all pass.
