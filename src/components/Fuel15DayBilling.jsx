import React, { useMemo, useState } from "react";
import { getRate, rupee } from "../core/pumpDomain";
import historicalDsr from "../data/dsr_apr_jul_2026.json";

const START = "2026-04-01";
const CLOSED_END = "2026-09-30";
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
function monthEnd(s) {
  const d = new Date(s + "T00:00:00");
  return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function periods() {
  const out = [];
  let y = 2026, m = 3;
  while (true) {
    const mm = String(m + 1).padStart(2, "0");
    const first = `${y}-${mm}-01`;
    const mid = `${y}-${mm}-15`;
    const last = monthEnd(first);
    if (first > CLOSED_END) break;
    out.push({ start: first, end: mid });
    if (mid < CLOSED_END) out.push({ start: addDays(mid, 1), end: last > CLOSED_END ? CLOSED_END : last });
    m += 1;
    if (m === 12) { m = 0; y += 1; }
  }
  return out.filter(x => x.start <= CLOSED_END);
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
  let billSeq = 1;

  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const credits = Array.isArray(data?.credits) ? data.credits : [];
  const historical = Array.isArray(historicalDsr) ? historicalDsr : [];

  const totalSalesForPeriod = (start, end) => {
    const map = {};
    if (start < "2026-08-01") {
      historical
        .filter(r => r.date >= start && r.date <= end && MS_HSD.has(r.fuel))
        .forEach(r => {
          // Apr-Jul historical DSR is the authoritative meter-sales source.
          addFuel(map, r.fuel, r.netSales, 0);
        });
      // Historical DSR has quantity only; rate is applied below per day.
      const rows = historical.filter(r => r.date >= start && r.date <= end && MS_HSD.has(r.fuel));
      const priced = {};
      rows.forEach(r => {
        const rate = num(getRate(data, r.fuel, r.date));
        addFuel(priced, r.fuel, r.netSales, num(r.netSales) * rate);
      });
      return priced;
    }
    sales
      .filter(r => r.date >= start && r.date <= end && MS_HSD.has(r.fuel))
      .forEach(r => addFuel(map, r.fuel, r.qty, r.amount));
    return map;
  };

  for (const p of periods()) {
    const all = totalSalesForPeriod(p.start, p.end);
    const creditByParty = new Map();

    if (p.end >= "2026-08-01") {
      credits
        .filter(r => r.date >= p.start && r.date <= p.end && MS_HSD.has(r.fuel))
        .forEach(r => {
          const party = String(r.party || "Unknown Party").trim() || "Unknown Party";
          if (!creditByParty.has(party)) creditByParty.set(party, {});
          addFuel(creditByParty.get(party), r.fuel, r.qty, r.amount);
        });
    }

    // From 1 Apr to 31 Jul: everything is Cash as requested.
    if (p.end < "2026-08-01") {
      const items = finalizeFuel(all);
      const total = round2(items.reduce((s, x) => s + x.amount, 0));
      if (total > 0.005) {
        result.push({
          billNo: String(billSeq++).padStart(3, "0"),
          type: "CASH",
          party: "CASH SALE",
          start: p.start,
          end: p.end,
          payment: "Cash",
          gst: "Not Applicable",
          items,
          total
        });
      }
      continue;
    }

    // From Aug onward: actual Credit Sale records stay Credit, by party.
    [...creditByParty.keys()].sort((a, b) => a.localeCompare(b)).forEach(party => {
      const items = finalizeFuel(creditByParty.get(party));
      const total = round2(items.reduce((s, x) => s + x.amount, 0));
      if (total > 0.005) {
        result.push({
          billNo: String(billSeq++).padStart(3, "0"),
          type: "CREDIT",
          party,
          start: p.start,
          end: p.end,
          payment: "Credit",
          gst: "Not Applicable",
          items,
          total
        });
      }
    });

    // Whatever is in MS/HSD meter sales but is not in Credit Sale is Cash.
    const cash = {};
    ["MS", "HSD"].forEach(fuel => {
      const total = all[fuel] || emptyFuel();
      let creditQty = 0, creditAmount = 0;
      creditByParty.forEach(m => {
        const c = m[fuel] || emptyFuel();
        creditQty += c.qty;
        creditAmount += c.amount;
      });
      const qty = Math.max(0, total.qty - creditQty);
      const amount = Math.max(0, total.amount - creditAmount);
      if (qty > 0.0001 || amount > 0.005) {
        cash[fuel] = { qty, amount };
      }
    });
    const cashItems = finalizeFuel(cash);
    const cashTotal = round2(cashItems.reduce((s, x) => s + x.amount, 0));
    if (cashTotal > 0.005) {
      result.push({
        billNo: String(billSeq++).padStart(3, "0"),
        type: "CASH",
        party: "CASH SALE",
        start: p.start,
        end: p.end,
        payment: "Cash",
        gst: "Not Applicable",
        items: cashItems,
        total: cashTotal
      });
    }
  }

  return result;
}

function money(v) {
  return `₹${round2(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function dateText(s) {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

export function Fuel15DayBilling({ data }) {
  const [selected, setSelected] = useState(null);
  const bills = useMemo(() => buildBills(data), [data]);

  const printBill = bill => {
    const rows = bill.items.map(x => `
      <tr><td>${x.fuel === "MS" ? "MS (Petrol)" : "HSD (Diesel)"}</td>
      <td style="text-align:right">${x.qty.toFixed(2)}</td>
      <td style="text-align:right">${money(x.rate)}</td>
      <td style="text-align:right">${money(x.amount)}</td></tr>`).join("");
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Fuel Bill ${bill.billNo}</title>
      <style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.paper{max-width:760px;margin:auto;border:1px solid #bbb;padding:28px}
      h1{text-align:center;margin:0 0 4px;font-size:22px}h2{text-align:center;margin:0 0 20px;font-size:15px}
      .meta{display:flex;justify-content:space-between;margin:14px 0;font-size:13px}.period{background:#f5f5f5;padding:9px;text-align:center;margin:12px 0}
      table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #aaa;padding:9px}th{background:#f3f3f3}.total{text-align:right;font-size:17px;font-weight:800;margin-top:16px}
      .note{margin-top:18px;font-size:12px}.sign{margin-top:55px;text-align:right;font-size:12px}@media print{body{padding:0}.paper{border:0}}</style></head>
      <body><div class="paper"><h1>SATAT FILLING STATION</h1><h2>DEALER - HINDUSTAN PETROLEUM CORP. LTD.</h2>
      <div class="meta"><div><b>Bill No.:</b> ${bill.billNo}</div><div><b>Bill Date:</b> ${dateText(bill.end)}</div></div>
      <div><b>M/s:</b> ${bill.party}</div><div class="period"><b>Billing Period:</b> ${dateText(bill.start)} to ${dateText(bill.end)}</div>
      <table><thead><tr><th>Product</th><th>Qty (Ltr)</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total">Grand Total: ${money(bill.total)}</div>
      <div class="note"><b>Payment:</b> ${bill.payment}<br/><b>GST:</b> ${bill.gst} — MS/HSD are shown without GST in this fuel bill.</div>
      <div class="sign">Authorized Signatory</div></div></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const periodCount = new Set(bills.map(b => `${b.start}|${b.end}`)).size;
  const cashCount = bills.filter(b => b.type === "CASH").length;
  const creditCount = bills.filter(b => b.type === "CREDIT").length;

  return <section className="panel" style={{ marginTop: 12 }}>
    <div className="section-title">
      <div>
        <h2>15-Day MS / HSD Billing</h2>
        <small>01 Apr 2026 से 15-day billing · Bill No. 001 से · Cash/Credit automatic</small>
      </div>
    </div>

    <div className="cards" style={{ gridTemplateColumns: "repeat(4,minmax(0,1fr))", marginBottom: 14 }}>
      <div className="card"><span>Closed Periods</span><b>{periodCount}</b></div>
      <div className="card"><span>Total Bills</span><b>{bills.length}</b></div>
      <div className="card"><span>Cash Bills</span><b>{cashCount}</b></div>
      <div className="card"><span>Credit Bills</span><b>{creditCount}</b></div>
    </div>

    <div style={{padding:"10px 12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,fontSize:12,marginBottom:12,lineHeight:1.55}}>
      <b>Rule:</b> 01 Apr–31 Jul 2026 = पूरा Cash. 01 Aug 2026 से Credit Sale में मौजूद MS/HSD = Credit party bill.
      बाकी MS/HSD = Cash bill. CNG इस module में शामिल नहीं है. GST MS/HSD पर 0 / Not Applicable रखा गया है.
    </div>

    <div style={{overflowX:"auto"}}>
      <table className="data-table" style={{width:"100%",minWidth:850}}>
        <thead><tr><th>Bill No.</th><th>Period</th><th>Party</th><th>Type</th><th>MS Qty</th><th>HSD Qty</th><th>Total</th><th>Action</th></tr></thead>
        <tbody>
          {bills.map((b, i) => <tr key={b.billNo + "-" + b.start + "-" + b.party}>
            <td><b>{b.billNo}</b></td>
            <td>{dateText(b.start)} - {dateText(b.end)}</td>
            <td>{b.party}</td>
            <td><span style={{padding:"3px 7px",borderRadius:99,background:b.type==="CREDIT"?"#fff7ed":"#ecfdf3",color:b.type==="CREDIT"?"#9a3412":"#166534",fontWeight:800,fontSize:10}}>{b.type}</span></td>
            <td>{(b.items.find(x=>x.fuel==="MS")?.qty || 0).toFixed(2)}</td>
            <td>{(b.items.find(x=>x.fuel==="HSD")?.qty || 0).toFixed(2)}</td>
            <td><b>{money(b.total)}</b></td>
            <td><button type="button" className="btn small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelected(i); }}>View</button> <button type="button" className="btn small" onClick={(e) => { e.preventDefault(); e.stopPropagation(); printBill(b); }}>Print</button></td>
          </tr>)}
        </tbody>
      </table>
    </div>

    {selected !== null && bills[selected] && <div onClick={() => setSelected(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
<div onClick={(e)=>e.stopPropagation()} style={{width:"min(850px,96vw)",maxHeight:"90vh",overflow:"auto",padding:20,border:"1px solid #dbe3ec",borderRadius:14,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
      {(() => { const b=bills[selected]; return <><div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><div><h3 style={{margin:"0 0 4px"}}>Bill No. {b.billNo}</h3><div style={{fontSize:12,color:"#64748b"}}>{b.party} · {dateText(b.start)} to {dateText(b.end)} · {b.payment}</div></div><button className="btn" onClick={() => printBill(b)}>🖨 Print Bill</button></div>
      <table className="data-table" style={{width:"100%",marginTop:12}}><thead><tr><th>Fuel</th><th>Qty</th><th>Average Rate</th><th>Amount</th></tr></thead><tbody>{b.items.map(x=><tr key={x.fuel}><td>{x.fuel==="MS"?"MS (Petrol)":"HSD (Diesel)"}</td><td>{x.qty.toFixed(2)} L</td><td>{money(x.rate)}</td><td>{money(x.amount)}</td></tr>)}</tbody></table>
      <div style={{textAlign:"right",fontSize:18,fontWeight:900,marginTop:12}}>Grand Total: {money(b.total)}</div>
      <div style={{marginTop:10,fontSize:11,color:"#475569"}}>Payment: <b>{b.payment}</b> · GST: <b>Not Applicable</b></div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
        <button type="button" className="btn" onClick={() => printBill(b)}>🖨 Print Bill</button>
        <button type="button" className="btn" onClick={() => setSelected(null)}>Close</button>
      </div>
      </>; })()}
    </div></div>}
  </section>;
}

export default Fuel15DayBilling;
