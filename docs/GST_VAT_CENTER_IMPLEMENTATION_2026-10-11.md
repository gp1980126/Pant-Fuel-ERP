# StationMitra GST & VAT Center — isolated implementation

Date: 2026-10-11
Branch: feature/gst-vat-center-isolated-2026-10-11

## Safety boundary
- Work is isolated to this feature branch and a Vercel Preview deployment.
- No Production/Live Supabase schema or data changes are part of this feature.
- The test build uses the existing isolated test Supabase fallback URL when branch-scoped Preview variables do not apply.
- The module is read-only over existing app data. It does not write GST/VAT calculations back into accounting records.

## Included in this iteration
- Navigation entry: GST & VAT Center (available to roles with Tally / CA Export access).
- Date-range filter; default period is 2026-09-01 through 2026-09-30.
- GSTR-1 CA-review CSV from lubricant credit and cash sales, with invoice, customer, HSN, taxable value and tax totals.
- GSTR-3B working summary with output GST and purchase GST shown separately; only CA-confirmed ITC is used in the indicative net calculation.
- Uttarakhand MS/HSD VAT working: fuel sale quantities and values, editable CA-confirmed tax bases, configurable rates/minimum-per-litre assumptions, and clearly labelled indicative estimates.
- Combined GST/VAT reconciliation CSV and print/save-PDF action.
- No official GST return or payment is submitted by this UI.

## Required validation before statutory use
1. Verify each lubricant invoice and HSN against the source invoice.
2. Match output GST to GSTR-1 and purchase invoices to GSTR-2B.
3. Confirm ITC eligibility and reversals with CA before entering eligible ITC.
4. Confirm current Uttarakhand VAT notifications, tax base, applicable return period and rate assumptions with CA.
5. Validate official portal-compatible JSON schema and GSTN/GSP sandbox access before enabling API submission.
6. Confirm deployment build and test environment isolation before asking users to test.

## Explicitly not implemented yet
- No live GSTN/GSP credentials or API calls.
- No auto-filing, no payment initiation, and no declaration that the CSV is an official GST portal JSON.
- No VAT return submission API.
- No Production/Live Supabase writes.
