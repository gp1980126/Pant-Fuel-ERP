// StationMitra Phase 12 static security regression gate (restored 2026-09-20).
// Re-asserts the 10 role-authorization invariants documented in
// PHASE12_RELEASE_REPORT_13-09-2026.md, plus the 2026-09-20 hardening invariants.
// Run with: npm run regression
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => fs.readFileSync(path.join(ROOT, rel), "utf8");

const domain = read("src/core/pumpDomain.js");
const app = read("src/App.jsx");
const modules = read("src/components/PumpModules.jsx");
const cloud = read("src/cloud_sync_supabase.js");
const pkg = JSON.parse(read("package.json"));

let failures = 0;
const check = (name, cond) => {
  if (cond) console.log(`PASS — ${name}`);
  else { failures += 1; console.error(`FAIL — ${name}`); }
};

// --- Phase 12: original 10 static security checks ---
check("1. View Only role constant",
  /VIEW_ONLY:\s*"View Only"/.test(domain));

check("2. View Only page permissions",
  /ROLE_PERMISSIONS[\s\S]*?\[USER_ROLES\.VIEW_ONLY\]:\s*\[[\s\S]*?"Dashboard"/.test(domain) &&
  /export const canAccess =/.test(domain));

check("3. View Only role normalization",
  /r === "view only" \|\| r === "view_only"/.test(app) &&
  /return USER_ROLES\.VIEW_ONLY;/.test(app));

check("4. View Only mutation gateway blocks business mutations",
  /if \(role === USER_ROLES\.VIEW_ONLY && businessKeys\.length\)/.test(app) &&
  /\[USER_ROLES\.VIEW_ONLY\]: \{ allow: \[\], delete: false \}/.test(app));

{
  // ROLE_MUTATION_POLICY lives in App.jsx (central mutation gateway).
  const m = app.match(/\[USER_ROLES\.MANAGER\]: \{ allow: \[([\s\S]*?)\]/);
  const list = m ? m[1] : "";
  check("5. Manager collection allowlist",
    Boolean(m) && ["sales", "credits", "dailyPayments", "staff"].every(c => list.includes(`"${c}"`)));
}

check("6. Manager/Operator delete blocking",
  /\[USER_ROLES\.MANAGER\]: \{[\s\S]*?delete: false \}/.test(app) &&
  /\[USER_ROLES\.OPERATOR\]: \{[\s\S]*?delete: false \}/.test(app) &&
  /को Delete permission नहीं है।/.test(app));

check("7. Accounting-lock authorization retained",
  /Accounting Period Lock केवल Admin \/ Owner बदल सकते हैं।/.test(app) &&
  /findLockedMutation/.test(app) && /month LOCKED है/.test(app));

check("8. Purchase-to-filling linked-delete protection retained",
  /delete नहीं हो सकता क्योंकि उससे Tank Filling linked है\./.test(app) &&
  /purchaseRef/.test(app));

check("9. View Only available in User Management role selector",
  /<option>View Only<\/option>/.test(modules));

{
  const block = domain.match(/export const DEFAULT_USERS = \[[\s\S]*?\];/);
  check("10. No demo View Only user in default users",
    Boolean(block) && !block[0].includes("View Only"));
}

// --- 2026-09-20 hardening checks ---
check("11. No hardcoded Supabase fallback credentials",
  !/FALLBACK_SUPABASE/.test(cloud) && !/eyJ[A-Za-z0-9_-]{8,}\./.test(cloud));

check("12. CLOUD_REQUIRED fail-closed login gate wired",
  /import \{ CLOUD_REQUIRED \} from "\.\/config\/appConfig";/.test(app) &&
  /if \(CLOUD_REQUIRED\) \{ setLoginError/.test(app));

check("13. Vulnerable unused xlsx dependency removed",
  !pkg.dependencies?.xlsx && !pkg.devDependencies?.xlsx);

check("14. Repo hygiene files present",
  fs.existsSync(path.join(ROOT, ".gitignore")) &&
  fs.existsSync(path.join(ROOT, ".env.example")));

// --- Phase 13 multi-tenancy checks ---
check("15. Embedded station data is optional-private (import.meta.glob wiring)",
  /import\.meta\.glob\("\.\/private\/stationData\.js", \{ eager: true \}\)/.test(domain) &&
  !/from "\.\/embeddedBackupData\.js"/.test(domain) &&
  !fs.existsSync(path.join(ROOT, "src/core/embeddedBackupData.js")));

{
  const seed = read("src/core/tenantSeed.js");
  check("16. Commercial tenant seed is blank and neutral",
    /TENANT_SEED_VERSION/.test(seed) && /sales: \[\]/.test(seed) &&
    /parties: \[\]/.test(seed) && /users: \[\]/.test(seed) &&
    !/fp1-|TX-SALES/.test(seed));
}

{
  const plans = read("src/config/plans.js");
  check("17. Commercial plan catalogue with View-Only lockout",
    /monthlyInr: 399/.test(plans) && /monthlyInr: 799/.test(plans) &&
    /oneTimeInr: 29999/.test(plans) &&
    /roleForSubscriptionStatus/.test(plans) && /"View Only"/.test(plans));
}

check("18. Supabase tenant-isolation SQL + provision scaffold versioned",
  fs.existsSync(path.join(ROOT, "supabase/migrations/00001_phase13_multitenancy.sql")) &&
  fs.existsSync(path.join(ROOT, "supabase/functions/station-provision/index.ts")) &&
  /enable row level security/.test(fs.readFileSync(path.join(ROOT, "supabase/migrations/00001_phase13_multitenancy.sql"), "utf8")));

console.log("");
if (failures) { console.error(`regression-check: ${failures} FAILURE(S)`); process.exit(1); }
console.log("regression-check: 18/18 PASS");
