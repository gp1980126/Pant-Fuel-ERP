import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import pdfParse from "pdf-parse";

const ROOT = path.resolve(process.env.HPCL_AGENT_HOME || process.cwd());
const OUT = path.join(ROOT, "data");
const PDF_DIR = path.join(OUT, "pdf");
const LOG_DIR = path.join(ROOT, "logs");
const HPCL_FORM = "https://sales.hpcl.co.in/bportal/retail/retailcust.jsp";
const STATION_URL = process.env.STATIONMITRA_URL || "https://stationmitraphase12isolatedliverole.vercel.app/";
const CDP = process.env.HPCL_CDP_URL || "http://127.0.0.1:9222";
const MODE_INDEX = process.argv.indexOf("--mode");
const MODE = MODE_INDEX >= 0 ? process.argv[MODE_INDEX + 1] : "backfill";
const IMPORT_READY = process.argv.includes("--import-ready");
const CUSTOMER_CODE = process.env.HPCL_CUSTOMER_CODE || "41012332";

const today = () => {
  const d = new Date();
  return [String(d.getDate()).padStart(2,"0"), String(d.getMonth()+1).padStart(2,"0"), d.getFullYear()].join("/");
};
const ranges = MODE === "daily"
  ? [{from:today(),to:today()}]
  : [{from:"01/08/2026",to:"31/10/2026"},{from:"01/11/2026",to:"18/11/2026"}];
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const dateISO = value => {
  const m = String(value || "").match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
};
const fuelOf = value => /0992000|\bCNG\b/i.test(value) ? "CNG"
  : /2812000|\bHSD\b|DIESEL/i.test(value) ? "HSD"
  : /2822000|\bMS\b|MOTOR SPIRIT|PETROL/i.test(value) ? "MS" : null;

