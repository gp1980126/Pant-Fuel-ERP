// Release gate for StationMitra (restored 2026-09-20).
// Runs every static gate and verifies the frozen-core file hashes recorded in
// RELEASE_MANIFEST.txt (FROZEN_HASHES_BEGIN ... FROZEN_HASHES_END block).
// Run with: npm run release-check
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
const fail = msg => { failures += 1; console.error(`FAIL — ${msg}`); };
const pass = msg => console.log(`PASS — ${msg}`);

// 1. Run the static gates
for (const script of ["scripts/parse-check.mjs", "scripts/regression-check.mjs"]) {
  const r = spawnSync(process.execPath, [path.join(ROOT, script)], { stdio: "inherit" });
  if (r.status !== 0) fail(`${script} failed`);
}

// 2. Frozen core file hashes from RELEASE_MANIFEST.txt
{
  const manifestPath = path.join(ROOT, "RELEASE_MANIFEST.txt");
  if (!fs.existsSync(manifestPath)) {
    fail("RELEASE_MANIFEST.txt missing");
  } else {
    const text = fs.readFileSync(manifestPath, "utf8");
    const block = text.match(/FROZEN_HASHES_BEGIN([\s\S]*?)FROZEN_HASHES_END/);
    if (!block) {
      fail("RELEASE_MANIFEST.txt has no FROZEN_HASHES_BEGIN/END block");
    } else {
      const entries = block[1].split("\n")
        .map(l => l.trim())
        .filter(l => /^[0-9a-f]{64}\s+/.test(l))
        .map(l => { const [hash, ...rest] = l.split(/\s+/); return { hash, file: rest.join(" ") }; });
      if (!entries.length) {
        fail("FROZEN_HASHES block lists no files");
      }
      for (const { hash, file } of entries) {
        const abs = path.join(ROOT, file);
        if (!fs.existsSync(abs)) { fail(`manifest file missing on disk: ${file}`); continue; }
        const actual = crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
        if (actual !== hash) {
          fail(`frozen file hash mismatch: ${file}\n  manifest: ${hash}\n  actual:   ${actual}\n  -> If this change is intentional, update RELEASE_MANIFEST.txt in the same commit.`);
        } else {
          pass(`frozen core file hash verified: ${file}`);
        }
      }
    }
  }
}

// 3. Secrets / artifacts must not be tracked by git
{
  try {
    const out = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
    const tracked = out.split("\n").filter(Boolean);
    const banned = tracked.filter(f =>
      /(^|\/)(\.env($|\.)|node_modules\/|dist\/)/.test(f) && f !== ".env.example"
    );
    if (tracked.includes(".env.example")) pass(".env.example is tracked (template for setup)");
    else fail(".env.example is NOT tracked by git");
    if (banned.length) banned.forEach(f => fail(`forbidden tracked file: ${f}`));
    else pass("no .env / node_modules / dist tracked in git");
  } catch {
    console.log("SKIP — git not available; tracked-file scan skipped");
  }
}

console.log("");
if (failures) { console.error(`release-check: ${failures} FAILURE(S)`); process.exit(1); }
console.log("release-check: PASS — package is static-release eligible (live multi-role test remains a manual gate)");
