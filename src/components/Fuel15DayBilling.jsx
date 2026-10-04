import React, { useEffect, useMemo, useState } from "react";
import historicalDsr from "../data/dsr_apr_jul_2026.json";
import { authoritativeSalesRows, todayDate } from "../core/pumpDomain";

const MS_RATE = 99.79;
const HSD_RATE = 95.32;
const MS_HSD = new Set(["MS", "HSD"]);

const num = v => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = v => Math.round((num(v) + Number.EPSILON) * 100) / 100;
const money = v => `₹${round2(v).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText = s => {
  const [y,m,d] = String(s).split("-");
  return `${d}/${m}/${y}`;
};
const addDays = (s, days=1) => {
  const [y,m,d] = String(s).split("-").map(Number);
  const x = new Date(y,m-1,d + days);
  return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,"0")}-${String(x.getDate()).padStart(2,"0")}`;
};
const emptyFuel = () => ({qty:0, amount:0});

function buildHistoricalBills() {
  const daily = new Map();
  (Array.isArray(historicalDsr) ? historicalDsr : []).forEach(r => {
    const date = String(r?.date || "");
    const fuel = String(r?.fuel || "").toUpperCase();
    if (!date || !MS_HSD.has(fuel)) return;
    if (!daily.has(date)) daily.set(date,{MS:emptyFuel(),HSD:emptyFuel()});
    daily.get(date)[fuel].qty += num(r.netSales);
    daily.get(date)[fuel].amount += num(r.netSales) * (fuel === "MS" ? MS_RATE : HSD_RATE);
  });

  const out = [];
  let no = 304;
  for (let date="2026-04-01"; date<="2026-07-31"; date=addDays(date)) {
    const sale = daily.get(date) || {MS:emptyFuel(),HSD:emptyFuel()};
    const total = round2(sale.MS.amount + sale.HSD.amount);
    out.push({
      billNo:String(no++), date, type:"HISTORICAL_CASH",
      party:"CASH SALE", payment:"Cash", sale,
      creditRows:[], creditAmount:0, cashAmount:total,
      creditAmountByFuel:{MS:0,HSD:0},
      cashAmountByFuel:{MS:sale.MS.amount,HSD:sale.HSD.amount},
      total
    });
  }
  return out;
}

function buildLiveBills(data) {
  const START = "2026-08-01";
  const END = todayDate();
  const sales = authoritativeSalesRows(data || {}).filter(r => {
    const date=String(r?.date||"");
    const fuel=String(r?.fuel||"").toUpperCase();
    return date>=START && date<=END && MS_HSD.has(fuel);
  });

  const saleByDate = new Map();
  sales.forEach(r => {
    const date=String(r.date), fuel=String(r.fuel).toUpperCase();
    if(!saleByDate.has(date)) saleByDate.set(date,{MS:emptyFuel(),HSD:emptyFuel()});
    saleByDate.get(date)[fuel].qty += num(r.qty);
    saleByDate.get(date)[fuel].amount += num(r.amount);
  });

  const creditByDate = new Map();
  (Array.isArray(data?.credits) ? data.credits : []).forEach(c => {
    const date=String(c?.date||""), fuel=String(c?.fuel||"").toUpperCase();
    if(date<START || date>END || !MS_HSD.has(fuel)) return;
    if(!creditByDate.has(date)) creditByDate.set(date,[]);
    creditByDate.get(date).push({
      party:String(c?.party||"Credit Party").trim() || "Credit Party",
      parchiNo:String(c?.parchiNo||"").trim(),
      fuel, qty:num(c?.qty), amount:num(c?.amount)
    });
  });

  const out=[];
  let no=426;
  for(let date=START; date<=END; date=addDays(date)){
    const sale=saleByDate.get(date)||{MS:emptyFuel(),HSD:emptyFuel()};
    const rows=creditByDate.get(date)||[];
    const creditRaw={MS:0,HSD:0}, creditQty={MS:0,HSD:0};
    rows.forEach(c=>{creditRaw[c.fuel]+=c.amount;creditQty[c.fuel]+=c.qty;});

    const creditAmountByFuel={
      MS:Math.min(sale.MS.amount,creditRaw.MS),
      HSD:Math.min(sale.HSD.amount,creditRaw.HSD)
    };
    const creditQtyUsedByFuel={
      MS:Math.min(sale.MS.qty,creditQty.MS),
      HSD:Math.min(sale.HSD.qty,creditQty.HSD)
    };
    const total=round2(sale.MS.amount+sale.HSD.amount);
    const creditAmount=round2(creditAmountByFuel.MS+creditAmountByFuel.HSD);
    const cashAmount=round2(Math.max(0,total-creditAmount));

    out.push({
      billNo:String(no++), date, type:"DAILY_AUTO",
      party:"DAILY CONSOLIDATED SALE",
      payment:creditAmount>0?"Cash + Credit":"Cash",
      sale, creditRows:rows, creditAmount,
      cashAmount, creditAmountByFuel,
      creditQtyUsedByFuel,
      cashAmountByFuel:{
        MS:Math.max(0,sale.MS.amount-creditAmountByFuel.MS),
        HSD:Math.max(0,sale.HSD.amount-creditAmountByFuel.HSD)
      },
      total
    });
  }
  return out;
}

