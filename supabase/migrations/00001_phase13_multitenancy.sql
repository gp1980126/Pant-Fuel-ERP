-- ============================================================================
-- Phase 13: Multi-tenant isolation (TEMPLATE — reconcile with live DB first)
-- ----------------------------------------------------------------------------
-- The live production project already has working versions of profiles,
-- sm_pumps, app_state and save_app_state. This file is the first versioned
-- reference of that surface. BEFORE applying: dump the live definitions
-- (`supabase db dump --linked`) and diff — do NOT blind-apply over production.
-- Every object below uses `create ... if not exists` / `or replace` so a
-- reconciled version is idempotent.
-- ============================================================================

-- ---------- 0) tenants: one row per paying customer (petrol pump owner) -----
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'trial',              -- trial | basic | pro | lifetime
  subscription_status text not null default 'trialing', -- active | trialing | past_due | locked
  trial_ends_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- 1) pumps: many pumps can belong to one tenant later -------------
create table if not exists public.sm_pumps (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants (id),
  station_id text not null unique,                 -- e.g. 'SATAT-FILLING-STATION'
  pump_code text,
  pump_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- 2) profiles: auth.users <-> pump binding ------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  username text,
  name text,
  role text not null check (role in ('Admin','Owner','Manager','Operator','View Only')),
  active boolean not null default true,
  pump_id uuid references public.sm_pumps (id)
);

-- ---------- 3) app_state: one JSON document per station (current design) ---
create table if not exists public.app_state (
  station_id text primary key references public.sm_pumps (station_id),
  data jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

-- ---------- 4) RLS helpers --------------------------------------------------
-- Station ids the caller belongs to (via profile -> pump), only when active.
create or replace function public.my_station_ids()
returns setof text
language sql stable security definer
set search_path = public
as $$
  select p.station_id
  from public.profiles pr
  join public.sm_pumps p on p.id = pr.pump_id
  where pr.id = auth.uid() and pr.active and p.active;
$$;

create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

-- ---------- 5) RLS policies -------------------------------------------------
alter table public.profiles   enable row level security;
alter table public.sm_pumps   enable row level security;
alter table public.app_state  enable row level security;
alter table public.tenants    enable row level security;

-- profiles: read own row + staff rows of own pump (needed for User Management)
drop policy if exists profiles_select_same_pump on public.profiles;
create policy profiles_select_same_pump on public.profiles
  for select using (
    id = auth.uid()
    or pump_id in (select pump_id from public.profiles where id = auth.uid() and active)
  );
-- profiles rows are written ONLY by the provision Edge Function (service role),
-- never from the browser: no insert/update/delete policies on purpose.

-- sm_pumps: users read only their own pump
drop policy if exists pumps_select_own on public.sm_pumps;
create policy pumps_select_own on public.sm_pumps
  for select using (station_id in (select public.my_station_ids()));

-- tenants: read only via own pump
drop policy if exists tenants_select_own on public.tenants;
create policy tenants_select_own on public.tenants
  for select using (
    id in (select p.tenant_id from public.sm_pumps p
           where p.station_id in (select public.my_station_ids()))
  );

-- app_state: browser may ONLY read its own station (needed for initial load +
-- realtime). ALL writes go through the save_app_state gate — no direct write
-- policies, so a stolen JWT can never overwrite another station's data.
drop policy if exists app_state_select_own on public.app_state;
create policy app_state_select_own on public.app_state
  for select using (station_id in (select public.my_station_ids()));

