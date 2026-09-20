// Static hygiene gate for StationMitra (restored 2026-09-20).
// Fast, dependency-free checks that must pass before build/release.
// Run with: npm run check
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");

let failures = 0;
const fail = msg => { failures += 1; console.error(`FAIL — ${msg}`); };
const pass = msg => console.log(`PASS — ${msg}`);

const REQUIRED_FILES = [
  "src/main.jsx",
  "src/App.jsx",
  "src/cloud_sync_supabase.js",
  "src/config/appConfig.js",
  "src/core/pumpDomain.js",
  "src/components/PumpModules.jsx",
  "src/components/TallyExport.jsx",
  "src/services/storage/localStore.js",
  "index.html",
];

// 1. Required entry files exist and are non-empty
let ok = true;
for (const rel of REQUIRED_FILES) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) { ok = false; fail(`required file missing: ${rel}`); continue; }
  const size = fs.statSync(abs).size;
  if (size < 50) { ok = false; fail(`required file suspiciously small (${size} bytes): ${rel}`); }
}
if (ok) pass("all required entry files present and non-empty");

// Collect source files
const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (/\.(jsx?|css)$/.test(e.name)) srcFiles.push(full);
  }
})(SRC);

// 2. No unresolved merge-conflict markers
{
  // Real git markers are exactly 7 chars: "<<<<<<< label", "=======" alone, ">>>>>>> label".
  // (A bare ^=======$ would false-positive on long decorative ==== comment dividers.)
  const bad = srcFiles.filter(f => /^(<<<<<<<[ \t]|=======$|>>>>>>>[ \t])/m.test(fs.readFileSync(f, "utf8")));
  if (bad.length) bad.forEach(f => fail(`merge-conflict markers in ${path.relative(ROOT, f)}`));
  else pass("no merge-conflict markers in src/");
}

// 3. No hardcoded credentials in src/ (JWT, service_role, private keys)
{
  const patterns = [
    { re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/, label: "hardcoded JWT token" },
    { re: /service_role/i, label: "service_role key reference" },
    { re: /BEGIN (RSA |EC )?PRIVATE KEY/, label: "private key block" },
  ];
  const hits = [];
  for (const f of srcFiles) {
    const text = fs.readFileSync(f, "utf8");
    for (const { re, label } of patterns) {
      if (re.test(text)) hits.push(`${label} in ${path.relative(ROOT, f)}`);
    }
  }
  if (hits.length) hits.forEach(fail);
  else pass("no hardcoded JWT / service_role / private keys in src/");
}

// 4. Relative imports resolve to real files
{
  const exts = [".js", ".jsx", ".mjs", ".json"];
  const bad = [];
  for (const f of srcFiles) {
    const text = fs.readFileSync(f, "utf8");
    const importRe = /(?:import\s[^'"]*|import\s*|from\s*)["'](\.[^"']+)["']/g;
    let m;
    while ((m = importRe.exec(text)) !== null) {
      const target = path.resolve(path.dirname(f), m[1]);
      const resolved = exts.some(e => fs.existsSync(target + e)) || fs.existsSync(target);
      if (!resolved) bad.push(`${path.relative(ROOT, f)} -> ${m[1]}`);
    }
  }
  if (bad.length) bad.forEach(b => fail(`unresolved import: ${b}`));
  else pass(`all relative imports resolve (${srcFiles.length} files scanned)`);
}

// 5. package.json is valid and its gate scripts exist
{
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const missing = ["check", "regression", "release-check"]
    .map(k => pkg.scripts?.[k])
    .filter(Boolean)
    .map(cmd => path.join(ROOT, cmd.replace("node ", "")))
    .filter(p => !fs.existsSync(p));
  if (missing.length) missing.forEach(p => fail(`package.json script target missing: ${path.relative(ROOT, p)}`));
  else pass("package.json gates (check/regression/release-check) all resolve to real scripts");
}

// 6. .gitignore must protect env files (README promises this)
{
  const gi = path.join(ROOT, ".gitignore");
  const text = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const protectsEnv = /^\.env\.?\*?$/m.test(text) || /^\.env$/m.test(text);
  if (!protectsEnv) fail(".gitignore missing or does not ignore .env files");
  else pass(".gitignore protects .env files");
}

console.log("");
if (failures) { console.error(`parse-check: ${failures} FAILURE(S)`); process.exit(1); }
console.log("parse-check: all checks PASS");
