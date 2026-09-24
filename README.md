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

See `COMMERCIAL_ARCHITECTURE.md` for the production roadmap.

## Important

Do not ship `.env.local`, `node_modules`, or development secrets inside a source archive.


## 12-09-2026 Staff & Electricity Data Recovery Fix

This build fixes a Home-PC/localStorage migration issue where an older browser cache could contain empty `staff`, `attendance`, `electricityBills`, or `electricityPayments` arrays. Because those arrays were previously spread from the saved cache over the embedded master, the Staff & Electricity screen could appear empty even though the master backup contained the records.

The load path now merges these four persistent collections by record ID, retaining embedded master records and newer saved records. No source backup values are invented or deleted. Regression checks assert the expected master counts: 7 staff, 69 attendance entries, 1 electricity bill, and 2 electricity payments.

## Phase 12 Role Authorization

Roles: Admin, Owner, Manager, Operator, View Only. View Only is strictly read-only.
Manager and Operator mutations are restricted by the central mutation gateway and the
production server-side `save_app_state` authorization gate; accounting-period locks
override every mutation permission.


<!-- Production asset refresh: equal CGST/SGST invoice fix -->
