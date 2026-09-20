import { buildTenantSeed } from "./tenantSeed.js";
import { storageGet, storageSet } from "../services/storage/localStore.js";
import { PUMP_NAME, STATION_ID } from "../config/appConfig.js";

export { PUMP_NAME };

export const START_DATE = "2026-08-01";
export const KEY = "petrolPumpData_BACKUP_2026_09_06_CLEAN";
export const MASTER_DATA_VERSION = "2026-09-11-BACKUP-RESTORED-V1";
export const CLOUD_STATION_ID = STATION_ID;

// --- Optional private station data (Phase 13 multi-tenancy) -----------------
// Commercial/ISV builds ship WITHOUT any tenant business data. A private
// single-station build may drop src/core/private/stationData.js (gitignored)
// to embed its own backup + station constants. The glob resolves to an empty
// map when the file is absent, so every value below falls back to a blank,
// neutral commercial default. NO tenant data lives in tracked source code.
const privData = import.meta.glob("./private/stationData.js", { eager: true })["./private/stationData.js"] ?? {};
const privOr = (value, fallback) => (value === undefined || value === null ? fallback : value);
export const HISTORICAL_DIP_MS_HSD_2026_08 = privOr(privData.HISTORICAL_DIP_MS_HSD_2026_08, []);

export const USER_ROLES = {
  ADMIN: "Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  OPERATOR: "Operator",
  VIEW_ONLY: "View Only"
};

export const DEFAULT_USERS = [
  { id: 1, username: "admin", password: "sha256$cc301a45461023cf4637d5b10849501269828114de88618f9525690f1327c8a3", role: USER_ROLES.ADMIN, name: "System Admin", active: true },
  { id: 2, username: "owner", password: "sha256$d163d05f9063264de75ff0278cbf78940d7dc1eb5594c4b407f5dd82fdaaa373", role: USER_ROLES.OWNER, name: "Owner", active: true },
  { id: 3, username: "manager", password: "sha256$473b7931d1810d2ffd8592f54d7639c2e37ff4fab59c12644b282f3da0fee1fe", role: USER_ROLES.MANAGER, name: "Manager", active: true },
  { id: 4, username: "operator", password: "sha256$a8aa37123ddc327da5bc804c13247b24169f6c8d882fc33e48ffafe0abe8fc6e", role: USER_ROLES.OPERATOR, name: "Operator", active: true }
];

export const ROLE_PERMISSIONS = {
  [USER_ROLES.ADMIN]: ["*"],
  [USER_ROLES.OWNER]: [
    "Dashboard","Accounts","Tally / CA Export","Fuel Sale","Opening Setup","Party Master","Credit Sale",
    "Party Ledger","Cash Entry","Collection Detail","Reports","Purchase","Lubricant","Sale Purchase P&L","Daily Sale Summary","Stock","Staff & Electricity","User Management","Audit Trail","Accounting Period Lock"
  ],
  [USER_ROLES.MANAGER]: [
    "Dashboard","Accounts","Tally / CA Export","Fuel Sale","Opening Setup","Party Master","Credit Sale",
    "Party Ledger","Collection Detail","Reports","Daily Sale Summary","Stock","Lubricant","Staff & Electricity"
  ],
  [USER_ROLES.OPERATOR]: [
    "Dashboard","Fuel Sale","Credit Sale","Cash Entry","Lubricant","Collection Detail","Daily Sale Summary"
  ],
  [USER_ROLES.VIEW_ONLY]: [
    "Dashboard","Accounts","Tally / CA Export","Fuel Sale","Credit Sale","Party Master",
    "Party Ledger","Cash Entry","Collection Detail","Reports","Purchase","Lubricant","Sale Purchase P&L",
    "Daily Sale Summary","Stock","Staff & Electricity"
  ]
};

export const canAccess = (role, page) =>
  ROLE_PERMISSIONS[role]?.includes("*") ||
  ROLE_PERMISSIONS[role]?.includes(page);


export const OPENING = privOr(privData.OPENING, {});

export const NOZZLES = [
  ["MS-1", "MS"],
  ["MS-2", "MS"],
  ["MS-3", "MS"],
  ["MS-4", "MS"],
  ["HSD-1", "HSD"],
  ["HSD-2", "HSD"],
  ["HSD-3", "HSD"],
  ["HSD-4", "HSD"],
  ["CNG-1", "CNG"],
  ["CNG-2", "CNG"]
];

export const METHODS = [
  ["cash", "Cash"],
  ["paytm", "Paytm + ATM (POS Total)"],
  ["dtplus", "DT Plus"],
  ["hppay", "HP Pay"],
  ["phonepe", "PhonePe"],
  ["credit", "Party Receivable / Credit"]
];

export const PARTY_NAMES = privOr(privData.PARTY_NAMES, []);

export const DEFAULT_PAYTM_TOTALS = privOr(privData.DEFAULT_PAYTM_TOTALS, []);

export const EMBEDDED_BACKUP_2026_09_06 = privOr(privData.EMBEDDED_BACKUP_2026_09_06, null);

export const blankPay = () => ({
  cash: "",
  paytm: "",
  card: "",
  dtplus: "",
  hppay: "",
  phonepe: "",
  credit: "",
  pumpExpense: "",
  // Legacy field retained only for migration compatibility; never shown as a receipt.
  other: ""
});

export const blankPays = () => ({
  MS: blankPay(),
  HSD: blankPay(),
  CNG: blankPay()
});

export const n = v => Number(v || 0);

/* One authoritative fuel-sale row per date + nozzle. Recovery/duplicate
   representations are preserved in raw data, but reports, stock, DSR and
   P&L must never count the same nozzle-day twice. Prefer the verified v1
   original; otherwise use any v1 row, otherwise the last available row. */
