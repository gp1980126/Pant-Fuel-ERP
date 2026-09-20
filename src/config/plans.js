// Commercial plan catalogue — Phase 13 groundwork (Phase 15 wires billing +
// server-side enforcement). Pricing follows the India tier-2/3 petrol-pump
// market scan of 2026-09-20 (cheap subscription + yearly advance discount +
// one-time option). Amounts in INR, GST extra.

export const PLAN_IDS = Object.freeze({
  TRIAL: "trial",
  BASIC: "basic",
  PRO: "pro",
  LIFETIME: "lifetime",
});

export const PLANS = Object.freeze({
  [PLAN_IDS.TRIAL]: {
    id: PLAN_IDS.TRIAL,
    label: "Trial (30 दिन)",
    monthlyInr: 0,
    yearlyInr: 0,
    trialDays: 30,
  },
  [PLAN_IDS.BASIC]: {
    id: PLAN_IDS.BASIC,
    label: "Basic",
    monthlyInr: 399,
    yearlyInr: 3999,
    onboardingInr: 4999,
  },
  [PLAN_IDS.PRO]: {
    id: PLAN_IDS.PRO,
    label: "Pro",
    monthlyInr: 799,
    yearlyInr: 7999,
    onboardingInr: 9999,
  },
  [PLAN_IDS.LIFETIME]: {
    id: PLAN_IDS.LIFETIME,
    label: "One-Time + AMC",
    oneTimeInr: 29999,
    amcYearlyInr: 4999,
  },
});

// Feature flags per plan. BASIC covers the daily counter workflow of a small
// pump; PRO adds back-office + controls; LIFETIME mirrors PRO.
export const PLAN_FEATURES = Object.freeze({
  [PLAN_IDS.TRIAL]:   ["saleEntry", "creditLedger", "dipStock", "staffElectricity", "reports", "periodLock", "tallyExport", "auditTrail", "userMgmt"],
  [PLAN_IDS.BASIC]:   ["saleEntry", "creditLedger", "dipStock"],
  [PLAN_IDS.PRO]:     ["saleEntry", "creditLedger", "dipStock", "staffElectricity", "reports", "periodLock", "tallyExport", "auditTrail", "userMgmt"],
  [PLAN_IDS.LIFETIME]: ["saleEntry", "creditLedger", "dipStock", "staffElectricity", "reports", "periodLock", "tallyExport", "auditTrail", "userMgmt"],
});

export const planAllows = (planId, feature) =>
  (PLAN_FEATURES[planId] || []).includes(feature);

// Subscription statuses a tenant record (sm_pumps/tenants) can carry.
// On non-payment the tenant is NOT locked out of their own records: the whole
// tenant is downgraded to the existing read-only "View Only" role until dues
// are cleared. Data is never deleted for billing reasons.
export const SUBSCRIPTION_STATUS = Object.freeze({
  ACTIVE: "active",
  TRIALING: "trialing",
  PAST_DUE: "past_due",
  LOCKED: "locked",
});

export const roleForSubscriptionStatus = status =>
  status === SUBSCRIPTION_STATUS.LOCKED ? "View Only" : null;

export const isSubscriptionUsable = status =>
  status === SUBSCRIPTION_STATUS.ACTIVE ||
  status === SUBSCRIPTION_STATUS.TRIALING ||
  status === SUBSCRIPTION_STATUS.PAST_DUE;
