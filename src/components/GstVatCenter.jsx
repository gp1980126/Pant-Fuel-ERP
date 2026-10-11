import React, { useMemo, useState } from "react";

const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const qty = value => Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 3 });
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateInRange = (date, from, to) => String(date || "") >= from && String(date || "") <= to;
const safeName = value => String(value || "").replace(/[^a-z0-9_-]+/gi, "_");
const csvCell = value => '"' + String(value ?? "").replaceAll('"', '""') + '"';
const download = (name, rows) => {
  const text = "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
};
const grossBreakdown = row => {
  const rate = n(row?.gstRate) || 18;
  const gross = n(row?.amount ?? row?.totalAmount);
  const savedTaxable = n(row?.taxableAmount);
  const savedTax = n(row?.gstAmount ?? row?.taxAmount);
  if (savedTaxable > 0 || savedTax > 0) return { rate, gross: gross || savedTaxable + savedTax, taxable: savedTaxable || Math.max(0, gross - savedTax), tax: savedTax || Math.max(0, gross - savedTaxable) };
  const taxable = gross / (1 + rate / 100);
  return { rate, gross, taxable, tax: gross - taxable };
};
const fuelCode = row => String(row?.fuel || row?.productType || "").trim().toUpperCase();

export function GstVatCenter({ data }) {
  const [from, setFrom] = useState("2026-09-01");
  const [to, setTo] = useState("2026-09-30");
  const [confirmedItc, setConfirmedItc] = useState("0");
  const [msVatRate, setMsVatRate] = useState("16.97");
  const [hsdVatRate, setHsdVatRate] = useState("17.15");
  const [msMinimum, setMsMinimum] = useState("13.14");
  const [hsdMinimum, setHsdMinimum] = useState("10.41");
  const [notice, setNotice] = useState("");

  const report = useMemo(() => {
    const sales = (Array.isArray(data?.sales) ? data.sales : []).filter(r => dateInRange(r?.date, from, to));
    const credits = (Array.isArray(data?.credits) ? data.credits : []).filter(r => dateInRange(r?.date, from, to));
    const cashLubricants = (Array.isArray(data?.lubricantCashSales) ? data.lubricantCashSales : []).filter(r => dateInRange(r?.date, from, to));
    const lubricantCredit = credits.filter(r => fuelCode(r) === "LUBRICANT");
    // Resolve customer GSTIN from Party Master when a sale row stores only the party name.
    const partyRows = Array.isArray(data?.parties) ? data.parties : [];
    const normalizeKey = value => String(value || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
    const partyGstin = partyName => {
      const key = normalizeKey(partyName);
      if (!key) return "";
      const match = partyRows.find(p => {
        const names = [p?.name, p?.partyName, p?.customerName, p?.firmName, p?.businessName, p?.title];
        return names.some(name => normalizeKey(name) === key);
      });
      return String(match?.gstin || match?.GSTIN || match?.gstNumber || match?.gstNo || match?.gstinNo || match?.gst || "").trim();
    };
    // HSN source of truth: the saved purchase bill, never a guessed/default HSN.
    // Support both detailed item lines and older bills that saved HSN at bill level.
    const hsnByProduct = new Map();
    const hsnFrom = row => String(row?.hsn || row?.hsnCode || row?.HSN || row?.hsnSac || row?.hsn_sac || "").trim();
    (Array.isArray(data?.purchases) ? data.purchases : []).forEach(purchase => {
      const items = Array.isArray(purchase?.items) ? purchase.items : [];
      items.forEach(item => {
        const name = item?.productName || item?.product || item?.name || item?.itemName || item?.description || "";
        const hsn = hsnFrom(item) || hsnFrom(purchase);
        if (name && hsn && !hsnByProduct.has(normalizeKey(name))) hsnByProduct.set(normalizeKey(name), hsn);
      });
      const billName = purchase?.productName || purchase?.product || purchase?.itemName || purchase?.description || "";
      const billHsn = hsnFrom(purchase);
      if (billName && billHsn && !hsnByProduct.has(normalizeKey(billName))) hsnByProduct.set(normalizeKey(billName), billHsn);
    });
    const lookupPurchaseHsn = productName => {
      const key = normalizeKey(productName);
      if (!key) return "";
      if (hsnByProduct.has(key)) return hsnByProduct.get(key);
      // Match product names conservatively when purchase and sale descriptions differ slightly.
      const match = [...hsnByProduct.entries()].find(([name]) => name && (name.includes(key) || key.includes(name)));
      return match?.[1] || "";
    };
    const lubricantRows = [
      ...lubricantCredit.map(r => ({ ...r, saleType: "CREDIT" })),
      ...cashLubricants.map(r => ({ ...r, fuel: "LUBRICANT", saleType: String(r?.paymentMode || "CASH").toUpperCase() }))
    ].map((r, i) => {
      const b = grossBreakdown(r);
      const party = r.party || r.partyName || r.customerName || "B2C / Customer";
      const product = r.productName || r.product || "Lubricant";
      const savedHsn = r.hsn || r.hsnCode || r.HSN || r.hsnSac || "";
      return {
        date: r.date || "", invoiceNo: r.invoiceNo || r.billNo || r.id || ("LUB-" + (i + 1)),
        party,
        gstin: r.gstin || r.GSTIN || r.customerGstin || r.customerGSTIN || partyGstin(party),
        hsn: savedHsn || lookupPurchaseHsn(product),
        product,
        qty: n(r.qty), rate: b.rate, taxable: b.taxable, cgst: b.tax / 2, sgst: b.tax / 2, igst: 0, tax: b.tax, gross: b.gross,
        saleType: r.saleType
      };
    });
    const fuelRows = ["MS", "HSD", "CNG"].map(fuel => {
      const rows = sales.filter(r => fuelCode(r) === fuel);
      const creditRows = credits.filter(r => fuelCode(r) === fuel);
      const amount = rows.reduce((s, r) => s + n(r.amount ?? n(r.qty) * n(r.rate)), 0);
      const creditAmount = creditRows.reduce((s, r) => s + n(r.amount ?? n(r.qty) * n(r.rate)), 0);
      return { fuel, qty: rows.reduce((s, r) => s + n(r.qty), 0) + creditRows.reduce((s, r) => s + n(r.qty), 0), amount, entries: rows.length + creditRows.length, creditQty: creditRows.reduce((s, r) => s + n(r.qty), 0), creditAmount };
    });
    const purchaseDate = r => String(r?.date || r?.billDate || r?.invoiceDate || r?.invoice_date || r?.bill_date || r?.documentDate || r?.importedAt || r?.createdAt || "").slice(0, 10);
    const purchases = (Array.isArray(data?.purchases) ? data.purchases : []).filter(r => dateInRange(purchaseDate(r), from, to) && fuelCode(r) === "LUBRICANT");
    // Purchase GST must include tax stored on detailed invoice item lines, not only the parent header.
    // Prefer item-level GST to avoid double-counting the same invoice's header and line totals.
    const purchaseTax = purchase => {
      const items = Array.isArray(purchase?.items) ? purchase.items : [];
      const itemTax = items.reduce((sum, item) => sum
        + n(item?.igstAmount) + n(item?.cgstAmount) + n(item?.sgstAmount)
        + n(item?.gstAmount) + n(item?.taxAmount), 0);
      if (itemTax > 0) return itemTax;
      const headerTax = n(purchase?.taxAmount) || n(purchase?.gstAmount) || n(purchase?.gstTotal);
      if (headerTax > 0) return headerTax;
      const breakdownTax = Array.isArray(purchase?.taxBreakdown)
        ? purchase.taxBreakdown.reduce((sum, item) => sum + n(item?.amount), 0) : 0;
      return breakdownTax;
    };
    const potentialItc = purchases.reduce((sum, purchase) => sum + purchaseTax(purchase), 0);
    const outputTax = lubricantRows.reduce((s, r) => s + r.tax, 0);
    const ms = fuelRows.find(r => r.fuel === "MS") || { qty: 0, amount: 0 };
    const hsd = fuelRows.find(r => r.fuel === "HSD") || { qty: 0, amount: 0 };
    // Software fuel sale totals are treated as retail gross (VAT-inclusive) for a transparent working estimate.
    // Derive the exclusive turnover instead of asking the operator to type a taxable base.
    const msGross = n(ms.amount) + n(ms.creditAmount);
    const hsdGross = n(hsd.amount) + n(hsd.creditAmount);
    const msBase = msGross / (1 + n(msVatRate) / 100);
    const hsdBase = hsdGross / (1 + n(hsdVatRate) / 100);
    const msPercentTax = msBase * n(msVatRate) / 100;
    const hsdPercentTax = hsdBase * n(hsdVatRate) / 100;
    const msFloorTax = n(ms.qty) * n(msMinimum);
    const hsdFloorTax = n(hsd.qty) * n(hsdMinimum);
    const msEstimate = Math.max(msPercentTax, msFloorTax);
    const hsdEstimate = Math.max(hsdPercentTax, hsdFloorTax);
    return { lubricantRows, fuelRows, purchases, potentialItc, outputTax, grossLubricant: lubricantRows.reduce((s, r) => s + r.gross, 0), taxableLubricant: lubricantRows.reduce((s, r) => s + r.taxable, 0), msEstimate, hsdEstimate, salesCount: sales.length, creditCount: credits.length };
  }, [data, from, to, msVatRate, hsdVatRate, msMinimum, hsdMinimum]);

  const exportGstr1 = () => {
    const rows = [["Date", "Invoice No", "Customer", "Customer GSTIN", "HSN", "Product", "Sale Type", "Qty", "Taxable Value", "GST Rate %", "CGST", "SGST", "IGST", "Total GST", "Invoice Total"],
      ...report.lubricantRows.map(r => [r.date, r.invoiceNo, r.party, r.gstin, r.hsn, r.product, r.saleType, r.qty, r.taxable.toFixed(2), r.rate, r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.tax.toFixed(2), r.gross.toFixed(2)])];
    download("StationMitra_GSTR1_CA_REVIEW_" + from + "_to_" + to + ".csv", rows);
    setNotice("GSTR-1 के लिए CA review CSV डाउनलोड हुई। इसे official portal JSON न मानें; CA/portal validation आवश्यक है।");
  };
  const exportSummary = () => {
    const rows = [
      ["StationMitra GST & VAT Center", "CA REVIEW EXPORT"], ["Period", from + " to " + to],
      ["GST Output Tax - Lubricant only", report.outputTax.toFixed(2)],
      ["Potential purchase GST (not automatically eligible ITC)", report.potentialItc.toFixed(2)],
      ["CA-confirmed eligible ITC entered", n(confirmedItc).toFixed(2)],
      ["Indicative GST cash liability before other adjustments", Math.max(0, report.outputTax - n(confirmedItc)).toFixed(2)],
      ["MS sales quantity", (report.fuelRows.find(r => r.fuel === "MS")?.qty || 0).toFixed(3)],
      ["MS gross fuel sales amount (software)", ((report.fuelRows.find(r => r.fuel === "MS")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "MS")?.creditAmount || 0)).toFixed(2)],
      ["MS estimated VAT-exclusive turnover (gross / (1 + rate))", (((report.fuelRows.find(r => r.fuel === "MS")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "MS")?.creditAmount || 0)) / (1 + n(msVatRate) / 100)).toFixed(2)],
      ["MS indicative VAT estimate (higher of percentage or per-litre floor)", report.msEstimate.toFixed(2)],
      ["HSD sales quantity", (report.fuelRows.find(r => r.fuel === "HSD")?.qty || 0).toFixed(3)],
      ["HSD gross fuel sales amount (software)", ((report.fuelRows.find(r => r.fuel === "HSD")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "HSD")?.creditAmount || 0)).toFixed(2)],
      ["HSD estimated VAT-exclusive turnover (gross / (1 + rate))", (((report.fuelRows.find(r => r.fuel === "HSD")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "HSD")?.creditAmount || 0)) / (1 + n(hsdVatRate) / 100)).toFixed(2)],
      ["HSD indicative VAT estimate (higher of percentage or per-litre floor)", report.hsdEstimate.toFixed(2)],
      ["Warning", "CA must validate tax base, HSN/rates, GSTR-2B, ITC eligibility, current notifications and portal schema before filing."]
    ];
    download("StationMitra_GST_VAT_CA_RECON_" + from + "_to_" + to + ".csv", rows);
    setNotice("GST/VAT reconciliation CSV डाउनलोड हुई। VAT tax base और ITC को CA द्वारा सत्यापित करना बाकी है।");
  };

  const exportGstr3b = () => {
    download("StationMitra_GSTR3B_CA_WORKING_" + from + "_to_" + to + ".csv", [
      ["Field", "Amount (INR)", "Status"],
      ["Tax period", from + " to " + to, "CA REVIEW"],
      ["Output GST on lubricant sales", report.outputTax.toFixed(2), "Calculated from StationMitra sales rows"],
      ["Potential GST on lubricant purchases", report.potentialItc.toFixed(2), "Not assumed eligible ITC"],
      ["CA-confirmed eligible ITC", n(confirmedItc).toFixed(2), "Entered by user/CA"],
      ["Indicative cash liability", Math.max(0, report.outputTax - n(confirmedItc)).toFixed(2), "Before other adjustments, reversals and portal ledger credits"],
      ["Filing status", "NOT FILED", "No official portal submission performed"]
    ]);
    setNotice("GSTR-3B working CSV डाउनलोड हुई। यह सरकारी रिटर्न नहीं है और इसे CA से verify कराएँ।");
  };
  const exportChallanWorking = () => {
    download("StationMitra_GST_CHALLAN_WORKING_" + from + "_to_" + to + ".csv", [
      ["Field", "Value", "Status"],
      ["GSTIN", "Configure/verify with CA", "Required for official challan"],
      ["Tax period", from + " to " + to, "CA REVIEW"],
      ["Indicative GST cash liability (INR)", Math.max(0, report.outputTax - n(confirmedItc)).toFixed(2), "Estimate only; reconcile with electronic credit/cash ledgers"],
      ["Official challan CIN/CPIN", "NOT GENERATED", "Generate only through official GST portal or configured authorized provider"],
      ["Payment status", "NOT PAID", "This file does not initiate payment"]
    ]);
    setNotice("GST challan working CSV डाउनलोड हुई। यह सरकारी CPIN/CIN नहीं है और कोई भुगतान नहीं हुआ है।");
  };

  const field = { width: "100%", boxSizing: "border-box", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, background: "var(--input-bg, #fff)", color: "var(--text, #0f172a)" };
  const card = { border: "1px solid var(--border, #dbe3ec)", borderRadius: 12, padding: 14, background: "var(--panel, #fff)" };
  const small = { color: "var(--muted, #64748b)", fontSize: 12 };
  return <div className="content">
    <section className="panel">
      <h2>🧾 GST &amp; VAT Center</h2>
      <p style={small}>Satat Filling Station · Haldwani, Uttarakhand · CA reconciliation and export</p>
      <div style={{ background: "#fff7ed", color: "#9a3412", border: "1px solid #fed7aa", padding: 12, borderRadius: 10, margin: "12px 0" }}>
        <b>TEST / CA REVIEW ONLY</b><br />
        <span>यह मॉड्यूल कोई सरकारी रिटर्न फाइल या भुगतान नहीं करता। दरें/टैक्स आधार और ITC पात्रता CA सत्यापित करे। Export फाइलें समीक्षा के लिए हैं।</span>
      </div>
      <div className="form">
        <label>From Date<input style={field} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
        <label>To Date<input style={field} type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
      </div>
      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card"><span>Lubricant GST Sales</span><strong>{money(report.grossLubricant)}</strong></div>
        <div className="card"><span>Taxable Value</span><strong>{money(report.taxableLubricant)}</strong></div>
        <div className="card"><span>Output GST</span><strong>{money(report.outputTax)}</strong></div>
        <div className="card"><span>Purchase GST in selected period ({report.purchases.length} bills)</span><strong>{money(report.potentialItc)}</strong></div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
        <button className="btn" onClick={exportGstr1}>⬇ GSTR-1 CA Review CSV</button>
        <button className="btn" onClick={exportGstr3b}>⬇ GSTR-3B Working CSV</button>
        <button className="btn" onClick={exportChallanWorking}>⬇ GST Challan Working CSV</button>
        <button className="btn" onClick={exportSummary}>⬇ GST/VAT Reconciliation CSV</button>
        <button className="btn gray" onClick={() => window.print()}>Print / Save PDF</button>
      </div>
      {notice && <p role="status" style={{ marginTop: 12, color: "#166534" }}>{notice}</p>}
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <h3>GSTR-1 — Lubricant sales summary</h3>
      <p style={small}>ईंधन की बिक्री को GST taxable sales में शामिल नहीं किया गया है। Invoice-level HSN/GSTIN और B2B/B2C वर्गीकरण CA से सत्यापित करें।</p>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Date</th><th>Invoice</th><th>Party</th><th>GSTIN</th><th>HSN</th><th>Taxable</th><th>GST</th><th>Total</th></tr></thead>
        <tbody>{report.lubricantRows.length ? report.lubricantRows.map((r, i) => <tr key={String(r.invoiceNo) + i}><td>{r.date}</td><td>{r.invoiceNo}</td><td>{r.party}</td><td>{r.gstin || "B2C / verify"}</td><td>{r.hsn || "MISSING"}</td><td>{money(r.taxable)}</td><td>{money(r.tax)}</td><td>{money(r.gross)}</td></tr>) : <tr><td colSpan="8">इस अवधि में lubricant GST sales रिकॉर्ड नहीं मिले।</td></tr>}</tbody>
      </table></div>
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <h3>GSTR-3B — working summary</h3>
      <div className="cards">
        <div className="card"><span>Output GST (Lubricant)</span><strong>{money(report.outputTax)}</strong></div>
        <div className="card"><span>Purchase GST in selected period ({report.purchases.length} bills)</span><strong>{money(report.potentialItc)}</strong></div>
        <div className="card"><span>Indicative net cash liability</span><strong>{money(Math.max(0, report.outputTax - n(confirmedItc)))}</strong></div>
      </div>
      <label style={{ display: "block", marginTop: 12 }}>CA-confirmed eligible ITC (₹)
        <input style={{ ...field, maxWidth: 300 }} type="number" min="0" step="0.01" value={confirmedItc} onChange={e => setConfirmedItc(e.target.value)} />
      </label>
      <p style={small}>Selected date range में केवल उसी अवधि के lubricant purchase bills गिने जाते हैं; item-line GST पहले, फिर bill-level tax पढ़ा जाता है। GSTR-2B, invoice, business-use और ITC restrictions जाँचे बिना इसे eligible ITC न मानें। Net liability केवल प्रारंभिक estimate है; अन्य adjustments और reverse charge लागू हो सकते हैं।</p>
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <h3>Uttarakhand VAT — MS / HSD</h3>
      <p style={small}>VAT working estimate only. The current formula treats recorded sale amount as VAT-inclusive and compares percentage tax with the per-litre minimum. Do not treat this estimate as the statutory payable amount until taxable turnover, invoice adjustments and the current Uttarakhand notification are reconciled against HPCL/DSR records.</p>
      <div style={{ overflowX: "auto" }}><table><thead><tr><th>Fuel</th><th>Sales Qty</th><th>Sales Amount (software)</th><th>Entries</th></tr></thead><tbody>
        {report.fuelRows.map(r => <tr key={r.fuel}><td>{r.fuel}</td><td>{qty(r.qty)} {r.fuel === "CNG" ? "Kg" : "L"}</td><td>{money(r.amount + r.creditAmount)}</td><td>{r.entries}</td></tr>)}
      </tbody></table></div>
      <div className="form" style={{ marginTop: 12 }}>
        <label>MS VAT rate (%)<input style={field} type="number" min="0" step="0.01" value={msVatRate} onChange={e => setMsVatRate(e.target.value)} /></label>
        <label>MS minimum per litre (₹)<input style={field} type="number" min="0" step="0.01" value={msMinimum} onChange={e => setMsMinimum(e.target.value)} /></label>
        <label>HSD VAT rate (%)<input style={field} type="number" min="0" step="0.01" value={hsdVatRate} onChange={e => setHsdVatRate(e.target.value)} /></label>
        <label>HSD minimum per litre (₹)<input style={field} type="number" min="0" step="0.01" value={hsdMinimum} onChange={e => setHsdMinimum(e.target.value)} /></label>
      </div>
      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card"><span>MS auto VAT estimate</span><strong>{money(report.msEstimate)}</strong><small>Sales gross: {money((report.fuelRows.find(r => r.fuel === "MS")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "MS")?.creditAmount || 0))}</small></div>
        <div className="card"><span>HSD auto VAT estimate</span><strong>{money(report.hsdEstimate)}</strong><small>Sales gross: {money((report.fuelRows.find(r => r.fuel === "HSD")?.amount || 0) + (report.fuelRows.find(r => r.fuel === "HSD")?.creditAmount || 0))}</small></div>
      </div>
      <p style={small}>Working formula: estimated taxable turnover = software gross sales ÷ (1 + VAT rate); percentage amount = estimated taxable turnover × rate; floor = sales litres × minimum per litre; estimate = higher of percentage amount and floor. This is not a final statutory calculation. Match taxable turnover to the current Uttarakhand notification and actual DSR/HPCL records, and separately reconcile discounts, cancellations and adjustments. CNG is separate.</p>
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <h3>GST Portal / Authorized GSP Integration</h3>
      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: 12, borderRadius: 10 }}>
        <b>स्थिति: अभी कनेक्ट नहीं है</b>
        <p style={{ ...small, marginBottom: 0 }}>GSTN/GSP API credentials, provider agreement and sandbox access are not configured in this test build. No GST portal API call, return filing, challan generation or payment is being performed.</p>
      </div>
      <ul>
        <li>Choose a GSTN-empanelled GSP and confirm pricing, supported APIs and onboarding terms.</li>
        <li>Obtain sandbox credentials and test access from the provider.</li>
        <li>Keep API secrets on a server-side function only; never put them in VITE_ variables or browser code.</li>
        <li>Run sandbox authentication, return validation and status checks before any production integration.</li>
        <li>Enable actual filing/payment only after explicit owner approval and CA verification.</li>
      </ul>
    </section>

    <section className="panel" style={{ marginTop: 16 }}>
      <h3>CA checklist</h3>
      <ul>
        <li>GSTR-1: invoice-wise sale, GSTIN, HSN, taxable value, tax rate and credit/debit notes.</li>
        <li>GSTR-3B: output tax, GSTR-2B reconciliation, eligible ITC, reversals and cash ledger.</li>
        <li>MS/HSD VAT: verify current Uttarakhand notification, tax base, minimum-per-litre rule and applicable filing period.</li>
        <li>Reconcile StationMitra with HPCL bills, bank/settlement reports, purchase ledger and stock records.</li>
        <li>Review this CSV before entering anything on the official portal; portal schema and validation remain separate.</li>
      </ul>
    </section>
  </div>;
}