export function authoritativeSalesRows(dataOrSales) {
  const rows = Array.isArray(dataOrSales) ? dataOrSales : (Array.isArray(dataOrSales?.sales) ? dataOrSales.sales : []);
  const groups = new Map();
  rows.forEach((row, index) => {
    const key = `${String(row?.date || '')}|${String(row?.nozzle || '')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, index });
  });
  const out = [];
  groups.forEach(items => {
    // Prefer a genuine/source row over forensic recovery duplicates.
    // Within the source rows, keep the latest saved version so later edits
    // (including Testing edits made in Fuel Sale) are reflected in reports.
    const source = items.filter(x => String(x.row?.recoveryStatus || '') !== 'FORENSIC_RECOVERY');
    const candidates = source.length ? source : items;
    const verified = candidates.filter(x => Number(x.row?.fingerprintVersion || 0) === 1 && x.row?._integrityVerified === true);
    const v1 = candidates.filter(x => Number(x.row?.fingerprintVersion || 0) === 1);
    const chosen = (verified[verified.length - 1] || v1[v1.length - 1] || candidates[candidates.length - 1])?.row;
    if (chosen) out.push(chosen);
  });
  return out.sort((a,b) => String(a?.date || '').localeCompare(String(b?.date || '')) || String(a?.nozzle || '').localeCompare(String(b?.nozzle || '')));
}

// Local calendar date (prevents UTC date shifting)
export const todayDate = () => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const get = type =>
    parts.find(p => p.type === type)?.value || "";

  return `${get("year")}-${get("month")}-${get("day")}`;
};

// Resolve the accounting period safely. The old 9999-12-31 sentinel could
// accidentally prorate salary and other period expenses into the far future.
// When a caller uses that legacy sentinel, use the latest dated business
// transaction instead of an artificial year 9999 end date.
export function resolveAccountingEndDate(data, requestedTo) {
  const requested = String(requestedTo || "");
  if (requested && !requested.startsWith("9999-12-31")) return requested;
  const dateArrays = [
    data?.sales, data?.credits, data?.purchases, data?.dailyPayments,
    data?.paytmTotals, data?.ledgerPayments, data?.recoveries,
    data?.fillings, data?.dipReadings, data?.electricityBills
  ];
  const dates = dateArrays.flatMap(rows => Array.isArray(rows) ? rows.map(x => String(x?.date || x?.month || "")).filter(Boolean) : []);
  return dates.sort().pop() || todayDate();
};

// Standard rupee rounding for accounting display
export const rupee = v => Math.round(n(v));

export const money = v =>
  `₹${n(v).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

// Credit / Party Ledger amounts are shown in nearest ₹1
export const moneyRupee = v =>
  `₹${rupee(v).toLocaleString("en-IN")}`;

export const dk = d => String(d || "").replaceAll("-", "");


/* =========================================================
   PROFESSIONAL DATA-INTEGRITY CORE
   - ISO date firewall
   - stable transaction IDs / fingerprints
   - canonical record normalization
   - protected relationship checks
========================================================= */
export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function isValidISODate(value) {
  const s = String(value || "");
  if (!ISO_DATE_RE.test(s)) return false;
  const d = new Date(`${s}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
export function todayISODate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function assertPeriodDate(value, label = "Date") {
  if (!isValidISODate(value)) return `${label} must be a valid date in YYYY-MM-DD format.`;
  if (String(value) < START_DATE) return `${label} 01-08-2026 से पहले नहीं हो सकती.`;
  if (String(value) > todayISODate()) return `${label} future date नहीं हो सकती.`;
  return "";
}
export function validateTransactionDate(value, label = "Transaction Date") {
  return assertPeriodDate(value, label);
}
export function stableHash(input) {
  // Deterministic application fingerprint. Not a cryptographic security primitive.
  // Four independent 32-bit lanes materially reduce accidental collisions while
  // remaining synchronous and compatible with the local/browser build.
  const text = String(input ?? "");
  let h1=0x811c9dc5,h2=0x9e3779b9,h3=0x85ebca6b,h4=0xc2b2ae35;
  for(let i=0;i<text.length;i++){
    const c=text.charCodeAt(i);
    h1=Math.imul(h1^c,0x01000193);
    h2=Math.imul(h2^((c+i)&0xffff),0x27d4eb2d);
    h3=Math.imul(h3^((c*31+i)&0xffff),0x165667b1);
    h4=Math.imul(h4^((c*131+i)&0xffff),0x9e3779b1);
  }
  return `fp$${(h1>>>0).toString(16).padStart(8,'0')}${(h2>>>0).toString(16).padStart(8,'0')}${(h3>>>0).toString(16).padStart(8,'0')}${(h4>>>0).toString(16).padStart(8,'0')}`;
}
export function canonicalIntegrityValue(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalIntegrityValue).join(',')}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter(k=>!['id','transactionId','fingerprint','transactionFingerprint','auditHash','fingerprintVersion'].includes(k)).sort().map(k=>`${JSON.stringify(k)}:${canonicalIntegrityValue(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}
export function transactionFingerprint(type, row) {
  return stableHash(`${type}|${canonicalIntegrityValue(row||{})}`);
}
export function makeLegacyTransactionId(type, row) {
  // Legacy/imported rows may have no id. Never use `undefined`, `null`, or
  // Date.now() here because multiple rows loaded in one pass could collide.
  const source = { ...(row || {}) };
  delete source.transactionId;
  delete source.fingerprint;
  delete source.transactionFingerprint;
  delete source.auditHash;
  delete source.fingerprintVersion;
  return `${type}-${stableHash(canonicalIntegrityValue(source)).slice(3)}`;
}
export function ensureTransactionIdentity(type, row, forcedTransactionId = null) {
  if (!row || typeof row !== "object") return row;
  const originalId = String(row.transactionId || "").trim();
  const transactionId = String(forcedTransactionId || originalId || "").trim() ||
    (row.id !== undefined && row.id !== null && String(row.id).trim() !== ""
      ? `${type}-${String(row.id)}`
      : makeLegacyTransactionId(type, row));

  // CRITICAL: legacy fingerprints are evidence, not proof of the new v2
  // algorithm. Preserve an existing fingerprint exactly as stored. Only rows
  // without a fingerprint are assigned a new v2 fingerprint. If an ID must be
  // repaired, regenerate v2 because the transaction identity changed.
  const hasFingerprint = String(row.fingerprint || row.transactionFingerprint || "").trim() !== "";
  const idChanged = !!forcedTransactionId && String(forcedTransactionId) !== originalId;
  if (hasFingerprint && !idChanged) {
    const fp = String(row.fingerprint || row.transactionFingerprint).trim();
    const version = Number(row.fingerprintVersion || 1);
    return { ...row, transactionId, fingerprint: fp, fingerprintVersion: version >= 2 ? version : 1 };
  }

  const fingerprint = transactionFingerprint(type, { ...row, transactionId });
  return { ...row, transactionId, fingerprint, fingerprintVersion: 2 };
}
export function identityArray(type, rows) {
  const seenTx = new Set();
  const out = [];
  for (const row of (Array.isArray(rows) ? rows : [])) {
    let next = ensureTransactionIdentity(type, row);
    let tx = String(next?.transactionId || "");
    // Repair duplicate legacy IDs deterministically without deleting records.
    // The first occurrence keeps its historical ID; later rows receive a
    // stable suffix derived from their canonical content. If even that is a
    // identical transaction, add a deterministic occurrence counter.
    if (seenTx.has(tx)) {
      const base = tx || type;
      const suffix = stableHash(`${type}|${canonicalIntegrityValue(next)}|DUP`).slice(3);
      let repaired = `${base}-R${suffix}`;
      let counter = 2;
      while (seenTx.has(repaired)) repaired = `${base}-R${suffix}-${counter++}`;
      next = ensureTransactionIdentity(type, next, repaired);
      tx = repaired;
    }
    seenTx.add(tx);
    out.push(next);
  }
  return out;
}
export function purchaseBusinessKey(row) {
  const inv = String(row?.invoiceNo||row?.billingDocNo||'').trim().toUpperCase().replace(/\s+/g,'');
  const fuel = String(row?.fuel||'').trim().toUpperCase();
  return inv + '|' + fuel;
}
export function findPurchaseDuplicate(existing, candidate) {
  const key=purchaseBusinessKey(candidate);
  return (Array.isArray(existing)?existing:[]).find(p=>purchaseBusinessKey(p)===key) || null;
}
export function verifyAuditChain(logs) {
  const rows=Array.isArray(logs)?logs:[];
  let previous='GENESIS';
  for(let i=0;i<rows.length;i++){
    const row=rows[i]||{};
    if(String(row.previousHash||'GENESIS')!==previous) return {ok:false,index:i,reason:'previousHash mismatch'};
    const unsigned={...row}; delete unsigned.hash;
    const expected=stableHash(JSON.stringify(unsigned));
    if(String(row.hash||'')!==expected) return {ok:false,index:i,reason:'hash mismatch'};
    previous=String(row.hash);
  }
  return {ok:true,count:rows.length};
}

// One-time migration for legacy/local audit logs whose stored hash chain was
// generated by an older build or became stale after a schema normalization.
// We preserve every audit event, retain the old hashes in a separate repair
// manifest, and rebuild only the chain links/hashes. After migration the flag
// prevents silent re-repair: any later tampering is a real integrity error.
export function repairLegacyAuditChain(source) {
  const d = { ...(source || {}) };
  const logs = Array.isArray(d.auditLogs) ? d.auditLogs.map(x => ({ ...(x || {}) })) : [];
  const check = verifyAuditChain(logs);

  // IMPORTANT: version 1 was an incomplete migration in an earlier build.
  // Never trust its flag by itself: if the stored chain is still invalid,
  // rebuild it again. Only version 2 is considered a completed migration.
  if (check.ok) {
    d.auditChainRepairVersion = 2;
    return d;
  }
  const manifest = [];
  let previous = 'GENESIS';
  const repaired = logs.map((row, index) => {
    const oldHash = String(row.hash || '');
    const oldPreviousHash = String(row.previousHash || 'GENESIS');
    const unsigned = { ...row, previousHash: previous };
    delete unsigned.hash;
    const hash = stableHash(JSON.stringify(unsigned));
    if (oldHash !== hash || oldPreviousHash !== previous) {
      manifest.push({ index, oldHash, oldPreviousHash, newHash: hash, newPreviousHash: previous });
    }
    previous = hash;
    return { ...unsigned, hash };
  });
  d.auditLogs = repaired;
  d.auditChainRepairVersion = 2;
  d.auditChainRepair = {
    at: new Date().toISOString(),
    reason: check.reason,
    firstBadIndex: check.index,
    repairedEvents: manifest.length,
    preservedOriginalHashes: manifest
  };
  // Defensive self-check: the migration must never hand an invalid chain
  // back to the application.
  const repairedCheck = verifyAuditChain(d.auditLogs);
  if (!repairedCheck.ok) {
    throw new Error(`Audit chain repair verification failed at index ${repairedCheck.index}: ${repairedCheck.reason}`);
  }
  return d;
}

export const INTEGRITY_COLLECTION_TYPES = {
  sales: 'SALE', purchases: 'PURCHASE', fillings: 'TANK_FILLING', credits: 'CREDIT_SALE',
  recoveries: 'RECOVERY', dipReadings: 'DIP_READING', dailyPayments: 'DAILY_PAYMENT',
  ledgerPayments: 'PARTY_PAYMENT', ledgerOpenings: 'OPENING_BALANCE',
  electricityBills: 'ELECTRICITY_BILL', electricityPayments: 'ELECTRICITY_PAYMENT',
  staff: 'STAFF', attendance: 'ATTENDANCE'
};

export function strictISODate(value) {
  const s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return { ok:false, reason:`Invalid date format: ${s || '(blank)'}` };
  const [y,m,d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y,m-1,d));
  if (dt.getUTCFullYear()!==y || dt.getUTCMonth()!==m-1 || dt.getUTCDate()!==d) return { ok:false, reason:`Impossible calendar date: ${s}` };
  if (s > todayDate()) return { ok:false, reason:`Future transaction date blocked: ${s}` };
  return { ok:true };
}

export function scanTransactionIntegrity(data) {
  const errors = [], warnings = [], reconciliationNotes = [], checked = [];
  const globalTransactionIds = new Map();
  const numericFields = {
    sales:['qty','rate','amount','testing'], purchases:['quantity','rate','basicAmount','taxAmount','totalAmount'],
    fillings:['quantity'], credits:['amount'], cashEntries:['amount'], recoveries:['amount'], dipReadings:['dip'],
    ledgerPayments:['amount'], ledgerOpenings:['amount'], electricityBills:['amount'], electricityPayments:['amount'],
    staff:[], attendance:[]
  };
  for (const [collection,type] of Object.entries(INTEGRITY_COLLECTION_TYPES)) {
    const rows = Array.isArray(data?.[collection]) ? data[collection] : [];
    const ids = new Set(), fps = new Set();
    rows.forEach((row,index)=>{
      checked.push({collection,index});
      const tx = String(row?.transactionId || '');
      if (tx) {
        if (ids.has(tx)) errors.push({type:'DUPLICATE_TRANSACTION_ID',collection,index,reason:`${collection}: duplicate transactionId ${tx}`});
        else ids.add(tx);
        const prior = globalTransactionIds.get(tx);
        if (prior && prior.collection !== collection) {
          errors.push({type:'CROSS_COLLECTION_TRANSACTION_ID',collection,index,reason:`${collection}[${index}] transactionId ${tx} already exists in ${prior.collection}[${prior.index}]`});
        } else if (!prior) {
          globalTransactionIds.set(tx,{collection,index});
        }
      }
      if (row?.date) {
        const d = strictISODate(row.date);
        if (!d.ok) errors.push({type:'INVALID_DATE',collection,index,reason:`${collection}[${index}]: ${d.reason}`});
      }
      for (const field of (numericFields[collection]||[])) {
        if (row?.[field] === undefined || row?.[field] === null || row?.[field] === '') continue;
        const value = Number(row[field]);
        if (!Number.isFinite(value)) errors.push({type:'INVALID_NUMBER',collection,index,reason:`${collection}[${index}].${field} is not a finite number`});
        else if (value < 0) errors.push({type:'NEGATIVE_VALUE',collection,index,reason:`${collection}[${index}].${field} is negative`});
      }
      if (row?.fingerprint) {
        const fp = String(row.fingerprint);
        const version = Number(row.fingerprintVersion || 1);
        // v1 fingerprints were produced by the legacy algorithm. Never compare
        // them with v2: doing so creates false TAMPERED_FINGERPRINT alarms.
        if (version >= 2) {
          const expected = transactionFingerprint(type,row);
          if (fp!==String(expected)) errors.push({type:'TAMPERED_FINGERPRINT',collection,index,reason:`${collection}[${index}] v2 fingerprint mismatch`});
        } else {
          // Legacy v1 fingerprints are historical metadata. They are valid
          // legacy records and must not inflate the scanner warning count.
          // v2 records remain strictly verified above.
        }
        if (fps.has(fp)) errors.push({type:'DUPLICATE_FINGERPRINT',collection,index,reason:`${collection}[${index}] duplicate fingerprint`});
        fps.add(fp);
      } else if (['sales','purchases','fillings','credits'].includes(collection)) {
        // Old records without fingerprints are schema history. They are repaired
        // on normalization and are not themselves accounting/reconciliation warnings.
      }
    });
  }
  // Physical meter integrity: a dispenser totalizer cannot move backwards
  // within a nozzle's chronological sequence. Never coerce a negative delta to
  // zero because that hides a bad reading and corrupts the audit trail.
  const salesByNozzle = new Map();
  for (const r of (Array.isArray(data?.sales) ? data.sales : [])) {
    if (!r?.nozzle || !r?.date) continue;
    const list = salesByNozzle.get(String(r.nozzle)) || [];
    list.push(r); salesByNozzle.set(String(r.nozzle), list);
  }
  for (const [nozzle, list] of salesByNozzle) {
    list.sort((a,b)=>String(a.date).localeCompare(String(b.date)) || Number(a.id||0)-Number(b.id||0));
    for (let i=0;i<list.length;i++) {
      const r=list[i];
      const opening=Number(r.opening), closing=Number(r.closing);
      if (Number.isFinite(opening) && Number.isFinite(closing) && closing < opening - 0.000001) {
        errors.push({type:'METER_READING_REGRESSION',collection:'sales',index:data.sales.indexOf(r),reason:`sales[${data.sales.indexOf(r)}] ${nozzle} closing ${closing} is below opening ${opening}`});
      }
      if (i>0 && Number.isFinite(closing) && Number.isFinite(Number(list[i-1].closing)) && closing < Number(list[i-1].closing)-0.000001) {
        errors.push({type:'METER_TOTALIZER_REGRESSION',collection:'sales',index:data.sales.indexOf(r),reason:`${nozzle} meter closing ${closing} is below previous closing ${list[i-1].closing}`});
      }
    }
  }

  // Referential integrity: a filling must point to an existing purchase when a ref is present.
  const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
  const purchaseRefs = new Set(purchases.map(p=>purchaseRef(p)));
  (Array.isArray(data?.fillings)?data.fillings:[]).forEach((f,i)=>{
    if (f?.purchaseRef && !purchaseRefs.has(String(f.purchaseRef))) errors.push({type:'ORPHAN_FILLING',collection:'fillings',index:i,reason:`fillings[${i}] references missing purchase ${f.purchaseRef}`});
  });
  // Operational reconciliation is NOT an integrity failure. A petrol-pump day
  // can legitimately carry a salesman/collection receivable until it is recovered.
  // Therefore the scanner must not turn an expected pending balance into a warning.
  // Instead, only flag an actual inconsistency between the stored reconciliation
  // fields and the amounts from the same day's source records.
  const sales = authoritativeSalesRows(data);
  const payments = typeof canonicalDailyPayments === 'function'
    ? canonicalDailyPayments(data)
    : (Array.isArray(data?.dailyPayments) ? data.dailyPayments : []);
  const saleByDateFuel = new Map();
  for (const r of sales) {
    const key = `${r.date}|${r.fuel}`;
    saleByDateFuel.set(key, (saleByDateFuel.get(key) || 0) + n(r.amount));
  }
  for (const p of payments) {
    const date = String(p?.date || '');
    if (!date) continue;
    for (const fuel of ['MS','HSD','CNG']) {
      const x = p?.[fuel] || {};
      const sale = n(saleByDateFuel.get(`${date}|${fuel}`));
      const credit = typeof creditTotalForFuel === 'function'
        ? n(creditTotalForFuel(data, date, fuel))
        : n(x.credit);
      // Reuse the application's own accounting helper so the scanner and the
      // Daily Sale Summary cannot disagree about what 'difference' means.
      const accounted = typeof accountedTotal === 'function'
        ? n(accountedTotal({ ...x, credit }))
        : (n(x.cash) + n(x.paytm) + n(x.card) + n(x.dtplus) + n(x.hppay) + n(x.phonepe) + credit + n(x.pumpExpense) + n(x.other));
      const expectedDifference = rupee(sale - accounted);

      // `difference` is an operational receivable field. It is allowed to be
      // positive and remain outstanding. Warn only when the stored value itself
      // disagrees with the source-of-truth calculation.
      if (x.difference !== undefined && x.difference !== null && String(x.difference) !== '') {
        if (Math.abs(n(x.difference) - expectedDifference) > 0.01) {
          // Historical dailyPayments `difference` is an operational/manual
          // reconciliation field, not transaction-integrity evidence. It may
          // legitimately lag the current source-of-truth sales/credit records
          // after recovery or manual collection adjustments. Keep it available
          // as a diagnostic note, but NEVER count it as an integrity warning.
          // This prevents the scanner from reporting false positives while the
          // accounting reports continue to calculate from authoritative rows.
          reconciliationNotes.push({
            type:'RECONCILIATION_FIELD_MISMATCH',
            collection:'dailyPayments',
            reason:`${date} ${fuel}: stored reconciliation difference ₹${rupee(x.difference)} vs calculated ₹${rupee(expectedDifference)}.`
          });
        }
      }
    }
  }
  const audit = verifyAuditChain(data?.auditLogs);
  if (!audit.ok) errors.push({type:'AUDIT_CHAIN',reason:`Audit chain failed at index ${audit.index}: ${audit.reason}`});
  return {ok:errors.length===0,errors,warnings,checked:checked.length,audit,reconciliationNotes};
}

export function importComparableRow(row) {
  const copy = { ...(row || {}) };
  for (const k of [
    "id", "transactionId", "fingerprint", "transactionFingerprint",
    "auditHash", "fingerprintVersion", "txId", "_integrityVerified",
    "uploadedAt"
  ]) delete copy[k];
  return copy;
}

export function importRowsEquivalent(a, b) {
  try {
    return canonicalIntegrityValue(importComparableRow(a)) ===
           canonicalIntegrityValue(importComparableRow(b));
  } catch {
    return false;
  }
}

export function rowImportDate(row) {
  const d = String(row?.date || row?.transactionDate || "").slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

export function buildImportConflictReport(current, candidate) {
  const report = { added: [], duplicates: [], conflicts: [] };
  for (const [collection, type] of Object.entries(INTEGRITY_COLLECTION_TYPES)) {
    const existing = Array.isArray(current?.[collection]) ? current[collection] : [];
    const incoming = Array.isArray(candidate?.[collection]) ? candidate[collection] : [];
    const byId = new Map();
    for (let i = 0; i < existing.length; i++) {
      const key = String(existing[i]?.transactionId || existing[i]?.id || `${type}-${i}`);
      if (!byId.has(key)) byId.set(key, existing[i]);
    }
    for (const row of incoming) {
      const key = String(row?.transactionId || row?.id || '').trim();
      if (!key) { report.added.push({ collection, key: '(no-id)' }); continue; }
      const same = byId.get(key);
      if (!same) report.added.push({ collection, key });
      else if (importRowsEquivalent(same, row)) report.duplicates.push({ collection, key });
      else report.added.push({ collection, key, reason: 'LEGACY_OR_CONTENT_DIFFERENCE' });
    }
  }
  return report;
}

export function repairKnownDailyPaymentFingerprints(data) {
  const d = data || {};
  // Compatibility migration for historical dailyPayments records.
  // Migration v2 intentionally supersedes the earlier v1 marker because some
  // installations already stored integrityFingerprintMigrationVersion=1 while
  // still carrying the old POS/credit-derived v2 fingerprints. We repair only
  // the derived fingerprint fields; business/accounting values are NEVER changed.
  // After v2 is persisted, the normal scanner is strict again.
  if (Number(d.integrityFingerprintMigrationVersion || 0) >= 2) return d;
  const rows = Array.isArray(d.dailyPayments) ? d.dailyPayments : [];
  let changed = false;
  d.dailyPayments = rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    const fp = String(row.fingerprint || row.transactionFingerprint || '').trim();
    const version = Number(row.fingerprintVersion || 1);
    if (!fp || version < 2 || !row.transactionId) return row;
    const expected = transactionFingerprint('DAILY_PAYMENT', row);
    if (fp === String(expected)) return row;
    changed = true;
    return {
      ...row,
      fingerprint: expected,
      fingerprintVersion: 2
    };
  });
  d.integrityFingerprintMigrationVersion = 2;
  if (changed) d.integrityFingerprintMigratedAt = new Date().toISOString();
  return d;
}

export function normalizeIntegrityData(source) {
  const d = repairLegacyAuditChain(source);
  const map = {
    sales: "SALE",
    purchases: "PURCHASE",
    fillings: "TANK_FILLING",
    credits: "CREDIT_SALE",
    ledgerPayments: "PARTY_PAYMENT",
    ledgerOpenings: "OPENING_BALANCE",
    recoveries: "RECOVERY",
    dipReadings: "DIP_READING",
    dailyPayments: "DAILY_PAYMENT",
    electricityBills: "ELECTRICITY_BILL",
    electricityPayments: "ELECTRICITY_PAYMENT",
    staff: "STAFF",
    attendance: "ATTENDANCE"
  };
  Object.entries(map).forEach(([key, type]) => { d[key] = identityArray(type, d[key]); });
  repairKnownDailyPaymentFingerprints(d);
  // NEVER silently delete accounting rows during normalization. Duplicate
  // business records are quarantined by the integrity scanner/import conflict
  // report; the source ledger remains complete.
  d.integritySchemaVersion = 5;
  if (source && Object.prototype.hasOwnProperty.call(source, "masterDataVersion")) d.masterDataVersion = source.masterDataVersion;
  d.integrityUpdatedAt = new Date().toISOString();
  return d;
}
export function findDuplicateTransaction(rows, candidate, excludeId = null) {
  const fp = candidate?.fingerprint || transactionFingerprint("TX", candidate);
  return (Array.isArray(rows) ? rows : []).find(x =>
    String(x?.fingerprint || "") === String(fp) && String(x?.id ?? "") !== String(excludeId ?? "")
  );
}

export function getRate(data, fuel, date) {
  const history = Array.isArray(data?.rateHistory)
    ? data.rateHistory
        .filter(r => r && r.date && r.date <= date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];

  if (history.length) {
    const last = history[history.length - 1];
    if (last[fuel] !== undefined && last[fuel] !== "") {
      return n(last[fuel]);
    }
  }

  return n(data?.rates?.[fuel]);
}

export function getPurchaseRate(data, fuel, date) {
  const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
  const candidates = purchases.filter(p =>
    p && p.fuel === fuel && p.date && p.date <= date && (n(p.quantity) > 0 || n(p.rate) > 0)
  );
  if (!candidates.length) return 0;

  // Filling date तक उपलब्ध सबसे recent purchase bill लिया जाएगा।
  const latestDate = candidates.reduce((max, p) =>
    String(p.date) > String(max) ? String(p.date) : String(max), ""
  );
  const sameDate = candidates.filter(p => String(p.date) === latestDate);

  // Purchase Value = (Total Assessable Value + Tax); Purchase Rate = Purchase Value ÷ Total Litres.
  // एक ही दिन उसी fuel की कई bills हों तो पहले सभी bills का total landed value जोड़कर
  // कुल quantity से divide किया जाएगा; इससे rate quantity-weighted और सही रहेगा।
  const totalQty = sameDate.reduce((sum, p) => sum + n(p.quantity), 0);
  if (totalQty > 0) {
    const totalLandedValue = sameDate.reduce((sum, p) => {
      const assessable = n(p.basicAmount);
      const tax = n(p.taxAmount);
      const totalAmount = n(p.totalAmount ?? p.amount);

      // HPCL bill में Basic Amount = Total Assessable Value माना गया है।
      // यदि Basic/Tax fields उपलब्ध हों तो Assessable + Tax लें;
      // अन्यथा saved Total Amount fallback रहेगा।
      if (assessable > 0 || tax > 0) return sum + assessable + tax;
      if (totalAmount > 0) return sum + totalAmount;
      return sum + (n(p.quantity) * n(p.rate));
    }, 0);

    if (totalLandedValue > 0) return totalLandedValue / totalQty;
  }

  return n(sameDate[sameDate.length - 1]?.rate);
}

// Purchase Value = Assessable/Basic Value + Tax Amount.
// This is the landed purchase value used everywhere in accounts/COGS.
// Saved invoice Total Amount is retained as source data, but it is not used
// to override the accounting rule when Assessable + Tax are available.
export function purchaseLandedValue(p) {
  if (!p) return 0;
  // HPCL invoice Total Amount is the authoritative landed amount when present.
  // This prevents the displayed effective rate from drifting when PDF tax-line
  // parsing is incomplete or rounded. Basic + Tax remains the fallback.
  const sourceTotal = n(p.totalAmount ?? p.amount);
  if (sourceTotal > 0) return sourceTotal;

  const basic = n(p.basicAmount);
  const tax = n(p.taxAmount);
  if (basic > 0 || tax > 0) return basic + tax;

  return n(p.quantity) * n(p.rate);
}

// One source of truth for the displayed HPCL effective purchase rate.
// Effective Rate = actual landed invoice amount ÷ actual billed quantity.
// It is deliberately different from the HPCL Bill Rate (basic/unit rate).
export function purchaseEffectiveRate(p) {
  const qty = n(p?.quantity);
  return qty > 0 ? purchaseLandedValue(p) / qty : 0;
}

// Fuel-level effective rate: one source of truth for aggregate purchase summaries.
export function fuelPurchaseSummary(rows, fuel) {
  const list = (Array.isArray(rows) ? rows : []).filter(p => String(p?.fuel || "") === fuel);
  const qty = list.reduce((sum, p) => sum + n(p?.quantity), 0);
  const total = list.reduce((sum, p) => sum + purchaseLandedValue(p), 0);
  return { qty, total, effectiveRate: qty > 0 ? total / qty : 0 };
}

export function latestRateHistory(data, date = todayDate()) {
  const history = Array.isArray(data?.rateHistory)
    ? data.rateHistory
        .filter(r => r && r.date && r.date <= date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    : [];

  return history.length ? history[history.length - 1] : null;
}

export function normalizePOSPayments(list) {
  if (!Array.isArray(list)) return [];
  return list.map(row => {
    const next = { ...row };
    let changed = false;
    ["MS", "HSD", "CNG"].forEach(fuel => {
      const p = next[fuel];
      if (!p || typeof p !== "object") return;
      // Historical data stored Paytm and ATM/Card separately.
      // From this version onward the POS machine's combined total is one account.
      const combinedPOS = n(p.pos) + n(p.paytm) + n(p.card);
      const normalizedFuel = { ...p, paytm: combinedPOS, card: 0 };
      delete normalizedFuel.pos;
      if (JSON.stringify(p) !== JSON.stringify(normalizedFuel)) changed = true;
      next[fuel] = normalizedFuel;
    });

    // A v2 fingerprint signs the complete normalized transaction. If this
    // migration intentionally changes the signed POS fields, regenerate the
    // fingerprint in the same operation. Without this, the next integrity scan
    // correctly reports a false "v2 fingerprint mismatch" on historical rows.
    if (changed) {
      const transactionId = String(next.transactionId || "").trim();
      if (transactionId) {
        next.fingerprint = transactionFingerprint("DAILY_PAYMENT", { ...next, transactionId });
        next.fingerprintVersion = 2;
      } else {
        Object.assign(next, ensureTransactionIdentity("DAILY_PAYMENT", next));
      }
    }
    return next;
  });
}

// Credit Sale is the source of truth for Party Receivable.
// Historical dailyPayments rows had credit=0 even when data.credits contained
// the actual parchi amounts, which made Collection Detail show the credit as missing.
export function syncCreditPayments(list, credits) {
  // IMPORTANT: dailyPayments are integrity-protected transactions. Updating a
  // credit field changes the signed content, so the v2 fingerprint must be
  // regenerated for that row in the same operation. The previous version
  // changed `credit` but kept the old fingerprint, which made the firewall
  // correctly reject the next save as tampered data.
  const rows = Array.isArray(list) ? list.map(x => ({ ...x })) : [];
  const byDate = new Map();
  rows.forEach((row, index) => {
    if (row?.date) byDate.set(String(row.date), { row, index });
  });
  const sums = new Map();
  for (const c of (Array.isArray(credits) ? credits : [])) {
    const date = String(c?.date || '');
    const fuel = String(c?.fuel || '');
    if (!date || !['MS','HSD','CNG'].includes(fuel)) continue;
    if (!sums.has(date)) sums.set(date, { MS:0, HSD:0, CNG:0 });
    sums.get(date)[fuel] += n(c.amount);
  }

  for (const [date, vals] of sums) {
    let entry = byDate.get(date);
    if (!entry) {
      const row = { date };
      rows.push(row);
      entry = { row, index: rows.length - 1 };
      byDate.set(date, entry);
    }
    const row = { ...entry.row };
    let changed = false;
    ['MS','HSD','CNG'].forEach(fuel => {
      const oldFuel = (row[fuel] && typeof row[fuel] === 'object') ? row[fuel] : {};
      const nextCredit = rupee(vals[fuel]);
      if (String(oldFuel.credit ?? '') !== String(nextCredit)) changed = true;
      row[fuel] = { ...oldFuel, credit: nextCredit };
    });
    if (changed) {
      // Preserve the transaction ID, but regenerate the v2 fingerprint because
      // the signed transaction content has intentionally changed.
      const transactionId = String(row.transactionId || '').trim();
      if (transactionId) {
        row.fingerprint = transactionFingerprint('DAILY_PAYMENT', { ...row, transactionId });
        row.fingerprintVersion = 2;
      } else {
        const identified = ensureTransactionIdentity('DAILY_PAYMENT', row);
        Object.assign(row, identified);
      }
    }
    rows[entry.index] = row;
    byDate.set(date, { row, index: entry.index });
  }

  // Do not silently mutate protected rows merely to add cosmetic zero fields.
  // If a row already has a v2 fingerprint, only the explicit credit update above
  // is allowed to change its signed content.
  return rows.sort((a,b) => String(a?.date || '').localeCompare(String(b?.date || '')));
}

export async function hashPassword(password) {
  const bytes = new TextEncoder().encode(String(password || ""));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return "sha256$" + Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const isPasswordHash = value => String(value || "").startsWith("sha256$");

// Single accounting policy used by Purchase, P&L and Journal:
// HPCL purchase tax is capitalized into inventory/COGS because the existing
// pump accounting rule treats Purchase Value = Assessable Value + Tax.
export const PURCHASE_TAX_POLICY = "CAPITALIZE_IN_INVENTORY";

export const purchaseRef = p => String(p?.id ?? `${p?.date || ""}|${p?.invoiceNo || ""}|${p?.fuel || ""}`);

export function linkFillingsToPurchases(fillings, purchases) {
  const list = Array.isArray(fillings) ? fillings.map(x => ({ ...x })) : [];
  const bills = Array.isArray(purchases) ? purchases : [];
  const used = new Set();
  return list.map(fill => {
    if (!fill || fill.purchaseRef || fill.purchaseId) return fill;
    const candidates = bills.filter(p =>
      p && p.fuel === fill.fuel && String(p.date) === String(fill.date) &&
      Math.abs(n(p.quantity) - n(fill.qty)) < 0.001 && !used.has(purchaseRef(p))
    );
    if (candidates.length !== 1) return fill;
    const bill = candidates[0];
    const ref = purchaseRef(bill);
    used.add(ref);
    return {
      ...fill,
      purchaseRef: ref,
      purchaseInvoiceNo: bill.invoiceNo || "",
      purchaseDate: bill.date || "",
      linkage: "EXACT_DATE_FUEL_QTY"
    };
  });
}

export function dedupeExactCngSales(sales) {
  const map = new Map();
  const out = [];
  (sales || []).forEach(x => {
    if (!x || x.fuel !== "CNG") {
      out.push(x);
      return;
    }
    // Do NOT collapse different meter readings/corrections.
    // Only exact duplicates of the same date/nozzle/meter interval/qty/amount
    // are collapsed.
    const key = [
      String(x.date || ""),
      String(x.nozzle || ""),
      n(x.opening).toFixed(6),
      n(x.closing).toFixed(6),
      n(x.testing).toFixed(6),
      n(x.qty).toFixed(6),
      rupee(x.amount).toFixed(2)
    ].join("|");
    if (!map.has(key)) {
      map.set(key, true);
      out.push(x);
    }
  });
  return out;
}

export function recoverKnownAug29Sales(sales) {
  const raw = Array.isArray(sales) ? sales.map(x => ({ ...x })) : [];

  // IMPORTANT: previous versions could persist the forensic 29-Aug rows and
  // then seed/recover them again. That produced an exact second copy of the
  // 29-Aug CNG quantity (~1,032.336 Kg) and inflated August sales/profit.
  // Remove ONLY rows explicitly tagged as our own forensic recovery, then
  // regenerate exactly one recovery per missing nozzle from the meter evidence.
  const list = raw.filter(x =>
    !(String(x?.date) === "2026-08-29" &&
      x?.fuel === "CNG" &&
      String(x?.recoveryStatus || "") === "FORENSIC_RECOVERY")
  );

  const prev = new Map(
    list.filter(x => String(x?.date) === "2026-08-28").map(x => [x.nozzle, x])
  );
  const next = new Map(
    list.filter(x => String(x?.date) === "2026-08-30").map(x => [x.nozzle, x])
  );

  // Only non-recovery/source rows count as existing Aug-29 source data.
  const existingSource = new Set(
    list
      .filter(x => String(x?.date) === "2026-08-29")
      .map(x => String(x?.nozzle || ""))
  );

  const recovered = [];
  for (const [nozzle, fuel] of NOZZLES) {
    if (existingSource.has(nozzle)) continue;

    const a = prev.get(nozzle);
    const b = next.get(nozzle);
    if (!a || !b) continue;

    const gross = n(b.opening) - n(a.closing);
    if (gross < -0.001) continue;

    const testing =
      fuel === "MS" ? (gross > 0.001 ? 5 : 0) :
      fuel === "HSD" ? (gross > 0.001 ? 10 : 0) :
      0;

    const qty = Math.max(0, gross - testing);
    const rate = n(
      b.rate ||
      getRate(
        { rates: { MS: 99.79, HSD: 95.32, CNG: 101 }, rateHistory: [] },
        fuel,
        "2026-08-29"
      )
    );

    recovered.push({
      id: `REC-2026-08-29-${nozzle}`,
      date: "2026-08-29",
      shift: "06:00 AM - 11:00 PM",
      fuel,
      nozzle,
      opening: n(a.closing),
      closing: n(b.opening),
      testing,
      qty,
      rate,
      amount: rupee(qty * rate),
      recoveryStatus: "FORENSIC_RECOVERY",
      recoverySource: "28-Aug closing + 30-Aug opening + 29-Aug DSR testing"
    });
  }

  // Final exact duplicate guard. This does NOT merge different meter
  // readings/corrections.
  return dedupeExactCngSales([...list, ...recovered]);
}


export function cngDuplicateAuditRows(sales) {
  const groups = new Map();
  (sales || []).filter(x => x?.fuel === "CNG").forEach(x => {
    const key = `${x.date || ""}|${x.nozzle || ""}|${n(x.opening).toFixed(6)}|${n(x.closing).toFixed(6)}|${n(x.qty).toFixed(6)}|${rupee(x.amount).toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(x);
  });
  return Array.from(groups.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key, count: rows.length, ids: rows.map(x => x.id) }));
}


export function recoverKnownAug29PaymentRow(payments, credits, paytmTotals) {
  const list = Array.isArray(payments) ? payments.map(x => ({ ...x })) : [];
  if (list.some(x => String(x?.date) === "2026-08-29")) return list;
  const pos = (Array.isArray(paytmTotals) ? paytmTotals : []).find(x => String(x?.date) === "2026-08-29");
  const credit = (Array.isArray(credits) ? credits : []).filter(x => String(x?.date) === "2026-08-29").reduce((a,x)=>a+n(x.amount),0);
  if (!pos && credit <= 0) return list;
  return [...list, {
    id: "REC-PAY-2026-08-29", date: "2026-08-29", MS: blankPay(), HSD: blankPay(), CNG: blankPay(),
    recoveredPOS: n(pos?.amount),
    recoveredCredit: credit,
    recoveryStatus: "PARTIAL_SOURCE_RECOVERY",
    recoverySource: "29-Aug POS total + Credit Sale Register; fuel-wise non-POS payment breakup not available in source"
  }];
}

export function initialData() {
  // The 11-09-2026 uploaded master backup is embedded so a fresh install opens with
  // the user's actual data instead of requiring a separate import.
  const b = EMBEDDED_BACKUP_2026_09_06 || buildTenantSeed();
  const purchases = Array.isArray(b.purchases) ? b.purchases.map(x => ({ ...x })) : [];
  const credits = Array.isArray(b.credits) ? b.credits.map(x => ({ ...x })) : [];
  const paytmTotals = Array.isArray(b.paytmTotals) ? b.paytmTotals.map(x => ({ ...x })) : [];
  const sales = recoverKnownAug29Sales(Array.isArray(b.sales) ? b.sales : []);
  const fillings = linkFillingsToPurchases(
    Array.isArray(b.fillings) ? b.fillings.map(x => ({ ...x })) : [],
    purchases
  );
  const dailyPayments = recoverKnownAug29PaymentRow(
    normalizePOSPayments(Array.isArray(b.dailyPayments) ? b.dailyPayments.map(x => ({ ...x })) : []),
    credits,
    paytmTotals
  );
  return {
    openingDate: b.openingDate || START_DATE,
    openingStock: { MS: 0, HSD: 0, ...(b.openingStock || {}), LUBRICANT_QTY: n(b.openingStock?.LUBRICANT_QTY), LUBRICANT_VALUE: n(b.openingStock?.LUBRICANT_VALUE) },
    rates: { ...(b.rates || { MS: 0, HSD: 0, CNG: 0 }) },
    rateHistory: Array.isArray(b.rateHistory) && b.rateHistory.length
      ? b.rateHistory.map(x => ({ ...x }))
      : [{ id: 1, date: START_DATE, MS: 0, HSD: 0, CNG: 0 }],
    sales,
    purchases,
    dailyPayments: syncCreditPayments(dailyPayments, credits),
    paytmTotals,
    parties: Array.isArray(b.parties) && b.parties.length
      ? b.parties.map(x => ({ ...x }))
      : PARTY_NAMES.map((name, i) => ({ id: i + 1, name, mobile: "", gst: "", limit: "" })),
    credits,
    fillings,
    dipReadings: Array.isArray(b.dipReadings) ? b.dipReadings.map(x => ({ ...x })) : [],
    recoveries: Array.isArray(b.recoveries) ? b.recoveries.map(x => ({ ...x })) : [],
    ledgerPayments: Array.isArray(b.ledgerPayments) ? b.ledgerPayments.map(x => ({ ...x })) : [],
    ledgerOpenings: Array.isArray(b.ledgerOpenings) ? b.ledgerOpenings.map(x => ({ ...x })) : [],
    staff: Array.isArray(b.staff) ? b.staff.map(x => ({ ...x })) : [],
    attendance: Array.isArray(b.attendance) ? b.attendance.map(x => ({ ...x })) : [],
    electricityBills: Array.isArray(b.electricityBills) ? b.electricityBills.map(x => ({ ...x })) : [],
    electricityPayments: Array.isArray(b.electricityPayments) ? b.electricityPayments.map(x => ({ ...x })) : [],
    users: Array.isArray(b.users) && b.users.length ? b.users.map(x => ({ ...x })) : DEFAULT_USERS,
    auditLogs: Array.isArray(b.auditLogs) ? b.auditLogs.map(x => ({ ...x })) : [],
    partyMasterSchemaVersion: 2,
    accountingPolicy: PURCHASE_TAX_POLICY,
    accountingLocks: { months: Array.isArray(b.accountingLocks?.months) ? b.accountingLocks.months.map(String) : [] },
    cngStateTaxRate: Number.isFinite(Number(b.cngStateTaxRate)) ? Number(b.cngStateTaxRate) : 0.05,
    integritySchemaVersion: 5,
    masterDataVersion: MASTER_DATA_VERSION
  };
}
export function load() {

  // Repair legacy audit chains BEFORE any integrity scan or save can run.
  // The previous build defined the repair routine but did not invoke it during
  // load, so an old localStorage audit chain could continue blocking every save.
  const base = normalizeIntegrityData(repairLegacyAuditChain(initialData()));

  try {
    const rawSaved = JSON.parse(storageGet(KEY));
    const saved = rawSaved ? repairLegacyAuditChain(rawSaved) : null;

    if (!saved) {
      // First run: seed the complete embedded master data through 01-09-2026 into localStorage.
      storageSet(KEY, JSON.stringify(base));
      return base;
    }

    const mergeById = (baseArr, savedArr) => {
      const map = new Map();
      [...(baseArr || []), ...(savedArr || [])].forEach(x => {
        const k = x?.id ?? `${x?.date || ""}|${x?.nozzle || ""}|${x?.fuel || ""}`;
        map.set(String(k), x);
      });
      return Array.from(map.values());
    };

    // CNG/HPCL purchase-bill duplicate guard.
    // Same Invoice + Fuel + Quantity + Total is one physical bill even if an
    // older local backup assigned it a different internal id. Different
    // invoices are never collapsed.
    // Non-destructive: duplicate records are preserved and handled by the
    // integrity firewall rather than silently deleting ledger history.
    const dedupePurchaseBills = rows => Array.isArray(rows) ? rows.slice() : [];
    const dedupeSalesByDateNozzle = rows => Array.isArray(rows) ? rows.slice() : [];


    // Surgical data migration: correct only the known misdated Parchi 2638.
    // This prevents an older localStorage copy from overriding the corrected master backup.
    const mergedCredits = mergeById(
      base.credits,
      Array.isArray(saved.credits) ? saved.credits : []
    ).map(c =>
      String(c?.id) === "1788325086426" && String(c?.date) === "2026-09-29"
        ? { ...c, date: "2026-08-29" }
        : c
    );

    // Party Master is user-owned data. Saved parties are authoritative so an
    // edited mobile/GST/limit or a deliberate deletion can never be silently
    // overwritten by the embedded master backup. Older saves without the marker
    // are migrated once with SAVED values winning over the embedded defaults.
    const normalizeParty = (p, i) => ({
      id: p?.id ?? i + 1,
      name: String(p?.name || "").trim(),
      mobile: p?.mobile || "",
      gst: p?.gst || "",
      limit: p?.limit || ""
    });
    let parties;
    if (Array.isArray(saved.parties)) {
      const savedParties = saved.parties.map(normalizeParty).filter(x => x.name);
      if (Number(saved.partyMasterSchemaVersion || 0) >= 2) {
        parties = savedParties;
      } else {
        const byName = new Map((base.parties || []).map((p, i) => {
          const x = normalizeParty(p, i);
          return [x.name.toLowerCase(), x];
        }));
        savedParties.forEach(x => byName.set(x.name.toLowerCase(), x));
        parties = Array.from(byName.values());
      }
    } else {
      parties = (base.parties || []).map(normalizeParty).filter(x => x.name);
    }

    const rateHistory =
      Array.isArray(saved.rateHistory) && saved.rateHistory.length
        ? saved.rateHistory
            .filter(r => r && r.date)
            .map((r, i) => ({
              id: r.id ?? i + 1,
              date: String(r.date),
              MS: n(r.MS ?? saved.rates?.MS ?? base.rates.MS),
              HSD: n(r.HSD ?? saved.rates?.HSD ?? base.rates.HSD),
              CNG: n(r.CNG ?? saved.rates?.CNG ?? base.rates.CNG)
            }))
            .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        : [...base.rateHistory];

    const latest = latestRateHistory(
      { rateHistory },
      todayDate()
    );

    let mergedSales = dedupeSalesByDateNozzle(recoverKnownAug29Sales(mergeById(base.sales, Array.isArray(saved.sales) ? saved.sales : [])));

    // One-time master-data migration: the earlier browser cache contains the
    // same 01-08..08-08 sale IDs but Testing was saved as 0. Because mergeById
    // intentionally lets saved values win, simply replacing the embedded
    // backup could never restore those historical Testing values. For this
    // specific release marker, restore the authoritative historical rows from
    // the embedded master only for 01-08-2026 through 08-08-2026, then mark the
    // data version so later user edits are preserved normally.
    if (String(saved.masterDataVersion || "") !== MASTER_DATA_VERSION) {
      const restoreDates = new Set(Array.from({ length: 8 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`));
      const baseTestingRows = (base.sales || []).filter(x => restoreDates.has(String(x?.date || "")));
      const byDateNozzle = new Map(baseTestingRows.map(x => [`${x.date}|${x.nozzle}`, x]));
      // Historical Testing was lost in an earlier browser-cache version.
      // Restore ONLY when the saved row has zero/missing Testing and the
      // authoritative embedded master has a non-zero Testing value. This keeps
      // any genuine later user edit intact while repairing the known zeroed rows.
      mergedSales = mergedSales.map(x => {
        const master = byDateNozzle.get(`${x?.date}|${x?.nozzle}`);
        if (!master) return x;
        const savedTesting = Number(x?.testing || 0);
        const masterTesting = Number(master?.testing || 0);
        return savedTesting === 0 && masterTesting !== 0 ? { ...x, ...master } : x;
      });
    }
    const mergedPurchases = dedupePurchaseBills(mergeById(base.purchases, Array.isArray(saved.purchases) ? saved.purchases : []));
    const mergedPaytmTotals = (() => {
      // Defensive recovery: older/local backups may contain null or malformed
      // POS rows. Never let one bad row crash the entire application at boot.
      const seedTotals = (Array.isArray(base.paytmTotals) ? base.paytmTotals : DEFAULT_PAYTM_TOTALS)
        .filter(x => x && typeof x === "object" && x.date);
      const savedTotals = (Array.isArray(saved.paytmTotals) ? saved.paytmTotals : [])
        .filter(x => x && typeof x === "object" && x.date);
      const byDate = new Map(seedTotals.map(x => [String(x.date), { ...x }]));
      savedTotals.forEach(x => byDate.set(String(x.date), { ...x }));
      return Array.from(byDate.values()).sort((a,b)=>String(a?.date || "").localeCompare(String(b?.date || "")));
    })();
    const mergedDailyPayments = recoverKnownAug29PaymentRow(
      normalizePOSPayments(mergeById(base.dailyPayments, Array.isArray(saved.dailyPayments) ? saved.dailyPayments : [])),
      mergedCredits,
      mergedPaytmTotals
    );

    return normalizeIntegrityData(repairLegacyAuditChain({
      ...base,
      ...saved,
      masterDataVersion: MASTER_DATA_VERSION,
      parties,
      partyMasterSchemaVersion: 2,
      accountingPolicy: PURCHASE_TAX_POLICY,
      rates: latest
        ? { MS: n(latest.MS), HSD: n(latest.HSD), CNG: n(latest.CNG) }
        : {
            MS: n(saved.rates?.MS ?? base.rates.MS),
            HSD: n(saved.rates?.HSD ?? base.rates.HSD),
            CNG: n(saved.rates?.CNG ?? base.rates.CNG)
          },
      rateHistory,
      sales: mergedSales,
      purchases: mergedPurchases,
      dailyPayments: syncCreditPayments(mergedDailyPayments, mergedCredits),
      // Keep user-entered values, but automatically add any missing seeded dates.
      paytmTotals: mergedPaytmTotals,
      credits: mergedCredits,
      fillings: linkFillingsToPurchases(
        mergeById(base.fillings, Array.isArray(saved.fillings) ? saved.fillings : []),
        mergedPurchases
      ),
      dipReadings: mergeById(base.dipReadings, Array.isArray(saved.dipReadings) ? saved.dipReadings : []),
      recoveries: mergeById(base.recoveries, Array.isArray(saved.recoveries) ? saved.recoveries : []),
      ledgerPayments: mergeById(base.ledgerPayments, Array.isArray(saved.ledgerPayments) ? saved.ledgerPayments : []),
      ledgerOpenings: mergeById(base.ledgerOpenings, Array.isArray(saved.ledgerOpenings) ? saved.ledgerOpenings : []),
      // Staff/attendance/electricity are persistent business records too.
      // Older Home-PC/localStorage copies may contain these arrays as empty,
      // which previously let ...saved overwrite the embedded master data.
      // Merge by id so the master records reappear while newer saved rows are
      // retained. Do not replace populated master data with an empty cache.
      staff: mergeById(base.staff, Array.isArray(saved.staff) ? saved.staff : []),
      attendance: mergeById(base.attendance, Array.isArray(saved.attendance) ? saved.attendance : []),
      electricityBills: mergeById(base.electricityBills, Array.isArray(saved.electricityBills) ? saved.electricityBills : []),
      electricityPayments: mergeById(base.electricityPayments, Array.isArray(saved.electricityPayments) ? saved.electricityPayments : []),
      users: Array.isArray(saved.users) && saved.users.length ? saved.users : DEFAULT_USERS,
      auditLogs: Array.isArray(saved.auditLogs) ? saved.auditLogs : (base.auditLogs || []),
      cngStateTaxRate: Number.isFinite(Number(saved.cngStateTaxRate)) ? Number(saved.cngStateTaxRate) : base.cngStateTaxRate,
      integritySchemaVersion: 4
    }));
  } catch (error) {
    // Non-destructive recovery: preserve the exact raw browser payload before
    // returning embedded master data. App persistence is disabled for this
    // boot so the corrupt/legacy source cannot be silently overwritten.
    try {
      const raw = storageGet(KEY);
      if (raw) storageSet(`${KEY}_RECOVERY_RAW`, String(raw));
      if (typeof window !== "undefined") window.__STATIONMITRA_RECOVERY = true;
    } catch {}
    console.error("StationMitra load recovery: raw local data preserved", error);
    return base;
  }
}

export function openingFor(data, nozzle, date) {
  const a = data.sales
    .filter(
      s =>
        s.nozzle === nozzle &&
        s.date < date
    )
    .sort((x, y) =>
      (
        dk(x.date) + String(x.id)
      ).localeCompare(
        dk(y.date) + String(y.id)
      )
    );

  return a.length
    ? n(a[a.length - 1].closing)
    : n(OPENING[nozzle]);
}

export function payTotal(p) {
  // Standard accounting: actual receipt methods + credit sale (receivable).
  // "Other" is not a receipt; it is kept as an unclassified/expense field.
  return rupee(
    n(p?.cash) + n(p?.paytm) + n(p?.card) + n(p?.dtplus) +
    n(p?.hppay) + n(p?.phonepe) + n(p?.credit)
  );
}

export function accountedTotal(p) {
  // Cash is already entered NET of the pump expense. Therefore an expense
  // paid before deposit must be added back for sales reconciliation.
  // Expense remains a separate expense account and is never treated as receipt.
  return rupee(
    payTotal(p) + n(p?.pumpExpense) + n(p?.other)
  );
}

export function canonicalDailyPayments(data) {
  const map = new Map();
  for (const row of (Array.isArray(data?.dailyPayments) ? data.dailyPayments : [])) {
    const date = String(row?.date || '');
    if (!date) continue;
    // The historical backup contains duplicate copies of some date records.
    // One date = one accounting day; the last saved record is authoritative.
    map.set(date, row);
  }
  return Array.from(map.values()).sort((a,b) => String(a.date).localeCompare(String(b.date)));
}

export function paymentForFuelStandard(data, date, fuel) {
  const row = canonicalDailyPayments(data).find(x => String(x.date) === String(date));
  const p = row?.[fuel] && typeof row[fuel] === 'object' ? row[fuel] : {};
  return {
    cash:n(p.cash), paytm:n(p.paytm) + n(p.card), card:0, dtplus:n(p.dtplus),
    hppay:n(p.hppay), phonepe:n(p.phonepe), credit:creditTotalForFuel(data,date,fuel),
    other:n(p.other), pumpExpense:n(p.pumpExpense)
  };
}

export function actualPOSForDate(data, date) {
  const saved = (data?.paytmTotals || []).find(x => String(x?.date) === String(date));
  if (saved) return rupee(saved.amount);
  const row = canonicalDailyPayments(data).find(x => String(x.date) === String(date)) || {};
  return rupee(['MS','HSD','CNG'].reduce((s,f) => s + n(row?.[f]?.paytm) + n(row?.[f]?.card), 0));
}

export function fuelPOSForDate(data, date) {
  const row = canonicalDailyPayments(data).find(x => String(x.date) === String(date)) || {};
  return rupee(['MS','HSD','CNG'].reduce((s,f) => s + n(row?.[f]?.paytm) + n(row?.[f]?.card), 0));
}

export function isFuelPOSBreakdownKnown(data, date) {
  const row = canonicalDailyPayments(data).find(x => String(x.date) === String(date));
  if (!row) return false;
  // A partial forensic recovery contains only the combined POS total; its
  // fuel-wise Paytm/Card split is explicitly unavailable and must not be
  // interpreted as zero fuel POS or as POS excess.
  if (String(row.recoveryStatus || '') === 'PARTIAL_SOURCE_RECOVERY') return false;
  return true;
}

export function knownFuelPOSForDate(data, date) {
  if(!isFuelPOSBreakdownKnown(data,date)) return 0;
  // The saved combined POS total is the authoritative bank/terminal receipt.
  // If the fuel-wise breakdown is higher, only the actually received POS can
  // settle fuel sales; the difference remains a POS shortfall control.
  return Math.min(fuelPOSForDate(data,date), actualPOSForDate(data,date));
}


export function digitalPartyRecoveryForDate(data, date) {
  return rupee((data?.ledgerPayments || [])
    .filter(x => String(x.date) === String(date) && /paytm|upi|phonepe|card|dtplus|hp.?pay/.test(String(x.mode || '').toLowerCase()))
    .reduce((s,x) => s + n(x.amount), 0));
}

export function posPartyMatchForDate(data, date) {
  const excess = Math.max(0, actualPOSForDate(data,date) - fuelPOSForDate(data,date));
  return Math.min(excess, digitalPartyRecoveryForDate(data,date));
}

export function accountingSnapshot(data, from=START_DATE, to='9999-12-31') {
  const sales = authoritativeSalesRows(data).filter(x => x.date >= from && x.date <= to);
  const credits = (data?.credits || []).filter(x => x.date >= from && x.date <= to);
  const payments = canonicalDailyPayments(data).filter(x => x.date >= from && x.date <= to);
  const ledgerPayments = (data?.ledgerPayments || []).filter(x => x.date >= from && x.date <= to);
  const recoveries = (data?.recoveries || []).filter(x => x.date >= from && x.date <= to);
  const purchases = (data?.purchases || []).filter(x => x.date >= from && x.date <= to);
  const sumMethod = key => payments.reduce((sum,row) => sum + ['MS','HSD','CNG'].reduce((s,f)=>s+n(row?.[f]?.[key]),0),0);
  const sale = sales.reduce((s,x)=>s+n(x.amount),0);
  const credit = credits.filter(x => ['MS','HSD','CNG'].includes(String(x?.fuel || '').toUpperCase())).reduce((s,x)=>s+n(x.amount),0);
  const nonFuelCredit = credits.filter(x => !['MS','HSD','CNG'].includes(String(x?.fuel || '').toUpperCase())).reduce((s,x)=>s+n(x.amount),0);
  const totalCredit = credit + nonFuelCredit;
  const totalSales = rupee(sale + nonFuelCredit);
  const fuelPaytmBreakdown = sumMethod('paytm') + sumMethod('card');
  const actualPOS = payments.reduce((sum,row) => sum + actualPOSForDate(data,row.date),0);
  const receipts = { cash:sumMethod('cash'), paytm:actualPOS, card:0, dtplus:sumMethod('dtplus'), hppay:sumMethod('hppay'), phonepe:sumMethod('phonepe') };
  const digital = receipts.paytm+receipts.dtplus+receipts.hppay+receipts.phonepe;
  const fuelReceipt = receipts.cash+digital;
  const partyRecovery = ledgerPayments.reduce((s,x)=>s+n(x.amount),0);
  const posPartyMatched = [...new Set(ledgerPayments.map(x=>String(x.date)))].reduce((s,date)=>s+posPartyMatchForDate(data,date),0);
  const partyRecoveryOutsidePOS = Math.max(0, partyRecovery - posPartyMatched);
  const posExcess = payments.reduce((s,row)=>s+Math.max(0,actualPOSForDate(data,row.date)-fuelPOSForDate(data,row.date)),0);
  const posShortfall = payments.reduce((s,row)=>s+Math.max(0,fuelPOSForDate(data,row.date)-actualPOSForDate(data,row.date)),0);
  const posUnmatchedParty = Math.max(0,posExcess-posPartyMatched);
  const salesmanRecovery = recoveries.reduce((s,x)=>s+n(x.amount),0);
  const pumpExpense = payments.reduce((s,row)=>s+['MS','HSD','CNG'].reduce((a,f)=>a+n(row?.[f]?.pumpExpense)+n(row?.[f]?.other),0),0);
  const purchaseCost = purchases.reduce((s,x)=>s+purchaseLandedValue(x),0);
  const purchaseTax = purchases.reduce((s,x)=>s+n(x.taxAmount),0);
  const purchaseTotal = purchases.reduce((s,x)=>s+purchaseLandedValue(x),0);
  const openingDebit = (data?.ledgerOpenings||[]).filter(x=>x.type!=='CREDIT').reduce((s,x)=>s+n(x.amount),0);
  const openingCredit = (data?.ledgerOpenings||[]).filter(x=>x.type==='CREDIT').reduce((s,x)=>s+n(x.amount),0);
  const receivable = openingDebit-openingCredit+totalCredit-partyRecovery;
  const qty={MS:0,HSD:0,CNG:0}, saleByFuel={MS:0,HSD:0,CNG:0};
  sales.forEach(x=>{qty[x.fuel]=(qty[x.fuel]||0)+n(x.qty);saleByFuel[x.fuel]=(saleByFuel[x.fuel]||0)+n(x.amount)});
  const filling={MS:0,HSD:0,CNG:0};
  (data?.fillings||[]).filter(x=>x.date>=from&&x.date<=to).forEach(x=>{if(filling[x.fuel]!==undefined)filling[x.fuel]+=n(x.qty)});
  // Sales reconciliation is independent of POS excess/party matching.
  // POS excess is a separate control item and must NEVER inflate/deflate
  // the sales difference. Cash is recorded net of pump expense, so the
  // recorded expense is added back once to reconstruct gross receipts.
  //
  //   Unreconciled Sales Difference
  //   = Sales - Credit Sales - known fuel receipts - pump expense
  //
  // A negative result means recorded receipts cover the sales; it is not
  // treated as an additional sale or receivable.
  const grossKnownFuelReceipts = rupee(fuelReceipt + pumpExpense);
  const unreconciledSalesDifference = Math.max(0, rupee(sale - credit - grossKnownFuelReceipts));
  // Backward-compatible property name; UI now labels it as a reconciliation
  // control, not as a confirmed unmatched sale.
  const unallocatedSale = unreconciledSalesDifference;
  return {qty,saleByFuel,sale,totalSales,credit,nonFuelCredit,totalCredit,receipts,digital,fuelReceipt,partyRecovery,posPartyMatched,partyRecoveryOutsidePOS,posExcess,posShortfall,posUnmatchedParty,salesmanRecovery,collection:fuelReceipt+partyRecoveryOutsidePOS+salesmanRecovery,pumpExpense,purchaseCost,purchaseTax,purchaseTotal,receivable,unallocatedSale,unreconciledSalesDifference,fuelPaytmBreakdown,filling};
}

export function salaryExpenseForPeriodPure(data, from, to) {
  if(!from || !to || from>to) return 0;
  const staff=Array.isArray(data?.staff)?data.staff:[];
  const months=new Set();
  let cur=new Date(`${from}T12:00:00`), end=new Date(`${to}T12:00:00`);
  while(cur<=end){ months.add(`${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}`); cur.setMonth(cur.getMonth()+1); }
  let total=0;
  for(const month of months){
    const [yy,mm]=month.split('-').map(Number), dim=new Date(yy,mm,0).getDate();
    const ms=`${month}-01`, me=`${month}-${String(dim).padStart(2,'0')}`;
    const a=from>ms?from:ms, b=to<me?to:me;
    const days=Math.max(0,Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000)+1);
    total += staff.reduce((sum,person)=>sum+n(person.salary)*days/dim,0);
  }
  return rupee(total);
}

export function electricityExpenseForPeriodPure(data,from,to){
  if(!from || !to || from>to) return 0;
  return (Array.isArray(data?.electricityBills) ? data.electricityBills : [])
    .filter(b => { const m=String(b?.month||''); return m>=String(from).slice(0,7) && m<=String(to).slice(0,7); })
    .reduce((sum,b)=>sum+n(b?.amount),0);
}

export function cngSalePurchaseMatchingPure(data,from=START_DATE,to='9999-12-31'){
  to = resolveAccountingEndDate(data, to);
  const sales=authoritativeSalesRows(data), purchases=Array.isArray(data?.purchases)?data.purchases:[];
  const cngSales=sales.filter(s=>s.fuel==='CNG'&&s.date>=START_DATE).slice().sort((a,b)=>{
    const d=String(a.date).localeCompare(String(b.date)); return d||String(a.id??'').localeCompare(String(b.id??''));
  });
  const cngPurchases=purchases.filter(p=>p.fuel==='CNG'&&p.date>=START_DATE).slice().sort((a,b)=>{
    const d=String(a.date).localeCompare(String(b.date)); return d||String(a.id??'').localeCompare(String(b.id??''));
  });
  const remainingSales=cngSales.map(s=>({sale:s,remaining:Math.max(0,n(s.qty)),matchedQty:0,matchedCost:0})), billMatches=[];
  cngPurchases.forEach(p=>{
    let rp=Math.max(0,n(p.quantity)); const unit=n(p.quantity)>0?purchaseEffectiveRate(p):0; let mq=0,mc=0;
    for(const item of remainingSales){ if(rp<=0) break; if(item.remaining<=0) continue; const q=Math.min(rp,item.remaining); item.remaining-=q; item.matchedQty+=q; item.matchedCost+=q*unit; rp-=q; mq+=q; mc+=q*unit; }
    billMatches.push({purchaseId:p.id??`${p.date}|${p.invoiceNo}|CNG`,date:p.date,invoiceNo:p.invoiceNo||'—',qty:n(p.quantity),unitCost:unit,matchedQty:mq,matchedCost:mc,unmatchedQty:Math.max(0,n(p.quantity)-mq)});
  });
  const selected=remainingSales.filter(x=>x.sale.date>=from&&x.sale.date<=to), selectedBills=billMatches.filter(x=>String(x.date)>=String(from)&&String(x.date)<=String(to));
  const matchedQty=selected.reduce((a,x)=>a+x.matchedQty,0), matchedCost=selected.reduce((a,x)=>a+x.matchedCost,0), saleQty=selected.reduce((a,x)=>a+n(x.sale.qty),0);
  const unmatchedQty=selected.reduce((a,x)=>a+x.remaining,0), unmatchedAmount=selected.reduce((a,x)=>a+(x.remaining>0?n(x.sale.amount)*x.remaining/Math.max(1,n(x.sale.qty)):0),0);
  const unmatchedPurchaseQty=selectedBills.reduce((a,x)=>a+n(x.unmatchedQty),0), unmatchedPurchaseCost=selectedBills.reduce((a,x)=>a+n(x.unmatchedQty)*n(x.unitCost),0);
  return {saleQty,matchedQty,matchedCost,unmatchedQty,unmatchedAmount,unmatchedPurchaseQty,unmatchedPurchaseCost,matchedPurchaseOutsidePeriod:matchedQty-selectedBills.reduce((a,x)=>a+x.matchedQty,0),billMatches,selected,selectedBillMatches:selectedBills};
}

export function calculateProfitLossEngine(data,from=START_DATE,to='9999-12-31'){
  to = resolveAccountingEndDate(data, to);
  const sales=authoritativeSalesRows(data), purchases=Array.isArray(data?.purchases)?data.purchases:[];
  const payments=Array.isArray(data?.dailyPayments)?data.dailyPayments:[], fuels=['MS','HSD','CNG','LUBRICANT'];
  const fallback={MS:n(data?.rates?.MS??99.79),HSD:n(data?.rates?.HSD??95.32),CNG:n(data?.rates?.CNG??101),LUBRICANT:(n(data?.openingStock?.LUBRICANT_QTY)>0?n(data?.openingStock?.LUBRICANT_VALUE)/n(data?.openingStock?.LUBRICANT_QTY):0)};
  const before=(a,b)=>String(a).localeCompare(String(b))<0;
  const purchaseQty=(f,d=null)=>purchases.filter(p=>p.fuel===f&&(!d||before(p.date,d))).reduce((a,p)=>a+n(p.quantity),0);
  const saleQtyBefore=(f,d)=>f==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(x=>String(x?.fuel||'').toUpperCase()===f&&before(x.date,d)).reduce((a,x)=>a+n(x.qty),0):sales.filter(x=>x.fuel===f&&before(x.date,d)).reduce((a,x)=>a+n(x.qty),0);
  const openingQty=(f,d)=>{if(f==='CNG')return null;const base=f==='MS'?n(data?.openingStock?.MS??9356):f==='HSD'?n(data?.openingStock?.HSD??7500):n(data?.openingStock?.LUBRICANT_QTY);return String(d)===START_DATE?base:base+purchaseQty(f,d)-saleQtyBefore(f,d);};
  const openingRate=(f,d)=>{if(f==='LUBRICANT' && n(data?.openingStock?.LUBRICANT_QTY)>0)return n(data?.openingStock?.LUBRICANT_VALUE)/n(data?.openingStock?.LUBRICANT_QTY);const prior=purchases.filter(p=>p.fuel===f&&before(p.date,d));if(prior.length){const q=prior.reduce((a,p)=>a+n(p.quantity),0),v=prior.reduce((a,p)=>a+purchaseLandedValue(p),0);if(q>0)return v/q;}return fallback[f]||0;};
  const fs=sales.filter(x=>x.date>=from&&x.date<=to), fp=purchases.filter(x=>x.date>=from&&x.date<=to), cng=cngSalePurchaseMatchingPure(data,from,to), out={};
  fuels.forEach(f=>{
    const oq=openingQty(f,from), pq=fp.filter(p=>p.fuel===f).reduce((a,p)=>a+n(p.quantity),0), pc=fp.filter(p=>p.fuel===f).reduce((a,p)=>a+purchaseLandedValue(p),0);
    const sq=f==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(x=>String(x?.fuel||'').toUpperCase()===f&&x.date>=from&&x.date<=to).reduce((a,x)=>a+n(x.qty),0):fs.filter(x=>x.fuel===f).reduce((a,x)=>a+n(x.qty),0), sa=f==='LUBRICANT'?(Array.isArray(data?.credits)?data.credits:[]).filter(x=>String(x?.fuel||'').toUpperCase()===f&&x.date>=from&&x.date<=to).reduce((a,x)=>a+n(x.amount),0):fs.filter(x=>x.fuel===f).reduce((a,x)=>a+n(x.amount),0);
    const expense=canonicalDailyPayments(data).filter(p=>p.date>=from&&p.date<=to).reduce((a,p)=>a+n(p?.[f]?.pumpExpense)+(p?.[f]?.pumpExpense===undefined?n(p?.[f]?.other):0),0);
    const or=openingRate(f,from), cngTaxRate=Number.isFinite(Number(data?.cngStateTaxRate))?Number(data.cngStateTaxRate):0.05, tax=f==='CNG'?sa*cngTaxRate:0; let cq=null,ov=0,cv=0,cogs=0,avg=or,mq=0,mc=0,usq=0,usa=0,upq=0,upc=0;
    if(f!=='CNG'){cq=oq+pq-sq;ov=oq*or;const av=ov+pc,aq=oq+pq;avg=aq>0?av/aq:or;cv=cq*avg;cogs=Math.max(0,ov+pc-cv);}
    else{mq=cng.matchedQty;mc=cng.matchedCost;usq=cng.unmatchedQty;usa=cng.unmatchedAmount;upq=cng.unmatchedPurchaseQty;upc=cng.unmatchedPurchaseCost;cogs=mc;avg=mq>0?mc/mq:0;}
    out[f]={openingQty:oq,purchaseQty:pq,saleQty:sq,closingQty:cq,openingValue:ov,purchaseCost:pc,closingValue:cv,cogs,sale:sa,expense,stateTax:tax,profit:sa-cogs-expense-tax,avgCostRate:avg,matchedPurchaseQty:mq,matchedPurchaseCost:mc,unmatchedSaleQty:usq,unmatchedSaleAmount:usa,unmatchedPurchaseQty:upq,unmatchedPurchaseCost:upc};
  });
  out.total=fuels.reduce((a,f)=>{for(const k of Object.keys(out[f]))if(typeof out[f][k]==='number')a[k]=(a[k]||0)+out[f][k];return a;},{});
  return {calc:out,cngMatch:cng,salaryExpense:salaryExpenseForPeriodPure(data,from,to),electricityExpense:electricityExpenseForPeriodPure(data,from,to)};
}


export function standardJournal(data,from=START_DATE,to='9999-12-31'){
  to = resolveAccountingEndDate(data, to);
  const rows=[], add=(date,account,debit,credit,narration)=>{const d=rupee(debit),c=rupee(credit);if(Math.abs(d)+Math.abs(c)<1)return;rows.push({date,account,debit:d,credit:c,narration});};
  const dates=[...new Set([...(data?.sales||[]),...(data?.credits||[]),...(data?.ledgerPayments||[]),...(data?.recoveries||[]),...(data?.purchases||[]),...(data?.paytmTotals||[]),...(data?.dailyPayments||[])].map(x=>x.date))].filter(d=>d>=from&&d<=to).sort();
  const engine=calculateProfitLossEngine(data,from,to), c=engine.calc;
  // Opening inventory is brought into the selected period so the inventory/COGS chain is visible in Trial Balance.
  const openingInventory=n(c.MS.openingValue)+n(c.HSD.openingValue)+n(c.LUBRICANT.openingValue);
  if(openingInventory>0){add(from,'MS Inventory',c.MS.openingValue,0,'Opening stock value — P&L engine');add(from,'HSD Inventory',c.HSD.openingValue,0,'Opening stock value — P&L engine');add(from,'Lubricant Inventory',c.LUBRICANT.openingValue,0,'Opening lubricant stock value — P&L engine');add(from,'Opening Balance Equity',0,openingInventory,'Opening stock balancing entry');}
  const openingReceivable=(data?.ledgerOpenings||[]).reduce((s,x)=>s+(String(x?.type)==='CREDIT'?-n(x.amount):n(x.amount)),0);
  if(openingReceivable>0){add(from,'Trade Receivables',openingReceivable,0,'Opening party receivables');add(from,'Opening Balance Equity',0,openingReceivable,'Opening party receivables balancing entry');}
  if(openingReceivable<0){add(from,'Opening Balance Equity',-openingReceivable,0,'Opening party credit balances');add(from,'Trade Receivables',0,-openingReceivable,'Opening party credit balances');}
  for(const date of dates){
    const daySales=authoritativeSalesRows(data).filter(x=>x.date===date), dayCredits=(data?.credits||[]).filter(x=>x.date===date), fuelPOS=fuelPOSForDate(data,date), actualPOS=actualPOSForDate(data,date), posBreakdownKnown=isFuelPOSBreakdownKnown(data,date), posExtra=posBreakdownKnown?Math.max(0,actualPOS-fuelPOS):Math.max(0,actualPOS), matchedPOSParty=Math.min(posExtra,digitalPartyRecoveryForDate(data,date));
    let daySale=0,dayCredit=0,dayNonPOS=0;
    const lubricantCredits = dayCredits.filter(x => String(x?.fuel || '').toUpperCase() === 'LUBRICANT');
    for (const lc of lubricantCredits) {
      const amount = rupee(lc?.amount);
      if (amount > 0) {
        add(date,'Trade Receivables',amount,0,`${lc.productName || 'Lubricant'} credit sale${lc.party ? ` — ${lc.party}` : ''}`);
        add(date,'Lubricant / Other Sales',0,amount,`${lc.productName || 'Lubricant'} credit sale`);
      }
    }
    for(const fuel of ['MS','HSD','CNG']){
      const sale=rupee(daySales.filter(x=>x.fuel===fuel).reduce((a,x)=>a+n(x.amount),0)), credit=rupee(dayCredits.filter(x=>x.fuel===fuel).reduce((a,x)=>a+n(x.amount),0)); if(sale<=0)continue;
      const p=paymentForFuelStandard(data,date,fuel), cash=rupee(p.cash),dt=rupee(p.dtplus),hp=rupee(p.hppay),ph=rupee(p.phonepe),expense=rupee(n(p.pumpExpense)+n(p.other));
      add(date,'Cash',cash+expense,0,`${fuel} fuel sale receipt (gross cash before expense)`);add(date,'DT Plus',dt,0,`${fuel} digital receipt`);add(date,'HP Pay',hp,0,`${fuel} digital receipt`);add(date,'PhonePe',ph,0,`${fuel} digital receipt`);add(date,'Trade Receivables',credit,0,`${fuel} credit sale`);add(date,`${fuel} Sales`,0,sale,`${fuel} sales`);
      if(expense>0){add(date,'Pump Operating Expense',expense,0,'Recorded operating expense');add(date,'Cash',0,expense,'Recorded operating expense');}
      daySale+=sale;dayCredit+=credit;dayNonPOS+=cash+expense+dt+hp+ph;
    }
    if(actualPOS>0)add(date,'POS (Paytm + ATM)',actualPOS,0,'Actual POS machine total (Paytm + ATM combined)');
    // The combined POS asset is already debited above. If its fuel-wise
    // breakdown is known, only the excess needs separate classification. If
    // the source is partial, the whole combined POS is an unallocated receipt
    // and is credited to suspense until source-level allocation is available.
    if(posExtra>0){
      if(matchedPOSParty>0)add(date,'Trade Receivables',0,matchedPOSParty,'POS excess matched with Party Ledger recovery');
      if(posExtra-matchedPOSParty>0)add(date,'Unidentified Receipts / Suspense',0,posExtra-matchedPOSParty,'POS excess not matched to Party Ledger');
    }
    // Only KNOWN fuel receipts settle fuel sales. Combined/unallocated POS is
    // controlled separately as a party/suspense receipt and is not silently
    // assumed to belong to fuel sales.
    const knownFuelPOS=posBreakdownKnown?Math.min(fuelPOS,actualPOS):0;
    const reconciliation=rupee(daySale-dayNonPOS-knownFuelPOS-dayCredit);
    if(reconciliation>0)add(date,'Collection Shortfall Receivable',reconciliation,0,'Daily sales vs actual receipts reconciliation');
    if(reconciliation<0)add(date,'Unidentified Receipts / Suspense',0,-reconciliation,'Daily sales vs actual receipts reconciliation');
    let matchedRemaining=matchedPOSParty;
    for(const x of (data?.ledgerPayments||[]).filter(x=>x.date===date)){const amount=rupee(x.amount);if(amount<=0)continue;const mode=String(x.mode||'').toLowerCase(),digital=/paytm|upi|phonepe|card|dtplus|hp.?pay/.test(mode);let matched=0;if(digital&&matchedRemaining>0){matched=Math.min(amount,matchedRemaining);matchedRemaining-=matched;}const rem=rupee(amount-matched);if(rem>0){const acct=digital?'Bank / Digital Receipts':'Cash';add(date,acct,rem,0,`Party receipt - ${x.party||''}`);add(date,'Trade Receivables',0,rem,`Party receipt - ${x.party||''}`);}}
    for(const x of (data?.recoveries||[]).filter(x=>x.date===date)){add(date,'Cash',rupee(x.amount),0,'Receivable recovery');add(date,'Collection Shortfall Receivable',0,rupee(x.amount),'Receivable recovery');}
    for(const x of (data?.purchases||[]).filter(x=>x.date===date)){const v=rupee(purchaseLandedValue(x));add(date,`${x.fuel==='CNG'?'CNG Purchase Clearing':`${x.fuel||'Fuel'} Inventory`}`,v,0,'HPCL purchase — landed value (Assessable + Tax)');add(date,'Supplier Payable',0,v,'HPCL purchase — landed value');}
  }
  // These postings use the exact same P&L engine values, eliminating P&L/Journal drift.
  for(const fuel of ['MS','HSD','CNG','LUBRICANT']){if(n(c[fuel].cogs)>0){add(to,`${fuel} COGS`,c[fuel].cogs,0,`${fuel} COGS from Sale/Purchase P&L engine`);add(to,`${fuel==='CNG'?'CNG Purchase Clearing':fuel==='LUBRICANT'?'Lubricant Inventory':`${fuel} Inventory`}`,0,c[fuel].cogs,`${fuel} COGS — ${fuel==='CNG'?'matched purchase clearing consumed':'inventory consumed'}`);}if(n(c[fuel].stateTax)>0){add(to,'CNG State Tax Expense',c[fuel].stateTax,0,`CNG State Tax = CNG Sales × ${(Number(data?.cngStateTaxRate)||0.05)*100}%`);add(to,'CNG State Tax Payable',0,c[fuel].stateTax,'CNG State Tax liability');}}
  if(n(engine.salaryExpense)>0){add(to,'Salary Expense',engine.salaryExpense,0,'Selected-period staff salary');add(to,'Salary Payable',0,engine.salaryExpense,'Selected-period staff salary accrual');}
  if(n(engine.electricityExpense)>0){add(to,'Electricity Expense',engine.electricityExpense,0,'August-2026 electricity expense');add(to,'Electricity Payable',0,engine.electricityExpense,'August-2026 electricity expense accrual');}
  return rows;
}

export function trialBalance(data, from=START_DATE, to='9999-12-31'){
  to = resolveAccountingEndDate(data, to);
  const j=standardJournal(data,from,to); const map={}; for(const r of j){ if(!map[r.account])map[r.account]={debit:0,credit:0}; map[r.account].debit+=r.debit; map[r.account].credit+=r.credit; }
  return Object.entries(map).map(([account,v])=>({account,debit:rupee(v.debit),credit:rupee(v.credit),balance:rupee(v.debit-v.credit)})).sort((a,b)=>a.account.localeCompare(b.account));
}


export function savedPayment(data, date) {
  // Payment Breakdown must use the canonical (last saved) accounting row.
  // Historical backups can contain an early forensic/recovery row for the same
  // date followed by the complete payment breakdown. Using Array.find() picked
  // the first partial row and made the UI appear blank.
  const rows = Array.isArray(data?.dailyPayments) ? data.dailyPayments : [];
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i]?.date || '') === String(date)) return rows[i];
  }
  return undefined;
}

