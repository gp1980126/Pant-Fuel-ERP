// OM GURU lubricant invoice display patch.
// Keeps the current main branch/P&L logic intact and only fixes the customer
// identity block on the printed lubricant invoice.
const OM_GURU_GSTIN = "05AFHPJ5165P1Z0";
const OM_GURU_ADDRESS = "VILL. GAUJAJALI BICHALI, BAREILLY ROAD, HALDWANI, UTTARAKHAND - 263139";

function patchOmGuruInvoice(root = document) {
  const selectors = [
    "#stationmitra-lubricant-bill-overlay .bill-paper .meta > div:first-child",
    "#stationmitra-lubricant-sale-viewer .sm-bill-paper .meta > div:first-child",
  ];

  for (const selector of selectors) {
    root.querySelectorAll?.(selector).forEach((box) => {
      if (box.dataset.omGuruInvoicePatched === "1") return;
      if (!/M\\/s\\s*:\\s*OM GURU/i.test(box.textContent || "")) return;

      const vehicleMatch = (box.textContent || "").match(/Vehicle(?: No\\.)?\\s*:\\s*([^\\n]*)/i);
      const vehicle = vehicleMatch?.[1]?.trim();
      box.innerHTML =
        "<b>M/s:</b> OM GURU" +
        "<br><b>Address:</b> " + OM_GURU_ADDRESS +
        "<br><b>GSTIN:</b> " + OM_GURU_GSTIN +
        (vehicle ? "<br><b>Vehicle:</b> " + vehicle : "");
      box.dataset.omGuruInvoicePatched = "1";
    });
  }
}

patchOmGuruInvoice();

const omGuruInvoiceObserver = new MutationObserver(() => patchOmGuruInvoice());
omGuruInvoiceObserver.observe(document.documentElement, { childList: true, subtree: true });
