import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import pdfParse from "pdf-parse";
const base=process.env.HPCL_AGENT_HOME||process.cwd();
const out=path.join(base,"data"), pdfDir=path.join(out,"pdf"), logs=path.join(base,"logs");
const cdp=process.env.HPCL_CDP_URL||"http://127.0.0.1:9222";
const mode=process.argv.includes("--mode")?process.argv[process.argv.indexOf("--mode")+1]:"backfill";
const dateToday=()=>{const d=new Date();return [String(d.getDate()).padStart(2,"0"),String(d.getMonth()+1).padStart(2,"0"),d.getFullYear()].join("/")};
const ranges=mode==="daily"?[{from:dateToday(),to:dateToday()}]:[{from:"01/08/2026",to:"31/10/2026"},{from:"01/11/2026",to:"18/11/2026"}];
const hash=b=>crypto.createHash("sha256").update(b).digest("hex");
await Promise.all([out,pdfDir,logs].map(x=>fs.mkdir(x,{recursive:true})));
const log=async(e,d={})=>{const s=JSON.stringify({at:new Date().toISOString(),event:e,...d});await fs.appendFile(path.join(logs,"agent.jsonl"),s+"\n");console.log(s)};
try {
 const browser=await chromium.connectOverCDP(cdp); const ctx=browser.contexts()[0]; if(!ctx) throw Error("No Edge browser context");
 let page=ctx.pages().find(p=>p.url().includes("sales.hpcl.co.in"))||ctx.pages()[0]; if(!page) page=await ctx.newPage();
 const rows=[];
 for(const range of ranges){
  await page.goto("https://sales.hpcl.co.in/bportal/retail/retailcust.jsp",{waitUntil:"domcontentloaded",timeout:60000});
  const cat=page.locator("#cmbcat"); if(await cat.count()){const opts=await cat.locator("option").evaluateAll(es=>es.map(e=>({v:e.value,t:e.textContent.trim()})));const all=opts.find(o=>/all/i.test(o.t));if(all)await cat.selectOption(all.v)}
  for(const [p,v] of [["txtfrm",range.from],["txtto",range.to]]){const a=v.split("/");for(const [k,x] of [["day",a[0]],["month",a[1]],["year",a[2]]])await page.locator("[name="+JSON.stringify(p+k)+"]").fill(x)}
  const html=page.locator('input[value="HTML"]');if(await html.count())await html.first().check().catch(()=>{});
  const submit=page.locator('input[type="submit"]');if(!(await submit.count()))throw Error("HPCL submit control missing");await submit.first().click();await page.waitForLoadState("domcontentloaded").catch(()=>{});await page.waitForTimeout(1200);
  const found=await page.locator("tr").evaluateAll(ts=>ts.map(tr=>{const cells=[...tr.querySelectorAll("th,td")].map(x=>(x.innerText||"").replace(/\\s+/g," ").trim());const links=[...tr.querySelectorAll("a[href]")].map(a=>a.href);return {text:cells.join(" | "),cells,links}}).filter(r=>/0992000|2812000|2822000|CNG|HSD|DIESEL|PETROL|\\bMS\\b/i.test(r.text)));
  for(const r of found){const invoice=(r.text.match(/\\b\\d{10}\\b/)||[])[0];const date=(r.text.match(/\\b\\d{2}[\\/-]\\d{2}[\\/-]\\d{4}\\b/)||[])[0];const fuel=/0992000|CNG/i.test(r.text)?"CNG":/2812000|HSD|DIESEL/i.test(r.text)?"HSD":/2822000|\\bMS\\b|PETROL/i.test(r.text)?"MS":null;const url=r.links.find(x=>/salesinvPDFdownload|invKy=/i.test(x))||null;if(invoice&&fuel)rows.push({invoiceNo:invoice,dateRaw:date||null,fuel,pdfUrl:url,rowText:r.text,cells:r.cells,range})}
  await log("range_done",{range,rows:found.length});
 }
 const unique=[...new Map(rows.map(r=>[r.invoiceNo+"|"+r.fuel,r])).values()];const urls=[...new Set(unique.map(r=>r.pdfUrl).filter(Boolean))];const downloaded=new Map();
 for(const url of urls){try{const res=await ctx.request.get(url,{timeout:60000});if(!res.ok())throw Error("HTTP "+res.status());const b=await res.body();if(b.subarray(0,5).toString()!=="%PDF-")throw Error("Not a PDF; check HPCL session");const h=hash(b);const key=(url.match(/invKy=([^&]+)/i)||[])[1]||h.slice(0,16);const name=key+"-"+h.slice(0,10)+".pdf";await fs.writeFile(path.join(pdfDir,name),b);let parsed={pages:null,textChars:0};try{const p=await pdfParse(b);parsed={pages:p.numpages,textChars:(p.text||"").length}}catch(e){parsed.error=String(e)}downloaded.set(url,{name,sha256:h,bytes:b.length,parsed})}catch(e){downloaded.set(url,{error:String(e)})}}
 const manifest=unique.map(r=>{const f=r.pdfUrl?downloaded.get(r.pdfUrl):null;const m=r.dateRaw&&r.dateRaw.match(/(\\d{2})[\\/-](\\d{2})[\\/-](\\d{4})/);return {...r,date:m?m[3]+"-"+m[2]+"-"+m[1]:null,pdfFile:f&&f.name||null,pdfSha256:f&&f.sha256||null,pdfBytes:f&&f.bytes||null,pdfParse:f&&f.parsed||null,status:!m?"REVIEW_DATE":!r.pdfUrl?"REVIEW_NO_PDF":f&&f.error?"REVIEW_DOWNLOAD": "DOWNLOADED_REVIEW_REQUIRED",autoImport:false}});
 const file=path.join(out,"manifest-"+mode+".json");await fs.writeFile(file,JSON.stringify({generatedAt:new Date().toISOString(),mode,rows:manifest},null,2));
 const summary=manifest.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});await log("complete",{mode,rows:manifest.length,pdfLinks:urls.length,summary,manifest:file});
 console.log("MANIFEST:",file,"PDF FOLDER:",pdfDir);
} catch(e){await log("failed",{error:String(e),stack:e.stack});process.exitCode=1}
// Keep the logged-in Edge CDP session open; never close the browser.
