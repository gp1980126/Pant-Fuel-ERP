import { spawnSync } from "node:child_process";

const files = [
  "src/core/pumpDomain.js",
  "src/cloud_sync_supabase.js",
  "src/services/storage/localStore.js",
  "src/config/appConfig.js",
];

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    failed = true;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  } else {
    process.stdout.write(`PASS syntax: ${file}\n`);
  }
}
if (failed) process.exit(1);
