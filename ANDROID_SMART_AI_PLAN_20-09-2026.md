# StationMitra Android + Smart AI — Build Plan
Date: 20-09-2026

Base
- Repository: gp1980126/Pant-Fuel-ERP
- Base commit: 622c1e0432aadc33d47c37495214de79b4e622f8 (merged 19-09-2026 cloud boot/reporting fixes)
- This branch is isolated from main: stationmitra-android-smart-ai-20-09-2026

Goals
1. Mobile/Android-first responsive owner experience.
2. Smart AI assistant over StationMitra business data.
3. Preserve accounting/data integrity and FY separation.
4. Preserve Density + JUMP Daily Sale Summary.
5. Preserve role authorization and locked-period protection.
6. Never hard-code or ship production secrets.
7. Do not mutate production Cloud data as part of this build.

Modules
- Dashboard: MS/HSD/CNG sales, cash, digital, credit, collection, stock, alerts.
- Fuel Sale: meter opening/closing, auto sale qty/rate/amount, payment breakup.
- Stock/Tank: tank filling, dip, book stock, variance.
- Party/Credit: party master, credit sale, payment, ledger, outstanding.
- Purchase: fuel and lubricant purchase bills.
- Lubricant: purchase, sale, stock and margin.
- Expenses / Employees.
- Reports: DSR, product P&L, purchase, tank, party ledger, collection.
- Export/Share: PDF, Excel, WhatsApp, Tally/CA.
- FY: financial-year selector, isolated accounting context, opening carry-forward workflow.
- Security: audit trail, duplicate firewall, date integrity, immutable accounting lock, role gates.
- Multi-pump: owner account -> multiple stations -> station-scoped data.

Android UX
- Thumb-friendly controls.
- Bottom navigation: Home, Sales, Stock, Parties, Reports.
- Quick actions: New Sale, Credit Sale, Payment, Dip, Expense.
- PWA/installable mobile shell first; native Android packaging can consume the same web app.
- Offline-friendly read cache with explicit sync status; writes remain subject to existing authorization/integrity rules.

Smart AI
- Ask questions in Hindi/English.
- Business Q&A from current authorized station/FY context.
- Explain variance, jump and density anomalies using underlying records.
- Identify unusual collection/credit/stock patterns without altering accounting entries.
- Daily AI summary and action list.
- Low-stock / overdue-party / reconciliation alerts.
- P&L explanation by product.
- AI must be read-only by default; any future mutation workflow requires explicit user action and existing role authorization.
- No fabricated figures: answers cite/report the underlying StationMitra calculations.

Commercial Plans (proposed)
- Trial: limited demo period/data.
- Starter: core 1-pump ERP.
- Business: full ERP + Android + exports.
- Professional: Business + Smart AI + WhatsApp + Tally/CA.
- Multi-Pump: multiple stations + central owner dashboard + AI.
- Enterprise: custom integrations/users/support.
Pricing is a proposed commercial model and should remain configurable in app settings rather than hard-coded.

Build rules
- Do not edit main directly.
- Do not remove existing accounting safeguards.
- Do not include .env.local, service-role keys, or secrets.
- Keep Cloud and production data untouched while developing/testing this branch.
