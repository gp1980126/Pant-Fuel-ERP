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

const fmt = value => n(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ImportedDsrHistory({ data }) {
  const source = Array.isArray(data?.dsrHistory) && data.dsrHistory.length ? data.dsrHistory : staticDsr;
  const [month, setMonth] = useState("2026-07");
  const fuelRows = fuel => useMemo(() => source
    .filter(r => String(r?.date || "").slice(0, 7) === month)
    .filter(r => String(r?.fuel || "").toUpperCase() === fuel)
    .sort((a, b) => String(a.date).localeCompare(String(b.date))),
    [source, month, fuel]
  );

  const msRows = fuelRows("MS");
  const hsdRows = fuelRows("HSD");

  const totalsFor = rows => rows.reduce((a, r) => ({
    received: a.received + n(r.received),
    meter: a.meter + n(r.salesByMtr),
    test: a.test + n(r.pumpTest),
    net: a.net + n(r.netSales),
    dip: a.dip + n(r.salesByDip),
    difference: a.difference + n(r.difference)
  }), { received: 0, meter: 0, test: 0, net: 0, dip: 0, difference: 0 });

  const renderFuelTable = (fuel, rows) => {
    const totals = totalsFor(rows);
    return (
      <section className="panel" style={{ marginTop: 18, border: "2px solid #dbeafe" }}>
        <h2 style={{ marginBottom: 4 }}>{fuel} — DSR / Stock History</h2>
        {renderFuelTable("MS", msRows)}
      {renderFuelTable("HSD", hsdRows)}

      <div className="notice" style={{ marginTop: 12 }}>
        <b>Important:</b> इस imported history को Fuel Sale की nozzle-wise sales या Opening/Closing Meter Reading में convert नहीं किया गया है। इससे existing accounting/sales data double-count नहीं होगा।
      </div>
    </section>
  );
}
