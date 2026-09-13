import React, { useMemo, useState } from "react";
import { START_DATE, standardJournal, trialBalance, accountingSnapshot, rupee, n } from "../core/pumpDomain";

const esc = v => String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
const csv = rows => "\ufeff" + rows.map(r => r.map(v => `"${String(v ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
const dl = (name, text, type="text/plain;charset=utf-8") => { const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); };
const money0 = v => rupee(v).toFixed(2);

function groupName(account){
  const a=String(account||"");
  if (/Inventory|Stock|Purchase Clearing/i.test(a)) return "Current Assets";
  if (/Cash|POS|Paytm|Bank|Digital|DT Plus|HP Pay|PhonePe|Receivable/i.test(a)) return "Current Assets";
  if (/Payable|Suspense/i.test(a)) return "Current Liabilities";
  if (/Sales|Revenue/i.test(a)) return "Sales Accounts";
  if (/Expense|COGS|Tax/i.test(a)) return "Indirect Expenses";
  if (/Equity/i.test(a)) return "Capital Account";
  return "Primary";
}

function ledgerMasterXml(accounts){
  const ledgers=accounts.map(a=>`<TALLYMESSAGE xmlns:UDF="TallyUDF"><LEDGER NAME="${esc(a.account)}" ACTION="Create"><NAME.LIST TYPE="String"><NAME>${esc(a.account)}</NAME></NAME.LIST><PARENT>${esc(groupName(a.account))}</PARENT><ISBILLWISEON>Yes</ISBILLWISEON></LEDGER></TALLYMESSAGE>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>All Masters</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>StationMitra</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${ledgers}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

function journalXml(journal){
  const byDate={};
  journal.forEach(r=>{(byDate[r.date]??=[]).push(r);});
  const vouchers=Object.entries(byDate).map(([date,rows])=>{
    const totalD=rows.reduce((s,r)=>s+n(r.debit),0), totalC=rows.reduce((s,r)=>s+n(r.credit),0);
    if(Math.abs(totalD-totalC)>=1) return "";
    const entries=rows.filter(r=>Math.abs(n(r.debit))+Math.abs(n(r.credit))>=1).map(r=>{
      const amount=n(r.debit)>0?n(r.debit):-n(r.credit);
      return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${esc(r.account)}</LEDGERNAME><ISDEEMEDPOSITIVE>${amount>=0?"No":"Yes"}</ISDEEMEDPOSITIVE><AMOUNT>${amount>=0?money0(amount):money0(-amount*-1)}</AMOUNT><BANKALLOCATIONS.LIST></BANKALLOCATIONS.LIST></ALLLEDGERENTRIES.LIST>`;
    }).join("");
    const narr=`StationMitra daily accounting export — ${date}`;
    return `<TALLYMESSAGE xmlns:UDF="TallyUDF"><VOUCHER VCHTYPE="Journal" ACTION="Create"><DATE>${date.replaceAll('-','')}</DATE><VOUCHERTYPENAME>Journal</VOUCHERTYPENAME><NARRATION>${esc(narr)}</NARRATION><VOUCHERNUMBER>SM-${date.replaceAll('-','')}</VOUCHERNUMBER>${entries}</VOUCHER></TALLYMESSAGE>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER><BODY><IMPORTDATA><REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>StationMitra</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC><REQUESTDATA>${vouchers}</REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
}

export function TallyExport({data}){
  const [from,setFrom]=useState(START_DATE);
  const [to,setTo]=useState(()=>new Date().toISOString().slice(0,10));
  const journal=useMemo(()=>standardJournal(data,from,to),[data,from,to]);
  const tb=useMemo(()=>trialBalance(data,from,to),[data,from,to]);
  const snap=useMemo(()=>accountingSnapshot(data,from,to),[data,from,to]);
  const accounts=useMemo(()=>tb.filter(x=>Math.abs(x.debit)+Math.abs(x.credit)>0),[tb]);
  const partyRows=useMemo(()=>Array.isArray(data?.parties)?data.parties:[],[data]);
  const voucherRows=useMemo(()=>journal.map((r,i)=>[i+1,r.date,"Journal",`SM-${String(r.date).replaceAll('-','')}`,r.account,r.debit,r.credit,r.narration]),[journal]);
  const stockRows=useMemo(()=>{
    const fuels=["MS","HSD","CNG","LUBRICANT"];
    return fuels.map(f=>{const c=snap.calc?.[f]||{};return [f,f==='CNG'?'Kg':f==='LUBRICANT'?'Ltr':'L',c.openingQty,c.purchaseQty,c.saleQty,c.closingQty,c.purchaseCost,c.cogs,c.sale,c.profit];});
  },[snap]);
  const exportAll=()=>{
    dl(`StationMitra_Tally_Ledger_Masters_${from}_to_${to}.xml`,ledgerMasterXml(accounts),"application/xml;charset=utf-8");
    setTimeout(()=>dl(`StationMitra_Tally_Vouchers_${from}_to_${to}.xml`,journalXml(journal),"application/xml;charset=utf-8"),250);
    setTimeout(()=>dl(`StationMitra_Tally_Voucher_Register_${from}_to_${to}.csv`,csv([["S.No","Date","Voucher Type","Voucher No","Ledger","Debit","Credit","Narration"],...voucherRows]),"text/csv;charset=utf-8"),500);
    setTimeout(()=>dl(`StationMitra_Tally_Party_Master_${from}_to_${to}.csv`,csv([["Party Name","Address","GSTIN","Opening/Reference"],...partyRows.map(p=>[p.name||p.party||"",p.address||"",p.gstin||p.GSTIN||"",p.openingBalance||0])]),"text/csv;charset=utf-8"),750);
    setTimeout(()=>dl(`StationMitra_Tally_Stock_Summary_${from}_to_${to}.csv`,csv([["Item","Unit","Opening Qty","Purchase Qty","Sale Qty","Closing Qty","Purchase Value","COGS","Sales","Profit"],...stockRows]),"text/csv;charset=utf-8"),1000);
  };
  return <div className="content"><section className="panel"><h2>🧾 Tally / CA Export</h2><p style={{color:'#64748b'}}>Current StationMitra accounting data को CA/Tally migration के लिए अलग master, voucher और stock files में export करता है। मूल data में कोई बदलाव नहीं होता।</p><div className="form"><label>From Date<input type="date" value={from} min={START_DATE} onChange={e=>setFrom(e.target.value)}/></label><label>To Date<input type="date" value={to} min={START_DATE} onChange={e=>setTo(e.target.value)}/></label></div><div style={{display:'flex',gap:10,flexWrap:'wrap',marginTop:14}}><button className="btn" onClick={exportAll}>⬇ Export Tally + CA Package</button><button className="btn gray" onClick={()=>dl(`StationMitra_Tally_Journal_${from}_to_${to}.csv`,csv([["Date","Ledger","Debit","Credit","Narration"],...journal.map(r=>[r.date,r.account,r.debit,r.credit,r.narration])]),"text/csv;charset=utf-8")}>⬇ Journal CSV</button></div></section><div className="cards" style={{marginTop:16}}><div className="card"><span>Ledger Masters</span><strong>{accounts.length}</strong></div><div className="card"><span>Journal Rows</span><strong>{journal.length}</strong></div><div className="card"><span>Parties</span><strong>{partyRows.length}</strong></div><div className="card"><span>Total Sales</span><strong>₹{money0(snap.totalSales)}</strong></div></div><section className="panel" style={{marginTop:16}}><h3>⚠ Import Safety</h3><ul><li>पहले Tally में Company/Groups/Ledgers का backup लें।</li><li>यह export StationMitra के double-entry Journal को Tally Journal vouchers में map करता है।</li><li>Exact Tally version/company name के हिसाब से CA को XML import mapping एक बार test करनी चाहिए।</li><li>JSON backup Tally import file नहीं है; यह export layer उसे Tally-ready format में बदलती है।</li></ul></section></div>;
}