await Promise.all([OUT,PDF_DIR,LOG_DIR].map(p=>fs.mkdir(p,{recursive:true})));
const log = async (event,details={}) => {
  const line = JSON.stringify({at:new Date().toISOString(),event,...details});
  await fs.appendFile(path.join(LOG_DIR,"agent.jsonl"),line+"\n");
  console.log(line);
};
const fillDate = async (page,prefix,value) => {
  const [dd,mm,yyyy] = value.split("/");
  for (const [part,v] of [["day",dd],["month",mm],["year",yyyy]]) {
    await page.locator('[name="'+prefix+part+'"]').fill(v);
  }
};
async function fetchHpclRows(page,range) {
  await page.goto(HPCL_FORM,{waitUntil:"domcontentloaded",timeout:60000});
  const category=page.locator("#cmbcat");
  if (await category.count()) {
    const options=await category.locator("option").evaluateAll(es=>es.map(e=>({value:e.value,label:(e.textContent||"").trim()})));
    const all=options.find(o=>/all/i.test(o.label));
    if(all) await category.selectOption(all.value);
  }
  await fillDate(page,"txtfrm",range.from);
  await fillDate(page,"txtto",range.to);
  const html=page.locator('input[value="HTML"]');
  if(await html.count()) await html.first().check().catch(()=>{});
  const submit=page.locator('input[type="submit"][value="SUBMIT"],input[type="submit"]');
  if(!(await submit.count())) throw new Error("HPCL submit button not found; portal layout changed.");
  await submit.first().click();
  await page.waitForLoadState("domcontentloaded").catch(()=>{});
  await page.waitForTimeout(1200);
  return await page.locator("tr").evaluateAll(rows=>rows.map(tr=>{
    const cells=[...tr.querySelectorAll("th,td")].map(td=>(td.innerText||"").replace(/\s+/g," ").trim());
    const links=[...tr.querySelectorAll("a[href]")].map(a=>a.href);
    return {text:cells.join(" | "),cells,links};
  }).filter(r=>/0992000|2812000|2822000|CNG|HSD|DIESEL|PETROL|\bMS\b/i.test(r.text)));
}
async function importPdfIntoStation(page,filePath,expectedRows) {
  if(!page.url().startsWith(STATION_URL)) await page.goto(STATION_URL,{waitUntil:"domcontentloaded",timeout:60000});
  if(!(await page.getByText("HPCL Purchase PDF Import",{exact:false}).count())) {
    const nav=page.getByText("Purchase",{exact:true});
    if(await nav.count()) await nav.first().click();
  }
  await page.getByText("HPCL Purchase PDF Import",{exact:false}).waitFor({state:"visible",timeout:20000});
  const input=page.locator('input[type="file"][accept*="application/pdf"]');
  if(!(await input.count())) throw new Error("StationMitra Purchase PDF input not found.");
  await input.first().setInputFiles(filePath);
  await page.getByText(/Preview में .* row मिली|HPCL Bill Preview/).first().waitFor({state:"visible",timeout:60000});
  const preview=page.locator("section.panel").filter({has:page.getByRole("heading",{name:"HPCL Bill Preview"})});
  const rows=await preview.locator("tbody tr").evaluateAll(trs=>trs.map(tr=>(tr.innerText||"").replace(/\s+/g," ").trim()));
  if(!rows.length) throw new Error("StationMitra preview returned no rows.");
  const expectedInvoices=[...new Set(expectedRows.map(r=>r.invoiceNo))];
  const expectedFuels=[...new Set(expectedRows.map(r=>r.fuel))];
  const combined=rows.join(" | ");
  if(!expectedInvoices.every(n=>combined.includes(n))) throw new Error("Invoice number mismatch in StationMitra preview.");
  if(!expectedFuels.every(f=>combined.includes(f))) throw new Error("Fuel mismatch in StationMitra preview.");
  const expectedDates=[...new Set(expectedRows.map(r=>r.date).filter(Boolean))];
  if(!expectedDates.every(d=>combined.includes(d))) throw new Error("Bill date mismatch in StationMitra preview.");
  if(rows.some(r=>/INVALID|DUPLICATE/.test(r)) || rows.some(r=>!/READY/.test(r))) {
    throw new Error("Preview has DUPLICATE/INVALID/non-READY rows; held for manual review.");
  }
  const button=page.getByRole("button",{name:/Import Selected/});
  if(!(await button.count())) throw new Error("Import Selected button not found.");
  await button.first().click();
  await page.getByText(/purchase bill imported/i).waitFor({state:"visible",timeout:30000});
  const body=await page.locator("body").innerText();
  if(!expectedInvoices.every(n=>body.includes(n))) throw new Error("Import message appeared but invoice not confirmed in Purchase register view.");
  return {previewRows:rows,invoiceNumbers:expectedInvoices,fuelTypes:expectedFuels,result:"IMPORT_CONFIRMED_UI"};
}
async function main() {
  let browser;
  try {
    browser=await chromium.connectOverCDP(CDP);
    const context=browser.contexts()[0];
    if(!context) throw new Error("Edge CDP connected but no browser context found.");
    let hpclPage=context.pages().find(p=>p.url().includes("sales.hpcl.co.in"))||context.pages()[0];
    if(!hpclPage) hpclPage=await context.newPage();
    const collected=[];
    for(const range of ranges) {
      await log("range_start",{range});
      const found=await fetchHpclRows(hpclPage,range);
      for(const row of found) {
        const invoiceNo=(row.text.match(/\b\d{10}\b/)||[])[0]||null;
        const dateRaw=(row.text.match(/\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/)||[])[0]||null;
        const fuel=fuelOf(row.text);
        const pdfUrl=row.links.find(x=>/salesinvPDFdownload|invKy=/i.test(x))||null;
        if(invoiceNo&&fuel) collected.push({invoiceNo,dateRaw,date:dateISO(dateRaw),fuel,pdfUrl,rowText:row.text,cells:row.cells,range});
      }
      await log("range_done",{range,matchedRows:collected.length});
    }
    // A combined MS/HSD invoice remains two purchase rows but its PDF is downloaded once.
    const uniqueRows=[...new Map(collected.map(r=>[r.invoiceNo+"|"+r.fuel,r])).values()];
    const urls=[...new Set(uniqueRows.map(r=>r.pdfUrl).filter(Boolean))];
    const fileMap=new Map();
    for(const url of urls) {
      try {
        const response=await context.request.get(url,{timeout:60000});
        if(!response.ok()) throw new Error("HTTP "+response.status());
        const bytes=await response.body();
        if(bytes.subarray(0,5).toString()!=="%PDF-") throw new Error("Downloaded response is not PDF; check HPCL login.");
        const digest=sha256(bytes);
        const key=(url.match(/invKy=([^&]+)/i)||[])[1]||digest.slice(0,16);
        const fileName=key+"-"+digest.slice(0,10)+".pdf";
        const filePath=path.join(PDF_DIR,fileName);
        await fs.writeFile(filePath,bytes);
        let parsed={pages:null,textChars:0,invoiceNoFound:false};
        try {
          const parsedPdf=await pdfParse(bytes);
          const pdfText=parsedPdf.text||"";
          parsed={pages:parsedPdf.numpages,textChars:pdfText.length,invoiceNoFound:uniqueRows.filter(r=>r.pdfUrl===url).every(r=>pdfText.includes(r.invoiceNo))};
        } catch(e) { parsed.error=String(e); }
        fileMap.set(url,{fileName,filePath,sha256:digest,bytes:bytes.length,parsed});
        await log("pdf_saved",{fileName,bytes:bytes.length,sha256:digest,parsed});
      } catch(e) {
        fileMap.set(url,{error:String(e)});
        await log("pdf_failed",{url,error:String(e)});
      }
    }
    const manifest=uniqueRows.map(r=>{
      const f=r.pdfUrl?fileMap.get(r.pdfUrl):null;
      const status=!r.date?"REVIEW_DATE":!r.pdfUrl?"REVIEW_NO_PDF":f&&f.error?"REVIEW_DOWNLOAD":f&&f.parsed&&f.parsed.error?"REVIEW_PARSE":"DOWNLOADED_REVIEW_REQUIRED";
      return {...r,pdfFile:f&&f.fileName||null,pdfSha256:f&&f.sha256||null,pdfBytes:f&&f.bytes||null,pdfParse:f&&f.parsed||null,status,importStatus:"NOT_IMPORTED"};
    });
    const importResults=[];
    if(IMPORT_READY) {
      const stationPage=context.pages().find(p=>p.url().includes("stationmitraphase12isolatedliverole.vercel.app"))||await context.newPage();
      for(const url of urls) {
        const file=fileMap.get(url);
        if(!file||file.error) continue;
        const group=manifest.filter(r=>r.pdfUrl===url);
        if(group.some(r=>!r.date)) { importResults.push({file:file.fileName,status:"HELD_MISSING_DATE"}); continue; }
        try {
          const result=await importPdfIntoStation(stationPage,file.filePath,group);
          for(const r of group) r.importStatus="IMPORTED_CONFIRMED";
          importResults.push({file:file.fileName,...result});
          await log("import_confirmed",{file:file.fileName,result});
        } catch(e) {
          for(const r of group) r.importStatus="HELD_REVIEW";
          importResults.push({file:file.fileName,status:"HELD_REVIEW",reason:String(e)});
          await log("import_held",{file:file.fileName,error:String(e)});
        }
      }
    }
    const manifestPath=path.join(OUT,"manifest-"+MODE+".json");
    await fs.writeFile(manifestPath,JSON.stringify({generatedAt:new Date().toISOString(),mode:MODE,customerCode:CUSTOMER_CODE,rows:manifest,importResults},null,2));
    const summary=manifest.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
    const imported=manifest.filter(r=>r.importStatus==="IMPORTED_CONFIRMED").length;
    await log("run_complete",{mode:MODE,rows:manifest.length,pdfLinks:urls.length,imported,statusSummary:summary,manifest:manifestPath});
    console.log(JSON.stringify({mode:MODE,rows:manifest.length,uniquePdfLinks:urls.length,imported,importResults,manifest:manifestPath,pdfFolder:PDF_DIR},null,2));
  } catch(e) {
    await log("run_failed",{error:String(e),stack:e.stack});
    process.exitCode=1;
  }
  // Never close the user's Edge CDP browser: it contains their authenticated sessions.
}
main();
