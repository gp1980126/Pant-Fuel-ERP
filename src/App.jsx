import React, { useEffect, useMemo, useRef, useState } from "react";
import { CLOUD_REQUIRED } from "./config/appConfig";
import { CLOUD_ENABLED, supabase, cloudSignIn, cloudResetPassword, cloudSignOut, cloudGetProfile, cloudGetStationId, cloudLoadState, cloudSaveState, subscribeState } from "./cloud_sync_supabase";
import {
  START_DATE,
  PUMP_NAME,
  KEY,
  CLOUD_STATION_ID,
  HISTORICAL_DIP_MS_HSD_2026_08,
  USER_ROLES,
  DEFAULT_USERS,
  ROLE_PERMISSIONS,
  canAccess,
  OPENING,
  NOZZLES,
  METHODS,
  PARTY_NAMES,
  EMBEDDED_BACKUP_2026_09_06,
  DEFAULT_PAYTM_TOTALS,
  blankPay,
  blankPays,
  n,
  todayDate,
  rupee,
  money,
  moneyRupee,
  dk,
  ISO_DATE_RE,
  isValidISODate,
  todayISODate,
  assertPeriodDate,
  validateTransactionDate,
  stableHash,
  canonicalIntegrityValue,
  transactionFingerprint,
  makeLegacyTransactionId,
  ensureTransactionIdentity,
  identityArray,
  purchaseBusinessKey,
  findPurchaseDuplicate,
  verifyAuditChain,
  repairLegacyAuditChain,
  INTEGRITY_COLLECTION_TYPES,
  strictISODate,
  scanTransactionIntegrity,
  importComparableRow,
  importRowsEquivalent,
  rowImportDate,
  buildImportConflictReport,
  normalizeIntegrityData,
  findDuplicateTransaction,
  getRate,
  getPurchaseRate,
  purchaseLandedValue,
  purchaseEffectiveRate,
  fuelPurchaseSummary,
  latestRateHistory,
  normalizePOSPayments,
  syncCreditPayments,
  isPasswordHash,
  PURCHASE_TAX_POLICY,
  purchaseRef,
  linkFillingsToPurchases,
  dedupeExactCngSales,
  recoverKnownAug29Sales,
  cngDuplicateAuditRows,
  recoverKnownAug29PaymentRow,
  initialData,
  load,
  openingFor,
  payTotal,
  accountedTotal,
  canonicalDailyPayments,
  paymentForFuelStandard,
  actualPOSForDate,
  fuelPOSForDate,
  isFuelPOSBreakdownKnown,
  knownFuelPOSForDate,
  digitalPartyRecoveryForDate,
  posPartyMatchForDate,
  accountingSnapshot,
  resolveAccountingEndDate,
  salaryExpenseForPeriodPure,
  electricityExpenseForPeriodPure,
  cngSalePurchaseMatchingPure,
  calculateProfitLossEngine,
  standardJournal,
  trialBalance,
  savedPayment,
  creditTotalForFuel,
  previousPending,
  hashPassword,
  monthKey,
  getLockedMonths,
  DATE_ARRAY_KEYS,
  changedMonthsForArray,
  findLockedMutation
} from "./core/pumpDomain";

function safeInitialLoad(){
  try { return load(); } catch (err) {
    console.error("StationMitra boot/load failed; using embedded backup recovery", err);
    try { return initialData(); } catch (e) { console.error("Embedded backup recovery failed", e); return {}; }
  }
}

export class BootErrorBoundary extends React.Component {
  constructor(props){ super(props); this.state={error:null}; }
  static getDerivedStateFromError(error){ return {error}; }
  componentDidCatch(error, info){ console.error("StationMitra UI boot error", error, info); }
  render(){
    if(this.state.error){
      return <div style={{fontFamily:'Arial',padding:24,maxWidth:900,margin:'30px auto'}}><h2>StationMitra शुरू नहीं हो पाया</h2><p>Browser में पुराना/टूटा हुआ local data या cached build मिला है। आपका embedded backup सुरक्षित है।</p><pre style={{whiteSpace:'pre-wrap',background:'#f3f4f6',padding:12,borderRadius:8}}>{String(this.state.error?.message||this.state.error)}</pre><button onClick={()=>{try{localStorage.removeItem(KEY); localStorage.removeItem(KEY+'_session'); location.reload();}catch(e){location.reload();}}} style={{padding:'10px 16px',cursor:'pointer'}}>Recovery करके Restart करें</button></div>;
    }
    return this.props.children;
  }
}

