import React, { useMemo, useState } from "react";
import { buildCngDeliveryReconciliation } from "../core/cngDeliveryReconciliation";

const kg = value => Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const box = { background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:14 };
const label = { display:"block", fontSize:12, color:"#64748b", marginBottom:5 };

export function CngReconciliation({ data }) {
  const [from, setFrom] = useState("2026-08-01");
  const [to, setTo] = useState("2026-11-30");
  const audit = useMemo(() => buildCngDeliveryReconciliation(data, from, to), [data, from, to]);
  const pending = audit.rows.filter(row => row.type === "PENDING_BILL");
  const deliveries = audit.rows.filter(row => row.type === "DELIVERY");
  const varianceRows = deliveries.filter(row => Math.abs(row.variance) > 1);
  return <div style={{ display:"grid", gap:16 }}>
    <section className="panel">
      <h2>CNG Truck Delivery Reconciliation</h2>
      <p style={{ color:"#64748b", fontSize:13, lineHeight:1.6 }}>
        CNG का हिसाब टैंक स्टॉक से नहीं होगा। HPCL Invoice की तारीख डिलीवरी/बिक्री की तारीख मानी जाएगी।
        बिल अगले दिन दर्ज हो सकता है; उपलब्ध रिकॉर्ड में Entry Date न होने पर उसे “उपलब्ध नहीं” दिखाया जाएगा।
        हर बिल की बिक्री पिछले बिल की तारीख के बाद से वर्तमान बिल की तारीख तक जोड़ी जाती है।
      </p>
      <div style={{ display:"flex", gap:12, flexWrap:"wrap", margin:"12px 0" }}>
        <label><span style={label}>From Date</span><input type="date" value={from} onChange={e=>setFrom(e.target.value)} /></label>
        <label><span style={label}>To Date</span><input type="date" value={to} onChange={e=>setTo(e.target.value)} /></label>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:10 }}>
        <div style={box}><small>HPCL Bill Rows</small><h2>{audit.totals.bills}</h2></div>
        <div style={box}><small>Purchase KG</small><h2>{kg(audit.totals.purchaseQty)}</h2></div>
        <div style={box}><small>Authoritative Sales KG</small><h2>{kg(audit.totals.salesQty)}</h2></div>
        <div style={box}><small>Duplicate Sale Groups</small><h2>{audit.totals.duplicateGroups}</h2></div>
      </div>
    </section>
    <section className="panel">
      <h3>Delivery-wise Matching</h3>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth:980 }}>
          <thead><tr>{["Delivery / Bill Date","Previous Bill Date","HPCL Invoice No.","Bill Entry Date","Bill KG","Sales KG (interval)","Difference KG","Sales Rows","Status"].map(x=><th key={x} style={{textAlign:"left",padding:9,background:"#f8fafc",borderBottom:"1px solid #e5e7eb",whiteSpace:"nowrap"}}>{x}</th>)}</tr></thead>
          <tbody>
            {deliveries.map((row,i)=><tr key={row.date+"-"+i}>
              <td style={{padding:9,borderBottom:"1px solid #eee"}}>{row.date}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee"}}>{row.previousDate || "पहली उपलब्ध डिलीवरी"}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee"}}>{row.invoiceNos}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee"}}>{row.entryDate || "उपलब्ध नहीं"}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"right"}}>{kg(row.purchaseQty)}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"right"}}>{kg(row.salesQty)}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"right"}}>{kg(row.variance)}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee",textAlign:"right"}}>{row.salesRows}</td>
              <td style={{padding:9,borderBottom:"1px solid #eee"}}>{Math.abs(row.variance)<=1 ? "करीबी मिलान" : "जाँच आवश्यक"}</td>
            </tr>)}
            {pending.map((row,i)=><tr key={"pending-"+i} style={{background:"#fff7ed"}}>
              <td style={{padding:9,fontWeight:700}}>बिल लंबित: {row.periodLabel}</td><td style={{padding:9}}>{row.previousDate || "पहला HPCL बिल प्रतीक्षित"}</td><td style={{padding:9}}>—</td><td style={{padding:9}}>—</td>
              <td style={{padding:9,textAlign:"right"}}>अभी बिल नहीं</td><td style={{padding:9,textAlign:"right"}}>{kg(row.salesQty)}</td><td style={{padding:9,textAlign:"right"}}>बिल आने पर</td><td style={{padding:9,textAlign:"right"}}>{row.salesRows}</td><td style={{padding:9,fontWeight:700}}>HPCL BILL PENDING</td>
            </tr>)}
            {!audit.rows.length && <tr><td colSpan={9} style={{padding:18,textAlign:"center"}}>इस अवधि में CNG रिकॉर्ड नहीं मिले।</td></tr>}
          </tbody>
        </table>
      </div>
      <p style={{fontSize:12,color:"#64748b",marginTop:10}}>Difference = HPCL Bill KG − संबंधित अवधि की बिक्री KG. ±1 KG तक “करीबी मिलान” केवल स्क्रीनिंग संकेत है, HPCL/मीटर का प्रमाणित tolerance नहीं।</p>
    </section>
    <section className="panel">
      <h3>Duplicate Sale Audit</h3>
      <p style={{fontSize:12,color:"#64748b"}}>एक ही तारीख और nozzle की कई entries में source/original entry को प्राथमिकता दी गई है। कोई रिकॉर्ड delete या edit नहीं किया जाता।</p>
      {audit.duplicateGroups.length ? <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}><thead><tr>{["Date","Nozzle","Raw Rows","Kept Sale ID","Excluded Duplicate IDs"].map(x=><th key={x} style={{textAlign:"left",padding:8}}>{x}</th>)}</tr></thead><tbody>{audit.duplicateGroups.filter(x=>x.date>=from&&x.date<=to).map(x=><tr key={x.key}><td style={{padding:8}}>{x.date}</td><td style={{padding:8}}>{x.nozzle}</td><td style={{padding:8}}>{x.rawCount}</td><td style={{padding:8}}>{x.keptId}</td><td style={{padding:8}}>{x.excludedIds.join(", ") || "—"}</td></tr>)}</tbody></table></div> : <p style={{fontSize:13}}>इस अवधि में duplicate sale groups नहीं मिले।</p>}
    </section>
    {varianceRows.length>0 && <section className="panel"><h3>Variance Requiring Review</h3><p style={{fontSize:12,color:"#64748b"}}>{varianceRows.length} delivery interval में 1 KG से अधिक अंतर है। पहले delivery challan, HPCL invoice KG और nozzle meter readings की जाँच करें।</p><ul>{varianceRows.map(row=><li key={row.date}>{row.date} · {row.invoiceNos} · अंतर {kg(row.variance)} KG</li>)}</ul></section>}
  </div>;
}