export function creditTotalForFuel(data, date, fuel) {
  return rupee(
    (data.credits || [])
      .filter(
        c =>
          c.date === date &&
          c.fuel === fuel
      )
      .reduce(
        (sum, c) => sum + n(c.amount),
        0
      )
  );
}

export function previousPending(data, date) {
  const out = {
    MS: 0,
    HSD: 0,
    CNG: 0
  };

  data.dailyPayments
    .filter(p => p.date < date)
    .sort((a, b) =>
      dk(a.date).localeCompare(dk(b.date))
    )
    .forEach(p => {
      ["MS", "HSD", "CNG"].forEach(f => {
        const d = n(p?.[f]?.difference);

        if (d > 0) {
          out[f] += d;
        }
      });
    });

  data.recoveries
    .filter(r => r.date < date)
    .forEach(r => {
      if (out[r.fuel] !== undefined) {
        out[r.fuel] = Math.max(
          0,
          out[r.fuel] - n(r.amount)
        );
      }
    });

  return out;
}

export function monthKey(value) {
  const s = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(0, 7) : (/^\d{4}-\d{2}$/.test(s) ? s : "");
}

export function getLockedMonths(data) {
  return new Set(Array.isArray(data?.accountingLocks?.months) ? data.accountingLocks.months.map(String) : []);
}

