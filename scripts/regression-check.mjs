import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  authoritativeSalesRows,
  canonicalDailyPayments,
  financialYearBounds,
  financialYearForDate,
  physicalDipStockForDate,
  previousPending,
} from "../src/core/pumpDomain.js";

const duplicatePayments = {
  dailyPayments: [
    { date: "2026-04-01", MS: { cash: 100, difference: 50 } },
    { date: "2026-04-01", MS: { cash: 200, difference: -20 } },
    { date: "2026-04-02", MS: { cash: 300, difference: 30 } },
  ],
  recoveries: [{ date: "2026-04-02", fuel: "MS", amount: 5 }],
};
assert.equal(canonicalDailyPayments(duplicatePayments).length, 2);
assert.equal(previousPending(duplicatePayments, "2026-04-03").MS, 5,
  "pending must use one canonical payment row per date and apply recoveries");

const netSurplus = {
  dailyPayments: [
    { date: "2026-04-01", MS: { cash: 100, difference: -50 } },
    { date: "2026-04-02", MS: { cash: 200, difference: 10 } },
  ],
  recoveries: [{ date: "2026-04-02", fuel: "MS", amount: 5 }],
};
assert.equal(previousPending(netSurplus, "2026-04-03").MS, 0,
  "net surplus must never become a negative receivable");

const sales = authoritativeSalesRows([
  { id: 1, date: "2026-04-01", nozzle: "MS-1", qty: 100, fingerprintVersion: 1, _integrityVerified: true },
  { id: 2, date: "2026-04-01", nozzle: "MS-1", qty: 120, fingerprintVersion: 1, _integrityVerified: true },
  { id: 3, date: "2026-04-01", nozzle: "MS-1", qty: 999, recoveryStatus: "FORENSIC_RECOVERY", fingerprintVersion: 1, _integrityVerified: true },
]);
assert.equal(sales.length, 1);
assert.equal(sales[0].qty, 120, "latest verified source sale must win over recovery duplicates");

assert.equal(financialYearForDate("2026-04-01"), "2026-27");
assert.equal(financialYearForDate("2027-03-31"), "2026-27");
assert.equal(financialYearForDate("2027-04-01"), "");
assert.deepEqual(financialYearBounds("2026-27"), {
  value: "2026-27", label: "FY 2026-27", start: "2026-04-01", end: "2027-03-31"
});

assert.equal(physicalDipStockForDate({}, "MS", "2026-08-01"), 9356);
assert.equal(physicalDipStockForDate({}, "HSD", "2026-08-01"), 7500);
assert.equal(physicalDipStockForDate({}, "CNG", "2026-08-01"), null);

const cloudSource = await readFile(new URL("../src/cloud_sync_supabase.js", import.meta.url), "utf8");
assert.match(cloudSource, /stableJson\(latest\.data\) !== stableJson\(data\)/,
  "network recovery must compare the stored payload, not just the version");
assert.match(cloudSource, /verified_payload_match:\s*true/,
  "successful network recovery must report payload verification");

process.stdout.write("PASS: duplicate payment canonicalization\n");
process.stdout.write("PASS: net excess/short and recovery calculation\n");
process.stdout.write("PASS: nozzle duplicate and forensic recovery selection\n");
process.stdout.write("PASS: financial-year boundaries\n");
process.stdout.write("PASS: physical dip source priority\n");
process.stdout.write("PASS: Cloud save payload verification guard\n");
process.stdout.write("All StationMitra regression checks passed.\n");
