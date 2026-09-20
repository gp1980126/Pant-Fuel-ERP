// station-provision Edge Function (v2-ready scaffold — Phase 13)
// ---------------------------------------------------------------------------
// Provisions a new pump user: creates the Supabase Auth account and links a
// profile row with an allowed role. Roles accepted by the Phase 12 gate
// include "View Only". This scaffold mirrors the behaviour the frontend
// expects; reconcile it with the LIVE station-provision v2 before deploying
// (see supabase/README.md).
//
// Deploy:  supabase functions deploy station-provision
// Secrets: provided automatically: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ROLES = new Set(["Admin", "Owner", "Manager", "Operator", "View Only"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, message: "POST only" }, 405);

  // Caller must be an authenticated Admin/Owner of an existing pump.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user } } = await caller.auth.getUser();
  if (!user) return json({ ok: false, message: "not authenticated" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("id,role,active,pump_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!callerProfile?.active || !["Admin", "Owner"].includes(callerProfile.role)) {
    return json({ ok: false, message: "only Admin/Owner can provision users" }, 403);
  }

  const { email, password, name, username, role } = await req.json();
  if (!email || !password) return json({ ok: false, message: "email and password required" }, 400);
  if (!ALLOWED_ROLES.has(role)) return json({ ok: false, message: "invalid role" }, 400);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name ?? null },
  });
  if (createError) return json({ ok: false, message: createError.message }, 400);

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    email,
    username: username ?? email,
    name: name ?? null,
    role,
    active: true,
    // New users join the caller's pump by default; super-admin tooling can
    // pass an explicit pump_id for a different station (not exposed here).
    pump_id: callerProfile.pump_id,
  });
  if (profileError) return json({ ok: false, message: profileError.message }, 400);

  return json({ ok: true, user_id: created.user.id });
});
