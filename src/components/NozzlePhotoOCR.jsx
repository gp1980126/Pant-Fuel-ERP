import React, { useMemo, useState } from "react";

const INITIAL_ROWS = [
  { id:"MS-1", fuel:"MS", opening:361226.870, closing:361226.870 },
  { id:"MS-2", fuel:"MS", opening:380468.551, closing:380468.550 },
  { id:"MS-3", fuel:"MS", opening:130758.860, closing:131669.255 },
  { id:"MS-4", fuel:"MS", opening:21736.260, closing:21997.732 },
  { id:"HSD-1", fuel:"HSD", opening:560006.760, closing:561062.340 },
  { id:"HSD-2", fuel:"HSD", opening:1274515.170, closing:1274840.130 },
  { id:"HSD-3", fuel:"HSD", opening:7444.580, closing:7688.390 },
  { id:"HSD-4", fuel:"HSD", opening:141673.560, closing:141961.440 },
];

const fmt = value => (Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00");
const num = value => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function NozzlePhotoOCR() {
  const [date, setDate] = useState("2026-10-10");
  const [rows, setRows] = useState(INITIAL_ROWS.map(row => ({ ...row, openingText:row.opening.toFixed(2), closingText:row.closing.toFixed(2), status:"Ready (editable)" })));
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("यह अलग टेस्ट OCR टूल है। OCR परिणाम को जाँचकर ही उपयोग करें; यह अपने आप Live/Cloud में कुछ सेव नहीं करता।");

  const updateRow = (id, patch) => setRows(old => old.map(row => row.id === id ? { ...row, ...patch } : row));
  const calculated = useMemo(() => rows.map(row => {
    const opening = num(row.openingText);
    const closing = num(row.closingText);
    const rawSale = closing - opening;
    const sale = Math.abs(rawSale) < 0.005 ? 0 : rawSale;
    const testing = sale > 0 ? 5 : 0;
    const net = sale > 0 ? sale - testing : 0;
    return { ...row, opening, closing, sale, testing, net };
  }), [rows]);

  async function readPhoto(row, file) {
    if (!file) return;
    updateRow(row.id, { photoName:file.name, status:"OCR चल रहा है…" });
    setBusyId(row.id);
    try {
      let Tesseract = window.Tesseract;
      if (!Tesseract) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("OCR लाइब्रेरी लोड नहीं हुई। इंटरनेट जाँचें या रीडिंग हाथ से भरें।"));
          document.head.appendChild(script);
        });
        Tesseract = window.Tesseract;
      }
      const result = await Tesseract.recognize(file, "eng", {
        logger: m => {
          if (m.status === "recognizing text") updateRow(row.id, { status:"OCR " + Math.round((m.progress || 0) * 100) + "%" });
        },
        tessedit_pageseg_mode: 7,
        tessedit_char_whitelist: "0123456789.,"
      });
      const raw = String(result?.data?.text || "");
      const matches = raw.match(/[0-9][0-9,]*(?:\\.[0-9]{1,3})?/g) || [];
      const opening = num(row.openingText);
      const candidates = matches.map(s => Number(s.replace(/,/g, "")))
        .filter(v => Number.isFinite(v) && v >= opening && v - opening <= 20000);
      if (!candidates.length) {
        updateRow(row.id, { status:"सही रीडिंग नहीं पहचानी — Closing हाथ से भरें", ocrText:raw });
      } else {
        const suggestion = candidates.sort((a,b) => (a-opening) - (b-opening))[0];
        updateRow(row.id, { closingText:String(Number(suggestion.toFixed(2))), status:"OCR सुझाव — 2 दशमलव तक; फोटो से मिलान जरूरी", ocrText:raw });
      }
      setNotice("OCR केवल सुझाव देता है। सात-सेगमेंट डिस्प्ले में गलती हो सकती है; Closing को फोटो से मिलाकर जाँचें।");
    } catch (error) {
      updateRow(row.id, { status:error?.message || "OCR नहीं चला" });
      setNotice(error?.message || "OCR नहीं चला। Closing Reading हाथ से भर सकते हैं।");
    } finally {
      setBusyId("");
    }
  }

  function downloadCsv() {
    const header = ["Date","Fuel","Nozzle","Opening","Closing","Meter Sale","Testing","Net Sale"];
    const lines = [header, ...calculated.map(r => [date,r.fuel,r.id,fmt(r.opening),fmt(r.closing),fmt(r.sale),fmt(r.testing),fmt(r.net)])]
      .map(cols => cols.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(","));
    const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type:"text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "StationMitra_Nozzle_OCR_" + date + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const totals = fuel => calculated.filter(r => r.fuel === fuel).reduce((acc,r) => ({
    sale:acc.sale + Math.max(0,r.sale), testing:acc.testing + r.testing, net:acc.net + r.net
  }), {sale:0,testing:0,net:0});

  return <section style={{padding:16,maxWidth:1200,margin:"0 auto"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
      <div><h2 style={{margin:"0 0 6px"}}>📷 Nozzle Photo OCR — Test</h2><div style={{fontSize:13,color:"#64748b"}}>MS/HSD meter reading, testing और net sale का preview</div></div>
      <label style={{fontSize:13,fontWeight:700}}>तारीख <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{marginLeft:8,padding:8,border:"1px solid #cbd5e1",borderRadius:8}} /></label>
    </div>
    <div style={{margin:"14px 0",padding:12,borderRadius:10,background:"#eff6ff",color:"#1e40af",fontSize:13}}>{notice}<br/><b>सुरक्षा:</b> यह पेज किसी भी डेटा को Fuel Sale में auto-save नहीं करता।</div>
    {["MS","HSD"].map(fuel => <div key={fuel} style={{marginTop:18}}>
      <h3 style={{margin:"0 0 10px"}}>{fuel === "MS" ? "MS — पेट्रोल" : "HSD — डीजल"}</h3>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
          <thead><tr>{["नोजल","Opening","Closing / OCR","Meter Sale","Testing","Net Sale","फोटो / OCR"].map(label=><th key={label} style={{textAlign:"left",padding:9,borderBottom:"2px solid #cbd5e1",whiteSpace:"nowrap"}}>{label}</th>)}</tr></thead>
          <tbody>{calculated.filter(r=>r.fuel===fuel).map(row=><tr key={row.id}>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:700}}>{row.id}</td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}><input aria-label={row.id+" opening"} value={row.openingText} onChange={e=>updateRow(row.id,{openingText:e.target.value})} style={{width:112,padding:7,border:"1px solid #cbd5e1",borderRadius:6}} /></td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}><input aria-label={row.id+" closing"} value={row.closingText} onChange={e=>updateRow(row.id,{closingText:e.target.value})} style={{width:112,padding:7,border:"1px solid #cbd5e1",borderRadius:6}} /></td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0",whiteSpace:"nowrap"}}>{fmt(Math.max(0,row.sale))} L</td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0"}}>{fmt(row.testing)} L</td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0",fontWeight:700,whiteSpace:"nowrap"}}>{fmt(row.net)} L</td>
            <td style={{padding:8,borderBottom:"1px solid #e2e8f0",minWidth:190}}>
              <input type="file" accept="image/*" aria-label={row.id+" meter photo"} onChange={e=>readPhoto(row,e.target.files?.[0])} style={{maxWidth:190,fontSize:11}} />
              <div style={{fontSize:11,color:busyId===row.id?"#1d4ed8":"#64748b",marginTop:5}}>{row.status}{row.photoName ? " · "+row.photoName : ""}</div>
            </td>
          </tr>)}</tbody>
        </table>
      </div>
      <div style={{display:"flex",gap:12,flexWrap:"wrap",marginTop:8,fontSize:13}}>
        <b>Meter Sale: {fmt(totals(fuel).sale)} L</b><b>Testing: {fmt(totals(fuel).testing)} L</b><b>Net Sale: {fmt(totals(fuel).net)} L</b>
      </div>
    </div>)}
    <div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>
      <button type="button" onClick={downloadCsv} style={{padding:"10px 16px",border:0,borderRadius:8,background:"#0f766e",color:"#fff",fontWeight:700,cursor:"pointer"}}>CSV रिपोर्ट डाउनलोड</button>
      <button type="button" onClick={()=>{setRows(INITIAL_ROWS.map(row=>({...row,openingText:row.opening.toFixed(2),closingText:row.closing.toFixed(2),status:"Ready (editable)"})));setNotice("डेमो रीडिंग फिर से लोड हो गई। कोई डेटा सेव नहीं हुआ।");}} style={{padding:"10px 16px",border:"1px solid #cbd5e1",borderRadius:8,background:"#fff",fontWeight:700,cursor:"pointer"}}>रीडिंग रीसेट</button>
    </div>
  </section>;
}
