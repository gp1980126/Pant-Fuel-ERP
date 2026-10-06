import React, { useMemo, useState } from "react";
import { loadHpclPdfJs2, hpclDate2, hpclNum2 } from "./PumpModules";

const TYPE_RULES = [
  ["DT Plus Settlement", /DT PLUS SETTLEMENT OF CARD\/CCMS SALE/i],
  ["DT Plus Earning", /DT PLUS EARNING ENTRIES/i],
  ["HP Pay Settlement", /HP Pay-Settlement of Sale/i],
  ["HP Pay Dealer Contribution", /HP Pay-Dealer Contribution/i],
  ["Customer E-Collection", /Customer ECollection/i],
  ["SSLF Credit", /SSLF CREDIT/i],
  ["SSLF Debit", /SSLF DEBIT/i],
  ["Customer Interest", /Customer Interest/i],
  ["MSHS Interest", /Non tax Cust Interst/i],
  ["Debit Note", /Non-Tax DN Customer/i],
  ["Credit Note", /Non-Tax CN Customer/i],
  ["Fuel / Lubricant Purchase", /Billing Document\(RV\)/i]
];

function classify(description, segment="") {
  const s = String(description || "");
  for (const [type, re] of TYPE_RULES) if (re.test(s)) return type;
  if (/LUB/i.test(segment) || /LUB/i.test(s)) return "Lubricant Purchase";
  return "Other HPCL Entry";
}

function monthKey(date) { return String(date || "").slice(0,7); }

async function extractText(file) {
  const pdfjsLib = await loadHpclPdfJs2();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({data:buffer}).promise;
  const pages = [];
  for (let pageNo=1; pageNo<=pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const items = content.items
      .filter(x => String(x.str || "").trim())
      .map(x => ({text:String(x.str || "").trim(), x:Number(x.transform?.[4] || 0), y:Number(x.transform?.[5] || 0)}))
      .sort((a,b) => b.y-a.y || a.x-b.x);
    const lines = [];
    for (const item of items) {
      let line = lines.find(l => Math.abs(l.y-item.y) <= 2.5);
      if (!line) { line={y:item.y,items:[]}; lines.push(line); }
      line.items.push(item);
    }
    pages.push(lines.sort((a,b)=>b.y-a.y)
      .map(l=>l.items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(" ").replace(/\s+/g," ").trim())
      .filter(Boolean));
  }
  return pages;
}

function parseStatement(pages, fileName) {
  const rows = [];
  let openingBalance = null, statementFrom = "", statementTo = "";
  for (const page of pages) {
    for (const line of page) {
      if (!statementFrom) {
        const m = line.match(/TRANSACTION DETAILS\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})\s+to\s+(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/i);
        if (m) { statementFrom=hpclDate2(m[1]); statementTo=hpclDate2(m[2]); }
      }
      const om = line.match(/Opening Balance \(Provisional\)\s+(-?[\d,]+(?:\.\d+)?)/i);
      if (om) openingBalance = hpclNum2(om[1]);
      if (!/^\d+\s+\d+\s+\d{2}\/\d{2}\/\d{4}\s+/i.test(line)) continue;
      const m = line.match(/^(\d+)\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(MSHS|NG|LUB)\s+(\d{2}\/\d{2}\/\d{4})\s+(-|[\d,]+(?:\.\d+)?)$/i);
      if (!m) continue;
      const [, sl, reference, dateRaw, description, segment, dueRaw, amountRaw] = m;
      const date = hpclDate2(dateRaw);
      const dueDate = hpclDate2(dueRaw);
      const type = classify(description, segment);
      const amountKnown = amountRaw !== "-";
      rows.push({
        id:"HPCL-"+date+"-"+reference+"-"+sl,
        slNo:Number(sl), reference:String(reference), date,
        description:String(description).trim(), segment:String(segment).toUpperCase(),
        dueDate, amount:amountKnown ? hpclNum2(amountRaw) : 0, amountKnown,
        type, month:monthKey(date), sourceFile:fileName
      });
    }
  }
  const unique = [], seen = new Set();
  for (const row of rows) { if (seen.has(row.id)) continue; seen.add(row.id); unique.push(row); }
  return {rows:unique, openingBalance, statementFrom, statementTo};
}

