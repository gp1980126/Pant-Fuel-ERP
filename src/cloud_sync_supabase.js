// PumpPro cloud sync adapter (Supabase)
import { createClient } from '@supabase/supabase-js';

// Fail closed: a missing or mismatched Vercel environment must never fall back
// to another project's credentials. Only the explicitly paired project is allowed.
const EXPECTED_PROJECTS = {
  test: 'gejczccpdvusmfetpxmg',
  production: 'vzfmhppgninuinvmwyjn',
};

const environment = String(import.meta.env.VITE_STATIONMITRA_ENV || '').trim().toLowerCase();
const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const expectedProject = EXPECTED_PROJECTS[environment];
const projectRef = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i)?.[1] || '';

export const CLOUD_CONFIG_ERROR = !expectedProject
  ? 'StationMitra environment is missing or invalid. Set VITE_STATIONMITRA_ENV to test or production.'
  : !url || !anonKey
    ? 'Supabase configuration is incomplete. Both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.'
    : projectRef !== expectedProject
      ? `Database isolation blocked: ${environment} environment cannot connect to Supabase project ${projectRef || '(invalid URL)'}.`
      : '';

const configured = !CLOUD_CONFIG_ERROR;
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
    const e = new Error(CLOUD_CONFIG_ERROR || 'Cloud configuration missing: Supabase client is not configured in this build.');
    e.code = 'CLOUD_NOT_CONFIGURED';
    e.stage = 'CONFIG';
    throw e;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { error.code = error.code || 'auth_error'; error.stage = 'AUTH'; throw error; }
  return data;
}

export async function cloudResetPassword(email) {
  if (!supabase) throw new Error(CLOUD_CONFIG_ERROR || 'Cloud configuration missing: Supabase is not configured in this build.');
  const cleanEmail = String(email || '').trim();
  if (!cleanEmail || !cleanEmail.includes('@')) throw new Error('Registered email address डालें।');
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo: window.location.origin });
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
  const { data, error } = await supabase.from('profiles').select('id,email,username,name,role,active,pump_id').eq('id', userId).maybeSingle();
  if (error) { error.stage = 'PROFILE'; throw error; }
  return data;
}

export async function cloudGetStationId(userId) {
  if (!supabase || !userId) return null;
  const { data: profile, error: profileError } = await supabase.from('profiles').select('pump_id').eq('id', userId).maybeSingle();
  if (profileError) { profileError.stage = 'PROFILE_CONTEXT'; throw profileError; }
  if (!profile?.pump_id) return null;
  const { data: pump, error: pumpError } = await supabase.from('sm_pumps').select('id,tenant_id,station_id,pump_code,pump_name,active').eq('id', profile.pump_id).maybeSingle();
  if (pumpError) { pumpError.stage = 'PUMP_CONTEXT'; throw pumpError; }
  if (!pump?.active || !pump?.station_id) return null;
  return String(pump.station_id).trim() || null;
}

export async function cloudLoadState(stationId = 'SATAT-FILLING-STATION') {
  if (!supabase) return null;
  const { data, error } = await supabase.from('app_state').select('station_id,data,version,updated_at,updated_by').eq('station_id', stationId).maybeSingle();
  if (error) { error.stage = 'CLOUD_STATE'; throw error; }
  return data || null;
}

async function rpcSaveOnce(stationId, data, expectedVersion, userId) {
  const { data: rows, error } = await supabase.rpc('save_app_state', {
    p_station_id: stationId, p_data: data,
    p_expected_version: Number(expectedVersion || 0), p_user_id: userId,
  });
  if (error) throw error;
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function cloudSaveState(stationId, data, expectedVersion, userId) {
  if (!supabase) throw new Error(CLOUD_CONFIG_ERROR || 'Cloud is disabled because configuration is invalid.');
  const expected = Number(expectedVersion || 0);
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const row = await rpcSaveOnce(stationId, data, expected, userId);
      if (!row || row.ok === false) {
        const e = new Error(row?.message || 'Cloud version conflict');
        e.code = row?.code || 'CLOUD_CONFLICT'; e.currentVersion = row?.current_version ?? null;
        throw e;
      }
      return row;
    } catch (error) {
      lastError = error;
      if (['CLOUD_CONFLICT','AUTH','PROFILE','STATION','ROLE','LOCKED'].includes(error?.code)) throw error;
      try {
        const latest = await cloudLoadState(stationId);
        const latestVersion = Number(latest?.version || 0);
        if (latestVersion > expected) return { ok:true, code:'OK', message:'Cloud save confirmed after network response loss', new_version:latestVersion, recovered_after_network_error:true };
      } catch {}
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  const message = lastError?.message || 'Cloud save failed';
  const e = new Error(message === 'Failed to fetch' ? 'Supabase connection failed. Save was not confirmed; Cloud data was not overwritten.' : message);
  e.code = lastError?.code || 'CLOUD_NETWORK'; e.stage = lastError?.stage || 'CLOUD_SAVE';
  throw e;
}

export function subscribeState(stationId, onRemoteState) {
  if (!supabase) return () => {};
  const channel = supabase.channel(`pump-pro-state-${stationId}`).on('postgres_changes', {
    event:'UPDATE', schema:'public', table:'app_state', filter:`station_id=eq.${stationId}`,
  }, payload => onRemoteState(payload.new)).subscribe();
  return () => { supabase.removeChannel(channel); };
}
