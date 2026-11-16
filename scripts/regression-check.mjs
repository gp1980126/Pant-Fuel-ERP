import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  authoritativeSalesRows,
  canonicalDailyPayments,
  financialYearBounds,
  financialYearForDate,
  financialYearOpeningStockForDate,
  lubricantStockQuantityForDate,
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
const completenessSelection = {
  dailyPayments: [
    { date: "2026-04-01", MS: { cash: 900, difference: 700 }, HSD: { cash: 100 } },
    { date: "2026-04-01", MS: { cash: 200, paytm: 0, card: 0, dtplus: 0, hppay: 0, phonepe: 0, credit: 0, other: 0, pumpExpense: 0 },
      HSD: { cash: 50, paytm: 0, card: 0, dtplus: 0, hppay: 0, phonepe: 0, credit: 0, other: 0, pumpExpense: 0 } },
  ],
};
assert.equal(canonicalDailyPayments(completenessSelection)[0].MS.cash, 200,
  "the most complete payment breakdown must win even when its cash amount is lower");
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
assert.equal(physicalDipStockForDate({ dipReadings: [{ date: "2026-08-01", MS: 9000 }] }, "MS", "2026-08-01"), 9000,
  "saved physical dip must take priority over imported and embedded history");

const fyStockFixture = {
  openingStock: { LUBRICANT_QTY: 0, LUBRICANT_VALUE: 0 },
  openingStockByFY: {
    "2026-27": { qty: 2090, value: 557727, source: "CARRY_FORWARD", fromFY: "2025-26" },
  },
  purchases: [
    { date: "2026-03-27", fuel: "LUBRICANT", quantity: 2300 },
    { date: "2026-04-05", fuel: "LUBRICANT", quantity: 100 },
  ],
  credits: [{ date: "2026-04-06", fuel: "LUBRICANT", qty: 20 }],
  lubricantCashSales: [{ date: "2026-04-07", qty: 30 }],
};
assert.deepEqual(financialYearOpeningStockForDate(fyStockFixture, "2026-04-01"), {
  fy: "2026-27", start: "2026-04-01", end: "2027-03-31",
  qty: 2090, value: 557727, source: "CARRY_FORWARD",
});
assert.equal(lubricantStockQuantityForDate(fyStockFixture, "2026-04-01"), 2090,
  "prior-FY purchases must not be added again on top of the carried-forward opening stock");
assert.equal(lubricantStockQuantityForDate(fyStockFixture, "2026-04-10"), 2140,
  "FY stock must equal opening + current-FY purchases - current-FY credit and cash sales");
assert.equal(financialYearOpeningStockForDate(fyStockFixture, "2027-04-01"), null,
  "unsupported FY dates must not silently fall back to another year's opening stock");

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
