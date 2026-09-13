# StationMitra Phase 12 — Final Role Authorization Autopsy / Release Candidate

Date: 2026-09-13

## Executive result

**Phase 12 static security regression: 10/10 PASS.**

The package adds the **View Only** role and strengthens role-based mutation controls while preserving the frozen accounting/storage/cloud-sync core files.

## Browser/mock verification

The user ran the isolated browser/mock test package locally. The screenshots show:

- **View Only:** View ALLOW; Add BLOCK; Edit BLOCK; Delete BLOCK; Accounting Lock BLOCK.
- **Owner:** View/Add/Edit/Delete/Accounting Lock ALLOW.
- **Manager:** View/Add/Edit ALLOW; Delete BLOCK; Accounting Lock BLOCK.
- **Operator:** View/Add/Edit ALLOW; Delete BLOCK; Accounting Lock BLOCK.
- View Only Action Test log records View ALLOWED and Add/Edit/Delete/Accounting Lock BLOCKED.

This was an **isolated mock test** with no Supabase connection and no production-data mutation.

## Static regression — 10/10 PASS

1. PASS — View Only role constant.
2. PASS — View Only page permissions.
3. PASS — View Only role normalization.
4. PASS — View Only mutation gateway blocks business mutations.
5. PASS — Manager collection allowlist.
6. PASS — Manager/Operator delete blocking.
7. PASS — Accounting-lock authorization retained.
8. PASS — Purchase-to-filling linked-delete protection retained.
9. PASS — View Only available in User Management role selector.
10. PASS — No demo View Only user was added to the default users.

## Server-side gate

The live Supabase `save_app_state(text,jsonb,bigint,uuid)` RPC has server-side authorization for authentication, active profile, station binding, role allowlists, delete blocking, accounting-lock permission, locked-period protection, and optimistic versioning.

The `station-provision` Edge Function is version 2 and accepts **View Only** as a provisionable role.

## Accounting-core protection

The following frozen core files are unchanged from the accounting baseline:

- `src/services/storage/localStore.js`
- `src/cloud_sync_supabase.js`
- `src/config/appConfig.js`

The Phase 12 role-security changes intentionally modify only the role/page-security areas of:

- `src/core/pumpDomain.js`
- `src/App.jsx`
- `src/components/PumpModules.jsx`

## Important release limitation

No destructive live browser test was run with real Manager/Operator/View Only cloud profiles. There are no such live profiles in the production project, and no fake production users were created.

Therefore this package is a **Phase 12 Release Candidate / Security-Hardened Build**, not a declaration that destructive multi-user production testing is complete.

## Build note

A local production build could not be completed in the previous environment because Vite was unavailable (`vite: not found`). This is an environment limitation. The user successfully opened and exercised the isolated browser/mock package locally.
