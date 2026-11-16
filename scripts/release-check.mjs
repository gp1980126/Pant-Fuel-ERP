import { spawnSync } from "node:child_process";

const steps = [
  ["check", ["run", "check"]],
  ["regression", ["run", "regression"]],
  ["production build", ["run", "build"]],
];

for (const [label, args] of steps) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const result = spawnSync("npm", args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    process.stderr.write(`FAILED: ${label}\n`);
    process.exit(result.status || 1);
  }
}
process.stdout.write("\nStationMitra release checks passed.\n");
