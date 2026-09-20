// PumpPro cloud sync adapter (Supabase)
import { createClient } from '@supabase/supabase-js';
import { STATION_ID } from './config/appConfig.js';

// The Supabase URL + anon key are client-side credentials and are safe to ship
// in a browser build because RLS and Auth remain the security boundary -- BUT
// they are environment-specific, so they must come ONLY from build-time
// environment variables (see .env.example / VERCEL_DEPLOY.md). Hardcoded
// fallback credentials were removed in the 2026-09-20 hardening: a missing
// configuration now fails closed instead of silently connecting production to
// the wrong (test) project.
const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const configured = Boolean(url && anonKey);

// A deployed Vercel build is Cloud-first. When env configuration is missing,
// Cloud is disabled (and App.jsx blocks login entirely when the deployment sets
// VITE_PUMPPRO_CLOUD_REQUIRED=true).
export const CLOUD_ENABLED = configured;

export const supabase = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function cloudSignIn(email, password) {
  if (!supabase) {
    const e = new Error('Cloud configuration missing: Supabase client is not configured in this build.');
    e.code = 'CLOUD_NOT_CONFIGURED';
    e.stage = 'CONFIG';
    throw e;
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    error.code = error.code || 'auth_error';
    error.stage = 'AUTH';
    throw error;
  }
  return data;
}

export async function cloudResetPassword(email) {
  if (!supabase) throw new Error('Cloud configuration missing: Supabase is not configured in this build.');
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Registered email address डालें।');
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
  return true;
}

export async function cloudSignOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function cloudGetProfile(userId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,username,name,role,active,pump_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    error.stage = 'PROFILE';
    throw error;
  }
  return data;
}

export async function cloudGetStationId(userId) {
  if (!supabase || !userId) return null;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('pump_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) { profileError.stage = 'PROFILE_CONTEXT'; throw profileError; }
  if (!profile?.pump_id) return null;
  const { data: pump, error: pumpError } = await supabase
    .from('sm_pumps')
    .select('id,tenant_id,station_id,pump_code,pump_name,active')
    .eq('id', profile.pump_id)
    .maybeSingle();
  if (pumpError) { pumpError.stage = 'PUMP_CONTEXT'; throw pumpError; }
  if (!pump?.active || !pump?.station_id) return null;
  return String(pump.station_id).trim() || null;
}

export async function cloudLoadState(stationId = STATION_ID) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_state')
    .select('station_id,data,version,updated_at,updated_by')
    .eq('station_id', stationId)
    .maybeSingle();

  if (error) {
    error.stage = 'CLOUD_STATE';
    throw error;
  }
  return data || null;
}

export async function cloudSaveState(stationId, data, expectedVersion, userId) {
  if (!supabase) return null;

  const { data: rows, error } = await supabase.rpc('save_app_state', {
    p_station_id: stationId,
    p_data: data,
    p_expected_version: Number(expectedVersion || 0),
    p_user_id: userId,
  });

  if (error) throw error;

  const row = Array.isArray(rows) ? rows[0] : rows;

  if (!row || row.ok === false) {
    const e = new Error(row?.message || 'Cloud version conflict');
    e.code = row?.code || 'CLOUD_CONFLICT';
    e.currentVersion = row?.current_version ?? null;
    throw e;
  }

  return row;
}

export function subscribeState(stationId, onRemoteState) {
  if (!supabase) return () => {};

  const channel = supabase
    .channel(`pump-pro-state-${stationId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'app_state',
        filter: `station_id=eq.${stationId}`,
      },
      (payload) => onRemoteState(payload.new)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
