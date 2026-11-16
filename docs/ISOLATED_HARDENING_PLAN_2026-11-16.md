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

## Stock and FY investigation — 2026-11-16

- Test `SATAT-FILLING-STATION` state row is tagged with FY 2026-27 and contains 1,095 sales, 117 purchases, and 107 dip readings.
- One Lubricant purchase dated 2026-03-27 remains in that FY 2026-27 JSON payload. It is a prior-FY transaction and must remain untouched until a separately approved data migration is planned.
- `openingStockByFY['2026-27']` is present (qty 2,090; value ₹557,727), but the P&L engine previously used the legacy global opening quantity plus all purchases before the report date. This could count the prior-FY 2,300 L purchase again instead of using the FY carry-forward balance.
- Fixed on the isolated branch: FY-specific Lubricant opening quantity/value now comes from `openingStockByFY`; only purchases and Lubricant sales dated within that FY are included in the movement calculation. Unsupported FY dates return no opening balance rather than silently falling back to the latest FY.
- Added regression cases for prior-FY purchase exclusion, FY opening carry-forward, current-FY purchase/sale movements, and physical-dip source priority.
- The `fromFY` metadata in the Test JSON contains malformed labels (`2025-20` and `2024-20`). No source data was edited; this metadata needs a separate reviewed correction.
- FY server-write validation remains pending. `sm_save_business_state` currently verifies that the requested FY is open and authorized, but does not validate transaction dates in the submitted JSON against that FY. A safe validator must allow unchanged legacy rows while rejecting new or modified out-of-FY rows.

## Fuel stock firewall — implementation update

- Stock's actual opening date is `data.openingDate` (Test data: 2026-08-01), while `START_DATE` is the earliest supported FY boundary (2025-04-01). The Stock component had incorrectly reused the FY boundary for stock accumulation and date limits.
- Fixed the Stock component to use the actual stock opening date for MS/HSD Book Stock, daily reconciliation, dip entry, fuel-rate dates and tank-filling dates. FY date bounds remain separate for accounting.
- Added a pure MS/HSD book-stock calculation: opening stock + linked tank fillings/receipts − authoritative net sales. `sales.qty` is already net of pump testing, so testing is not subtracted twice. Physical Dip remains a separate actual measurement; missing Dip is not invented.
- Stock still excludes CNG from tank-stock/Dip calculations, matching the existing module design.
- Fixed the Lubricant carry-forward code so future `fromFY` metadata uses the proper previous FY code. Existing malformed metadata in the saved Test payload was not edited.
- Test data audit: 25 date/nozzle duplicate groups were found. All groups had a verified source copy; 23 were exact same-ID/same-quantity copies, and the remaining two were CNG float-format duplicates. No sale, purchase or dip data was changed.
- Regression tests now cover FY-specific Lubricant opening balances, prior-FY movement exclusion, the MS/HSD Book Stock formula, actual stock-opening date enforcement and no double subtraction of testing.
- Isolated Vercel Preview build for commit `f99fb29ccb4de611942058e5ce7a4d38b5fbf4d6` reached `READY` after the regression correction. Earlier failing build was caused by a test helper date-regex typo and was corrected; no Production deployment occurred.

## Six workstreams

1. Cloud and data-integrity firewall: idempotent save confirmation, optimistic concurrency, payload hash, duplicate and date integrity.
2. Payment reconciliation firewall: canonical payment selection, signed excess/short netting, recoveries and credit treatment.
3. Fuel stock firewall: opening + purchases - net sales, nozzle uniqueness, dip reconciliation and tank-filling linkage.
4. Financial-year firewall: isolate FY-scoped sales, purchase, credit, ledger, stock, opening balances and P&L.
5. Automated regression suite: parse/build, accounting fixtures, duplicate/fingerprint fixtures, FY and stock checks.
6. Release safety: isolated preview, backup/hash verification, security advisor review, approval gate and no automatic Production promotion.

## Release gate

No merge to `main`, no Production Supabase migration, no Production environment change, and no Production deployment until the Test preview build, regression suite, database security review, backup/restore validation and explicit release approval all pass.