-- ---------- 6) save_app_state: the single write gate ------------------------
-- Returns one row: ok, code, message, current_version, new_version.
-- Mirrors the frontend contract in src/cloud_sync_supabase.js.
create or replace function public.save_app_state(
  p_station_id text,
  p_data jsonb,
  p_expected_version bigint,
  p_user_id uuid
)
returns table (ok boolean, code text, message text, current_version bigint, new_version bigint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_pump public.sm_pumps%rowtype;
  v_version bigint;
  v_role text;
  v_allowed text[] := array['sales','credits','dailyPayments','ledgerPayments','recoveries',
                            'dipReadings','attendance','electricityBills','electricityPayments','staff'];
  v_op_allowed text[] := array['sales','credits','dailyPayments'];
  v_key text;
  v_lock_key text;
begin
  -- 1) authentication
  if p_user_id is null or p_user_id <> auth.uid() then
    return query select false, 'AUTH', 'not authenticated', null::bigint, null::bigint; return;
  end if;

  -- 2) active profile
  select * into v_profile from public.profiles where id = p_user_id and active;
  if not found then
    return query select false, 'PROFILE', 'profile missing or inactive', null::bigint, null::bigint; return;
  end if;
  v_role := v_profile.role;

  -- 3) station binding (tenant isolation: user may only write own pump)
  select * into v_pump from public.sm_pumps where id = v_profile.pump_id and active;
  if not found or v_pump.station_id <> p_station_id then
    return query select false, 'STATION', 'not provisioned for this station', null::bigint, null::bigint; return;
  end if;

  -- 4) View Only: zero business mutations
  if v_role = 'View Only' then
    return query select false, 'ROLE', 'View Only is read-only', null::bigint, null::bigint; return;
  end if;

  -- 5) Manager/Operator: collection allowlist (+ implicit delete block: each
  --    allowed array may never shrink vs the stored version)
  if v_role in ('Manager','Operator') then
    foreach v_key in array (select coalesce(array_agg(k), '{}') from jsonb_object_keys(p_data) k
                            where k not in ('auditLogs','accountingLocks')) loop
      if not (v_key = any(case when v_role = 'Manager' then v_allowed else v_op_allowed end)) then
        return query select false, 'ROLE', 'collection not allowed: ' || v_key, null::bigint, null::bigint; return;
      end if;
    end loop;
    if exists (
      select 1 from public.app_state s
      where s.station_id = p_station_id
        and exists (
          select 1 from jsonb_object_keys(coalesce(s.data,'{}'::jsonb)) k
          where jsonb_typeof(s.data->k) = 'array' and jsonb_typeof(p_data->k) = 'array'
            and jsonb_array_length(p_data->k) < jsonb_array_length(s.data->k)
        )
    ) then
      return query select false, 'ROLE', 'delete not permitted for role', null::bigint, null::bigint; return;
    end if;
  end if;

  -- 6) accounting period lock: only Admin/Owner may touch accountingLocks,
  --    and nobody may mutate collections of a locked month.
  if p_data ? 'accountingLocks' and v_role not in ('Admin','Owner') then
    return query select false, 'ROLE', 'accounting lock change not permitted', null::bigint, null::bigint; return;
  end if;
  if exists (
    select 1
    from public.app_state s,
         lateral jsonb_array_elements_text(coalesce(s.data->'accountingLocks'->'months','[]'::jsonb)) m
    where s.station_id = p_station_id
      and exists (
        select 1 from jsonb_object_keys(coalesce(p_data,'{}'::jsonb)) k
        where k in ('sales','credits','purchases','fillings','dipReadings','dailyPayments',
                    'ledgerPayments','recoveries','paytmTotals')
          and exists (
            select 1 from jsonb_array_elements(p_data->k) r
            where substring(coalesce(r->>'date','') from 1 for 7) = m
          )
      )
  ) then
    return query select false, 'LOCKED', 'accounting period is locked for this data', null::bigint, null::bigint; return;
  end if;

  -- 7) optimistic version gate
  select version into v_version from public.app_state where station_id = p_station_id for update;
  if found and v_version <> coalesce(p_expected_version, 0) then
    return query select false, 'CLOUD_CONFLICT', 'version conflict', v_version, null::bigint; return;
  end if;

  -- 8) write
  insert into public.app_state as s (station_id, data, version, updated_at, updated_by)
  values (p_station_id, p_data, 1, now(), p_user_id)
  on conflict (station_id) do update
    set data = excluded.data, version = s.version + 1, updated_at = now(), updated_by = p_user_id
  returning version into new_version;
  ok := true; code := 'OK'; message := 'saved'; current_version := null;
  return next; return;
end;
$$;

-- ---------- 7) indexes + realtime -------------------------------------------
create index if not exists profiles_pump_id_idx on public.profiles (pump_id);
create index if not exists sm_pumps_tenant_id_idx on public.sm_pumps (tenant_id);

-- realtime for app_state updates (frontend subscribeState):
--   alter publication supabase_realtime add table public.app_state;

-- TODO(owner): run `supabase db dump --linked`, diff this template against the
-- LIVE definitions, reconcile, then commit the reconciled file. Also version
-- the station-provision Edge Function under supabase/functions/.
