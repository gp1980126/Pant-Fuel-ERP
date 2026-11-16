/* CNG is reconciled by delivery interval, not by tank stock.
   Each HPCL invoice date is the delivery/sales date; the invoice may be entered
   later. A delivery's sales are the authoritative nozzle-day rows after the
   previous invoice date and through the current invoice date. */
const num = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const dateOf = row => String(row?.date || "");
const addDays = (date, days = 1) => {
  if (!date) return "";
  const value = new Date(date + "T00:00:00Z");
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
const idOf = row => String(row?.id ?? row?.transactionId ?? row?.txId ?? "");

export function authoritativeCngSales(sales = []) {
  const groups = new Map();
  (Array.isArray(sales) ? sales : []).filter(row => String(row?.fuel || "").toUpperCase() === "CNG").forEach((row, index) => {
    const key = `${dateOf(row)}|${String(row?.nozzle || "")}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ row, index });
  });
  const chosen = [];
  const duplicates = [];
  for (const [key, items] of groups) {
    const source = items.filter(x => String(x.row?.recoveryStatus || "") !== "FORENSIC_RECOVERY" &&
      !String(x.row?.transactionId || "").includes("-RECOVERY-"));
    const candidates = source.length ? source : items;
    const verified = candidates.filter(x => Number(x.row?.fingerprintVersion || 0) === 1 && x.row?._integrityVerified === true);
    const v1 = candidates.filter(x => Number(x.row?.fingerprintVersion || 0) === 1);
    const winner = (verified[verified.length - 1] || v1[v1.length - 1] || candidates[candidates.length - 1]);
    if (winner) chosen.push(winner.row);
    if (items.length > 1) duplicates.push({
      key, date: dateOf(items[0].row), nozzle: String(items[0].row?.nozzle || ""),
      rawCount: items.length, keptId: idOf(winner?.row),
      excludedIds: items.filter(x => x !== winner).map(x => idOf(x.row))
    });
  }
  return {
    sales: chosen.sort((a,b) => dateOf(a).localeCompare(dateOf(b)) || String(a.nozzle || "").localeCompare(String(b.nozzle || ""))),
    duplicates
  };
}

export function buildCngDeliveryReconciliation(data = {}, from = "0000-01-01", to = "9999-12-31") {
  const purchases = (Array.isArray(data?.purchases) ? data.purchases : [])
    .filter(row => String(row?.fuel || "").toUpperCase() === "CNG" && dateOf(row))
    .slice()
    .sort((a,b) => dateOf(a).localeCompare(dateOf(b)) || String(a.invoiceNo || "").localeCompare(String(b.invoiceNo || "")));
  const { sales, duplicates } = authoritativeCngSales(data?.sales);
  const byDate = new Map();
  for (const purchase of purchases) {
    const date = dateOf(purchase);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(purchase);
  }
  const billDates = [...byDate.keys()].sort();
  const rows = [];
  let previousDate = "";
  for (const date of billDates) {
    const bills = byDate.get(date);
    const periodSales = sales.filter(row => dateOf(row) <= date && (!previousDate || dateOf(row) > previousDate));
    const purchaseQty = bills.reduce((sum,row) => sum + num(row.quantity), 0);
    const salesQty = periodSales.reduce((sum,row) => sum + num(row.qty), 0);
    const entryDates = bills.map(row => row.entryDate || row.billEntryDate || row.receivedAt || row.createdAt || "").filter(Boolean);
    const entryDate = entryDates.length ? [...new Set(entryDates)].join(", ") : "";
    rows.push({
      type: "DELIVERY",
      date,
      previousDate,
      invoiceNos: bills.map(row => String(row.invoiceNo || "Invoice missing")).join(", "),
      entryDate,
      fileNames: bills.map(row => row.fileName).filter(Boolean).join(", "),
      billCount: bills.length,
      purchaseQty,
      salesQty,
      variance: purchaseQty - salesQty,
      salesRows: periodSales.length
    });
    previousDate = date;
  }
  // Sales after the latest HPCL invoice remain an open interval until the next
  // invoice arrives. Clip this interval to the selected report window so the
  // pending quantity never includes dates outside the user's To Date.
  const tailSales = sales.filter(row =>
    (!previousDate || dateOf(row) > previousDate) &&
    dateOf(row) >= from && dateOf(row) <= to
  );
  if (tailSales.length) {
    const pendingFromDate = !previousDate || from > addDays(previousDate) ? from : addDays(previousDate);
    const pendingToDate = tailSales.reduce((latest, row) => dateOf(row) > latest ? dateOf(row) : latest, "");
    rows.push({
      type: "PENDING_BILL",
      date: "",
      previousDate,
      pendingFromDate,
      pendingToDate,
      periodLabel: pendingFromDate === pendingToDate
        ? pendingFromDate
        : pendingFromDate + " से " + pendingToDate,
      status: "HPCL BILL PENDING",
      invoiceNos: "",
      entryDate: "",
      fileNames: "",
      billCount: 0,
      purchaseQty: null,
      salesQty: tailSales.reduce((sum,row) => sum + num(row.qty), 0),
      variance: null,
      salesRows: tailSales.length
    });
  }
  const filtered = rows.filter(row => row.type === "PENDING_BILL" ? row.previousDate <= to : row.date >= from && row.date <= to);
  return {
    rows: filtered,
    duplicateGroups: duplicates,
    totals: {
      bills: purchases.filter(row => dateOf(row) >= from && dateOf(row) <= to).length,
      purchaseQty: purchases.filter(row => dateOf(row) >= from && dateOf(row) <= to).reduce((sum,row) => sum + num(row.quantity), 0),
      authoritativeSalesRows: sales.filter(row => dateOf(row) >= from && dateOf(row) <= to).length,
      salesQty: sales.filter(row => dateOf(row) >= from && dateOf(row) <= to).reduce((sum,row) => sum + num(row.qty), 0),
      duplicateGroups: duplicates.filter(row => row.date >= from && row.date <= to).length
    }
  };
}
