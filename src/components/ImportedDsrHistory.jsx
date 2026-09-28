import React, { useMemo, useState } from "react";
import staticDsr from "../data/dsr_apr_jul_2026.json";

const MONTHS = [
  ["2026-04", "April 2026"],
  ["2026-05", "May 2026"],
  ["2026-06", "June 2026"],
  ["2026-07", "July 2026"]
];

const FUELS = ["ALL", "MS", "HSD"];

const n = value => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

const fmt = value => n(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportedDsrHistory({ data }) {
  const source = Array.isArray(data?.dsrHistory) && data.dsrHistory.length ? data.dsrHistory : staticDsr;
  const [month, setMonth] = useState("2026-07");
  const [fuel, setFuel] = useState("ALL");

  const rows = useMemo(() => source
    .filter(r => String(r?.date || "").slice(0, 7) === month)
    .filter(r => fuel === "ALL" || String(r?.fuel || "").toUpperCase() === fuel)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.fuel).localeCompare(String(b.fuel))),
    [source, month, fuel]
  );

  const totals = useMemo(() => rows.reduce((a, r) => ({
    received: a.received + n(r.received),
    meter: a.meter + n(r.salesByMtr),
    test: a.test + n(r.pumpTest),
    net: a.net + n(r.netSales),
    dip: a.dip + n(r.salesByDip),
    difference: a.difference + n(r.difference)
  }), { received: 0, meter: 0, test: 0, net: 0, dip: 0, difference: 0 }), [rows]);

  if (!source.length) {
    return (
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>📥 Imported DSR / Stock History</h2>
        <div className="warning">01-04-2026 से 31-07-2026 का DSR अभी cloud test data में import नहीं है।</div>
      </section>
    );
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="pro-panel-head" style={{ alignItems: "center" }}>
        <div>
          <h2 style={{ marginBottom: 4 }}>📥 DSR / Stock History — 01-04-2026 to 31-07-2026</h2>
          <span style={{ color: "#64748b" }}>
            Source DSR में Opening/Closing Meter Reading नहीं है। यहाँ केवल source में मौजूद DSR/stock values दिखाई जाती हैं; कोई meter reading invent नहीं की गई है।
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <label>Month
            <select value={month} onChange={e => setMonth(e.target.value)}>
              {MONTHS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
          <label>Fuel
            <select value={fuel} onChange={e => setFuel(e.target.value)}>
              {FUELS.map(v => <option key={v} value={v}>{v === "ALL" ? "MS + HSD" : v}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card"><span>Received</span><strong>{fmt(totals.received)} L</strong></div>
        <div className="card"><span>Sales By Mtr</span><strong>{fmt(totals.meter)} L</strong></div>
        <div className="card"><span>Pump Test</span><strong>{fmt(totals.test)} L</strong></div>
        <div className="card"><span>Net Sales</span><strong>{fmt(totals.net)} L</strong></div>
        <div className="card"><span>Sales By Dip</span><strong>{fmt(totals.dip)} L</strong></div>
        <div className="card"><span>Difference</span><strong>{fmt(totals.difference)} L</strong></div>
      </div>

      <div className="table" style={{ marginTop: 14, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Fuel</th><th>Opp. Stock</th><th>Received</th><th>Total Stock</th>
              <th>Sales By Mtr</th><th>Pump Test</th><th>Net Sales</th><th>Cumm. Sales</th>
              <th>Sales By Dip</th><th>Difference</th><th>Cumm. Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={String(r.date) + "|" + String(r.fuel)}>
                <td><b>{r.date}</b></td>
                <td><b>{r.fuel}</b></td>
                <td>{fmt(r.opStock)} L</td>
                <td>{fmt(r.received)} L</td>
                <td>{fmt(r.totalStock)} L</td>
                <td>{fmt(r.salesByMtr)} L</td>
                <td>{fmt(r.pumpTest)} L</td>
                <td><b>{fmt(r.netSales)} L</b></td>
                <td>{fmt(r.cummSales)} L</td>
                <td>{fmt(r.salesByDip)} L</td>
                <td>{fmt(r.difference)} L</td>
                <td><b>{fmt(r.cumulativeDifference)} L</b></td>
              </tr>
            ))}
            <tr className="total-row">
              <td colSpan="3"><b>MONTH TOTAL</b></td>
              <td><b>{fmt(totals.received)} L</b></td>
              <td>—</td>
              <td><b>{fmt(totals.meter)} L</b></td>
              <td><b>{fmt(totals.test)} L</b></td>
              <td><b>{fmt(totals.net)} L</b></td>
              <td>—</td>
              <td><b>{fmt(totals.dip)} L</b></td>
              <td><b>{fmt(totals.difference)} L</b></td>
              <td>Source cumulative value is shown per day above</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 12 }}>
        <b>Important:</b> इस imported history को Fuel Sale की nozzle-wise sales या Opening/Closing Meter Reading में convert नहीं किया गया है। इससे existing accounting/sales data double-count नहीं होगा।
      </div>
    </section>
  );
}
