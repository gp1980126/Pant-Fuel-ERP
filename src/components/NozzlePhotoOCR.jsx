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

  async function readBulkPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    if (files.length !== 8) {
      setNotice(`आपने ${files.length} फोटो चुनी हैं। सही क्रम में सभी 8 फोटो चुनें: पहले MS-1 से MS-4, फिर HSD-1 से HSD-4।`);
      return;
    }
    setNotice("8 फोटो क्रम से पढ़ी जा रही हैं: MS-1, MS-2, MS-3, MS-4, HSD-1, HSD-2, HSD-3, HSD-4। हर रीडिंग फोटो से मिलाकर जाँचें।");
    for (let i = 0; i < 8; i++) {
      await readPhoto(rows[i], files[i]);
    }
    setNotice("8 फोटो की OCR प्रक्रिया पूरी हुई। सभी Closing Reading को संबंधित नोजल की फोटो से मिलाकर सत्यापित करें; OCR गलत भी पढ़ सकता है।");
  }

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
      // Upscale and enhance the LCD area; full dispenser photos often make seven-segment digits too small.
      const imageUrl = URL.createObjectURL(file);
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });
      const makeCanvas = cropTop => {
        const sx = cropTop ? Math.floor(image.width * 0.08) : 0;
        const sw = cropTop ? Math.floor(image.width * 0.84) : image.width;
        const sh = cropTop ? Math.floor(image.height * 0.48) : image.height;
        const canvas = document.createElement("canvas");
        canvas.width = sw * 3;
        canvas.height = sh * 3;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, sx, 0, sw, sh, 0, 0, canvas.width, canvas.height);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const gray = Math.round(0.299 * pixels.data[i] + 0.587 * pixels.data[i + 1] + 0.114 * pixels.data[i + 2]);
          const value = gray > 175 ? 255 : (gray < 95 ? 0 : Math.round((gray - 95) * 255 / 80));
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas;
      };
      const ocrOptions = {
        logger: m => {
          if (m.status === "recognizing text") updateRow(row.id, { status:"OCR " + Math.round((m.progress || 0) * 100) + "%" });
        },
        tessedit_pageseg_mode: 7,
        tessedit_char_whitelist: "0123456789.,"
      };
      const opening = num(row.openingText);
      let raw = "";
      let candidates = [];
      for (const cropTop of [true, false]) {
        const result = await Tesseract.recognize(makeCanvas(cropTop), "eng", ocrOptions);
        raw += "\n" + String(result?.data?.text || "");
        // Accept only meter-like values that include a decimal separator. Bare integers such as
        // 150800 are often OCR mistakes from LCD digits and must never be auto-filled.
        const matches = raw.match(/[0-9][0-9,]*\.[0-9]{1,3}/g) || [];
        candidates = matches.map(s => Number(s.replace(/,/g, "")))
          .filter(v => Number.isFinite(v) && v >= opening && v - opening <= 3000);
        if (candidates.length) break;
      }
      URL.revokeObjectURL(imageUrl);
      if (!candidates.length) {
        updateRow(row.id, { status:"रीडिंग भरोसेमंद नहीं — Closing हाथ से भरें", ocrText:raw });
      } else {
        const unique = [...new Set(candidates.map(v => Math.trunc((v + Number.EPSILON) * 1000) / 1000))];
        if (unique.length !== 1) {
          updateRow(row.id, { status:"एक से अधिक रीडिंग मिलीं — Closing हाथ से भरें", ocrText:raw });
        } else {
          const suggestion = unique[0];
          updateRow(row.id, { closingText:String(Math.trunc((suggestion + Number.EPSILON) * 100) / 100), status:"OCR सुझाव — फोटो से मिलान जरूरी", ocrText:raw });
        }
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
    <div style={{margin:"12px 0",padding:12,border:"1px solid #cbd5e1",borderRadius:10,background:"#fff"}}>
      <b>एक साथ 8 फोटो अपलोड करें</b>
      <div style={{fontSize:12,color:"#475569",margin:"6px 0 10px"}}>फोटो इसी क्रम में चुनें: MS-1, MS-2, MS-3, MS-4, HSD-1, HSD-2, HSD-3, HSD-4। OCR के बाद रीडिंग जाँचें।</div>
      <input type="file" accept="image/*" multiple aria-label="Upload all eight nozzle photos" onChange={e=>{const files=e.target.files; if(files?.length) readBulkPhotos(files); e.target.value="";}} />
    </div>
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