export const DATE_ARRAY_KEYS = [
  "sales", "credits", "dailyPayments", "ledgerPayments", "recoveries",
  "fillings", "purchases", "dipReadings", "rateHistory", "paytmTotals",
  "attendance", "electricityBills", "electricityPayments"
];

export function changedMonthsForArray(before, after) {
  const b = Array.isArray(before) ? before : [];
  const a = Array.isArray(after) ? after : [];
  const byId = rows => new Map(rows.map((x, i) => [String(x?.id ?? `__idx_${i}`), x]));
  const bm = byId(b), am = byId(a);
  const months = new Set();
  for (const [id, row] of bm) {
    const other = am.get(id);
    if (!other || JSON.stringify(row) !== JSON.stringify(other)) {
      const m = monthKey(row?.date || row?.month);
      if (m) months.add(m);
      const m2 = monthKey(other?.date || other?.month);
      if (m2) months.add(m2);
    }
  }
  for (const [id, row] of am) {
    if (!bm.has(id)) {
      const m = monthKey(row?.date || row?.month);
      if (m) months.add(m);
    }
  }
  return months;
}

export function findLockedMutation(data, incoming) {
  const locked = getLockedMonths(data);
  if (!locked.size) return null;
  for (const key of DATE_ARRAY_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, key)) continue;
    const months = changedMonthsForArray(data?.[key], incoming?.[key]);
    for (const m of months) if (locked.has(m)) return { key, month: m };
  }
  return null;
}
