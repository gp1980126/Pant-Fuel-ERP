import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";
import pdfParse from "pdf-parse";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(process.env.HPCL_AGENT_HOME || process.cwd());
const OUT = path.join(ROOT, "data");
const PDF_DIR = path.join(OUT, "pdf");
const LOG_DIR = path.join(ROOT, "logs");
const HPCL_DASHBOARD = "https://sales.hpcl.co.in/bportal/retail/dashboard.jsp";
const HPCL_HOST = "sales.hpcl.co.in";
const CDP = process.env.HPCL_CDP_URL || "http://127.0.0.1:9222";
const MODE_INDEX = process.argv.indexOf("--mode");
const MODE = MODE_INDEX >= 0 ? process.argv[MODE_INDEX + 1] : "backfill";
const INTERACTIVE_LOGIN = process.argv.includes("--interactive-login");
const IMPORT_REQUESTED = process.argv.includes("--import-ready");
const VERIFY_ONLY = process.argv.includes("--verify-only");
const CUSTOMER_CODE = process.env.HPCL_CUSTOMER_CODE || "41012332";

if (!["backfill", "daily"].includes(MODE)) {
  throw new Error('Unsupported mode. Use "--mode backfill" or "--mode daily".');
}
if (INTERACTIVE_LOGIN && MODE !== "backfill") {
  throw new Error("Interactive login is allowed only for a manually started backfill, never for scheduled daily runs.");
}
if (IMPORT_REQUESTED) {
  throw new Error("IMPORT DISABLED: this build is download-and-manifest only. Customer identity, HPCL quantity/amount mapping and StationMitra reconciliation must be verified before any import feature is enabled.");
}

const today = () => {
  const d = new Date();
  return [String(d.getDate()).padStart(2, "0"), String(d.getMonth() + 1).padStart(2, "0"), d.getFullYear()].join("/");
};
const ranges = MODE === "daily"
  ? [{ from: today(), to: today() }]
  : [{ from: "01/08/2026", to: "31/10/2026" }, { from: "01/11/2026", to: "18/11/2026" }];
const sha256 = b => crypto.createHash("sha256").update(b).digest("hex");
const dateISO = value => {
  const m = String(value || "").match(/(\d{2})[\/-](\d{2})[\/-](\d{4})/);
  return m ? m[3] + "-" + m[2] + "-" + m[1] : null;
};
const fuelOf = value => /0992000|\bCNG\b/i.test(value) ? "CNG"
  : /2812000|\bHSD\b|DIESEL/i.test(value) ? "HSD"
  : /2822000|\bMS\b|MOTOR SPIRIT|PETROL/i.test(value) ? "MS" : null;
const digits = value => String(value || "").replace(/\D/g, "");

await Promise.all([OUT, PDF_DIR, LOG_DIR].map(p => fs.mkdir(p, { recursive: true })));
const log = async (event, details = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), event, ...details });
  await fs.appendFile(path.join(LOG_DIR, "agent.jsonl"), line + "\n");
  console.log(line);
};
const fillDate = async (page, prefix, value) => {
  const [dd, mm, yyyy] = value.split("/");
  for (const [part, v] of [["day", dd], ["month", mm], ["year", yyyy]]) {
    await page.locator('[name="' + prefix + part + '"]').fill(v);
  }
};

async function invoiceFormReady(page) {
  if (new URL(page.url()).hostname !== HPCL_HOST) return false;
  const required = [
    "#cmbcat",
    '[name="txtfrmday"]',
    '[name="txtfrmmonth"]',
    '[name="txtfrmyear"]',
    '[name="txttoday"]',
    '[name="txttomonth"]',
    '[name="txttoyear"]'
  ];
  for (const selector of required) {
    if (!(await page.locator(selector).count())) return false;
  }
  return !(await page.locator('input[type="password"]').count());
}

async function openInvoicePage(page) {
  if (await invoiceFormReady(page)) return page;
  if (new URL(page.url()).hostname !== HPCL_HOST) {
    throw new Error("Cannot open HPCL Invoices: current tab is not on the official HPCL host.");
  }

  // Dashboard tile navigation is performed by the agent; the user does not need
  // to click Invoices manually. Do not submit any search form in this step.
  const invoiceCandidates = [
    page.getByRole("link", { name: /^invoices?$/i }),
    page.getByRole("button", { name: /^invoices?$/i }),
    page.getByText(/^invoices?$/i)
  ];
  for (const candidate of invoiceCandidates) {
    const count = await candidate.count().catch(() => 0);
    if (!count) continue;
    const target = candidate.first();
    if (!(await target.isVisible().catch(() => false))) continue;
    const popupPromise = page.waitForEvent("popup", { timeout: 1500 }).catch(() => null);
    await target.click({ timeout: 10000 });
    const popup = await popupPromise;
    if (popup) page = popup;
    await page.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    if (await invoiceFormReady(page)) return page;
    break;
  }

  throw new Error("Automission reached the HPCL dashboard but could not verify the Invoices page. The portal layout or invoice tile selector needs inspection. No invoice search or download was started.");
}

