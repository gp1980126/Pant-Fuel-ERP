import React, { useMemo, useState } from "react";
import staticDsr from "../data/dsr_apr_jul_2026.json";

const MONTHS = [
  ["2026-04", "April 2026"],
  ["2026-05", "May 2026"],
  ["2026-06", "June 2026"],
  ["2026-07", "July 2026"]
];

const n = value => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

const fmt = value =>
  n(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

const totalsFor = (rows, fuel, month) => {
  const raw = rows.reduce(
    (a, r) => ({
      received: a.received + n(r.received),
      meter: a.meter + n(r.salesByMtr),
      test: a.test + n(r.pumpTest),
      net: a.net + n(r.netSales),
      dip: a.dip + n(r.salesByDip),
      difference: a.difference + n(r.difference)
    }),
    { received: 0, meter: 0, test: 0, net: 0, dip: 0, difference: 0 }
  );

  // April 2026 MS: use the confirmed physical closing and boundary purchase.
  if (fuel === "MS" && month === "2026-04") {
    const opening = 12917;
    const received = 37000;
    const closing = 7593;
    const test = 644;
    const stockConsumption = opening + received - closing;
    return { ...raw, received, test, reconciliationOpening: opening,
      reconciliationClosing: closing, stockConsumption,
      net: stockConsumption - test };
  }

  const opening = rows.length ? n(rows[0].opStock) : 0;
  const closing = rows.length ? n(rows[rows.length - 1].opStock) : 0;
  const stockConsumption = opening + raw.received - closing;
  return { ...raw, reconciliationOpening: opening,
    reconciliationClosing: closing, stockConsumption,
    net: stockConsumption - raw.test };
};

function FuelTable({ fuel, rows, month }) {
  const totals = totalsFor(rows, fuel, month);

  return (
    <section className="panel" style={{ marginTop: 18, border: "2px solid #dbeafe" }}>
      <h2 style={{ marginBottom: 4 }}>
        {fuel} — DSR / Stock History
      </h2>

      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card"><span>Received</span><strong>{fmt(totals.received)} L</strong></div>
        <div className="card"><span>Sales By Mtr</span><strong>{fmt(totals.meter)} L</strong></div>
        <div className="card"><span>Pump Test</span><strong>{fmt(totals.test)} L</strong></div>
        <div className="card"><span>Net Sale (Reconciled)</span><strong>{fmt(totals.net)} L</strong><small>Opening + Purchase − Physical Closing − Tasting</small></div>
        <div className="card"><span>Sales By Dip</span><strong>{fmt(totals.dip)} L</strong></div>
        <div className="card"><span>Stock Reconciliation</span><strong>{fmt(totals.stockConsumption)} L</strong><small>Opening + Purchase − Physical Closing</small></div>
        <div className="card"><span>DSR Difference</span><strong>{fmt(totals.difference)} L</strong></div>
      </div>

      <div className="table" style={{ marginTop: 14, overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opp. Stock</th>
              <th>Received</th>
              <th>Total Stock</th>
              <th>Sales By Mtr</th>
              <th>Pump Test</th>
              <th>Net Sales</th>
              <th>Cumm. Sales</th>
              <th>Sales By Dip</th>
              <th>Difference</th>
              <th>Cumm. Difference</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={String(r.date) + "|" + fuel}>
                <td><b>{r.date}</b></td>
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
            {!rows.length && (
              <tr>
                <td colSpan="11" style={{ textAlign: "center", padding: 18 }}>
                  No {fuel} records found for this month.
                </td>
              </tr>
            )}
            <tr className="total-row">
              <td><b>{fuel} MONTH TOTAL</b></td>
              <td>—</td>
              <td><b>{fmt(totals.received)} L</b></td>
              <td>—</td>
              <td><b>{fmt(totals.meter)} L</b></td>
              <td><b>{fmt(totals.test)} L</b></td>
              <td><b>{fmt(totals.net)} L</b></td>
              <td>—</td>
              <td><b>{fmt(totals.dip)} L</b></td>
              <td><b>{fmt(totals.difference)} L</b></td>
              <td>—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function ImportedDsrHistory({ data }) {
  const source =
    Array.isArray(data?.dsrHistory) && data.dsrHistory.length
      ? data.dsrHistory
      : staticDsr;

  const [month, setMonth] = useState("2026-07");

  const monthRows = useMemo(
    () =>
      source
        .filter(r => String(r?.date || "").slice(0, 7) === month)
        .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [source, month]
  );

  const msRows = monthRows.filter(
    r => String(r?.fuel || "").toUpperCase() === "MS"
  );
  const hsdRows = monthRows.filter(
    r => String(r?.fuel || "").toUpperCase() === "HSD"
  );

  if (!source.length) {
    return (
      <section className="panel" style={{ marginTop: 18 }}>
        <h2>📥 Imported DSR / Stock History</h2>
        <div className="warning">
          01-04-2026 से 31-07-2026 का DSR अभी उपलब्ध नहीं है।
        </div>
      </section>
    );
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div
        className="pro-panel-head"
        style={{ alignItems: "center" }}
      >
        <div>
          <h2 style={{ marginBottom: 4 }}>
            📥 DSR / Stock History — 01-04-2026 to 31-07-2026
          </h2>
          <span style={{ color: "#64748b" }}>
            MS और HSD अलग-अलग दिखाए गए हैं। Source DSR में Opening/Closing Meter Reading नहीं है, इसलिए कोई meter reading बनाई नहीं गई है। Monthly reconciliation में Physical Closing को stock closing माना जाता है।
          </span>
        </div>

        <label>
          Month
          <select value={month} onChange={e => setMonth(e.target.value)}>
            {MONTHS.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      <FuelTable fuel="MS" rows={msRows} month={month} />
      <FuelTable fuel="HSD" rows={hsdRows} month={month} />

      <div className="notice" style={{ marginTop: 12 }}>
        <b>April 2026 MS reconciliation:</b> 12,917 L Opening + 37,000 L Purchase − 7,593 L Physical Closing − 644 L Tasting = <b>41,680 L Net Sale</b>.
      </div>
      <div className="notice" style={{ marginTop: 12 }}>
        <b>Important:</b> इस imported history को Fuel Sale की nozzle-wise
        sales या Opening/Closing Meter Reading में convert नहीं किया गया है।
        Existing accounting/sales data को double-count नहीं किया गया है।
      </div>
    </section>
  );
}
