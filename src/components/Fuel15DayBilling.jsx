import React, { useMemo, useState } from "react";
import { getRate } from "../core/pumpDomain";
import historicalDsr from "../data/dsr_apr_jul_2026.json";

const START = "2026-04-01";
const END = "2026-07-31";
const MS_HSD = new Set(["MS", "HSD"]);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(v) {
  return Math.round((num(v) + Number.EPSILON) * 100) / 100;
}
function iso(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(s, days) {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + days);
  return iso(d);
}
function dateText(s) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}
function money(v) {
  return `₹${round2(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function emptyFuel() {
  return { qty: 0, amount: 0 };
}
function addFuel(target, fuel, qty, amount) {
  if (!MS_HSD.has(fuel)) return;
  target[fuel] = target[fuel] || emptyFuel();
  target[fuel].qty += num(qty);
  target[fuel].amount += num(amount);
}
function finalizeFuel(fuelMap) {
  return ["MS", "HSD"].map(fuel => {
    const x = fuelMap[fuel] || emptyFuel();
    return {
      fuel,
      qty: round2(x.qty),
      amount: round2(x.amount),
      rate: x.qty ? round2(x.amount / x.qty) : 0
    };
  }).filter(x => x.qty > 0.0001 || x.amount > 0.005);
}

function buildBills(data) {
  const result = [];
  let billSeq = 304;
  const historical = Array.isArray(historicalDsr) ? historicalDsr : [];

  // Keep only the tiny set of historical rate changes needed for Apr-Jul.
  // Never sort or copy the complete cloud state.
  const rateChanges = [];
  const sourceRates = Array.isArray(data?.rateHistory) ? data.rateHistory : [];
  for (let i = 0; i < sourceRates.length; i += 1) {
    const r = sourceRates[i];
    if (!r?.date || String(r.date) > END) continue;
    if (r.MS !== undefined || r.HSD !== undefined) {
      rateChanges.push({
        date: String(r.date),
        MS: r.MS === undefined ? null : num(r.MS),
        HSD: r.HSD === undefined ? null : num(r.HSD)
      });
    }
  }
  rateChanges.sort((x, y) => x.date.localeCompare(y.date));

  const baseRates = data?.rates || {};
  const dailyRates = new Map();
  let msRate = num(baseRates.MS);
  let hsdRate = num(baseRates.HSD);
  let ri = 0;
  for (let date = START; date <= END; date = addDays(date, 1)) {
    while (ri < rateChanges.length && rateChanges[ri].date <= date) {
      if (rateChanges[ri].MS !== null && rateChanges[ri].MS > 0) msRate = rateChanges[ri].MS;
      if (rateChanges[ri].HSD !== null && rateChanges[ri].HSD > 0) hsdRate = rateChanges[ri].HSD;
      ri += 1;
    }
    dailyRates.set(date, { MS: msRate, HSD: hsdRate });
  }

  // Group the small static DSR file once instead of filtering it for every day.
  const daily = new Map();
  historical.forEach(r => {
    if (!MS_HSD.has(r?.fuel) || !r?.date) return;
    const key = String(r.date);
    if (!daily.has(key)) daily.set(key, []);
    daily.get(key).push(r);
  });

  for (let date = START; date <= END; date = addDays(date, 1)) {
    const rows = daily.get(date) || [];
    const map = {};

    rows.forEach(r => {
      const qty = num(r.netSales);
      const rate = dailyRates.get(date)?.[r.fuel] || 0;
      addFuel(map, r.fuel, qty, qty * rate);
    });

    const items = finalizeFuel(map);
    const total = round2(items.reduce((sum, x) => sum + x.amount, 0));
    if (total <= 0.005) continue;

    result.push({
      billNo: String(billSeq++),
      type: "CASH",
      party: "CASH SALE",
      date,
      payment: "Cash",
      gst: "Not Applicable",
      items,
      total
    });
  }

  return result;
}
export function Fuel15DayBilling({ data }) {
  const [selected, setSelected] = useState(null);
  const bills = useMemo(() => buildBills(data), [data]);

  const printBill = bill => {
    const rows = bill.items.map(x => `
      <tr>
        <td>${x.fuel === "MS" ? "MS (Petrol)" : "HSD (Diesel)"}</td>
        <td style="text-align:right">${x.qty.toFixed(2)}</td>
        <td style="text-align:right">${money(x.rate)}</td>
        <td style="text-align:right">${money(x.amount)}</td>
      </tr>`).join("");

    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;

    w.document.write(`<!doctype html><html><head><title>Fuel Bill ${bill.billNo}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:28px;color:#111}
        .paper{max-width:760px;margin:auto;border:1px solid #bbb;padding:28px}
        h1{text-align:center;margin:0 0 4px;font-size:22px}
        h2{text-align:center;margin:0 0 20px;font-size:15px}
        .meta{display:flex;justify-content:space-between;margin:14px 0;font-size:13px}
        table{width:100%;border-collapse:collapse;margin-top:18px}
        th,td{border:1px solid #aaa;padding:9px}
        th{background:#f3f3f3}
        .total{text-align:right;font-size:17px;font-weight:800;margin-top:16px}
        .note{margin-top:18px;font-size:12px}
        .sign{margin-top:55px;text-align:right;font-size:12px}
        @media print{body{padding:0}.paper{border:0}}
      </style></head>
      <body><div class="paper">
        <h1>SATAT FILLING STATION</h1>
        <h2>DEALER - HINDUSTAN PETROLEUM CORP. LTD.</h2>
        <div class="meta">
          <div><b>Bill No.:</b> ${bill.billNo}</div>
          <div><b>Bill Date:</b> ${dateText(bill.date)}</div>
        </div>
        <div><b>M/s:</b> ${bill.party}</div>
        <div style="margin-top:8px"><b>Sale Date:</b> ${dateText(bill.date)}</div>
        <table>
          <thead><tr><th>Product</th><th>Qty (Ltr)</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total">Grand Total: ${money(bill.total)}</div>
        <div class="note">
          <b>Payment:</b> Cash<br/>
          <b>GST:</b> Not Applicable — MS/HSD are shown without GST in this fuel bill.
        </div>
        <div class="sign">Authorized Signatory</div>
      </div></body></html>`);

    w.document.close();
    w.focus();
    w.print();
  };

  const totalAmount = bills.reduce((s, b) => s + b.total, 0);

  return <section className="panel" style={{ marginTop: 12 }}>
    <div className="section-title">
      <div>
        <h2>Daily MS / HSD Cash Billing</h2>
        <small>01 Apr 2026 से 31 Jul 2026 · हर दिन अलग Cash Bill · Bill No. 304 से</small>
      </div>
    </div>

    <div className="cards" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))", marginBottom: 14 }}>
      <div className="card"><span>Daily Bills</span><b>{bills.length}</b></div>
      <div className="card"><span>First Bill</span><b>{bills[0]?.billNo || "—"}</b></div>
      <div className="card"><span>Total Billing</span><b>{money(totalAmount)}</b></div>
    </div>

    <div style={{padding:"10px 12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,fontSize:12,marginBottom:12,lineHeight:1.55}}>
      <b>Billing Rule:</b> 01 Apr–31 Jul 2026 की हर तारीख की पूरी MS + HSD बिक्री एक ही Cash Bill में है.
      Credit/Party bills इस billing list में नहीं हैं. <b>CNG पूरी तरह excluded है.</b> Bill numbering 304 से लगातार है.
    </div>

    <div style={{overflowX:"auto"}}>
      <table className="data-table" style={{width:"100%",minWidth:850}}>
        <thead>
          <tr>
            <th>Bill No.</th><th>Sale Date</th><th>Party</th><th>Payment</th>
            <th>MS Qty</th><th>HSD Qty</th><th>Total</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {bills.map((b, i) => <tr key={b.billNo + "-" + b.date}>
            <td><b>{b.billNo}</b></td>
            <td>{dateText(b.date)}</td>
            <td>{b.party}</td>
            <td><span style={{padding:"3px 7px",borderRadius:99,background:"#ecfdf3",color:"#166534",fontWeight:800,fontSize:10}}>CASH</span></td>
            <td>{(b.items.find(x=>x.fuel==="MS")?.qty || 0).toFixed(2)}</td>
            <td>{(b.items.find(x=>x.fuel==="HSD")?.qty || 0).toFixed(2)}</td>
            <td><b>{money(b.total)}</b></td>
            <td>
              <button type="button" className="btn small" onClick={() => setSelected(i)}>View</button>{" "}
              <button type="button" className="btn small" onClick={() => printBill(b)}>Print</button>
            </td>
          </tr>)}
        </tbody>
      </table>
    </div>

    {selected !== null && bills[selected] && <div onClick={() => setSelected(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
      <div onClick={e => e.stopPropagation()} style={{width:"min(850px,96vw)",maxHeight:"90vh",overflow:"auto",padding:20,border:"1px solid #dbe3ec",borderRadius:14,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        {(() => {
          const b = bills[selected];
          return <>
            <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
              <div>
                <h3 style={{margin:"0 0 4px"}}>Bill No. {b.billNo}</h3>
                <div style={{fontSize:12,color:"#64748b"}}>{b.party} · {dateText(b.date)} · Cash</div>
              </div>
              <button className="btn" onClick={() => printBill(b)}>🖨 Print Bill</button>
            </div>
            <table className="data-table" style={{width:"100%",marginTop:12}}>
              <thead><tr><th>Fuel</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>{b.items.map(x => <tr key={x.fuel}>
                <td>{x.fuel==="MS" ? "MS (Petrol)" : "HSD (Diesel)"}</td>
                <td>{x.qty.toFixed(2)} L</td>
                <td>{money(x.rate)}</td>
                <td>{money(x.amount)}</td>
              </tr>)}</tbody>
            </table>
            <div style={{textAlign:"right",fontSize:18,fontWeight:900,marginTop:12}}>Grand Total: {money(b.total)}</div>
            <div style={{marginTop:10,fontSize:11,color:"#475569"}}>Payment: <b>Cash</b> · CNG: <b>Excluded</b> · GST: <b>Not Applicable</b></div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
              <button type="button" className="btn" onClick={() => printBill(b)}>🖨 Print Bill</button>
              <button type="button" className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>
          </>;
        })()}
      </div>
    </div>}
  </section>;
}

export default Fuel15DayBilling;
