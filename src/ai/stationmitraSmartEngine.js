const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
const money = v => Number(v || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

function isRecoveryCreditRow(row) {
  return String(row?.transactionId || "").includes("-RECOVERY-") || String(row?.recoveryStatus || "").toUpperCase() === "FORENSIC_RECOVERY";
}

function authoritativeCredits(credits = []) {
  const families = new Map();
  credits.forEach((row, index) => {
    const id = String(row?.transactionId || row?.id || `credit-${index}`);
    const family = id.split(/-RECOVERY-/i)[0];
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(row);
  });
  const selected = [];
  families.forEach(rows => {
    const originals = rows.filter(row => !isRecoveryCreditRow(row));
    selected.push(...(originals.length ? originals : [rows[0]]));
  });
  const keys = new Set();
  return selected.filter(row => {
    const key = [row?.date,row?.party,row?.parchiNo,row?.vehicle,row?.fuel,row?.qty,num(row?.amount)]
      .map(v => String(v ?? "").trim().toUpperCase()).join("|");
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

function partyOutstanding(data) {
  const credits = authoritativeCredits(Array.isArray(data?.credits) ? data.credits : []);
  const openings = Array.isArray(data?.ledgerOpenings) ? data.ledgerOpenings : [];
  const payments = Array.isArray(data?.ledgerPayments) ? data.ledgerPayments : [];
  const parties = new Set([
    ...(data?.parties || []).map(x => x?.name).filter(Boolean),
    ...credits.map(x => x?.party).filter(Boolean),
    ...openings.map(x => x?.party).filter(Boolean),
    ...payments.map(x => x?.party).filter(Boolean)
  ]);
  return [...parties].map(party => {
    const opening = openings.find(x => String(x?.party) === String(party));
    const openingSigned = opening ? (String(opening.type).toUpperCase() === "CREDIT" ? -num(opening.amount) : num(opening.amount)) : 0;
    const sales = credits.filter(x => String(x?.party) === String(party)).reduce((a,x)=>a+num(x?.amount),0);
    const received = payments.filter(x => String(x?.party) === String(party)).reduce((a,x)=>a+num(x?.amount),0);
    return { party, opening: openingSigned, sales, received, outstanding: openingSigned + sales - received };
  }).filter(x => Math.abs(x.outstanding) > 0.009).sort((a,b)=>b.outstanding-a.outstanding);
}

function summarizeFuel(rows, fuel) {
  return rows.filter(r => String(r?.fuel || "").toUpperCase() === fuel).reduce(
    (a, r) => ({ qty: a.qty + num(r.qty), amount: a.amount + num(r.amount), testing: a.testing + num(r.testing) }),
    { qty: 0, amount: 0, testing: 0 }
  );
}

export function analyzeStationData(data, question = "") {
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const dates = [...new Set(sales.map(r => String(r?.date || "")).filter(Boolean))].sort();
  const latest = dates.at(-1) || "";
  const latestRows = sales.filter(r => String(r?.date) === latest);
  const q = String(question).toLowerCase();

  if (/party|outstanding|उधार|पार्टी/.test(q)) {
    const parties = partyOutstanding(data);
    if (!parties.length) return "Authoritative Party Ledger के अनुसार अभी कोई outstanding नहीं मिला।";
    const top = parties.slice(0, 10).map((x,i) =>
      `${i+1}. ${x.party}: ₹${money(x.outstanding)}`
    ).join("\n");
    const total = parties.reduce((a,x)=>a+x.outstanding,0);
    return `Authoritative Party Ledger data के अनुसार:\n${top}\n\nTotal outstanding: ₹${money(total)}\n\nSource: Opening Balance + Udhari Sale − Payment Received. Recovery/duplicate credit rows को दोबारा नहीं गिना गया।`;
  }

  if (/stock|dip|स्टॉक|डिप/.test(q)) {
    const dips = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
    const lastDip = dips.filter(x => x?.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
    return lastDip
      ? `Latest recorded dip: ${lastDip.date}. MS: ${num(lastDip.MS ?? lastDip.ms ?? lastDip.dip)} L, HSD: ${num(lastDip.HSD ?? lastDip.hsd)} L. Stock/Reports के Book Stock से इसी date पर compare करें।`
      : "Authoritative data में usable dip record नहीं मिला।";
  }

  if (/density|jump|डेंसिटी|जंप|anomal/.test(q)) {
    const rows = sales.filter(r => r?.density != null || r?.jump != null);
    return rows.length
      ? `Authoritative sales snapshot में Density/JUMP fields वाले ${rows.length} records मिले। मैं केवल मौजूद records को explain करूँगा; missing field को अनुमान से नहीं भरूँगा।`
      : "Authoritative sales snapshot में Density/JUMP fields उपलब्ध नहीं हैं। इसलिए गलत alert नहीं बनाऊँगा।";
  }

  if (/profit|p&l|margin|मुनाफा|लाभ/.test(q)) {
    return "P&L के लिए मैं Sale/Purchase P&L के authoritative product-wise figures से answer दूँगा। इस stage पर बिना वही calculation layer जोड़े कोई margin number नहीं बनाऊँगा।";
  }

  if (/today|आज|sale|बिक्री|collection|कलेक्शन/.test(q)) {
    const summary = ["MS","HSD","CNG"].map(fuel=>({fuel,...summarizeFuel(latestRows,fuel)}));
    const total = summary.reduce((a,x)=>({qty:a.qty+x.qty,amount:a.amount+x.amount}),{qty:0,amount:0});
    return `Latest available authoritative sales date: ${latest || "—"}\n${summary.map(x=>`${x.fuel}: ${x.qty.toFixed(3)} / ₹${money(x.amount)}`).join("\n")}\nTotal: ${total.qty.toFixed(3)} / ₹${money(total.amount)}`;
  }

  return `मैं StationMitra के authoritative loaded data को read-only तरीके से analyze करता हूँ। Sales dates: ${dates.length}; latest: ${latest || "—"}। Party Ledger, Stock/Dip और Density/JUMP के answers source calculations से मिलाए जाते हैं।`;
}
