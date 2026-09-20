# Supabase backend — REQUIRED versioning placeholder

> **Status: scaffold only.** The security model of this app depends on
> server-side objects that currently live ONLY in the hosted Supabase project
> and are **not** versioned in this repository. That is a production-readiness
> gap: without them you cannot audit, review, or disaster-recover the backend.
>
> **Action required (project owner):** export the real definitions from the
> live Supabase project (Dashboard → SQL Editor, or `supabase db dump`) and
> commit them here, e.g. under `supabase/migrations/` and
> `supabase/functions/`. Do not invent or hand-rewrite policies from memory —
> dump the live, verified definitions.

Objects the application expects (derived from `src/cloud_sync_supabase.js`
and `PHASE12_RELEASE_REPORT_13-09-2026.md`):

| Object | Type | Used by | Notes |
|---|---|---|---|
| `public.profiles` | table + RLS | `cloudGetProfile` | columns: `id,email,username,name,role,active,pump_id` |
| `public.sm_pumps` | table + RLS | `cloudGetStationId` | columns: `id,tenant_id,station_id,pump_code,pump_name,active` |
| `public.app_state` | table + RLS | `cloudLoadState`, `subscribeState` | columns: `station_id,data,version,updated_at,updated_by`; realtime UPDATE enabled |
| `public.save_app_state(text,jsonb,bigint,uuid)` | RPC function | `cloudSaveState` | server-side role gate: auth check, active profile, station binding, role allowlists, delete blocking, accounting-lock, optimistic version conflict (`ok/code/message/current_version` row) |
| `station-provision` | Edge Function (v2) | provisioning | accepts `View Only` role |

Checklist for the owner:

1. [ ] `supabase link` to the production project
2. [ ] `supabase db dump --linked` → commit the resulting SQL
3. [ ] `supabase functions download station-provision` → commit the source
4. [ ] Verify RLS policies for `profiles`, `sm_pumps`, `app_state` are present in the dump
5. [ ] Confirm secrets: never commit `service_role` keys — only DDL/policies/function code (function env secrets stay in Supabase)
