// PumpPro cloud sync adapter (Supabase)
import { createClient } from '@supabase/supabase-js';

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const CLOUD_ENABLED = Boolean(url && anonKey);

export const supabase = CLOUD_ENABLED
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function cloudSignIn(email, password) {
  if (!supabase) throw new Error('Cloud is not configured');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

export async function cloudResetPassword(email) {
  if (!supabase) throw new Error('Cloud is not configured');
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
    .select('id,email,username,name,role,active')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function cloudLoadState(
  stationId = 'SATAT-FILLING-STATION'
) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('app_state')
    .select('station_id,data,version,updated_at,updated_by')
    .eq('station_id', stationId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function cloudSaveState(
  stationId,
  data,
  expectedVersion,
  userId
) {
  if (!supabase) return null;

  const { data: rows, error } = await supabase.rpc(
    'save_app_state',
    {
      p_station_id: stationId,
      p_data: data,
      p_expected_version: Number(expectedVersion || 0),
      p_user_id: userId,
    }
  );

  if (error) throw error;

  const row = Array.isArray(rows) ? rows[0] : rows;

  if (!row || row.ok === false) {
    const e = new Error(
      row?.message || 'Cloud version conflict'
    );

    e.code = row?.code || 'CLOUD_CONFLICT';
    e.currentVersion =
      row?.current_version ?? null;

    throw e;
  }

  return row;
}

export function subscribeState(
  stationId,
  onRemoteState
) {
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