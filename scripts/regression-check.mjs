import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  authoritativeSalesRows,
  bookFuelStockForDate,
  calculateProfitLossEngine,
  cngSalePurchaseMatchingPure,
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
const fyPnl = calculateProfitLossEngine(fyStockFixture, "2026-04-10", "2026-04-10");
assert.equal(fyPnl.calc.LUBRICANT.openingQty, 2140,
  "P&L opening stock must use FY carry-forward plus only same-FY movements");
assert.equal(financialYearOpeningStockForDate(fyStockFixture, "2027-04-01"), null,
  "unsupported FY dates must not silently fall back to another year's opening stock");

const fuelStockFixture = {
  openingDate: "2026-08-01",
  openingStock: { MS: 9356, HSD: 7500 },
  fillings: [
    { date: "2026-07-31", fuel: "MS", qty: 500 },
    { date: "2026-08-01", fuel: "MS", qty: 100 },
    { date: "2026-08-02", fuel: "MS", qty: 50 },
  ],
};
const fuelStockSales = [
  { date: "2026-08-01", fuel: "MS", qty: 300, testing: 5 },
  { date: "2026-08-02", fuel: "MS", qty: 100, testing: 5 },
];
assert.equal(bookFuelStockForDate(fuelStockFixture, fuelStockSales, "MS", "2026-07-31"), null,
  "book stock must not use FY start as an earlier stock opening");
assert.equal(bookFuelStockForDate(fuelStockFixture, fuelStockSales, "MS", "2026-08-01"), 9156,
  "book stock = physical opening + tank receipt - net sale; testing is not subtracted twice");
assert.equal(bookFuelStockForDate(fuelStockFixture, fuelStockSales, "MS", "2026-08-02"), 9106,
  "book stock must accumulate only fillings and net sales from the actual stock opening date");

const moduleSource = await readFile(new URL("../src/components/PumpModules.jsx", import.meta.url), "utf8");
const stockComponent = moduleSource.slice(moduleSource.indexOf("export function Stock({"), moduleSource.indexOf("export function Table({"));
assert.match(stockComponent, /const stockStartDate = String\(data\?\.openingDate \|\| "2026-08-01"\)/,
  "Stock must use the configured stock opening date, not the FY boundary");
assert.doesNotMatch(stockComponent, /START_DATE/,
  "Stock date calculations must remain separate from Financial Year start");
assert.match(moduleSource, /return lubricantStockQuantityForDate\(data,date\)/,
  "P&L screen must use the FY-scoped lubricant stock calculation");
assert.match(moduleSource, /financialYearOpeningStockForDate\(data,date\)/,
  "P&L opening valuation must use the selected FY opening value");
assert.match(moduleSource, /fromFY:previousFY/,
  "future carry-forward metadata must use the valid previous FY label");

const cngFifoFixture = {
  sales: [
    { id: "sale-before-lot", date: "2026-03-30", fuel: "CNG", qty: 40, amount: 400 },
    { id: "sale-fy1", date: "2026-04-01", fuel: "CNG", qty: 80, amount: 800 },
    { id: "sale-fy2", date: "2026-04-03", fuel: "CNG", qty: 100, amount: 1000 },
  ],
  purchases: [
    { id: "lot-prior-fy", date: "2026-03-31", fuel: "CNG", quantity: 100, amount: 1000 },
    { id: "lot-current-fy", date: "2026-04-02", fuel: "CNG", quantity: 100, amount: 2000 },
  ],
};
const cngFifo = cngSalePurchaseMatchingPure(cngFifoFixture, "2026-04-01", "2027-03-31");
assert.equal(cngFifo.saleQty, 180, "selected FY CNG sales must be matched only after purchase lots exist");
assert.equal(cngFifo.matchedQty, 180, "prior-FY carried-forward CNG lots must match current-FY sales");
assert.equal(cngFifo.matchedCost, 2600, "FIFO must consume the older carried-forward lot before current-FY lots");
assert.equal(cngFifo.unmatchedQty, 0);
assert.equal(cngFifo.unmatchedPurchaseQty, 20, "unused current-FY purchase quantity must remain as closing carry-forward");
assert.equal(cngFifo.matchedPurchaseOutsidePeriod, 100, "current-FY sale matching must disclose the 100 kg prior-FY lot carry-forward");

