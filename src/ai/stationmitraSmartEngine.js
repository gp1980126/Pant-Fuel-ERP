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
  families.forEach(rows => { const originals = rows.filter(row => !isRecoveryCreditRow(row)); selected.push(...(originals.length ? originals : [rows[0]])); });
  const keys = new Set();
  return selected.filter(row => {
    const key = [row?.date,row?.party,row?.parchiNo,row?.vehicle,row?.fuel,row?.qty,num(row?.amount)].map(v => String(v ?? "").trim().toUpperCase()).join("|");
    if (keys.has(key)) return false; keys.add(key); return true;
  });
}
function partyOutstanding(data) {
  const credits = authoritativeCredits(Array.isArray(data?.credits) ? data.credits : []);
  const openings = Array.isArray(data?.ledgerOpenings) ? data.ledgerOpenings : [];
  const payments = Array.isArray(data?.ledgerPayments) ? data.ledgerPayments : [];
  const parties = new Set([...(data?.parties || []).map(x => x?.name).filter(Boolean),...credits.map(x => x?.party).filter(Boolean),...openings.map(x => x?.party).filter(Boolean),...payments.map(x => x?.party).filter(Boolean)]);
  return [...parties].map(party => {
    const opening = openings.find(x => String(x?.party) === String(party));
    const openingSigned = opening ? (String(opening.type).toUpperCase() === "CREDIT" ? -num(opening.amount) : num(opening.amount)) : 0;
    const sales = credits.filter(x => String(x?.party) === String(party)).reduce((a,x)=>a+num(x?.amount),0);
    const received = payments.filter(x => String(x?.party) === String(party)).reduce((a,x)=>a+num(x?.amount),0);
    return { party, opening: openingSigned, sales, received, outstanding: openingSigned + sales - received };
  }).filter(x => Math.abs(x.outstanding) > 0.009).sort((a,b)=>b.outstanding-a.outstanding);
}
function summarizeFuel(rows, fuel) {
  return rows.filter(r => String(r?.fuel || "").toUpperCase() === fuel).reduce((a,r)=>({qty:a.qty+num(r.qty),amount:a.amount+num(r.amount),testing:a.testing+num(r.testing)}),{qty:0,amount:0,testing:0});
}
export function analyzeStationData(data, question = "") {
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const dates = [...new Set(sales.map(r => String(r?.date || "")).filter(Boolean))].sort();
  const latest = dates.at(-1) || "";
  const latestRows = sales.filter(r => String(r?.date) === latest);
  const q = String(question).toLowerCase();
  if (/party|outstanding|उधार|पार्टी|ग्राहक|बकाया/.test(q)) {
    const parties = partyOutstanding(data);
    if (!parties.length) return "प्रमाणित ग्राहक-बही के अनुसार अभी कोई बकाया राशि नहीं मिली।";
    const top = parties.slice(0,10).map((x,i)=>`${i+1}. ${x.party}: ₹${money(x.outstanding)}`).join("\n");
    const total = parties.reduce((a,x)=>a+x.outstanding,0);
    return `प्रमाणित ग्राहक-बही के अनुसार:\n${top}\n\nकुल बकाया राशि: ₹${money(total)}\n\nगणना: प्रारंभिक शेष + उधार बिक्री − प्राप्त भुगतान। पुनर्प्राप्ति या दोहराई गई उधार प्रविष्टियों को दोबारा नहीं गिना गया है।`;
  }
  if (/stock|dip|स्टॉक|डिप|भंडार/.test(q)) {
    const dips = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
    const lastDip = dips.filter(x=>x?.date).sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];
    return lastDip ? `सबसे हाल की दर्ज डिप तारीख: ${lastDip.date}। पेट्रोल: ${num(lastDip.MS ?? lastDip.ms ?? lastDip.dip)} लीटर, डीजल: ${num(lastDip.HSD ?? lastDip.hsd)} लीटर। उपलब्ध भंडार की प्रमाणित रिपोर्ट से इसी तारीख पर तुलना की जानी चाहिए।` : "प्रमाणित आँकड़ों में उपयोग योग्य डिप रिकॉर्ड नहीं मिला।";
  }
  if (/density|jump|डेंसिटी|जंप|घनत्व|असामान्य अंतर/.test(q)) {
    const rows = sales.filter(r=>r?.density != null || r?.jump != null);
    return rows.length ? `प्रमाणित बिक्री आँकड़ों में घनत्व या असामान्य अंतर वाले ${rows.length} रिकॉर्ड मिले। मैं केवल उपलब्ध रिकॉर्ड के आधार पर समझाऊँगा; खाली जानकारी का अनुमान नहीं लगाऊँगा।` : "प्रमाणित बिक्री आँकड़ों में घनत्व या असामान्य अंतर की जानकारी उपलब्ध नहीं है, इसलिए कोई गलत चेतावनी नहीं बनाई जाएगी।";
  }
  if (/profit|p&l|margin|मुनाफा|लाभ|पी&एल/.test(q)) return "लाभ-हानि बताने के लिए प्रमाणित उत्पाद-वार बिक्री और खरीद गणना आवश्यक है। उसके बिना कोई लाभ प्रतिशत या राशि अनुमान से नहीं बताई जाएगी।";
  if (/today|आज|sale|बिक्री|collection|कलेक्शन|प्राप्त राशि/.test(q)) {
    const summary=["MS","HSD","CNG"].map(fuel=>({fuel,...summarizeFuel(latestRows,fuel)}));
    const total=summary.reduce((a,x)=>({qty:a.qty+x.qty,amount:a.amount+x.amount}),{qty:0,amount:0});
    return `सबसे हाल की उपलब्ध प्रमाणित बिक्री तारीख: ${latest || "—"}\nपेट्रोल: ${summary[0].qty.toFixed(3)} लीटर / ₹${money(summary[0].amount)}\nडीजल: ${summary[1].qty.toFixed(3)} लीटर / ₹${money(summary[1].amount)}\nसीएनजी: ${summary[2].qty.toFixed(3)} किलोग्राम / ₹${money(summary[2].amount)}\nकुल बिक्री: ${total.qty.toFixed(3)} इकाई / ₹${money(total.amount)}`;
  }
  return `मैं स्टेशनमित्र के प्रमाणित, उपलब्ध आँकड़ों को केवल पढ़कर समझाता हूँ। बिक्री की ${dates.length} अलग-अलग तारीखें उपलब्ध हैं; सबसे हाल की तारीख: ${latest || "—"}। ग्राहक-बही, भंडार/डिप और घनत्व/असामान्य अंतर के उत्तर स्रोत गणनाओं से मिलाए जाते हैं।`;
}
