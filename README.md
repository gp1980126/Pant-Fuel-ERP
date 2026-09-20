# Station Mitra Professional Accounting — Commercial v4.0.1 Hardened

This package is the commercial-architecture conversion of the working PumpPro V3 baseline. The existing accounting rules and data compatibility layer are preserved.

## Start on Windows

1. Copy `.env.example` to `.env.local`.
2. Fill in the Supabase values and station identity.
3. Run `npm install`.
4. Double-click `START_PUMPPRO.bat` or run `npm run dev -- --host 127.0.0.1`.

## Architecture

- `src/App.jsx` — application shell and orchestration
- `src/core/pumpDomain.js` — accounting/domain engine and data compatibility
- `src/components/PumpModules.jsx` — UI modules
- `src/config/appConfig.js` — commercial runtime configuration
- `src/cloud_sync_supabase.js` — cloud/auth adapter

## Quality gates (restored 2026-09-20)

- `npm run check` — static hygiene (imports, conflict markers, hardcoded-secret scan)
- `npm run regression` — Phase 12 role-authorization invariants (14 checks)
- `npm run release-check` — gates above + frozen-core file hashes from `RELEASE_MANIFEST.txt` + tracked-secret scan
- CI: `.github/workflows/ci.yml` runs all gates + production build on `main`

## Production deployment checklist

1. Set Vercel env vars from `.env.example` (see `VERCEL_DEPLOY.md`).
2. Set `VITE_PUMPPRO_CLOUD_REQUIRED=true` so a misconfigured build can never fall back to local login.
3. ✅ Local fallback default passwords rotated on 2026-09-20 (hashes in `DEFAULT_USERS`; plaintext held by owner). Still change them once via User Management after first login.
4. ✅ Embedded master backup moved verbatim to `src/core/embeddedBackupData.js` on 2026-09-20. Long-term: load it from a cloud seed / external backup instead of the JS bundle; also ensure this repository stays **private** while it contains business records.
5. Version the Supabase backend DDL/RLS/RPC/Edge Functions into `supabase/` — Phase 13 added the multi-tenancy SQL template + provision scaffold; reconcile with live DB (see `supabase/README.md`). **[owner action — needs project access]**
6. Run the pending live multi-role (Manager/Operator/View Only) destructive test noted in `PHASE12_RELEASE_REPORT_13-09-2026.md`. **[owner action — needs production test profiles]**
6. `COMMERCIAL_ARCHITECTURE.md` referenced by earlier docs is a planned roadmap doc and is not part of this package.

## Important

`.gitignore` now blocks `.env*`, `node_modules/`, and `dist/`. Still never ship `.env.local`
or development secrets inside a source archive.


## 12-09-2026 Staff & Electricity Data Recovery Fix

This build fixes a Home-PC/localStorage migration issue where an older browser cache could contain empty `staff`, `attendance`, `electricityBills`, or `electricityPayments` arrays. Because those arrays were previously spread from the saved cache over the embedded master, the Staff & Electricity screen could appear empty even though the master backup contained the records.

The load path now merges these four persistent collections by record ID, retaining embedded master records and newer saved records. No source backup values are invented or deleted. Regression checks assert the expected master counts: 7 staff, 69 attendance entries, 1 electricity bill, and 2 electricity payments.

## Phase 13 Multi-Tenancy Groundwork (20-09-2026)

Tracked source में अब कोई tenant business data या station identity hardcode नहीं है —
commercial/ISV build किसी भी pump को serve कर सकता है:

- Business data (918KB backup, party names, meter openings, dip history) → **untracked**
  `src/core/private/stationData.js` (gitignored). Private single-station builds file रखकर
  data embed करते हैं; commercial builds में bundle में शून्य business data (verify: bundle 1.6MB → 723KB).
- Station identity (name/GSTIN/address/dealer/jurisdiction) → env-driven via
  `src/config/stationIdentity.js` (Vercel env vars देखें: VERCEL_DEPLOY.md).
- Blank commercial start: `src/core/tenantSeed.js`; plan catalogue ₹399/₹799/one-time: `src/config/plans.js`.
- Tenant isolation SQL template + provision Edge Function: `supabase/`.
- Gates 18/18 green; initialData() output private data के साथ sha256-verified byte-identical.

## Phase 12 Role Authorization

Roles: Admin, Owner, Manager, Operator, View Only. View Only is strictly read-only.
Manager and Operator mutations are restricted by the central mutation gateway and the
production server-side `save_app_state` authorization gate; accounting-period locks
override every mutation permission.