export function Fuel15DayBilling({data}) {
  const [selected,setSelected]=useState(null);
  const [billPage,setBillPage]=useState(0);
  const PAGE_SIZE=25;
  const bills=useMemo(()=>[...buildHistoricalBills(),...buildLiveBills(data)], [data]);
  const totalAmount=bills.reduce((s,b)=>s+b.total,0);
  const liveBills=bills.filter(b=>b.type==="DAILY_AUTO");
  const lubricantHsnFor=(row)=>{
    const direct=String(row?.hsnCode||row?.hsn||"").trim();
    if(direct) return direct;
    const product=String(row?.productName||"").trim().toLowerCase();
    if(!product) return "";
    const purchases=Array.isArray(data?.purchases)?data.purchases:[];
    for(const p of purchases){
      if(String(p?.fuel||"").toUpperCase()!=="LUBRICANT") continue;
      const items=Array.isArray(p?.items)?p.items:[];
      const item=items.find(it=>String(it?.description||"").trim().toLowerCase()===product);
      if(item?.hsn) return String(item.hsn).trim();
      if(String(p?.productName||"").trim().toLowerCase()===product && p?.hsn) return String(p.hsn).trim();
    }
    return "";
  };
  const lubricantBills=useMemo(()=>{
    const rows=[
      ...(Array.isArray(data?.credits)?data.credits:[])
        .filter(x=>String(x?.fuel||"").toUpperCase()==="LUBRICANT")
        .map(x=>({id:String(x.id||x.transactionId||""),date:String(x.date||""),party:String(x.party||"Credit Party"),product:String(x.productName||"Lubricant"),qty:num(x.qty),amount:round2(x.amount),payment:"CREDIT",parchiNo:String(x.parchiNo||""),gstRate:num(x.gstRate)>0?num(x.gstRate):18,hsnCode:String(x.hsnCode||x.hsn||"").trim(),kind:"CREDIT"})),
      ...(Array.isArray(data?.lubricantCashSales)?data.lubricantCashSales:[])
        .map(x=>({id:String(x.id||x.transactionId||""),date:String(x.date||""),party:"CASH CUSTOMER",product:String(x.productName||"Lubricant"),qty:num(x.qty),amount:round2(x.amount),payment:String(x.paymentMode||"CASH").toUpperCase(),parchiNo:"",gstRate:num(x.gstRate)>0?num(x.gstRate):18,hsnCode:String(x.hsnCode||x.hsn||"").trim(),kind:"CASH"}))
    ].filter(x=>x.date);
    rows.sort((a,b)=>String(a.date).localeCompare(String(b.date))||String(a.id).localeCompare(String(b.id)));
    const counters={};
    return rows.map(x=>{
      x.hsnCode=lubricantHsnFor(x);
      const y=Number(String(x.date).slice(0,4));
      const fyStart=String(x.date).slice(5,10)>="04-01"?y:y-1;
      const key=String(fyStart);
      counters[key]=(counters[key]||0)+1;
      const fyLabel=String(fyStart)+"-"+String(fyStart+1).slice(-2);
      return {...x,billNo:"LUB-"+fyLabel+"-"+String(counters[key]).padStart(4,"0")};
    }).sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  },[data?.credits,data?.lubricantCashSales]);
  const billPageCount=Math.max(1,Math.ceil(bills.length/PAGE_SIZE));
  const visibleBills=bills.slice(billPage*PAGE_SIZE,(billPage+1)*PAGE_SIZE);
  useEffect(()=>{setBillPage(p=>Math.min(p,billPageCount-1));},[billPageCount]);

  const printLubricantBill=x=>{
    const gstRate=num(x.gstRate)>0?num(x.gstRate):18;
    const total=round2(x.amount);
    const taxable=round2(total*100/(100+gstRate));
    const tax=round2(total-taxable);
    const cgst=round2(tax/2), sgst=round2(tax-cgst);
    const rate=x.qty>0?round2(total/x.qty):0;\n    const hsn=x.hsnCode||lubricantHsnFor(x)||"Not available";
    const w=window.open("","_blank","width=900,height=1000");
    if(!w){window.alert("Print window blocked है. Chrome में pop-ups Allow करें.");return;}
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tax Invoice ${x.billNo}</title><style>
      body{font-family:Arial,sans-serif;padding:24px;color:#111}.paper{max-width:820px;margin:auto;border:1px solid #222;padding:24px}
      h1{text-align:center;margin:0 0 4px;font-size:24px}h2{text-align:center;margin:0 0 18px;font-size:16px}.meta{display:grid;grid-template-columns:1fr 1fr}
      .meta>div{padding:9px;border:1px solid #555}.meta>div+div{border-left:0}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #555;padding:8px;font-size:12px}th{background:#eee}.num{text-align:right}.total{font-size:18px;font-weight:800;text-align:right;margin-top:14px}
      .taxbox{margin-top:14px;border:1px solid #555;padding:10px}.sign{text-align:right;margin-top:60px;font-weight:700}@media print{body{padding:0}.paper{border:0}}
    </style></head><body><div class="paper">
      <h1>SATAT FILLING STATION</h1><h2>TAX INVOICE — LUBRICANT / MOBILE OIL</h2>
      <div style="text-align:center;font-size:12px"><b>GSTIN: 05ABWFS5610D1Z4</b> &nbsp; | &nbsp; State Code: 05<br>DEALER - HINDUSTAN PETROLEUM CORP. LTD.<br>Bye Pass Gaujajali (Bichli), HALDWANI-263139, Distt. Nainital (Uttarakhand)</div>
      <div class="meta" style="margin-top:16px"><div><b>Bill No.:</b> ${x.billNo}<br><b>Party:</b> ${x.party}<br><b>Parchi No.:</b> ${x.parchiNo||"—"}<br><b>HSN Code:</b> ${hsn}</div><div><b>Bill Date:</b> ${dateText(x.date)}<br><b>Payment:</b> ${x.payment}<br><b>Supply State:</b> Uttarakhand</div></div>
      <table><thead><tr><th>HSN Code</th><th>Product</th><th>Qty (L)</th><th>Rate (Incl. GST)</th><th>Taxable Value</th><th>GST 18%</th><th>Total</th></tr></thead>
      <tbody><tr><td>${hsn}</td><td>${x.product}</td><td class="num">${x.qty.toFixed(2)}</td><td class="num">${money(rate)}</td><td class="num">${money(taxable)}</td><td class="num">${money(tax)}</td><td class="num">${money(total)}</td></tr></tbody></table>
      <div class="taxbox"><b>GST Break-up</b><br>Taxable Value: ${money(taxable)}<br>CGST @ 9%: ${money(cgst)}<br>SGST @ 9%: ${money(sgst)}<br>IGST @ 0%: ₹0.00</div>
      <div class="total">Grand Total: ${money(total)}</div>
      <div style="margin-top:8px;font-size:12px"><b>Amount in words:</b> Rupees ${Math.round(total).toLocaleString("en-IN")} Only</div>
      <div class="sign">For - SATAT FILLING STATION<br><br>Authorized Signatory</div>
    </div></body></html>`);
    w.document.close();w.focus();w.print();
  };

  const printBill=b=>{
    const fuelRows=["MS","HSD"].filter(f=>b.sale[f].qty||b.sale[f].amount).map(f=>{
      const rate=b.sale[f].qty?b.sale[f].amount/b.sale[f].qty:0;
      return `<tr><td>${f==="MS"?"MS (Petrol)":"HSD (Diesel)"}</td><td style="text-align:right">${b.sale[f].qty.toFixed(2)}</td><td style="text-align:right">${money(rate)}</td><td style="text-align:right">${money(b.sale[f].amount)}</td><td style="text-align:right">${money(b.creditAmountByFuel[f])}</td><td style="text-align:right">${money(b.cashAmountByFuel[f])}</td></tr>`;
    }).join("");

    const creditRows=b.creditRows.map(c=>`<tr><td>${c.party}</td><td>${c.parchiNo||"—"}</td><td>${c.fuel}</td><td style="text-align:right">${c.qty.toFixed(2)} L</td><td style="text-align:right">${money(c.amount)}</td></tr>`).join("");

    const w=window.open("","_blank","width=900,height=1000");
    if(!w)return;
    w.document.write(`<!doctype html><html><head><title>Fuel Bill ${b.billNo}</title><style>
      body{font-family:Arial,sans-serif;padding:28px;color:#111}.paper{max-width:820px;margin:auto;border:1px solid #bbb;padding:28px}
      h1{text-align:center;margin:0 0 4px;font-size:22px}h2{text-align:center;margin:0 0 20px;font-size:15px}
      .meta{display:flex;justify-content:space-between;margin:14px 0;font-size:13px}table{width:100%;border-collapse:collapse;margin-top:18px}
      th,td{border:1px solid #aaa;padding:8px;font-size:12px}th{background:#f3f3f3}.total{text-align:right;font-size:17px;font-weight:800;margin-top:16px}
      .note{margin-top:18px;font-size:12px}.sign{margin-top:55px;text-align:right;font-size:12px}@media print{body{padding:0}.paper{border:0}}
    </style></head><body><div class="paper">
      <h1>SATAT FILLING STATION</h1><h2>DEALER - HINDUSTAN PETROLEUM CORP. LTD.</h2>
      <div class="meta"><div><b>Bill No.:</b> ${b.billNo}</div><div><b>Bill Date:</b> ${dateText(b.date)}</div></div>
      <div><b>Type:</b> ${b.type==="DAILY_AUTO"?"Daily Consolidated MS/HSD Sale":"Historical Cash Sale"}</div>
      <table><thead><tr><th>Product</th><th>Qty (L)</th><th>Rate</th><th>Total</th><th>Credit</th><th>Cash</th></tr></thead><tbody>${fuelRows}</tbody></table>
      <div class="total">Grand Total: ${money(b.total)}</div>
      <div class="note"><b>Payment:</b> Cash ${money(b.cashAmount)} + Credit ${money(b.creditAmount)} = ${money(b.total)}<br/><b>GST:</b> Not Applicable — MS/HSD<br/><b>CNG:</b> Excluded</div>
      ${b.creditRows.length?`<h3>Credit Sale Included — Party Wise</h3><table><thead><tr><th>Party</th><th>Parchi No.</th><th>Fuel</th><th>Credit Qty</th><th>Credit Amount</th></tr></thead><tbody>${creditRows}</tbody></table>`:""}
      <div class="sign">Authorized Signatory</div></div></body></html>`);
    w.document.close();w.focus();w.print();
  };

  return <section className="panel" style={{marginTop:12}}>
    <div className="section-title"><div>
      <h2>Daily MS / HSD Billing</h2>
      <small>01 Apr 2026–31 Jul 2026: Cash Bills 304–425 · 01 Aug 2026 से आज तक: Auto Daily Bills 426 से लगातार</small>
    </div></div>

    <div className="cards" style={{gridTemplateColumns:"repeat(4,minmax(0,1fr))",marginBottom:14}}>
      <div className="card"><span>Total Daily Bills</span><b>{bills.length}</b></div>
      <div className="card"><span>Historical</span><b>304–425</b></div>
      <div className="card"><span>Auto Bills</span><b>426–{liveBills.at(-1)?.billNo||"—"}</b></div>
      <div className="card"><span>Total Billing</span><b>{money(totalAmount)}</b></div>
    </div>

    <div style={{padding:"10px 12px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,fontSize:12,marginBottom:12,lineHeight:1.6}}>
      <b>01/08/2026 से Auto Rule:</b> हर calendar day का MS + HSD meter sale एक consolidated bill में आएगा.
      उसी दिन की <b>Credit Sale</b> उसमें Credit के रूप में घटेगी और बाकी <b>Cash</b> रहेगा.
      Credit Party, Parchi No., Fuel और Qty अलग से View/Print में दिखेंगे. <b>CNG excluded</b> है.
      यह screen केवल data पढ़ती है; कोई billing record Cloud में save नहीं करती.
    </div>

    <div style={{overflowX:"auto"}}>
      <table className="data-table" style={{width:"100%",minWidth:1050}}>
        <thead><tr><th>Bill No.</th><th>Date</th><th>Party / Type</th><th>Payment</th><th>MS Qty</th><th>HSD Qty</th><th>Credit</th><th>Cash</th><th>Total</th><th>Action</th></tr></thead>
        <tbody>{visibleBills.map((b,i)=><tr key={b.billNo+"-"+b.date}>
          <td><b>{b.billNo}</b></td><td>{dateText(b.date)}</td><td>{b.party}</td>
          <td><span style={{padding:"3px 7px",borderRadius:99,background:b.creditAmount?"#eef2ff":"#ecfdf3",color:b.creditAmount?"#3730a3":"#166534",fontWeight:800,fontSize:10}}>{b.payment.toUpperCase()}</span></td>
          <td>{b.sale.MS.qty.toFixed(2)}</td><td>{b.sale.HSD.qty.toFixed(2)}</td><td>{money(b.creditAmount)}</td><td>{money(b.cashAmount)}</td><td><b>{money(b.total)}</b></td>
          <td><button type="button" className="btn small" onClick={()=>setSelected(billPage*PAGE_SIZE+i)}>View</button>{" "}<button type="button" className="btn small" onClick={()=>printBill(b)}>Print</button></td>
        </tr>)}</tbody>
      </table>
    </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginTop:12,flexWrap:"wrap"}}>
        <span style={{fontSize:12,color:"#64748b"}}>Showing {bills.length?billPage*PAGE_SIZE+1:0}–{Math.min((billPage+1)*PAGE_SIZE,bills.length)} of {bills.length} fuel bills</span>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button type="button" className="btn small" disabled={billPage===0} onClick={()=>setBillPage(p=>Math.max(0,p-1))}>← Previous</button>
          <b style={{fontSize:12}}>Page {billPage+1} / {billPageCount}</b>
          <button type="button" className="btn small" disabled={billPage>=billPageCount-1} onClick={()=>setBillPage(p=>Math.min(billPageCount-1,p+1))}>Next →</button>
        </div>
      </div>


    <section className="panel" style={{marginTop:18}}>
      <div className="section-title"><div><h3>🛢️ Lubricant Sales Bills</h3><small>Lubricant Credit + Cash/UPI sales अलग bill register में. Fuel Bill No. 304–668 numbering को नहीं बदला गया.</small></div></div>
      <div style={{overflowX:"auto"}}><table className="data-table" style={{width:"100%",minWidth:900}}><thead><tr><th>Bill / Parchi</th><th>Date</th><th>Party</th><th>Product</th><th>Qty</th><th>Payment</th><th>Total</th><th>Action</th></tr></thead><tbody>
        {lubricantBills.map(x=><tr key={x.id+"-"+x.date}><td><b>{x.billNo}</b></td><td>{dateText(x.date)}</td><td>{x.party}</td><td>{x.product}</td><td>{x.qty.toFixed(2)} L</td><td>{x.payment}</td><td><b>{money(x.amount)}</b></td><td><button type="button" className="btn small" onClick={()=>printLubricantBill(x)}>View / GST Bill</button>{" "}<button type="button" className="btn small" onClick={()=>printLubricantBill(x)}>Print</button></td></tr>)}
        {!lubricantBills.length&&<tr><td colSpan="8" style={{textAlign:"center",padding:20,color:"#64748b"}}>अभी कोई Lubricant Credit/Cash Sale bill नहीं मिला।</td></tr>}
      </tbody></table></div>
    </section>

    {selected!==null && bills[selected] && <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.48)",display:"flex",alignItems:"center",justifyContent:"center",padding:18}}>
      <div onClick={e=>e.stopPropagation()} style={{width:"min(900px,96vw)",maxHeight:"90vh",overflow:"auto",padding:20,border:"1px solid #dbe3ec",borderRadius:14,background:"#fff",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
        {(()=>{const b=bills[selected];return <>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><div><h3 style={{margin:"0 0 4px"}}>Bill No. {b.billNo}</h3><div style={{fontSize:12,color:"#64748b"}}>{dateText(b.date)} · {b.payment}</div></div><button className="btn" onClick={()=>printBill(b)}>🖨 Print Bill</button></div>
          <table className="data-table" style={{width:"100%",marginTop:12}}><thead><tr><th>Fuel</th><th>Qty</th><th>Rate</th><th>Total</th><th>Credit</th><th>Cash</th></tr></thead><tbody>
            {["MS","HSD"].filter(f=>b.sale[f].qty||b.sale[f].amount).map(f=><tr key={f}><td>{f==="MS"?"MS (Petrol)":"HSD (Diesel)"}</td><td>{b.sale[f].qty.toFixed(2)} L</td><td>{money(b.sale[f].qty?b.sale[f].amount/b.sale[f].qty:0)}</td><td>{money(b.sale[f].amount)}</td><td>{money(b.creditAmountByFuel[f])}</td><td>{money(b.cashAmountByFuel[f])}</td></tr>)}
          </tbody></table>
          <div style={{textAlign:"right",fontSize:18,fontWeight:900,marginTop:12}}>Grand Total: {money(b.total)}</div>
          <div style={{marginTop:10,fontSize:11,color:"#475569"}}>Payment: <b>Cash {money(b.cashAmount)} + Credit {money(b.creditAmount)} = {money(b.total)}</b> · CNG: <b>Excluded</b> · GST: <b>Not Applicable</b></div>
          {b.creditRows.length>0 && <><h4 style={{margin:"18px 0 8px"}}>Credit Sale Included — Party Wise</h4><table className="data-table" style={{width:"100%"}}><thead><tr><th>Party</th><th>Parchi No.</th><th>Fuel</th><th>Qty</th><th>Credit Amount</th></tr></thead><tbody>
            {b.creditRows.map((c,j)=><tr key={String(c.parchiNo)+"-"+j}><td>{c.party}</td><td>{c.parchiNo||"—"}</td><td>{c.fuel}</td><td>{c.qty.toFixed(2)} L</td><td>{money(c.amount)}</td></tr>)}
          </tbody></table></>}
          <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><button className="btn" onClick={()=>printBill(b)}>🖨 Print Bill</button><button className="btn" onClick={()=>setSelected(null)}>Close</button></div>
        </>})()}
      </div>
    </div>}
  </section>;
}

export default Fuel15DayBilling;
