const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;

function latestDate(rows = []) {
  return rows.reduce((m, r) => {
    const d = String(r?.date || "");
    return d > m ? d : m;
  }, "");
}

function summarizeFuel(rows, fuel) {
  return rows.filter(r => String(r?.fuel || "").toUpperCase() === fuel).reduce(
    (a, r) => ({ qty: a.qty + num(r.qty), amount: a.amount + num(r.amount), testing: a.testing + num(r.testing) }),
    { qty: 0, amount: 0, testing: 0 }
  );
}

function dateSummary(rows, date) {
  return ["MS", "HSD", "CNG"].map(fuel => ({ fuel, ...summarizeFuel(rows.filter(r => String(r?.date) === date), fuel) }));
}

function partyOutstanding(data) {
  const credit = new Map();
  const paid = new Map();
  for (const r of (Array.isArray(data?.credits) ? data.credits : [])) {
    const p = String(r?.party || "Unknown");
    credit.set(p, (credit.get(p) || 0) + num(r?.amount));
  }
  for (const r of (Array.isArray(data?.ledgerPayments) ? data.ledgerPayments : [])) {
    const p = String(r?.party || "Unknown");
    paid.set(p, (paid.get(p) || 0) + num(r?.amount));
  }
  return [...credit.entries()]
    .map(([party, amount]) => ({ party, outstanding: amount - (paid.get(party) || 0), credit: amount, paid: paid.get(party) || 0 }))
    .filter(x => x.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function analyzeStationData(data, question = "") {
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const dates = [...new Set(sales.map(r => String(r?.date || "")).filter(Boolean))].sort();
  const latest = latestDate(sales);
  const latestRows = sales.filter(r => String(r?.date) === latest);
  const summary = dateSummary(sales, latest);
  const total = summary.reduce((a, x) => ({ qty: a.qty + x.qty, amount: a.amount + x.amount }), { qty: 0, amount: 0 });
  const parties = partyOutstanding(data);
  const q = String(question).toLowerCase();

  if (/party|outstanding|उधार|पार्टी/.test(q)) {
    if (!parties.length) return "अभी उपलब्ध data में कोई positive party outstanding नहीं मिला।";
    const top = parties.slice(0, 5).map((x, i) => `${i + 1}. ${x.party}: ₹${x.outstanding.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`).join("\n");
    return `Party outstanding (available records):\n${top}`;
  }

  if (/stock|dip|स्टॉक|डिप/.test(q)) {
    const dips = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
    const lastDip = dips.filter(x => x?.date).sort((a,b) => String(b.date).localeCompare(String(a.date)))[0];
    return lastDip
      ? `Latest dip record: ${lastDip.date}. MS: ${num(lastDip.MS ?? lastDip.ms)} L, HSD: ${num(lastDip.HSD ?? lastDip.hsd)} L. Please compare with the Book Stock shown in Stock/Reports before acting.`
      : "Dip readings का कोई usable record उपलब्ध नहीं है। Stock mismatch बताने के लिए पहले dip entry चाहिए।";
  }

  if (/density|jump|डेंसिटी|जंप|anomal/.test(q)) {
    const densityRows = sales.filter(r => r?.density != null || r?.jump != null);
    if (!densityRows.length) return "इस data snapshot में Density/JUMP fields उपलब्ध नहीं हैं; मैं अनुमान लगाकर alert नहीं बनाऊँगा। Daily Sale Summary में ये fields आने पर AI इन्हें explain कर सकता है।";
    return `Density/JUMP के ${densityRows.length} records मिले। इन्हें date/nozzle के हिसाब से compare करना चाहिए; AI accounting entry को अपने-आप नहीं बदलेगा।`;
  }

  if (/today|आज|sale|बिक्री|collection|कलेक्शन/.test(q)) {
    const lines = summary.map(x => `${x.fuel}: ${x.qty.toFixed(3)} qty / ₹${x.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`);
    return `Latest available sales date: ${latest || "—"}\n${lines.join("\n")}\nTotal: ${total.qty.toFixed(3)} qty / ₹${total.amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }

  if (/profit|p&l|margin|मुनाफा|लाभ/.test(q)) {
    return "P&L analysis के लिए Sale Purchase P&L के product-wise purchase cost, tax और sales figures को साथ पढ़ना जरूरी है। Smart AI अभी इस screen से accounting entries नहीं बदलेगा।";
  }

  if (/help|क्या कर|कर सकता|features|सुविध/.test(q)) {
    return "मैं sales, collection, stock/dip, party outstanding, P&L और Density/JUMP records को पढ़कर explain कर सकता हूँ। हर answer current authorized station/FY data पर आधारित होना चाहिए।";
  }

  return `मैं StationMitra के current data को read-only तरीके से analyze कर सकता हूँ। Latest sales date ${latest || "उपलब्ध नहीं"} है और ${dates.length} sales dates मिले हैं। उदाहरण: "आज की बिक्री बताओ", "किस party का outstanding है?", "stock/dip समझाओ", या "density/jump alerts बताओ"।`;
}
