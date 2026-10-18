import React, { useMemo, useState } from "react";
import staticDsr from "../data/dsr_apr_jul_2026.json";

const MONTH_LABEL = month => {
  const [year, mm] = String(month).split("-");
  const date = new Date(Number(year), Number(mm) - 1, 1);
  return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
};

const n = value => {
  const v = Number(value);
  return Number.isFinite(v) ? v : 0;
};

const fmt = value => {
  if (value === null || value === undefined || value === "") return "—";
  return n(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};


// Build August onward from the isolated app-state records; do not invent missing values.
// Opening stock is the dated physical dip. Dip consumption uses opening + receipts - next day's opening.
const buildOperationalDsr = data => {
  const sales = Array.isArray(data?.sales) ? data.sales : [];
  const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
  const dips = Array.isArray(data?.dipReadings) ? data.dipReadings : [];
  const fuels = ["MS", "HSD"];
  const dateFuel = new Map();
  const dipByDate = new Map();

  for (const dip of dips) {
    const date = String(dip?.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    dipByDate.set(date, dip);
  }
  const ensure = (date, fuel) => {
    const key = date + "|" + fuel;
    if (!dateFuel.has(key)) dateFuel.set(key, {
      date, fuel, received: 0, salesByMtr: 0, pumpTest: 0, opStock: null
    });
    return dateFuel.get(key);
  };
  const seenSales = new Set();
  for (const sale of sales) {
    const date = String(sale?.date || "").slice(0, 10);
    const fuel = String(sale?.fuel || "").toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fuels.includes(fuel)) continue;
    const identity = String(sale?.txId || sale?.transactionId || sale?.id || "");
    const dedupeKey = identity ? fuel + "|" + identity : date + "|" + fuel + "|" + String(sale?.nozzle || "");
    if (seenSales.has(dedupeKey)) continue;
    seenSales.add(dedupeKey);
    const row = ensure(date, fuel);
    row.salesByMtr += n(sale?.qty);
    row.pumpTest += n(sale?.testing);
  }
  const seenPurchases = new Set();
  for (const purchase of purchases) {
    const date = String(purchase?.date || purchase?.purchaseDate || "").slice(0, 10);
    const fuel = String(purchase?.fuel || "").toUpperCase();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !fuels.includes(fuel)) continue;
    const identity = String(purchase?.txId || purchase?.transactionId || purchase?.invoiceNo || purchase?.id || "");
    const dedupeKey = identity ? fuel + "|" + identity : "";
    if (dedupeKey && seenPurchases.has(dedupeKey)) continue;
    if (dedupeKey) seenPurchases.add(dedupeKey);
    ensure(date, fuel).received += n(purchase?.quantity ?? purchase?.qty);
  }
  for (const row of dateFuel.values()) {
    const value = dipByDate.get(row.date)?.[row.fuel];
    row.opStock = value === undefined || value === null || value === "" ? null : n(value);
  }

  const grouped = new Map();
  for (const row of dateFuel.values()) {
    if (row.opStock === null) continue;
    if (!grouped.has(row.fuel)) grouped.set(row.fuel, []);
    grouped.get(row.fuel).push(row);
  }
  const output = [];
  for (const [fuel, fuelRows] of grouped) {
    fuelRows.sort((a, b) => a.date.localeCompare(b.date));
    let cumulativeSales = 0;
    let cumulativeDifference = 0;
    for (const row of fuelRows) {
      const nextDate = new Date(new Date(row.date + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10);
      const nextStock = dipByDate.get(nextDate)?.[fuel];
      const netSales = row.salesByMtr - row.pumpTest;
      const salesByDip = nextStock === undefined || nextStock === null || nextStock === ""
        ? null : row.opStock + row.received - n(nextStock);
      const difference = salesByDip === null ? null : netSales - salesByDip;
      cumulativeSales += netSales;
      if (difference !== null) cumulativeDifference += difference;
      output.push({
        date: row.date, fuel, opStock: row.opStock, received: row.received,
        totalStock: row.opStock + row.received, salesByMtr: row.salesByMtr,
        pumpTest: row.pumpTest, netSales, cummSales: cumulativeSales,
        salesByDip, difference, cumulativeDifference
      });
    }
  }
  return output.sort((a, b) => a.date.localeCompare(b.date) || a.fuel.localeCompare(b.fuel));
};

const totalsFor = (rows, fuel, month, closingStock) => {
  const raw = rows.reduce(
    (a, r) => ({
      received: a.received + n(r.received),
      meter: a.meter + n(r.salesByMtr),
      test: a.test + n(r.pumpTest),
      net: a.net + n(r.netSales),
      dip: a.dip + (r.salesByDip === null || r.salesByDip === undefined || r.salesByDip === "" ? 0 : n(r.salesByDip)),
      dipKnown: a.dipKnown || (r.salesByDip !== null && r.salesByDip !== undefined && r.salesByDip !== ""),
      difference: a.difference + (r.difference === null || r.difference === undefined || r.difference === "" ? 0 : n(r.difference)),
      differenceKnown: a.differenceKnown || (r.difference !== null && r.difference !== undefined && r.difference !== "")
    }),
    { received: 0, meter: 0, test: 0, net: 0, dip: 0, dipKnown: false, difference: 0, differenceKnown: false }
  );

  // April 2026 MS has a separately confirmed stock reconciliation.
  if (fuel === "MS" && month === "2026-04") {
    const opening = 12917;
    const received = 37000;
    const closing = 7593;
    const test = 644;
    const stockConsumption = opening + received - closing;
    return { ...raw, received, test, reconciliationOpening: opening,
      reconciliationClosing: closing, stockConsumption,
      reconciledNet: stockConsumption - test };
  }

  const opening = rows.length ? n(rows[0].opStock) : 0;
  // Month-end closing is the next calendar day's opening dip, not the last
  // day's opening dip. If that boundary reading is absent, leave it unknown.
  const closing = closingStock === null || closingStock === undefined ? null : n(closingStock);
  const stockConsumption = closing === null ? null : opening + raw.received - closing;
  return { ...raw, dip: raw.dipKnown ? raw.dip : null, difference: raw.differenceKnown ? raw.difference : null, reconciliationOpening: opening,
    reconciliationClosing: closing, stockConsumption,
    reconciledNet: stockConsumption === null ? null : stockConsumption - raw.test };
};

function FuelTable({ fuel, rows, month, closingStock }) {
  const totals = totalsFor(rows, fuel, month, closingStock);

  return (
    <section className="panel" style={{ marginTop: 18, border: "2px solid #dbeafe" }}>
      <h2 style={{ marginBottom: 4 }}>
        {fuel} — DSR / Stock History
      </h2>

      <div className="cards" style={{ marginTop: 14 }}>
        <div className="card"><span>Received</span><strong>{fmt(totals.received)} L</strong></div>
        <div className="card"><span>Sales By Mtr</span><strong>{fmt(totals.meter)} L</strong></div>
        <div className="card"><span>Pump Test</span><strong>{fmt(totals.test)} L</strong></div>
        <div className="card"><span>Net Sale (Meter − Test)</span><strong>{fmt(totals.net)} L</strong><small>Daily Net Sales का योग</small></div>
        <div className="card"><span>Stock-Based Net</span><strong>{fmt(totals.reconciledNet)} L</strong><small>Opening + Received − Closing − Pump Test</small></div>
        <div className="card"><span>Sales By Dip</span><strong>{fmt(totals.dip)} L</strong></div>
        <div className="card"><span>Month-End Closing Dip</span><strong>{fmt(totals.reconciliationClosing)} L</strong><small>अगले महीने/अगले दिन का opening dip</small></div>
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
  const importedSource =
    Array.isArray(data?.dsrHistory) && data.dsrHistory.length
      ? data.dsrHistory
      : staticDsr;
  const operationalSource = useMemo(() => buildOperationalDsr(data), [
    data?.sales, data?.purchases, data?.dipReadings
  ]);
  const importedKeys = new Set(importedSource.map(r => String(r?.date || "").slice(0, 10) + "|" + String(r?.fuel || "").toUpperCase()));
  const source = [
    ...importedSource,
    ...operationalSource.filter(r =>
      String(r.date).slice(0, 7) >= "2026-08" &&
      !importedKeys.has(String(r.date).slice(0, 10) + "|" + String(r.fuel).toUpperCase())
    )
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.fuel).localeCompare(String(b.fuel)));

  const availableMonths = useMemo(() => {
    const keys = [...new Set(source.map(r => String(r?.date || "").slice(0, 7)).filter(k => /^\d{4}-\d{2}$/.test(k)))].sort();
    return keys;
  }, [source]);

  const [month, setMonth] = useState("2026-10");
  const selectedMonth = availableMonths.includes(month) ? month : (availableMonths[availableMonths.length - 1] || "2026-07");

  // Recalculate dip sales from the next calendar day's opening dip, including month boundaries.
  // This is essential for the last day of a month: 31 Aug uses 1 Sep opening.
  const monthRows = useMemo(() => {
    const rows = source
      .filter(r => String(r?.date || "").slice(0, 7) === selectedMonth)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const sourceByKey = new Map(source.map(r => [
      String(r?.date || "").slice(0, 10) + "|" + String(r?.fuel || "").toUpperCase(),
      r
    ]));
    let monthlyCummSales = 0;
    let monthlyCummDifference = 0;
    return rows.map(r => {
      const date = String(r?.date || "").slice(0, 10);
      const fuel = String(r?.fuel || "").toUpperCase();
      const nextDate = new Date(new Date(date + "T00:00:00Z").getTime() + 86400000).toISOString().slice(0, 10);
      const nextRow = sourceByKey.get(nextDate + "|" + fuel);
      const opening = r?.opStock === null || r?.opStock === undefined || r?.opStock === "" ? null : n(r.opStock);
      const received = r?.received === null || r?.received === undefined || r?.received === "" ? null : n(r.received);
      const nextOpening = nextRow?.opStock === null || nextRow?.opStock === undefined || nextRow?.opStock === "" ? null : n(nextRow.opStock);
      const netSales = n(r?.netSales ?? r?.netSale);
      const salesByDip = opening === null || received === null || nextOpening === null
        ? null
        : Math.round((opening + received - nextOpening) * 100) / 100;
      const difference = salesByDip === null
        ? null
        : Math.round((netSales - salesByDip) * 100) / 100;
      monthlyCummSales = Math.round((monthlyCummSales + netSales) * 100) / 100;
      if (difference !== null) {
        monthlyCummDifference = Math.round((monthlyCummDifference + difference) * 100) / 100;
      }
      return {
        ...r,
        salesByDip,
        difference,
        cummSales: monthlyCummSales,
        cumulativeDifference: difference === null ? null : monthlyCummDifference
      };
    });
  }, [source, selectedMonth]);

  const msRows = monthRows.filter(
    r => String(r?.fuel || "").toUpperCase() === "MS"
  );
  const hsdRows = monthRows.filter(
    r => String(r?.fuel || "").toUpperCase() === "HSD"
  );
  const [yearPart, monthPart] = selectedMonth.split("-").map(Number);
  const nextMonthDate = new Date(Date.UTC(yearPart, monthPart, 1)).toISOString().slice(0, 10);
  const msClosingStock = source.find(r =>
    String(r?.date || "").slice(0, 10) === nextMonthDate &&
    String(r?.fuel || "").toUpperCase() === "MS"
  )?.opStock ?? null;
  const hsdClosingStock = source.find(r =>
    String(r?.date || "").slice(0, 10) === nextMonthDate &&
    String(r?.fuel || "").toUpperCase() === "HSD"
  )?.opStock ?? null;

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
            📥 DSR / Stock History — Month Wise
          </h2>
          <span style={{ color: "#64748b" }}>
            चुने हुए महीने का दैनिक DSR और Month Total नीचे दिखेगा। MS और HSD अलग-अलग हैं। Stock logic: Opening + Purchase − Net Sale − Pump Test = Closing Balance. केवल उपलब्ध source records दिखाए जाते हैं; missing dates या figures अनुमान से नहीं भरे जाते।
          </span>
        </div>

        <label>
          Month
          <select value={selectedMonth} onChange={e => setMonth(e.target.value)}>
            {availableMonths.map(value => (
              <option key={value} value={value}>{MONTH_LABEL(value)}</option>
            ))}
          </select>
        </label>
      </div>

      <FuelTable fuel="MS" rows={msRows} month={selectedMonth} closingStock={msClosingStock} />
      <FuelTable fuel="HSD" rows={hsdRows} month={selectedMonth} closingStock={hsdClosingStock} />

      {selectedMonth === "2026-04" && (
        <div className="notice" style={{ marginTop: 12 }}>
          <b>April 2026 MS reconciliation:</b> 12,917 L Opening + 37,000 L Purchase − 41,680 L Net Sale − 644 L Pump Test = <b>7,593 L Closing Balance</b>.
        </div>
      )}
      <div className="notice" style={{ marginTop: 12 }}>
        <b>Important:</b> इस imported history को Fuel Sale की nozzle-wise
        sales या Opening/Closing Meter Reading में convert नहीं किया गया है।
        Existing accounting/sales data को double-count नहीं किया गया है।
      </div>
    </section>
  );
}