const partyLedger = moduleSource.slice(moduleSource.indexOf("export function PartyLedger"), moduleSource.indexOf("export function Accounts"));
assert.match(partyLedger, /const \[selectedFY, setSelectedFY\] = useState\(DEFAULT_FINANCIAL_YEAR\)/,
  "Party Ledger must expose a Financial Year selector");
assert.match(partyLedger, /d < fy.start \|\| d > fy.end/,
  "Party Ledger rows must be limited to the selected FY");
assert.match(partyLedger, /validateLedgerFYDate\(payment.date, "Payment Date"\)/,
  "new Party Ledger receipts must be date-checked against selected FY");
assert.match(partyLedger, /type: "Opening Outstanding"/,
  "saved opening outstanding must appear on its actual effective date when it falls inside the selected report range");
assert.match(partyLedger, /openingEffectiveDate >= String\(from \|\| fy.start\)/,
  "opening outstanding dated after the report start must not be silently omitted");
assert.match(partyLedger, /entries\.reduce\(\(balance, entry\) => balance \+ n\(entry\.debit\) - n\(entry\.credit\), 0\)/,
  "Party Ledger closing balance must include every visible dated opening entry");
assert.match(partyLedger, /effectiveOpeningInRange/,
  "All Party Outstanding must include an opening outstanding effective within the selected date range");

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
process.stdout.write("PASS: FY-scoped lubricant opening stock and P&L movement firewall\n");
process.stdout.write("PASS: MS/HSD stock-opening-date book stock formula\n");
process.stdout.write("PASS: Cloud save payload verification guard\\n");

const { buildCngDeliveryReconciliation } = await import("../src/core/cngDeliveryReconciliation.js");
const cngDeliveryFixture = {
  purchases: [
    { date:"2026-08-05", fuel:"CNG", quantity:4321, invoiceNo:"INV-1" },
    { date:"2026-08-06", fuel:"CNG", quantity:802, invoiceNo:"INV-2", billEntryDate:"2026-08-07" },
  ],
  sales: [
    { id:1, date:"2026-08-01", fuel:"CNG", nozzle:"CNG-1", qty:949.416 },
    { id:2, date:"2026-08-02", fuel:"CNG", nozzle:"CNG-1", qty:1235.041 },
    { id:3, date:"2026-08-03", fuel:"CNG", nozzle:"CNG-1", qty:596.850 },
    { id:4, date:"2026-08-04", fuel:"CNG", nozzle:"CNG-1", qty:748.767 },
    { id:5, date:"2026-08-05", fuel:"CNG", nozzle:"CNG-1", qty:791.065 },
    { id:6, date:"2026-08-06", fuel:"CNG", nozzle:"CNG-1", qty:801.087 },
    { id:6, date:"2026-08-06", fuel:"CNG", nozzle:"CNG-1", qty:801.087, transactionId:"SALE-6-RECOVERY-copy" },
  ],
};
const deliveryAudit = buildCngDeliveryReconciliation(cngDeliveryFixture, "2026-08-01", "2026-08-31");
assert.equal(deliveryAudit.rows[0].invoiceNos, "INV-1");
assert.equal(deliveryAudit.rows[0].salesQty, 4321.139);
assert.equal(deliveryAudit.rows[1].salesQty, 801.087);
assert.equal(deliveryAudit.rows[1].entryDate, "2026-08-07");
assert.equal(deliveryAudit.duplicateGroups.length, 1);
assert.equal(deliveryAudit.totals.salesQty, 5122.226);
const pendingAudit = buildCngDeliveryReconciliation({
  purchases: [{date:"2026-08-05",fuel:"CNG",quantity:100,invoiceNo:"INV"}],
  sales: [{id:1,date:"2026-08-06",fuel:"CNG",nozzle:"CNG-1",qty:45}]
}, "2026-08-01", "2026-08-31");
assert.equal(pendingAudit.rows.at(-1).type, "PENDING_BILL");
assert.equal(pendingAudit.rows.at(-1).salesQty, 45);
process.stdout.write("PASS: CNG delivery interval reconciliation and duplicate audit\\n");

process.stdout.write("All StationMitra regression checks passed.");