function App() {
  const [data, setData] = useState(safeInitialLoad);
  const [page, setPageState] = useState("Dashboard");
  const [cloudReady, setCloudReady] = useState(!CLOUD_ENABLED);
  const [cloudStatus, setCloudStatus] = useState(CLOUD_ENABLED ? "connecting" : "local");
  const cloudVersionRef = useRef(0);
  const cloudHydratedRef = useRef(!CLOUD_ENABLED);
  const cloudApplyingRef = useRef(false);
  const cloudSaveTimerRef = useRef(null);
  const cloudLastSavedHashRef = useRef("");
  const setPage = target => {
    if (target === "Dashboard" || canAccess(session?.role, target)) setPageState(target);
    else setPageState("Dashboard");
  };
  const [dark, setDark] = useState(false);
  const [session, setSession] = useState(null);
  const [runtimeStationId, setRuntimeStationId] = useState(CLOUD_STATION_ID);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [integrityReport, setIntegrityReport] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [mutationError, setMutationError] = useState("");

  useEffect(() => {
    const onMutationError = e => {
      const reason = String(e?.detail?.reason || "Save blocked");
      setMutationError(reason);
      window.clearTimeout(window.__stationMitraMutationErrorTimer);
      window.__stationMitraMutationErrorTimer = window.setTimeout(() => setMutationError(""), 8000);
    };
    window.addEventListener("stationmitra:mutation-error", onMutationError);
    return () => window.removeEventListener("stationmitra:mutation-error", onMutationError);
  }, []);

  const normalizeRole = role => {
    const r = String(role || "").trim().toLowerCase();
    if (r === "admin") return USER_ROLES.ADMIN;
    if (r === "owner") return USER_ROLES.OWNER;
    if (r === "manager") return USER_ROLES.MANAGER;
    if (r === "operator") return USER_ROLES.OPERATOR;
    if (r === "view only" || r === "view_only" || r === "readonly" || r === "read-only") return USER_ROLES.VIEW_ONLY;
    return "";
  };

  const hydrateCloudUser = async authUser => {
    const profile = await cloudGetProfile(authUser.id);
    if (!profile || profile.active === false) {
      await cloudSignOut();
      throw new Error("Cloud profile missing or inactive");
    }
    const role = normalizeRole(profile.role);
    if (!role) throw new Error("Cloud profile role is invalid");
    const resolvedStationId = await cloudGetStationId(authUser.id);
    if (!resolvedStationId) throw new Error("Cloud pump is not provisioned for this account");
    setRuntimeStationId(resolvedStationId);
    const cloudRow = await cloudLoadState(resolvedStationId);
    let nextData;
    let version;
    if (cloudRow?.data) {
      nextData = normalizeIntegrityData(repairLegacyAuditChain(cloudRow.data));
      const scan = scanTransactionIntegrity(nextData);
      if (scan.errors.length) throw new Error(`Cloud state failed integrity validation: ${scan.errors[0].reason}`);
      version = Number(cloudRow.version || 1);
    } else {
      // First cloud initialization: seed only from the current authoritative browser copy.
      nextData = normalizeIntegrityData(repairLegacyAuditChain(data));
      const scan = scanTransactionIntegrity(nextData);
      if (scan.errors.length) throw new Error(`Local state failed integrity validation: ${scan.errors[0].reason}`);
      try {
        const created = await cloudSaveState(resolvedStationId, nextData, 0, authUser.id);
        version = Number(created?.new_version || 1);
      } catch (e) {
        if (e?.code !== "CLOUD_CONFLICT") throw e;
        // Another device initialized the station a moment earlier. Never overwrite it.
        const latest = await cloudLoadState(resolvedStationId);
        if (!latest?.data) throw e;
        nextData = normalizeIntegrityData(repairLegacyAuditChain(latest.data));
        version = Number(latest.version || 1);
      }
    }
    cloudApplyingRef.current = true;
    setData(nextData);
    cloudVersionRef.current = version;
    cloudLastSavedHashRef.current = stableHash(JSON.stringify(nextData));
    cloudHydratedRef.current = true;
    setSession({ uid:String(authUser.id), username:profile.username || profile.email, email:profile.email || profile.username, role, name:profile.name || profile.username || profile.email });
    setCloudReady(true);
    setCloudStatus("online");
    setAuthReady(true);
    setTimeout(() => { cloudApplyingRef.current = false; }, 0);
  };

  useEffect(() => {
    if (!CLOUD_ENABLED) {
      setAuthReady(true);
      if (CLOUD_REQUIRED) {
        // Production hardening: a cloud-required deployment must never fall back
        // to local/default-user login when the Supabase env config is missing.
        setCloudReady(false);
        setCloudStatus("error");
        setLoginError("Cloud configuration missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY सेट किए बिना यह deployment login allow नहीं करता (VITE_PUMPPRO_CLOUD_REQUIRED=true)। Vercel env variables जोड़कर redeploy करें।");
        return;
      }
      const saved = localStorage.getItem(KEY + '_session');
      if (saved) {
        try { setSession(JSON.parse(saved)); } catch { localStorage.removeItem(KEY + '_session'); }
      }
      return;
    }
    // A Vercel build is intentionally Cloud-first, but a missing build-time
    // Supabase configuration must never dereference a null client. Show a
    // recoverable configuration state instead of crashing the entire app.
    if (!supabase) {
      setAuthReady(true);
      setCloudReady(false);
      setCloudStatus("error");
      setLoginError("Cloud configuration missing: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not available in this Vercel build.");
      return;
    }
    let mounted = true;
    const bootstrap = async () => {
      try {
        setCloudStatus("connecting");
        const { data: authData, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (authData?.session?.user) await hydrateCloudUser(authData.session.user);
        else { setAuthReady(true); setCloudReady(false); setCloudStatus("login-required"); }
      } catch (e) {
        console.error("Cloud bootstrap failed:", e);
        if (mounted) { setAuthReady(true); setCloudReady(false); setCloudStatus("error"); setLoginError(e?.message || "Cloud connection failed"); }
      }
    };
    bootstrap();
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, authSession) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        cloudHydratedRef.current = false;
        setSession(null); setCloudReady(false); setCloudStatus("login-required");
        return;
      }
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && authSession?.user) {
        try { await hydrateCloudUser(authSession.user); }
        catch (e) { console.error("Cloud auth hydration failed:", e); setLoginError(e?.message || "Cloud account setup failed"); }
      }
    });
    return () => { mounted = false; listener?.subscription?.unsubscribe?.(); };
  }, []);

  const refreshCloudData = async () => {
    if (!CLOUD_ENABLED || !session?.uid) return { ok:false, reason:"Cloud session not ready" };
    try {
      setCloudStatus("connecting");
      const latest = await cloudLoadState(runtimeStationId);
      if (!latest?.data) return { ok:false, reason:"Cloud state not found" };
      const next = normalizeIntegrityData(repairLegacyAuditChain(latest.data));
      const scan = scanTransactionIntegrity(next);
      if (scan.errors.length) {
        const reason = scan.errors.slice(0,5).map(x => x.reason).join(" | ");
        setCloudStatus("error");
        console.error("Cloud refresh rejected by integrity scanner", scan);
        return { ok:false, reason };
      }
      cloudApplyingRef.current = true;
      cloudVersionRef.current = Number(latest.version || 0);
      cloudLastSavedHashRef.current = stableHash(JSON.stringify(next));
      setData(next);
      setCloudStatus("online");
      window.setTimeout(() => { cloudApplyingRef.current = false; }, 0);
      return { ok:true, version:Number(latest.version || 0), count:Array.isArray(next.credits) ? next.credits.length : 0 };
    } catch (e) {
      console.error("Cloud refresh failed:", e);
      setCloudStatus("error");
      return { ok:false, reason:e?.message || "Cloud refresh failed" };
    }
  };

  useEffect(() => {
    if (!CLOUD_ENABLED || !session?.uid || !cloudHydratedRef.current) return;
    const refresh = () => { void refreshCloudData(); };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [session?.uid, runtimeStationId]);

  useEffect(() => {
    if (!CLOUD_ENABLED || !session?.uid || !cloudHydratedRef.current) return;
    return subscribeState(runtimeStationId, remote => {
      const remoteVersion = Number(remote?.version || 0);
      if (!remote?.data || remoteVersion <= cloudVersionRef.current) return;
      try {
        const next = normalizeIntegrityData(repairLegacyAuditChain(remote.data));
        const scan = scanTransactionIntegrity(next);
        if (scan.errors.length) { console.error("Remote cloud state rejected by integrity scanner", scan); return; }
        cloudApplyingRef.current = true;
        cloudVersionRef.current = remoteVersion;
        cloudLastSavedHashRef.current = stableHash(JSON.stringify(next));
        setData(next);
        setCloudStatus("online");
        setTimeout(() => { cloudApplyingRef.current = false; }, 0);
      } catch (e) { console.error("Remote cloud state apply failed:", e); }
    });
  }, [session?.uid]);



  // Central mutation gateway. Returns a result so callers can distinguish an
  // accepted state mutation from an integrity/lock rejection. Existing callers
  // may ignore the returned Promise; critical workflows (e.g. imported bills)
  // can await it and show success only after React accepted the new state.
  const ROLE_MUTATION_POLICY = {
    [USER_ROLES.ADMIN]: { allow: ["*"], delete: true },
    [USER_ROLES.OWNER]: { allow: ["*"], delete: true },
    [USER_ROLES.MANAGER]: { allow: [
      "sales","credits","dailyPayments","ledgerPayments","recoveries",
      "dipReadings","attendance","electricityBills","electricityPayments","staff"
    ], delete: false },
    [USER_ROLES.OPERATOR]: { allow: ["sales","credits","dailyPayments"], delete: false },
    [USER_ROLES.VIEW_ONLY]: { allow: [], delete: false }
  };

  const update = part => new Promise(resolve => setData(d => {
      const incoming = { ...(part || {}) };
      const role = session?.role;
      const policy = ROLE_MUTATION_POLICY[role] || { allow: [], delete: false };
      const businessKeys = Object.keys(incoming).filter(k => !["auditLogs","accountingLocks"].includes(k));

      if (role === USER_ROLES.VIEW_ONLY && businessKeys.length) {
        const reason = "View Only user केवल data देख सकता है; Add / Edit / Delete allowed नहीं है।";
        try { window.alert(`👁️ ${reason}`); } catch {}
        window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
        resolve({ok:false, data:d, reason});
        return d;
      }

      if (![USER_ROLES.ADMIN, USER_ROLES.OWNER].includes(role)) {
        const denied = businessKeys.find(k => !policy.allow.includes(k));
        if (denied) {
          const reason = `${role || "User"} को ${denied} में बदलाव की अनुमति नहीं है।`;
          try { window.alert(`⛔ ${reason}`); } catch {}
          window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
          resolve({ok:false, data:d, reason});
          return d;
        }
        if (businessKeys.some(k => {
          const before = Array.isArray(d[k]) ? d[k] : [];
          const after = Array.isArray(incoming[k]) ? incoming[k] : [];
          const beforeIds = new Set(before.map(x => String(x?.id ?? x?.transactionId ?? "")));
          const afterIds = new Set(after.map(x => String(x?.id ?? x?.transactionId ?? "")));
          return after.length < before.length || [...beforeIds].some(id => id && !afterIds.has(id));
        }) && !policy.delete) {
          const reason = `${role} को Delete permission नहीं है।`;
          try { window.alert(`🛑 ${reason}`); } catch {}
          window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
          resolve({ok:false, data:d, reason});
          return d;
        }
      }

      if (Object.prototype.hasOwnProperty.call(incoming, "accountingLocks") && ![USER_ROLES.ADMIN, USER_ROLES.OWNER].includes(role)) {
        const reason = "Accounting Period Lock केवल Admin / Owner बदल सकते हैं।";
        try { window.alert(`❌ ${reason}`); } catch {}
        window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
        resolve({ok:false, data:d, reason});
        return d;
      }

      const lockedMutation = findLockedMutation(d, incoming);
      if (lockedMutation) {
        const reason = `${lockedMutation.month} month LOCKED है। ${lockedMutation.key} में नई entry/edit/delete allowed नहीं है। पहले Accounting Period Unlock करें।`;
        try { window.alert(`🔒 ${reason}`); } catch {}
        window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
        resolve({ok:false, data:d, reason});
        return d;
      }

      if (Object.prototype.hasOwnProperty.call(incoming, "purchases")) {
        const before = Array.isArray(d.purchases) ? d.purchases : [];
        const after = Array.isArray(incoming.purchases) ? incoming.purchases : [];
        const afterIds = new Set(after.map(x => String(x?.id ?? "")));
        const removed = before.filter(x => !afterIds.has(String(x?.id ?? "")));
        const linked = removed.find(p => (d.fillings || []).some(f => String(f?.purchaseRef || "") === purchaseRef(p)));
        if (linked) {
          const reason = `Purchase Bill ${linked.invoiceNo || purchaseRef(linked)} delete नहीं हो सकता क्योंकि उससे Tank Filling linked है.`;
          try { window.alert(reason); } catch {}
          resolve({ok:false, data:d, reason});
          return d;
        }
      }

      const next = { ...d, ...incoming };
      if (!Number.isFinite(Number(next.cngStateTaxRate))) next.cngStateTaxRate = 0.05;
      if (Object.prototype.hasOwnProperty.call(incoming, 'credits')) {
        // Credit Sale is the source of truth; do not rewrite protected Daily Payment rows during Credit Save.
      }

      const changedKeys = Object.keys(incoming).filter(k => k !== 'auditLogs');
      if (changedKeys.length && session?.username) {
        const action = changedKeys.join(', ');
        const previousHash = Array.isArray(d.auditLogs) && d.auditLogs.length
          ? String(d.auditLogs[d.auditLogs.length - 1]?.hash || "GENESIS")
          : "GENESIS";
        const unsigned = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
          at: new Date().toISOString(),
          userId: String(session.uid || ''),
          username: String(session.username || ''),
          role: String(session.role || ''),
          action,
          details: `Updated: ${action}`,
          previousHash
        };
        const log = { ...unsigned, hash: stableHash(JSON.stringify(unsigned)) };
        next.auditLogs = [...(Array.isArray(d.auditLogs) ? d.auditLogs : []), log];
      }

      const prepared = normalizeIntegrityData(next);
      const beforeScan = scanTransactionIntegrity(d);
      const scan = scanTransactionIntegrity(prepared);
      const signature = x => `${x.type}|${x.collection||""}|${x.index??""}|${x.reason||""}`;
      const beforeErrors = new Set(beforeScan.errors.map(signature));
      const newErrors = scan.errors.filter(x => !beforeErrors.has(signature(x)));
      if (newErrors.length) {
        const reason = newErrors.slice(0,5).map(x=>x.reason).join(" | ");
        console.error("[INTEGRITY BLOCK]", { before: beforeScan, after: scan, newErrors });
        try { window.alert(`❌ Save blocked by Data Integrity Firewall\n\n${newErrors.slice(0,5).map(x=>x.reason).join("\n")}`); } catch {}
        window.dispatchEvent(new CustomEvent("stationmitra:mutation-error", {detail:{reason}}));
        resolve({ok:false, data:d, reason});
        return d;
      }
      resolve({ok:true, data:prepared});
      return prepared;
    }));

  // Persist locally as a cache, and in cloud mode persist through an optimistic-concurrency RPC.
  // localStorage is never treated as the source of truth once cloud mode is authenticated.
  useEffect(() => {
    if (window.__STATIONMITRA_RECOVERY) return;
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (error) { console.error("PumpPro local cache persistence failed:", error); }

    if (!CLOUD_ENABLED || !session?.uid || !cloudHydratedRef.current || cloudApplyingRef.current) return;
    const payloadHash = stableHash(JSON.stringify(data));
    if (payloadHash === cloudLastSavedHashRef.current) return;
    if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
    cloudSaveTimerRef.current = setTimeout(async () => {
      try {
        setCloudStatus("saving");
        const result = await cloudSaveState(runtimeStationId, data, cloudVersionRef.current, session.uid);
        cloudVersionRef.current = Number(result?.new_version || cloudVersionRef.current + 1);
        cloudLastSavedHashRef.current = payloadHash;
        setCloudStatus("online");
      } catch (error) {
        console.error("PumpPro cloud save failed:", error);
        if (error?.code === "CLOUD_CONFLICT") {
          setCloudStatus("conflict");
          try {
            const latest = await cloudLoadState(runtimeStationId);
            if (latest?.data) {
              const next = normalizeIntegrityData(repairLegacyAuditChain(latest.data));
              cloudApplyingRef.current = true;
              cloudVersionRef.current = Number(latest.version || 0);
              cloudLastSavedHashRef.current = stableHash(JSON.stringify(next));
              setData(next);
              setTimeout(() => { cloudApplyingRef.current = false; }, 0);
              alert("⚠️ इस data को दूसरे device पर बदल दिया गया था। आपकी local conflicting change overwrite नहीं की गई; latest cloud data load कर दिया गया है।");
            }
          } catch (reloadError) { console.error("Cloud conflict reload failed:", reloadError); }
        } else {
          setCloudStatus("error");
          alert(`❌ Cloud save failed: ${error?.message || "Unknown error"}`);
        }
      }
    }, 350);
    return () => { if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current); };
  }, [data, session?.uid]);

  const runIntegrityScanner = () => {
    const result = scanTransactionIntegrity(data);
    setIntegrityReport(result);
    if (result.errors.length) {
      alert(`⚠️ Data Integrity Scanner\nErrors: ${result.errors.length}\nWarnings: ${result.warnings.length}\n\n${result.errors.slice(0,8).map(x=>x.reason).join("\n")}`);
    } else {
      alert(`✅ Data Integrity Scanner passed\nChecked records: ${result.checked}\nWarnings: ${result.warnings.length}${result.reconciliationNotes?.length ? `\n\nReconciliation notes: ${result.reconciliationNotes.length} (not integrity errors)` : `\n\nNo integrity or reconciliation warnings.`}`);
    }
  };

  const backupData = () => {
    const backup = {
      ...data,
      backupDate: new Date().toISOString()
    };

    const blob = new Blob(
      [JSON.stringify(backup, null, 2)],
      {
        type: "application/json"
      }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;

    a.download =
      `petrol-pump-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  };
const importData = (event) => {
  const file = event.target.files?.[0];

  if (!file) return;
  if (![USER_ROLES.ADMIN, USER_ROLES.OWNER].includes(session?.role)) {
    alert("❌ Backup Import केवल Admin / Owner कर सकते हैं।");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const imported = JSON.parse(e.target.result);

      if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
        alert("❌ Invalid backup file");
        return;
      }

      // Accept both backup formats:
      // 1) current flat format: { sales, parties, ... }
      // 2) wrapped format: { data: { sales, parties, ... }, backupDate }
      // Never replace valid existing arrays with undefined/empty values accidentally.
      const source = (imported.data && typeof imported.data === "object" && !Array.isArray(imported.data))
        ? imported.data
        : imported;
      const base = initialData();
      let restoredData = {
        ...base,
        ...source,
        openingStock: { ...base.openingStock, ...(source.openingStock || {}) },
        rates: { ...base.rates, ...(source.rates || {}) },
        rateHistory: Array.isArray(source.rateHistory) && source.rateHistory.length
          ? source.rateHistory
          : base.rateHistory,
        sales: Array.isArray(source.sales) ? source.sales : base.sales,
        dailyPayments: normalizePOSPayments(Array.isArray(source.dailyPayments) ? source.dailyPayments : base.dailyPayments),
        paytmTotals: Array.isArray(source.paytmTotals) ? source.paytmTotals : base.paytmTotals,
        parties: Array.isArray(source.parties) && source.parties.length ? source.parties : base.parties,
        credits: Array.isArray(source.credits) ? source.credits : base.credits,
        fillings: Array.isArray(source.fillings) ? source.fillings : base.fillings,
        dipReadings: Array.isArray(source.dipReadings) ? source.dipReadings : base.dipReadings,
        recoveries: Array.isArray(source.recoveries) ? source.recoveries : base.recoveries,
        ledgerPayments: Array.isArray(source.ledgerPayments) ? source.ledgerPayments : base.ledgerPayments,
        ledgerOpenings: Array.isArray(source.ledgerOpenings) ? source.ledgerOpenings : base.ledgerOpenings,
        staff: Array.isArray(source.staff) ? source.staff : base.staff,
        attendance: Array.isArray(source.attendance) ? source.attendance : base.attendance,
        electricityBills: Array.isArray(source.electricityBills) ? source.electricityBills : base.electricityBills,
        electricityPayments: Array.isArray(source.electricityPayments) ? source.electricityPayments : base.electricityPayments,
        purchases: Array.isArray(source.purchases) ? source.purchases : base.purchases,
        users: Array.isArray(source.users) && source.users.length ? source.users : base.users,
        auditLogs: Array.isArray(source.auditLogs) ? source.auditLogs : base.auditLogs,
        partyMasterSchemaVersion: 2,
        accountingPolicy: PURCHASE_TAX_POLICY,
        cngStateTaxRate: Number.isFinite(Number(source.cngStateTaxRate)) ? Number(source.cngStateTaxRate) : base.cngStateTaxRate,
        integritySchemaVersion: 5
      };

      restoredData.users = await Promise.all((restoredData.users || []).map(async u => ({
        ...u,
        password: isPasswordHash(u.password) ? String(u.password) : await hashPassword(u.password)
      })));

      // Credit Sale is the source of truth: rebuild daily credit totals after import.
      restoredData.dailyPayments = syncCreditPayments(
        restoredData.dailyPayments,
        restoredData.credits
      );
      restoredData.fillings = linkFillingsToPurchases(
        restoredData.fillings,
        restoredData.purchases
      );

      const importAudit = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        at: new Date().toISOString(),
        userId: String(session?.uid || ""),
        username: String(session?.username || ""),
        role: String(session?.role || ""),
        action: "BACKUP_IMPORT",
        details: `Backup imported: sales=${restoredData.sales.length}, parties=${restoredData.parties.length}, credits=${restoredData.credits.length}, purchases=${restoredData.purchases.length}, fillings=${restoredData.fillings.length}`
      };
      restoredData.auditLogs = [...(Array.isArray(restoredData.auditLogs) ? restoredData.auditLogs : []), {
        ...importAudit,
        previousHash: Array.isArray(restoredData.auditLogs) && restoredData.auditLogs.length ? String(restoredData.auditLogs[restoredData.auditLogs.length - 1]?.hash || "GENESIS") : "GENESIS"
      }];
      restoredData.auditLogs[restoredData.auditLogs.length - 1].hash = stableHash(JSON.stringify(restoredData.auditLogs[restoredData.auditLogs.length - 1]));
      const auditCheck=verifyAuditChain(restoredData.auditLogs);
      if(!auditCheck.ok){
        restoredData.auditLogs=[...(Array.isArray(restoredData.auditLogs)?restoredData.auditLogs:[]),{
          id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,at:new Date().toISOString(),
          userId:String(session?.uid||''),username:String(session?.username||''),role:String(session?.role||''),
          action:'AUDIT_CHAIN_WARNING',details:`Imported backup audit chain failed verification at index ${auditCheck.index}: ${auditCheck.reason}`,previousHash:'GENESIS'
        }];
        const last=restoredData.auditLogs[restoredData.auditLogs.length-1];
        last.hash=stableHash(JSON.stringify(last));
      }
      restoredData = normalizeIntegrityData(restoredData);
      delete restoredData.backupDate;

      // ATOMIC IMPORT: validate the complete candidate first. Nothing in current
      // state/localStorage is changed until validation and user confirmation pass.
      const importScan = scanTransactionIntegrity(restoredData);
      if (importScan.errors.length) {
        const reasons = importScan.errors.slice(0,8).map(x=>x.reason).join("\n");
        throw new Error(`IMPORT_INTEGRITY_BLOCK\n${reasons}`);
      }
      const lockedImportMutation = findLockedMutation(data, restoredData);
      if (lockedImportMutation) {
        alert(`🔒 Backup import blocked: ${lockedImportMutation.month} month LOCKED है और imported backup में ${lockedImportMutation.key} का change मिला। पहले period unlock करें या locked data वाला backup import न करें।`);
        setImportPreview(null);
        return;
      }

      const conflictReport = buildImportConflictReport(data, restoredData);
      setImportPreview({ counts:{sales:restoredData.sales.length,credits:restoredData.credits.length,purchases:restoredData.purchases.length,fillings:restoredData.fillings.length}, report:conflictReport });
      const proceed = window.confirm(
        `BACKUP IMPORT PREVIEW\n\n` +
        `Sales: ${restoredData.sales.length}\nCredits: ${restoredData.credits.length}\nPurchases: ${restoredData.purchases.length}\nTank Fillings: ${restoredData.fillings.length}\n\n` +
        `New records: ${conflictReport.added.length}\nSame records: ${conflictReport.duplicates.length}\nConflicts: ${conflictReport.conflicts.length}\n\n` +
        `No existing data has been changed yet.\nClick OK only to atomically commit this validated backup.`
      );
      if (!proceed) {
        setImportPreview(null);
        alert("ℹ️ Import cancelled — existing data was not changed.");
        return;
      }

      // SAFE RECOVERY MERGE: never block the whole recovery because of legacy
      // identity/fingerprint differences. Exact duplicates are skipped. For a
      // same-key/different-content row, mergeCollections below preserves the live
      // row and, when the imported row is from a newer date, stores it under a
      // deterministic RECOVERY identity so the newer accounting data survives.
      // This is critical when the live cloud snapshot ends earlier than the backup.

      const mergeCollections = (collection) => {
        const currentRows = Array.isArray(data?.[collection]) ? data[collection] : [];
        const incomingRows = Array.isArray(restoredData?.[collection]) ? restoredData[collection] : [];
        const byKey = new Map(currentRows.map((r,i)=>[String(r?.transactionId || r?.id || `${collection}-${i}`), r]));
        // Import idempotency firewall: fingerprints are global transaction identities.
        // When the same already-stored fingerprint is present in the incoming backup,
        // do not create a second row merely because its legacy key/ID differs.
        // Exact/equivalent duplicates are skipped; a same-fingerprint/different-content
        // row remains a hard integrity conflict and is never silently rewritten.
        const byFingerprint = new Map();
        const currentDeduped = [];
        for (const r of currentRows) {
          const fp = String(r?.fingerprint || r?.transactionFingerprint || '').trim();
          if (fp && byFingerprint.has(fp)) {
            const prior = byFingerprint.get(fp);
            // A byte-for-byte/equivalent duplicate already present in live data is
            // safe to collapse during an atomic import. This fixes legacy duplicate
            // fingerprint rows such as dailyPayments[59] without altering business
            // values. A same-fingerprint/different-content collision is retained so
            // the final integrity firewall can still block it.
            if (importRowsEquivalent(prior, r)) continue;
          }
          currentDeduped.push(r);
          if (fp) byFingerprint.set(fp, r);
        }
        const merged = [...currentDeduped];
        byKey.clear();
        currentDeduped.forEach((r,i)=>byKey.set(String(r?.transactionId || r?.id || `${collection}-${i}`), r));
        const maxExistingDate = currentRows.reduce((m, r) => Math.max(m, rowImportDate(r) ? Date.parse(rowImportDate(r)) : 0), 0);
        for (const row of incomingRows) {
          const incomingFp = String(row?.fingerprint || row?.transactionFingerprint || '').trim();
          if (incomingFp && byFingerprint.has(incomingFp)) {
            const fingerprintMatch = byFingerprint.get(incomingFp);
            if (importRowsEquivalent(fingerprintMatch, row)) continue;
            // Same fingerprint but different business content is a real integrity
            // collision/tamper signal. Preserve the firewall rather than guessing.
            const collisionKey = String(row?.transactionId || row?.id || `${collection}-fingerprint-collision`);
            let collision = byKey.get(collisionKey);
            if (!collision) collision = fingerprintMatch;
            throw new Error(`${collection}: same fingerprint with different content (${incomingFp})`);
          }
          let key = String(row?.transactionId || row?.id || "").trim();
          if (!key) key = `${collection}-${stableHash(canonicalIntegrityValue(importComparableRow(row))).slice(3)}`;
          const same = byKey.get(key);
          if (!same) {
            const next = ensureTransactionIdentity(INTEGRITY_COLLECTION_TYPES[collection] || collection, row, key);
            byKey.set(key, next);
            if (String(next?.fingerprint || next?.transactionFingerprint || '').trim()) byFingerprint.set(String(next.fingerprint || next.transactionFingerprint).trim(), next);
            merged.push(next);
            continue;
          }
          if (importRowsEquivalent(same, row)) continue;
          // Any same-key but different-content backup row is preserved as a
          // separate deterministic recovery transaction. This prevents a
          // legacy/reused ID from discarding real historical data.
          const suffix = stableHash(canonicalIntegrityValue(importComparableRow(row))).slice(3);
          const repairedKey = `${key}-RECOVERY-${suffix}`;
          // Idempotency firewall: if this exact recovery transaction was already
          // imported earlier, do NOT create a second -2/-3 copy on re-import.
          const existingRecovery = byKey.get(repairedKey);
          if (existingRecovery && importRowsEquivalent(existingRecovery, row)) continue;
          // A different transaction with the same legacy key gets a deterministic
          // secondary identity. Only add a counter when the deterministic key is
          // genuinely occupied by different business content.
          let finalKey = repairedKey;
          let counter = 2;
          while (byKey.has(finalKey) && !importRowsEquivalent(byKey.get(finalKey), row)) {
            finalKey = `${repairedKey}-${counter++}`;
          }
          const next = ensureTransactionIdentity(INTEGRITY_COLLECTION_TYPES[collection] || collection, row, finalKey);
          byKey.set(finalKey, next);
          if (String(next?.fingerprint || next?.transactionFingerprint || '').trim()) byFingerprint.set(String(next.fingerprint || next.transactionFingerprint).trim(), next);
          merged.push(next);
        }
        return merged;
      };
      const mergedData = { ...data };
      // Live accounting locks are authoritative; a backup must never silently unlock a closed period.
      mergedData.accountingLocks = { months: Array.from(getLockedMonths(data)) };
      for (const collection of Object.keys(INTEGRITY_COLLECTION_TYPES)) mergedData[collection] = mergeCollections(collection);
      mergedData.parties = mergeCollections('parties');
      mergedData.users = data.users?.length ? data.users : restoredData.users;
      mergedData.cngStateTaxRate = data.cngStateTaxRate ?? restoredData.cngStateTaxRate;
      mergedData.accountingPolicy = data.accountingPolicy || restoredData.accountingPolicy;
      mergedData.integritySchemaVersion = 5;
      // Audit chains cannot be concatenated blindly because the imported chain
      // has a different previousHash root. Preserve the live chain and append
      // one fresh import event into that chain.
      const liveAudit = Array.isArray(data.auditLogs) ? data.auditLogs : [];
      const previousHash = liveAudit.length ? String(liveAudit[liveAudit.length-1]?.hash || "GENESIS") : "GENESIS";
      const importEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        at: new Date().toISOString(),
        userId: String(session?.uid || ""),
        username: String(session?.username || ""),
        role: String(session?.role || ""),
        action: "BACKUP_MERGE",
        details: `Backup recovery merge: added=${conflictReport.added.length}, duplicates=${conflictReport.duplicates.length}, conflicts-preserved=${conflictReport.conflicts.length}`,
        previousHash
      };
      importEvent.hash = stableHash(JSON.stringify(importEvent));
      mergedData.auditLogs = [...liveAudit, importEvent];
      const finalCandidate = normalizeIntegrityData(mergedData);
      const finalScan = scanTransactionIntegrity(finalCandidate);
      if (finalScan.errors.length) {
        alert(`❌ Import merge blocked by integrity firewall\n\n${finalScan.errors.slice(0,8).map(x=>x.reason).join("\n")}\n\nExisting data was NOT changed.`);
        return;
      }
      // Single final commit point. In cloud mode commit to Supabase FIRST so
      // hydration/Realtime can never restore the stale Sep-01 snapshot.
      if (CLOUD_ENABLED && session?.uid && cloudHydratedRef.current) {
        try {
          if (cloudSaveTimerRef.current) clearTimeout(cloudSaveTimerRef.current);
          setCloudStatus("saving");
          const saved = await cloudSaveState(
            runtimeStationId,
            finalCandidate,
            Number(cloudVersionRef.current || 0),
            session.uid
          );
          cloudVersionRef.current = Number(saved?.new_version || Number(cloudVersionRef.current || 0) + 1);
          cloudLastSavedHashRef.current = stableHash(JSON.stringify(finalCandidate));
          cloudApplyingRef.current = true;
          setData(finalCandidate);
          localStorage.setItem(KEY, JSON.stringify(finalCandidate));
          setCloudStatus("online");
          setTimeout(() => { cloudApplyingRef.current = false; }, 0);
        } catch (cloudError) {
          console.error("Recovery cloud commit failed:", cloudError);
          setCloudStatus("error");
          alert(`❌ Recovery cloud commit नहीं हुआ।\n\nExisting data सुरक्षित है।\n\n${cloudError?.message || "Cloud save failed"}`);
          return;
        }
      } else {
        setData(finalCandidate);
        localStorage.setItem(KEY, JSON.stringify(finalCandidate));
      }
      setImportPreview(null);
      setPage("Dashboard");
      alert(`✅ Backup recovery merged safely\n\nNew records added: ${conflictReport.added.length}\nExact duplicates skipped: ${conflictReport.duplicates.length}\nContent/legacy differences preserved with recovery IDs.\n\nCloud + local data committed.`);
    } catch (error) {
      console.error("Import error:", error);
      alert("❌ Backup file सही नहीं है");
    }
  };

  reader.readAsText(file);
  event.target.value = "";
};
  const totals = useMemo(() => accountingSnapshot(data), [data]);

  const css = `
    *{box-sizing:border-box}

    body{
      margin:0;
      font-family:Arial,sans-serif;
      background:${dark ? "#111827" : "#f5f7fb"};
      color:${dark ? "#f3f4f6" : "#172033"};
    }

    button,input,select{
      font:inherit;
    }

    button{
      cursor:pointer;
    }

    .app{
      display:flex;
      min-height:100vh;
    }

    .side{
      width:220px;
      background:${dark ? "#172033" : "#fff"};
      border-right:1px solid #ddd;
      padding:18px;
      position:fixed;
      top:0;
      bottom:0;
    }

    .brand{
      font-size:22px;
      font-weight:800;
      margin-bottom:25px;
    }

    .brand small{
      display:block;
      font-size:11px;
      color:#777;
      margin-top:3px;
    }
.nav {
  max-height: 100vh;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 20px;
}
    .nav button{
      width:100%;
      padding:12px;
      border:0;
      background:none;
      border-radius:9px;
      text-align:left;
      margin:4px 0;
      color:inherit;
    }

    .nav button.active{
      background:#253b67;
      color:#fff;
    }

    .main{
      margin-left:220px;
      width:calc(100% - 220px);
    }

    .top{
      height:78px;
      background:${dark ? "#172033" : "#fff"};
      border-bottom:1px solid #ddd;
      padding:15px 28px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }

    .top h1{
      margin:0;
      font-size:24px;
    }

    .top p{
      margin:4px 0;
      color:#777;
      font-size:12px;
    }

    .content{
      padding:25px;
      max-width:1500px;
      margin:auto;
    }

    .hero{
      background:#263b64;
      color:#fff;
      border-radius:14px;
      padding:25px;
      display:flex;
      justify-content:space-between;
      align-items:center;
    }

    .hero h2{
      margin:6px 0;
    }

    .btn{
      border:0;
      border-radius:8px;
      padding:10px 15px;
      background:#3159a5;
      color:#fff;
      font-weight:700;
    }

    .btn.gray{
      background:#e8ebf1;
      color:#172033;
    }

    .btn.red{
      background:#c43d3d;
    }

    .btn.small{
      padding:7px 10px;
      font-size:12px;
    }

    .cards{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:14px;
      margin:18px 0;
    }

    .card,.panel{
      background:${dark ? "#172033" : "#fff"};
      border:1px solid #e2e5ea;
      border-radius:12px;
      padding:17px;
    }

    .card span,.card small{
      display:block;
      color:#777;
    }

    .card strong{
      font-size:22px;
      display:block;
      margin:8px 0;
    }

    .grid{
      display:grid;
      grid-template-columns:1fr 1fr;
      gap:18px;
    }

    .panel h2,.panel h3{
      margin:0 0 6px;
    }

    .panel p{
      color:#777;
      font-size:12px;
    }

    .form{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:14px;
    }

    .field span{
      display:block;
      font-size:12px;
      font-weight:700;
      margin-bottom:6px;
    }

    .field input,.field select{
      width:100%;
      padding:10px;
      border:1px solid #ccd2dc;
      border-radius:7px;
      background:${dark ? "#202b3f" : "#fff"};
      color:inherit;
    }

    .readonly{
      background:#eef2f7!important;
      color:#172033!important;
    }

    .actions{
      display:flex;
      gap:10px;
      margin-top:18px;
    }

    .table{
      overflow:auto;
    }

    .table table{
      width:100%;
      border-collapse:collapse;
      font-size:13px;
    }

    .table th,.table td{
      padding:9px;
      border-bottom:1px solid #ddd;
      text-align:left;
      white-space:nowrap;
    }

    .notice{
      margin:15px 0;
      padding:11px;
      background:#e7f7ec;
      border-radius:8px;
      color:#126b35;
    }

    .notice.error{
      background:#ffe5e5;
      color:#9b1c1c;
    }

    .warning{
      padding:12px;
      background:#fff4d6;
      border-radius:8px;
      color:#755400;
      margin-bottom:15px;
    }

    .meter-table input{
      width:115px;
      padding:8px;
      border:1px solid #ccd2dc;
      border-radius:7px;
    }

    .total-box{
      display:grid;
      grid-template-columns:repeat(4,1fr);
      gap:12px;
      margin-top:15px;
    }

    .mini{
      padding:13px;
      background:${dark ? "#202b3f" : "#f6f8fb"};
      border:1px solid #e0e4ea;
      border-radius:8px;
    }

    .mini span{
      display:block;
      font-size:11px;
      color:#777;
    }

    .mini strong{
      display:block;
      margin-top:5px;
      font-size:18px;
    }

    .balance-ok{
      padding:12px;
      background:#e7f7ec;
      border-radius:8px;
      color:#126b35;
      margin-top:15px;
      font-weight:700;
    }

    .balance-bad{
      padding:12px;
      background:#ffe5e5;
      border-radius:8px;
      color:#9b1c1c;
      margin-top:15px;
      font-weight:700;
    }

    .search{
      width:300px;
      padding:10px;
      border:1px solid #ccd2dc;
      border-radius:7px;
    }

    .pagination{
      display:flex;
      gap:5px;
      flex-wrap:wrap;
      align-items:center;
      margin-top:15px;
    }

    .pagination button{
      border:1px solid #ccd2dc;
      background:#fff;
      padding:7px 10px;
      border-radius:6px;
    }

    .pagination .active{
      background:#3159a5;
      color:#fff;
    }

    @media(max-width:1000px){
      .cards{
        grid-template-columns:repeat(2,1fr);
      }

      .form{
        grid-template-columns:1fr 1fr;
      }

      .grid{
        grid-template-columns:1fr;
      }

      .total-box{
        grid-template-columns:repeat(2,1fr);
      }
    }

    @media(max-width:600px){
      .side{
        display:none;
      }

      .main{
        margin:0;
        width:100%;
      }

      .cards,.form,.total-box{
        grid-template-columns:1fr;
      }

      .content{
        padding:12px;
      }
    }

    /* =====================================================
       Station Mitra Professional Dashboard Design
    ===================================================== */
    body{background:#f5f8fc;color:#162033}
    .app{background:#f5f8fc}
    .side{width:248px;background:linear-gradient(180deg,#063b84 0%,#082f69 100%);border-right:0;color:#fff;padding:18px 15px;box-shadow:6px 0 22px rgba(8,47,105,.08)}
    .brand{font-size:27px;letter-spacing:-.6px;color:#fff;margin:2px 8px 28px}
    .brand small{color:#dbeafe;font-size:11px;font-weight:500;letter-spacing:.2px}
    .nav{max-height:calc(100vh - 110px);padding-bottom:30px}
    .nav button{color:#dbeafe;border-radius:10px;padding:11px 13px;font-weight:700;font-size:13px;transition:.15s;background:transparent}
    .nav button:hover{background:rgba(255,255,255,.10);color:#fff}
    .nav button.active{background:#1677f2;color:#fff;box-shadow:0 7px 16px rgba(0,0,0,.12)}
    .main{margin-left:248px;width:calc(100% - 248px)}
    .top{height:82px;background:#fff;border-bottom:1px solid #e6ebf2;padding:15px 30px;box-shadow:0 1px 8px rgba(15,23,42,.03)}
    .top h1{font-size:23px;color:#162033}
    .top p{color:#64748b}
    .content{padding:24px 28px;max-width:1600px}
    .pro-dashboard{background:#f5f8fc}
    .pro-welcome{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1px solid #e6ebf2;border-radius:16px;padding:20px 22px;margin-bottom:18px;box-shadow:0 5px 20px rgba(15,23,42,.035)}
    .pro-welcome h2{margin:5px 0;font-size:25px;letter-spacing:-.4px}
    .pro-welcome p{margin:4px 0;color:#64748b;font-size:12px}
    .pro-eyebrow{font-size:10px;font-weight:800;letter-spacing:1.2px;color:#1677f2}
    .pro-primary{border:0;border-radius:10px;padding:12px 17px;background:#1677f2;color:#fff;font-weight:800;box-shadow:0 7px 15px rgba(22,119,242,.22);cursor:pointer}
    .pro-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-bottom:18px}
    .pro-kpi{display:flex;align-items:center;gap:13px;background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:17px;min-height:112px;box-shadow:0 5px 18px rgba(15,23,42,.03)}
    .pro-kpi-icon{width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;flex:0 0 auto}
    .pro-kpi span{display:block;font-size:11px;color:#64748b;font-weight:800;text-transform:uppercase;letter-spacing:.35px}
    .pro-kpi strong{display:block;font-size:22px;margin:6px 0 3px;color:#111827}
    .pro-kpi small{display:block;font-size:10px;color:#64748b}
    .pro-kpi.blue .pro-kpi-icon{background:#e8f1ff;color:#1677f2}.pro-kpi.green .pro-kpi-icon{background:#e8f8ee;color:#16a34a}.pro-kpi.orange .pro-kpi-icon{background:#fff2dc;color:#f59e0b}.pro-kpi.red .pro-kpi-icon{background:#ffe9e9;color:#ef4444}
    .pro-main-grid{display:grid;grid-template-columns:1.25fr 1.05fr .95fr;gap:16px;align-items:stretch}
    .pro-bottom-grid{display:grid;grid-template-columns:1.65fr .85fr;gap:16px}
    .pro-panel{background:#fff;border:1px solid #e6ebf2;border-radius:14px;padding:17px;box-shadow:0 5px 18px rgba(15,23,42,.03);min-width:0}
    .pro-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:15px}
    .pro-panel-head h3{margin:0;color:#162033;font-size:15px}.pro-panel-head span{display:block;color:#64748b;font-size:10px;margin-top:4px}
    .pro-link{border:0;background:transparent;color:#1677f2;font-size:11px;font-weight:800;cursor:pointer;padding:4px 0}
    .pro-bell{width:25px;height:25px;border-radius:50%;background:#fff2d8;color:#f59e0b;text-align:center;padding-top:5px;font-weight:900}
    .pro-bars{padding:8px 0 2px}.pro-bar-row{display:grid;grid-template-columns:1fr 1.25fr 45px;gap:10px;align-items:center;margin:16px 0}.pro-bar-label{display:flex;align-items:center;gap:7px;font-size:11px}.pro-bar-label strong{margin-left:auto;font-size:11px}.dot{width:9px;height:9px;border-radius:50%;display:inline-block}.pro-track{height:10px;background:#edf2f7;border-radius:99px;overflow:hidden}.pro-fill{height:100%;border-radius:99px}.pro-percent{text-align:right;color:#64748b;font-size:10px}.pro-total-line{border-top:1px solid #edf1f5;margin-top:15px;padding-top:12px;display:flex;justify-content:space-between;font-size:12px}.pro-total-line b{font-size:14px}
    .pro-payment-row{display:grid;grid-template-columns:1fr auto 42px;gap:8px;align-items:center;margin:12px 0}.pro-payment-name{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700}.pro-payment-name i{width:9px;height:9px;border-radius:50%}.pro-payment-row b{font-size:11px}.pro-payment-pct{text-align:right;color:#64748b;font-size:10px}.pro-mini-track{grid-column:1/-1;height:4px;background:#eef2f6;border-radius:99px;overflow:hidden}.pro-mini-track div{height:100%;border-radius:99px}
    .pro-alert-list{display:flex;flex-direction:column;gap:9px}.pro-alert{display:flex;justify-content:space-between;gap:10px;padding:12px;border-radius:10px;border:1px solid #edf0f4}.pro-alert div b{display:block;font-size:11px}.pro-alert div span{display:block;font-size:9px;color:#64748b;margin-top:4px}.pro-alert strong{font-size:11px;white-space:nowrap}.pro-alert.danger{background:#fff7f7;border-color:#fee2e2}.pro-alert.danger strong{color:#dc2626}.pro-alert.ok{background:#f5fbf7}.pro-alert.ok strong{color:#16a34a}
    .pro-info-row{display:grid;grid-template-columns:repeat(3,1fr);gap:15px;margin:16px 0}.pro-info{border-radius:12px;padding:13px 15px;border:1px solid}.pro-info b{display:block;font-size:11px;margin-bottom:5px}.pro-info span{display:block;font-size:10px;line-height:1.45;color:#475569}.pro-info.green{background:#f2fbf5;border-color:#d8f1df}.pro-info.green b{color:#15803d}.pro-info.orange{background:#fff9ed;border-color:#fce8bb}.pro-info.orange b{color:#c2410c}.pro-info.red{background:#fff5f5;border-color:#fee0e0}.pro-info.red b{color:#dc2626}
    .pro-table table{font-size:11px}.pro-table th{color:#64748b;font-size:10px;background:#f8fafc}.pro-table th,.pro-table td{padding:10px;border-bottom:1px solid #edf1f5}.pro-table .total-row td{font-weight:800;background:#f6fbf8}
    .pro-side-stack{display:flex;flex-direction:column;gap:16px}.pro-summary-list{display:flex;flex-direction:column}.pro-summary-list div{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #edf1f5;font-size:11px}.pro-summary-list div:last-child{border-bottom:0}.pro-summary-list span{color:#64748b}.pro-quick-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.pro-quick-grid button{background:#fff;border:1px solid #e5eaf0;border-radius:9px;padding:10px 5px;min-height:68px;cursor:pointer}.pro-quick-grid button:hover{border-color:#93c5fd;background:#f8fbff}.pro-quick-grid span{display:block;font-size:20px;margin-bottom:5px}.pro-quick-grid b{font-size:9px;color:#334155}
    .pro-stock-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.pro-stock-grid div{background:#f8fafc;border:1px solid #edf1f5;border-radius:10px;padding:14px}.pro-stock-grid span{font-size:11px;color:#64748b;font-weight:800}.pro-stock-grid strong{display:block;font-size:20px;margin:7px 0}.pro-stock-grid small{font-size:9px;color:#64748b}.pro-latest-list div{display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #edf1f5;font-size:11px}.pro-latest-list div:last-child{border-bottom:0}.pro-legacy-panel{margin-top:18px}.pro-legacy-panel p{margin:5px 0 12px}
    @media(max-width:1200px){.pro-main-grid{grid-template-columns:1fr 1fr}.pro-main-grid .pro-panel:last-child{grid-column:1/-1}.pro-kpis{grid-template-columns:repeat(2,1fr)}}
    @media(max-width:850px){.side{width:210px}.main{margin-left:210px;width:calc(100% - 210px)}.pro-main-grid,.pro-bottom-grid{grid-template-columns:1fr}.pro-info-row{grid-template-columns:1fr}.pro-welcome{align-items:flex-start;gap:15px;flex-direction:column}}
    @media(max-width:600px){.side{display:none}.main{margin:0;width:100%}.content{padding:12px 12px 88px}.pro-kpis{grid-template-columns:1fr 1fr}.pro-bar-row{grid-template-columns:1fr}.pro-percent{text-align:left}.pro-quick-grid{grid-template-columns:repeat(2,1fr)}.top{height:auto;min-height:64px;padding:10px 12px}.top>div:last-child .btn,.top .userbar{display:none}.top h1{font-size:17px}.top p{font-size:10px}.mobile-bottom-nav{display:grid!important}.dashboard-hero{padding:18px;border-radius:18px}.dashboard-hero h2{font-size:24px}.hero-actions{width:100%;display:grid;grid-template-columns:1fr 1fr}.hero-date,.pro-primary{width:100%;font-size:11px}.premium-kpis .pro-kpi{min-height:108px;padding:13px}.premium-kpis .pro-kpi strong{font-size:18px}.premium-grid-top,.premium-lower-grid,.collection-grid{grid-template-columns:1fr}.rule-strip{grid-template-columns:1fr;gap:8px}.pro-panel{padding:14px}.premium-table{overflow-x:auto}.premium-table table{min-width:560px}.collection-kpis{grid-template-columns:1fr 1fr}.collection-actions{width:100%}.collection-date{flex:1}.collection-date input{width:100%}.collection-history-list{grid-template-columns:1fr 1fr}.collection-hero{padding:16px}.collection-hero h2{font-size:21px}}\n    .mobile-bottom-nav{display:none;position:fixed;z-index:1000;left:0;right:0;bottom:0;background:rgba(255,255,255,.97);backdrop-filter:blur(12px);border-top:1px solid #dfe6ef;padding:7px 5px calc(7px + env(safe-area-inset-bottom));grid-template-columns:repeat(5,1fr);box-shadow:0 -6px 24px rgba(15,23,42,.10)}.mobile-bottom-nav button{border:0;background:transparent;border-radius:11px;padding:6px 2px;color:#64748b;font-size:9px;cursor:pointer}.mobile-bottom-nav button span{display:block;font-size:18px;line-height:20px}.mobile-bottom-nav button b{font-size:9px}.mobile-bottom-nav button.active{background:#eaf2ff;color:#1266d4}\n    .premium-dashboard{background:linear-gradient(180deg,#f3f7fc 0%,#f8fafc 100%)}.dashboard-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:24px 26px;margin-bottom:18px;border-radius:20px;color:#fff;background:linear-gradient(135deg,#0b3b82 0%,#146fe8 55%,#13a67a 140%);box-shadow:0 14px 30px rgba(13,74,145,.20)}.dashboard-hero .pro-eyebrow{color:#cfe3ff}.dashboard-hero h2{margin:7px 0 4px;font-size:28px;letter-spacing:-.6px}.dashboard-hero p{margin:0;color:#dceaff;font-size:12px}.hero-actions{display:flex;align-items:center;gap:9px}.hero-date{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:#fff;border-radius:10px;padding:11px 13px;font-weight:800}.premium-grid-top{display:grid;grid-template-columns:1.15fr 1fr .82fr;gap:16px}.premium-lower-grid{display:grid;grid-template-columns:1.55fr .75fr;gap:16px;margin-top:16px}.premium-side-stack{display:flex;flex-direction:column;gap:16px}.fuel-visual{padding:4px 0}.fuel-row{margin:17px 0}.fuel-row-head{display:flex;justify-content:space-between;gap:10px;font-size:12px}.fuel-row-head span{display:flex;align-items:center;gap:8px}.fuel-row-head i{width:10px;height:10px;border-radius:50%;display:inline-block}.fuel-bar{height:12px;background:#eef3f8;border-radius:99px;overflow:hidden;margin:8px 0 5px}.fuel-bar div{height:100%;border-radius:99px}.fuel-row small{font-size:10px;color:#7a8798}.big-total{display:flex;justify-content:space-between;border-top:1px solid #e9eef4;padding-top:13px;margin-top:8px}.big-total b{font-size:18px}.collection-title{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.collection-title h3{margin:0}.collection-total{padding:18px;border-radius:14px;background:linear-gradient(135deg,#eaf8f0,#f5fbff);margin:8px 0 15px}.collection-total span,.collection-total small{display:block;color:#64748b;font-size:10px}.collection-total strong{display:block;font-size:27px;margin:5px 0;color:#0f172a}.payment-mini-list>div{display:grid;grid-template-columns:1fr auto 36px;gap:8px;align-items:center;margin:10px 0;font-size:11px}.payment-mini-list span{display:flex;gap:7px;align-items:center;font-weight:700}.payment-mini-list i{width:8px;height:8px;border-radius:50%}.payment-mini-list em{font-style:normal;color:#94a3b8;font-size:10px;text-align:right}.payment-mini-list>div>div{grid-column:1/-1;height:4px;background:#eef2f7;border-radius:99px;overflow:hidden}.payment-mini-list u{display:block;height:100%;border-radius:99px;text-decoration:none}.attention-card{padding:12px;border-radius:11px;background:#f7faff;border:1px solid #e5edf6;margin:9px 0}.attention-card span,.attention-card small{display:block;color:#64748b;font-size:10px}.attention-card b{display:block;font-size:15px;margin:4px 0}.attention-card.danger{background:#fff7f7;border-color:#ffdede}.attention-card.danger b{color:#dc2626}.attention-card.ok{background:#f2fbf5;border-color:#d9f1df}.attention-card.ok b{color:#15803d}.rule-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.rule-strip div{padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #e4eaf2}.rule-strip b{display:block;font-size:10px;margin-bottom:4px}.rule-strip span{font-size:10px;color:#64748b;line-height:1.4}.rule-strip div:first-child b{color:#15803d}.rule-strip div:nth-child(2) b{color:#c2410c}.rule-strip div:last-child b{color:#dc2626}.premium-quick button{min-height:76px}.stock-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px}.stock-cards div{padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e9eef5}.stock-cards span{display:block;font-size:11px;color:#64748b;font-weight:800}.stock-cards b{display:block;font-size:20px;margin-top:7px}.collection-page{background:#f4f7fb;min-height:100%}.collection-hero{display:flex;justify-content:space-between;gap:15px;align-items:center;background:linear-gradient(135deg,#082f69,#1677f2);color:#fff;padding:22px;border-radius:18px;margin-bottom:16px}.collection-hero .pro-eyebrow{color:#cfe3ff}.collection-hero h2{margin:5px 0;font-size:25px}.collection-hero p{margin:0;color:#dbeafe;font-size:11px}.collection-actions{display:flex;gap:9px;align-items:center}.collection-date{display:flex;align-items:center;gap:7px;background:rgba(255,255,255,.12);padding:8px 10px;border-radius:9px;font-size:10px;font-weight:800}.collection-date input{border:0;border-radius:6px;padding:7px;background:#fff;color:#111827}.collection-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}.collection-kpi{padding:16px;background:#fff;border-radius:14px;border:1px solid #e4eaf2}.collection-kpi span,.collection-kpi small{display:block;color:#64748b;font-size:10px}.collection-kpi strong{display:block;font-size:21px;margin:6px 0}.collection-kpi.blue strong{color:#1677f2}.collection-kpi.green strong{color:#15803d}.collection-kpi.orange strong{color:#c2410c}.collection-kpi.purple strong{color:#7c3aed}.collection-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.collection-breakdown>div{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #edf1f5;font-size:12px}.collection-breakdown .total{font-size:14px;border-top:2px solid #e5eaf0;border-bottom:0;margin-top:6px}.collection-note{padding:11px 12px;border-radius:10px;font-size:10px;line-height:1.5;margin-top:10px}.green-note{background:#f1fbf5;color:#166534}.red-note{background:#fff5f5;color:#991b1b}.collection-party-list>div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid #edf1f5}.collection-party-list small{display:block;color:#94a3b8;font-size:9px;margin-top:3px}.collection-party-list strong{white-space:nowrap}.collection-party-total{font-size:13px;background:#f7fafc;padding:12px!important;margin-top:6px;border-radius:9px}.empty-state{padding:24px;text-align:center;color:#94a3b8;font-size:11px;background:#f8fafc;border-radius:10px}.collection-history{margin-top:16px}.collection-history-list{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.collection-history-list button{border:1px solid #e5eaf0;background:#fff;border-radius:9px;padding:10px;display:flex;justify-content:space-between;gap:8px;cursor:pointer}.collection-history-list button.selected{border-color:#1677f2;background:#eff6ff}.collection-history-list span{font-size:10px;color:#64748b}.collection-history-list b{font-size:10px;color:#0f172a}\n\n    .staff-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:16px}\n    .staff-form-grid{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:9px;align-items:end}\n    .staff-form-grid label,.bill-form-grid label{display:block;font-size:10px;color:#64748b;font-weight:800}\n    .staff-form-grid input,.bill-form-grid input,.bill-form-grid select{width:100%;margin-top:5px;border:1px solid #dbe3ec;border-radius:8px;padding:9px;background:#fff;color:#172033}\n    .staff-table{overflow-x:auto}.staff-table table{width:100%;border-collapse:collapse;font-size:11px;min-width:760px}\n    .staff-table th,.staff-table td{padding:10px;border-bottom:1px solid #edf1f5;text-align:left}\n    .staff-table th{background:#f8fafc;color:#64748b;font-size:10px}\n    .staff-pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#eaf2ff;color:#1557a6;font-size:10px;font-weight:800}\n    .attendance-form{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:9px;align-items:end;margin-top:14px}\n    .attendance-form label{display:block;font-size:10px;color:#64748b;font-weight:800}\n    .attendance-form input,.attendance-form select{width:100%;margin-top:5px;border:1px solid #dbe3ec;border-radius:8px;padding:9px;background:#fff}\n    .attendance-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin:12px 0}\n    .attendance-summary div{padding:12px;border-radius:10px;background:#f8fafc;border:1px solid #e8edf3}\n    .attendance-summary span{display:block;font-size:9px;color:#64748b}.attendance-summary b{display:block;font-size:17px;margin-top:4px}\n    .bill-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n    .bill-upload{grid-column:1/-1;border:1px dashed #a9bdd6;border-radius:10px;padding:12px;background:#f8fbff}\n    .bill-upload input{border:0;padding:5px 0;background:transparent}\n    .bill-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}\n    .bill-row{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e5ebf2;border-radius:10px;background:#fff}\n    .bill-row small{display:block;color:#64748b;font-size:9px;margin-top:3px}.bill-row b{font-size:12px}\n    .bill-actions{display:flex;gap:6px;align-items:center}.bill-actions a{font-size:10px;font-weight:800;color:#1677f2;text-decoration:none}\n    .staff-note{padding:10px 12px;border-radius:10px;background:#fff9ed;color:#92400e;border:1px solid #fde7b0;font-size:10px;line-height:1.5;margin-top:12px}\n    @media(max-width:900px){.staff-grid{grid-template-columns:1fr}.staff-form-grid,.attendance-form{grid-template-columns:1fr 1fr}.staff-form-grid button,.attendance-form button{width:100%}}\n    @media(max-width:600px){.staff-form-grid,.attendance-form,.bill-form-grid{grid-template-columns:1fr}.bill-upload{grid-column:auto}.attendance-summary{grid-template-columns:1fr 1fr 1fr}.staff-table{overflow-x:auto}.staff-table table{min-width:620px}}\n  `;

  if (!authReady) { return <div style={{padding:40,fontFamily:"sans-serif"}}>PumpPro शुरू हो रहा है…</div>; }

  if (!session) {
    return (
      <>
        {mutationError && <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,background:"#b91c1c",color:"white",padding:"10px 16px",fontWeight:700,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.2)"}}>⚠️ Save नहीं हुआ: {mutationError}</div>}
        <style>{css + `
          .login-page{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#eef2f8;padding:20px}
          .login-card{width:min(430px,96vw);background:#fff;border:1px solid #dfe4ec;border-radius:16px;padding:30px;box-shadow:0 15px 45px rgba(0,0,0,.10)}
          .login-brand{text-align:center;font-size:28px;font-weight:800;color:#244f9f;margin-bottom:5px}
          .login-sub{text-align:center;color:#6b7280;font-size:13px;margin-bottom:25px}
          .login-field{margin:12px 0}.login-field label{display:block;font-size:12px;font-weight:700;margin-bottom:6px}
          .login-field input{width:100%;padding:12px;border:1px solid #ccd4df;border-radius:8px}
          .login-btn{width:100%;margin-top:12px;padding:12px;border:0;border-radius:8px;background:#3159a5;color:#fff;font-weight:800;cursor:pointer}
          .login-error{margin-top:12px;padding:10px;border-radius:8px;background:#ffe5e5;color:#9b1c1c;font-size:13px}
          .role-hint{margin-top:18px;background:#f5f7fb;border-radius:9px;padding:12px;font-size:11px;color:#667085}
        `}</style>
        <div className="login-page">
          <form className="login-card" onSubmit={async e => {
            e.preventDefault(); setLoginError("");
            const form=new FormData(e.currentTarget); const username=String(form.get("email")||"").trim(); const password=String(form.get("password")||"");
            if (CLOUD_ENABLED) {
              try {
                if (!username.includes("@")) { setLoginError("Cloud login में registered email address इस्तेमाल करें।"); return; }
                const result = await cloudSignIn(username, password);
                if (!result?.user) throw new Error("Cloud login failed");
                await hydrateCloudUser(result.user);
                setPage('Dashboard');
              } catch (error) {
                setLoginError(error?.message || "Email/password गलत है या cloud account active नहीं है।");
              }
              return;
            }
            if (CLOUD_REQUIRED) { setLoginError("Cloud configuration missing: इस deployment पर local login बंद है (VITE_PUMPPRO_CLOUD_REQUIRED=true)। Supabase env variables जोड़कर redeploy करें।"); return; }
            const users=Array.isArray(data.users)&&data.users.length?data.users:DEFAULT_USERS;
            const candidate=users.find(x=>((String(x.username||"").trim().toLowerCase()===username.toLowerCase()) || (String(x.email||"").trim().toLowerCase()===username.toLowerCase())) && x.active!==false);
            if(!candidate){setLoginError("Username/Email या password गलत है।");return;}
            const passwordHash=await hashPassword(password);
            const valid=isPasswordHash(candidate.password) ? candidate.password===passwordHash : String(candidate.password||"")===password;
            if(!valid){setLoginError("Username/Email या password गलत है।");return;}
            if(!isPasswordHash(candidate.password)){ setData(d=>({...d,users:(d.users||[]).map(x=>x.id===candidate.id?{...x,password:passwordHash}:x)})); }
            const u={...candidate,password:passwordHash};
            const role=normalizeRole(u.role); if(!role){setLoginError("User role मान्य नहीं है।");return;}
            const s={uid:String(u.id),username:u.username,email:u.email||u.username,role,name:u.name||u.username}; setSession(s); localStorage.setItem(KEY+'_session',JSON.stringify(s)); setPage('Dashboard');
          }}>
            <div className="login-brand">⛽ PumpPro</div>
            <div className="login-sub">SATAT FILLING STATION · Standard Accounting</div>
            <div className="login-field"><label>Username / Email</label><input name="email" type="text" autoComplete="username" required /></div>
            <div className="login-field"><label>Password</label><input name="password" type="password" autoComplete="current-password" required /></div>
            <button className="login-btn" type="submit">LOGIN</button>
            {CLOUD_ENABLED && <button type="button" className="btn" style={{marginTop:8,width:"100%"}} onClick={async e => {
              const form = e.currentTarget.form;
              const email = String(new FormData(form).get("email") || "").trim();
              setLoginError(""); setResetMessage("");
              if (!email.includes("@")) { setLoginError("Forgot Password के लिए registered email address डालें।"); return; }
              setResetBusy(true);
              try { await cloudResetPassword(email); setResetMessage("Password reset link आपके registered email पर भेज दिया गया है।"); }
              catch (error) { setLoginError(error?.message || "Password reset email नहीं भेजा जा सका।"); }
              finally { setResetBusy(false); }
            }}>{resetBusy ? "SENDING…" : "Forgot Password?"}</button>}
            <div className="login-error" style={{display:loginError ? "block" : "none"}}>{loginError}</div>
            {resetMessage && <div style={{marginTop:8,color:"#15803d",fontSize:12,textAlign:"center"}}>{resetMessage}</div>}
            <div className="role-hint"><b>4 Roles:</b> Admin · Owner · Manager · Operator<br/>Cloud mode: login is shared across devices. Local mode: login is browser-only.</div>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      {mutationError && <div style={{position:"fixed",top:0,left:0,right:0,zIndex:99999,background:"#b91c1c",color:"white",padding:"10px 16px",fontWeight:700,textAlign:"center",boxShadow:"0 2px 8px rgba(0,0,0,.2)"}}>⚠️ Save नहीं हुआ: {mutationError}</div>}
      <style>{css + `
        .userbar{display:flex;align-items:center;gap:10px}
        .rolebadge{padding:5px 9px;border-radius:999px;background:#e8efff;color:#244f9f;font-size:11px;font-weight:800}
        .logout{border:0;border-radius:7px;padding:8px 10px;background:#f0f2f5;cursor:pointer;font-weight:700}
      `}</style>

      <div className="app">

        <aside className="side">

          <div className="brand">
            ⛽ PumpPro
            <small>Fuel Management</small>
          </div>

          <div className="nav">

            {[
              "Dashboard",
              "Accounts",
              "Tally / CA Export",
              "Fuel Sale",
              "Opening Setup",
              "Party Master",
              "Credit Sale",
              "Party Ledger",
              "Collection Detail",
              "Reports",
              "Purchase",
              "Lubricant",
              "Sale Purchase P&L",
              "Daily Sale Summary",
              "Stock",
              ...(canAccess(session.role, "Staff & Electricity") ? ["Staff & Electricity"] : []),
              ...(canAccess(session.role, "User Management") ? ["User Management"] : []),
              ...(canAccess(session.role, "Audit Trail") ? ["Audit Trail"] : []),
              ...(canAccess(session.role, "Accounting Period Lock") ? ["Accounting Period Lock"] : [])
            ].map(x => (
              <button
                type="button"
                className={
                  page === x
                    ? "active"
                    : ""
                }
                onClick={() =>
                  setPage(x)
                }
                key={x}
              >
                {x}
              </button>
            ))}

          </div>

          <small
            style={{
              color:"#6b7280",
              position:"absolute",
              bottom:20
            }}
          >
            ● Logged in: {session.role}
          </small>

        </aside>

        <main className="main">

          <header className="top">

            <div>
              <h1>{PUMP_NAME}</h1>

              <p>
                {page === "Dashboard"
                  ? "01 Aug 2026 onwards"
                  : "Manage pump operations"}
              </p>
            </div>

            <div
              style={{
                display:"flex",
                gap:"10px"
              }}
            >

              <div className="userbar">
                <span className="rolebadge">{session.role}</span>{session.role === USER_ROLES.VIEW_ONLY && <span className="rolebadge" title="Read-only role">👁️ View Only</span>}{CLOUD_ENABLED && <span className="rolebadge" title="Cloud synchronization status">☁️ {cloudStatus === "online" ? "Synced" : cloudStatus === "saving" ? "Saving…" : cloudStatus === "conflict" ? "Conflict" : cloudStatus}</span>}
                <span style={{fontSize:"12px"}}>{session.name}</span>
                <button type="button" className="btn small" title="Cloud data / Supabase" onClick={async () => {
  if (!CLOUD_ENABLED) {
    alert("☁️ Cloud button is ready, but this deployment is not connected to Supabase yet. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, then redeploy.");
    return;
  }
  const r = await refreshCloudData();
  if (r.ok) alert(`☁️ Latest cloud data loaded.\n\nCredits: ${r.count}`);
  else alert(`❌ Cloud refresh failed\n\n${r.reason}`);
}}>{CLOUD_ENABLED ? "☁️ Cloud" : "☁️ Cloud (Setup)"}</button>
                <button className="logout" onClick={async () => { try { if (CLOUD_ENABLED) await cloudSignOut(); else localStorage.removeItem(KEY + '_session'); } catch(e) { console.error(e); } setSession(null); setCloudReady(!CLOUD_ENABLED); setCloudStatus(CLOUD_ENABLED ? "login-required" : "local"); setPage("Dashboard"); }}>Logout</button>
              </div>

              {[USER_ROLES.ADMIN, USER_ROLES.OWNER].includes(session.role) && <>
                <button type="button" className="btn" onClick={runIntegrityScanner}>🛡 Integrity Scan</button>
                <button
                  type="button"
                  className="btn"
                  onClick={backupData}
                >
                  💾 Backup
                </button>
                <label className="btn" style={{cursor:"pointer"}}>
                  📥 Import
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={importData}
                    style={{ display: "none" }}
                  />
                </label>
              </>}
              <button
                type="button"
                className="btn gray"
                onClick={() =>
                  setDark(x => !x)
                }
              >
                {dark
                  ? "☀ Light"
                  : "🌙 Dark"}
              </button>

            </div>

          </header>

          <nav className="mobile-bottom-nav">
            {[
              ["⌂", "Dashboard", "Dashboard"],
              ["⛽", "Sale", "Fuel Sale"],
              ["₹", "Collection", "Collection Detail"],
              ["👥", "Parties", "Party Ledger"],
              ["☷", "Reports", "Reports"]
            ].map(([icon, label, target]) => (
              <button type="button" key={target} className={page === target ? "active" : ""} onClick={() => setPage(target)}>
                <span>{icon}</span><b>{label}</b>
              </button>
            ))}
          </nav>

          {page === "User Management" && canAccess(session.role, "User Management") && (
            <UserManagement data={data} update={update} />
          )}

          {page === "Audit Trail" && canAccess(session.role, "Audit Trail") && (
            <AuditTrail data={data} />
          )}

          {page === "Accounts" && canAccess(session.role, "Accounts") && (
            <Accounts data={data} />
          )}

          {page === "Tally / CA Export" && canAccess(session.role, "Tally / CA Export") && (
            <TallyExport data={data} />
          )}

          {page === "Accounting Period Lock" && canAccess(session.role, "Accounting Period Lock") && (
            <AccountingPeriodLock data={data} update={update} session={session} />
          )}

          {page === "Dashboard" && (
            <Dashboard
              data={data}
              totals={totals}
              setPage={setPage}
              update={update}
            />
          )}

          {page === "Collection Detail" && canAccess(session.role, "Collection Detail") && (
            <CollectionDetail
              data={data}
              totals={totals}
              setPage={setPage}
              update={update}
            />
          )}

          {page === "Fuel Sale" && canAccess(session.role, "Fuel Sale") && (
            <FuelSale
              data={data}
              update={update}
            />
          )}

          {page === "Opening Setup" && canAccess(session.role, "Opening Setup") && (
            <OpeningSetup
              data={data}
              update={update}
              session={session}
            />
          )}

          {page === "Party Master" && canAccess(session.role, "Party Master") && (
            <PartyMaster
              data={data}
              update={update}
            />
          )}

          {page === "Credit Sale" && canAccess(session.role, "Credit Sale") && (
            <CreditSale
              data={data}
              update={update}
            />
          )}

          {page === "Party Ledger" && canAccess(session.role, "Party Ledger") && (
            <PartyLedger
              data={data}
              update={update}
              setPage={setPage}
            />
          )}

          {page === "Reports" && canAccess(session.role, "Reports") && (
            <Reports
              data={data}
              totals={totals}
            />
          )}

          {page === "Purchase" && canAccess(session.role, "Purchase") && (
            <Purchase data={data} update={update} />
          )}

          {page === "Lubricant" && canAccess(session.role, "Lubricant") && (
            <LubricantManagement data={data} update={update} />
          )}

          {page === "Sale Purchase P&L" && canAccess(session.role, "Sale Purchase P&L") && (
            <SalePurchaseProfitLoss
              data={data}
            />
          )}

          {page === "Daily Sale Summary" && canAccess(session.role, "Daily Sale Summary") && (
            <DailySaleSummary
              data={data}
            />
          )}

          {page === "Stock" && canAccess(session.role, "Stock") && (
            <Stock
              data={data}
              update={update}
              totals={totals}
            />
          )}

          {page === "Staff & Electricity" && canAccess(session.role, "Staff & Electricity") && (
            <StaffElectricity data={data} update={update} />
          )}

        </main>

      </div>
    </>
  );
}

import {
  StaffElectricity,
  UserManagement,
  AuditTrail,
  AccountingPeriodLock,
  CollectionDetail,
  Dashboard,
  FuelSale,
  PaymentSection,
  OpeningSetup,
  PartyMaster,
  CreditSale,
  PartyLedger,
  Accounts,
  Reports,
  loadHpclPdfJs2,
  hpclNum2,
  hpclDate2,
  hpclFuel2,
  hpclParseInvoicePdfText2,
  Purchase,
  LubricantManagement,
  SalePurchaseProfitLoss,
  DailySaleSummary,
  DataQualityBadge,
  Stock,
  Field,
  Table
} from "./components/PumpModules";
import { TallyExport } from "./components/TallyExport";

export default App;
