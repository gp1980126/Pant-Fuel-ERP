import React, { useMemo, useState } from "react";
import { getRate, rupee } from "../core/pumpDomain";
import historicalDsr from "../data/dsr_apr_jul_2026.json";

const START = "2026-04-01";
const CLOSED_END = "2026-07-31";
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
  let billSeq = 304;

  const sales = Array.isArray(data?.sales) ? data.sales : [];

  const historical = Array.isArray(historicalDsr) ? historicalDsr : [];

  const totalSalesForDate = date => {
    const map = {};
    const historicalRows = historical.filter(r => r.date === date && MS_HSD.has(r.fuel));
    historicalRows.forEach(r => {
      const rate = num(getRate(data, r.fuel, date));
      addFuel(map, r.fuel, r.netSales, num(r.netSales) * rate);
    });
    if (Object.keys(map).length === 0) {
      sales.filter(r => r.date === date && MS_HSD.has(r.fuel))
        .forEach(r => addFuel(map, r.fuel, r.qty, r.amount));
    }
    return map;
  };

  const dates = [];
  let cursor = START;
  while (cursor <= CLOSED_END) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  for (const date of dates) {
    const items = finalizeFuel(totalSalesForDate(date));
    const total = round2(items.reduce((s, x) => s + x.amount, 0));
    if (total <= 0.005) continue;
    result.push({
      billNo: String(billSeq++),
      type: "CASH",
      party: "CASH SALE",
      start: date,
      end: date,
      payment: "Cash",
      gst: "Not Applicable",
      items,
      total
    });
  }