async function ensureHpclLogin(page) {
  if (new URL(page.url()).hostname !== HPCL_HOST) {
    await page.goto(HPCL_DASHBOARD, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  const passwordField = page.locator('input[type="password"]');
  if (await passwordField.count()) {
    if (!INTERACTIVE_LOGIN) {
      throw new Error("HPCL login/session expired. Scheduled or non-interactive run stopped safely; sign in manually and run the backfill with --interactive-login.");
    }
    console.log("\\nHPCL login required. Enter credentials and solve the image CAPTCHA directly in the visible Edge window.");
    console.log("The agent will NOT read, store, transmit, or attempt to solve your password/CAPTCHA.");
    const rl = readline.createInterface({ input, output });
    try {
      await rl.question("After HPCL confirms login, press ENTER here. The agent will open the dashboard and navigate to Invoices... ");
    } finally {
      rl.close();
    }
    await page.goto(HPCL_DASHBOARD, { waitUntil: "domcontentloaded", timeout: 60000 });
  }
  if (await page.locator('input[type="password"]').count()) {
    throw new Error("HPCL login is still required. No invoice scan was started.");
  }
  page = await openInvoicePage(page);
  await log("hpcl_session_ready", {
    host: HPCL_HOST,
    loginMethod: INTERACTIVE_LOGIN ? "USER_COMPLETED_VISIBLE_LOGIN_AND_IMAGE_CAPTCHA" : "EXISTING_SESSION",
    invoiceFormVerified: true,
    navigation: "AUTOMISSION_OPENED_INVOICES_TILE"
  });
  return page;
}

async function fetchHpclRows(page, range) {
  if (!(await invoiceFormReady(page))) {
    throw new Error("HPCL session expired or invoice form is unavailable before search. Run stopped; no login prompt will appear in this mode.");
  }
  const category = page.locator("#cmbcat");
  const options = await category.locator("option").evaluateAll(es => es.map(e => ({ value: e.value, label: (e.textContent || "").trim() })));
  const all = options.find(o => /all/i.test(o.label));
  if (all) await category.selectOption(all.value);
  await fillDate(page, "txtfrm", range.from);
  await fillDate(page, "txtto", range.to);
  const html = page.locator('input[value="HTML"]');
  if (await html.count()) await html.first().check().catch(() => {});
  const submit = page.locator('input[type="submit"][value="SUBMIT"],input[type="submit"]');
  if (!(await submit.count())) throw new Error("HPCL submit button not found; portal layout changed.");
  await submit.first().click();
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(1200);
  if (await page.locator('input[type="password"]').count()) {
    throw new Error("HPCL redirected to login during invoice search. Stopping without retry or import.");
  }
  return await page.locator("tr").evaluateAll(rows => rows.map(tr => {
    const cells = [...tr.querySelectorAll("th,td")].map(td => (td.innerText || "").replace(/\s+/g, " ").trim());
    const links = [...tr.querySelectorAll("a[href]")].map(a => a.href);
    return { text: cells.join(" | "), cells, links };
  }).filter(r => /0992000|2812000|2822000|CNG|HSD|DIESEL|PETROL|\bMS\b/i.test(r.text)));
}

async function main() {
  try {
    const browser = await chromium.connectOverCDP(CDP);
    const context = browser.contexts()[0];
    if (!context) throw new Error("Edge CDP connected but no browser context found.");
    let hpclPage = context.pages().find(p => {
      try { return new URL(p.url()).hostname === HPCL_HOST; } catch { return false; }
    }) || context.pages()[0];
    if (!hpclPage) hpclPage = await context.newPage();
    hpclPage = await ensureHpclLogin(hpclPage);
    if (VERIFY_ONLY) {
      await log("verify_only_complete", {
        invoiceFormVerified: true,
        navigation: "AUTOMISSION_OPENED_INVOICES_TILE",
        scanned: false,
        downloaded: 0,
        imported: 0
      });
      console.log("HPCL Invoices page verified by Automission. Verify-only mode: no search, PDF download, or import was performed.");
      return;
    }

    const collected = [];
    for (const range of ranges) {
      await log("range_start", { range });
      const found = await fetchHpclRows(hpclPage, range);
      for (const row of found) {
        const invoiceNo = (row.text.match(/\b\d{10}\b/) || [])[0] || null;
        const dateRaw = (row.text.match(/\b\d{2}[\/-]\d{2}[\/-]\d{4}\b/) || [])[0] || null;
        const fuel = fuelOf(row.text);
        const pdfUrl = row.links.find(x => /salesinvPDFdownload|invKy=/i.test(x)) || null;
        if (invoiceNo && fuel) collected.push({ invoiceNo, dateRaw, date: dateISO(dateRaw), fuel, pdfUrl, rowText: row.text, cells: row.cells, range });
      }
      await log("range_done", { range, matchedRows: found.length, collectedRows: collected.length });
    }

    const grouped = new Map();
    for (const row of collected) {
      const key = row.invoiceNo + "|" + row.fuel;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    }
    const uniqueRows = [];
    for (const [key, rows] of grouped) {
      const signatures = new Set(rows.map(r => [r.date || "", r.pdfUrl || ""].join("|")));
      if (signatures.size > 1) {
        uniqueRows.push({ ...rows[0], rowConflict: true, conflictingSourceRows: rows.length, conflictKey: key });
      } else {
        uniqueRows.push(rows[0]);
      }
    }

    const urls = [...new Set(uniqueRows.map(r => r.pdfUrl).filter(Boolean))];
    const fileMap = new Map();
    for (const url of urls) {
      try {
        const response = await context.request.get(url, { timeout: 60000 });
        if (!response.ok()) throw new Error("HTTP " + response.status());
        const bytes = await response.body();
        if (bytes.subarray(0, 5).toString() !== "%PDF-") throw new Error("Downloaded response is not PDF; check HPCL login.");
        const digest = sha256(bytes);
        const key = (url.match(/invKy=([^&]+)/i) || [])[1] || digest.slice(0, 16);
        const fileName = key + "-" + digest.slice(0, 10) + ".pdf";
        const filePath = path.join(PDF_DIR, fileName);
        await fs.writeFile(filePath, bytes);

        let parsed = { pages: null, textChars: 0, invoiceNoFound: false, parseOk: false };
        try {
          const parsedPdf = await pdfParse(bytes);
          const pdfText = parsedPdf.text || "";
          const linkedRows = uniqueRows.filter(r => r.pdfUrl === url);
          const normalizedText = digits(pdfText);
          const invoiceNoFound = linkedRows.length > 0 && linkedRows.every(r => normalizedText.includes(digits(r.invoiceNo)));
          parsed = { pages: parsedPdf.numpages, textChars: pdfText.length, invoiceNoFound, parseOk: pdfText.trim().length > 0 };
        } catch (e) {
          parsed.error = String(e);
        }
        fileMap.set(url, { fileName, filePath, sha256: digest, bytes: bytes.length, parsed });
        await log("pdf_saved", { fileName, bytes: bytes.length, sha256: digest, parsed });
      } catch (e) {
        fileMap.set(url, { error: String(e) });
        await log("pdf_failed", { url, error: String(e) });
      }
    }

    const manifest = uniqueRows.map(r => {
      const f = r.pdfUrl ? fileMap.get(r.pdfUrl) : null;
      let status = "DOWNLOADED_REVIEW_REQUIRED";
      if (r.rowConflict) status = "REVIEW_SOURCE_ROW_CONFLICT";
      else if (!r.date) status = "REVIEW_DATE";
      else if (!r.pdfUrl) status = "REVIEW_NO_PDF";
      else if (!f || f.error) status = "REVIEW_DOWNLOAD";
      else if (f.parsed && f.parsed.error) status = "REVIEW_PARSE";
      else if (!f.parsed || !f.parsed.parseOk) status = "REVIEW_EMPTY_PDF_TEXT";
      else if (!f.parsed.invoiceNoFound) status = "REVIEW_INVOICE_MISMATCH";
      return {
        ...r,
        pdfFile: f && f.fileName || null,
        pdfSha256: f && f.sha256 || null,
        pdfBytes: f && f.bytes || null,
        pdfParse: f && f.parsed || null,
        customerCodeExpected: CUSTOMER_CODE,
        customerIdentityVerification: "NOT_VERIFIED_BY_AGENT",
        quantityAmountVerification: "NOT_IMPLEMENTED_SOURCE_MAPPING_REQUIRED",
        status,
        importStatus: "NOT_IMPORTED"
      };
    });

    const manifestPath = path.join(OUT, "manifest-" + MODE + ".json");
    await fs.writeFile(manifestPath, JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: MODE,
      customerCodeExpected: CUSTOMER_CODE,
      importEnabled: false,
      note: "Download-only run. Customer identity and HPCL quantity/amount source mapping are not verified; no StationMitra import was attempted.",
      rows: manifest
    }, null, 2));

    const summary = manifest.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {});
    await log("run_complete", { mode: MODE, rows: manifest.length, pdfLinks: urls.length, imported: 0, statusSummary: summary, manifest: manifestPath });
    console.log(JSON.stringify({
      mode: MODE,
      rows: manifest.length,
      uniquePdfLinks: urls.length,
      imported: 0,
      statusSummary: summary,
      manifest: manifestPath,
      pdfFolder: PDF_DIR,
      importEnabled: false
    }, null, 2));
  } catch (e) {
    await log("run_failed", { error: String(e), stack: e.stack });
    process.exitCode = 1;
  }
  // Never close the user's Edge CDP browser: it contains their authenticated sessions.
}
main();
