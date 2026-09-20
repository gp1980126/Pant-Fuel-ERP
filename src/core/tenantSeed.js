// Commercial tenant seed — Phase 13 multi-tenancy.
// A NEW tenant (petrol pump) starts from this blank, neutral shape.
// It deliberately contains NO station data: no rates, no stock, no parties,
// no users, no history. Per-tenant values are entered via the Opening Setup /
// User Management screens or seeded by the station-provision Edge Function.

export const TENANT_SEED_VERSION = "commercial-tenant-seed-v1";

// Keys mirror the shape initialData() consumes (see pumpDomain.js).
export function buildTenantSeed() {
  return {
    openingDate: null, // tenant sets its own opening date during onboarding
    openingStock: {},
    rates: { MS: 0, HSD: 0, CNG: 0 },
    rateHistory: [],
    sales: [],
    purchases: [],
    dailyPayments: [],
    paytmTotals: [],
    parties: [],
    credits: [],
    fillings: [],
    dipReadings: [],
    recoveries: [],
    ledgerPayments: [],
    ledgerOpenings: [],
    staff: [],
    attendance: [],
    electricityBills: [],
    electricityPayments: [],
    users: [],
    auditLogs: [],
    accountingLocks: { months: [] },
    cngStateTaxRate: 0.05,
  };
}