const money = n => "₹"+Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});

export function HPCLAccount({data, update}) {
  const [busy,setBusy]=useState(false), [msg,setMsg]=useState(""), [preview,setPreview]=useState(null);
  const [month,setMonth]=useState(""), [filter,setFilter]=useState("All");
  const saved=Array.isArray(data?.hpclTransactions)?data.hpclTransactions:[];

  const importPdf=async e=>{
    const file=e.target.files?.[0]; if(!file) return;
    if(file.type!=="application/pdf"){setMsg("❌ केवल HPCL Laser PDF upload करें।");e.target.value="";return;}
    setBusy(true); setMsg("⏳ HPCL Laser PDF पढ़ी जा रही है...");
    try {
      const parsed=parseStatement(await extractText(file),file.name);
      if(!parsed.rows.length) throw new Error("Transaction rows नहीं मिलीं।");
      setPreview({...parsed,fileName:file.name});
      setMonth(parsed.statementFrom?.slice(0,7)||"");
      setFilter("All");
      const dup=parsed.rows.filter(r=>saved.some(s=>String(s.id)===String(r.id))).length;
      setMsg("✅ "+parsed.rows.length+" transaction rows मिलीं · Duplicate "+dup+" · Opening "+money(parsed.openingBalance));
    } catch(err) {
      console.error(err); setMsg("❌ Laser PDF पढ़ने में समस्या: "+(err?.message||"unknown error"));
    } finally { setBusy(false); e.target.value=""; }
  };

  const saveImport=()=>{
    if(!preview?.rows?.length) return;
    const existing=new Set(saved.map(x=>String(x.id)));
    const fresh=preview.rows.filter(x=>!existing.has(String(x.id)));
    if(!fresh.length){setMsg("⚠️ यह Laser statement पहले से imported है। Duplicate entry नहीं बनाई गई।");return;}
    update({hpclTransactions:[...saved,...fresh]});
    setMsg("✅ HPCL Account में "+fresh.length+" नई entries save हुईं। Duplicate rows skip हुईं।");
    setPreview(null);
  };

  const allRows=preview?.rows?.length?preview.rows:saved;
  const activeRows=allRows.filter(x=>(!month||x.month===month)&&(filter==="All"||x.type===filter));
  const summary=useMemo(()=>{
    const rows=activeRows;
    const sum=t=>rows.filter(x=>x.type===t&&x.amountKnown).reduce((a,x)=>a+Number(x.amount||0),0);
    return {
      purchase:rows.filter(x=>x.type==="Fuel / Lubricant Purchase"&&x.amountKnown).reduce((a,x)=>a+Number(x.amount||0),0),
      sslfDebit:sum("SSLF Debit"),
      sslfCredit:rows.filter(x=>x.type==="SSLF Credit").length,
      dtEarn:sum("DT Plus Earning"),
      hpDealer:sum("HP Pay Dealer Contribution"),
      charges:rows.filter(x=>["SSLF Debit","Customer Interest","MSHS Interest","Debit Note"].includes(x.type)&&x.amountKnown).reduce((a,x)=>a+Number(x.amount||0),0)
    };
  },[activeRows]);

  const types=Array.from(new Set(allRows.map(x=>x.type))).sort();
  const monthOptions=Array.from(new Set(allRows.map(x=>x.month).filter(Boolean))).sort().reverse();

  return <div className="content">
    <section className="dashboard-hero"><div className="hero-copy">
      <div className="pro-eyebrow">HPCL · LASER · ACCOUNT RECONCILIATION</div>
      <h2>HPCL Account</h2>
      <p>HPCL Laser statement को month-wise import करके Fuel Purchase, DT Plus, HP Pay, SSLF और दूसरे HPCL adjustments अलग रखें।</p>
    </div></section>

    {msg && <div className="collection-note green-note" style={{marginBottom:16}}>{msg}</div>}

    <section className="pro-panel">
      <div className="pro-panel-head">
        <div><h3>Laser PDF Upload</h3><span>पहली बार 01/04/2026–05/10/2026 वाला PDF import करें। आगे हर महीने का Laser PDF अलग import किया जा सकता है।</span></div>
        <label className="btn" style={{cursor:"pointer"}}>📥 {busy?"Reading…":"Upload HPCL Laser PDF"}<input type="file" accept="application/pdf" hidden onChange={importPdf}/></label>
      </div>
      {preview && <div className="collection-note" style={{marginTop:12}}>
        <b>{preview.fileName}</b> · {preview.statementFrom} → {preview.statementTo} · Opening {money(preview.openingBalance)} · {preview.rows.length} rows
        <div style={{marginTop:10,display:"flex",gap:8}}><button className="btn" onClick={saveImport}>✓ Import to HPCL Account</button><button className="btn gray" onClick={()=>setPreview(null)}>Cancel</button></div>
      </div>}
    </section>

    <div className="grid-4" style={{marginTop:14}}>
      <div className="metric"><span>Fuel / Lubricant Purchase</span><b>{money(summary.purchase)}</b></div>
      <div className="metric"><span>SSLF Debit</span><b>{money(summary.sslfDebit)}</b></div>
      <div className="metric"><span>SSLF Credit Entries</span><b>{summary.sslfCredit}</b></div>
      <div className="metric"><span>Other HPCL Charges</span><b>{money(summary.charges)}</b></div>
    </div>

    <section className="pro-panel" style={{marginTop:14}}>
      <div className="pro-panel-head">
        <div><h3>HPCL Transactions</h3><span>{preview?.rows?.length?"Preview — अभी Save नहीं हुआ":"Saved Laser entries"}</span></div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <select value={month} onChange={e=>setMonth(e.target.value)}><option value="">All Months</option>{monthOptions.map(m=><option key={m} value={m}>{m}</option>)}</select>
          <select value={filter} onChange={e=>setFilter(e.target.value)}><option>All</option>{types.map(t=><option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <div style={{overflowX:"auto"}}>
        <table className="staff-table"><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Segment</th><th>Ref</th><th>Dr Amount</th><th>Status</th></tr></thead>
        <tbody>{activeRows.slice(0,300).map(r=><tr key={r.id}><td><b>{r.date}</b></td><td><span className="staff-pill">{r.type}</span></td><td>{r.description}</td><td>{r.segment}</td><td>{r.reference}</td><td>{r.amountKnown?money(r.amount):"—"}</td><td>{r.amountKnown?"Amount":"No Dr amount"}</td></tr>)}</tbody></table>
        {!activeRows.length && <div className="empty-state">कोई HPCL entry नहीं मिली।</div>}
      </div>
    </section>

    <section className="pro-panel" style={{marginTop:14}}>
      <div className="pro-panel-head"><div><h3>Monthly Control</h3><span>Laser में मौजूद entry types को अलग-अलग देखें।</span></div></div>
      <div style={{overflowX:"auto"}}><table className="staff-table">
        <thead><tr><th>Month</th><th>Entries</th><th>SSLF Debit</th><th>SSLF Credit</th><th>DT Plus Earning</th><th>HP Pay Dealer Contribution</th></tr></thead>
        <tbody>{monthOptions.slice().sort().map(m=>{
          const r=allRows.filter(x=>x.month===m);
          const total=t=>r.filter(x=>x.type===t&&x.amountKnown).reduce((a,x)=>a+Number(x.amount||0),0);
          return <tr key={m}><td><b>{m}</b></td><td>{r.length}</td><td>{money(total("SSLF Debit"))}</td><td>{r.filter(x=>x.type==="SSLF Credit").length} credit entries</td><td>{money(total("DT Plus Earning"))}</td><td>{money(total("HP Pay Dealer Contribution"))}</td></tr>;
        })}</tbody>
      </table></div>
      <div className="staff-note">नोट: इस Laser statement में SSLF Credit के सामने Dr Amount “-” है। इसलिए software credit amount को अनुमान से नहीं भरेगा; उसे केवल entry के रूप में रखेगा जब तक HPCL credit-note amount उपलब्ध न हो।</div>
    </section>
  </div>;
}
