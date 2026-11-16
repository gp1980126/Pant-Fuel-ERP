# Fuel Stock Firewall — Test Data Audit — 2026-11-16

## Scope and safety
- Read-only audit of Test Supabase project `vzfmhppgninuinvmwyjn`.
- Station: `SATAT-FILLING-STATION`.
- Current Test app_state version observed: 1920 (updated 2026-11-16 07:07:52 UTC).
- No app_state, sales, purchase, filling, dip, or Production data was changed.

## Reconciliation window
- Stock opening date: 2026-08-01.
- Latest physical dip used: 2026-11-15.
- Sales data extends through 2026-11-15.
- Purchase/filling data extends through 2026-11-10.
- User confirmed that the 2026-08-01 opening stock figures (MS 9,356 L; HSD 7,500 L) are correct.

## Verified purchase-to-filling linkage totals
| Fuel | Purchase rows | Purchase quantity | Filling rows | Filling quantity |
|---|---:|---:|---:|---:|
| MS | 14 | 109,000 L | 14 | 109,000 L |
| HSD | 15 | 151,000 L | 15 | 151,000 L |

Purchase quantity and tank-filling quantity match exactly for both fuels in the current Test payload.

## Book stock vs physical dip
Formula: Opening Stock + Tank Fillings - Canonical Net Sales.

| Fuel | Opening | Purchases / Fillings | Canonical net sales | Calculated book stock | Physical dip (15-Nov) | Dip minus book |
|---|---:|---:|---:|---:|---:|---:|
| MS | 9,356.00 L | 109,000.00 L | 114,463.941 L | 3,892.059 L | 11,653.00 L | +7,760.941 L |
| HSD | 7,500.00 L | 151,000.00 L | 148,225.450 L | 10,274.550 L | 15,094.00 L | +4,819.450 L |

Canonical sales aggregation deduplicated repeated nozzle/day rows by sale ID. No source rows were deleted or edited.

## Duplicate audit
- 25 repeated date/fuel/nozzle groups were observed in the Test payload.
- The groups have one distinct sale ID per group; most are exact repeated copies. Two CNG groups have formatting-level quantity differences and must remain in forensic review.
- No duplicate sale was deleted or rewritten during this audit.

## Updated interpretation and next investigation
- The user has confirmed the 2026-08-01 opening stock, so opening stock is no longer an outstanding verification item.
- Purchase-to-filling quantities reconcile exactly.
- Large positive physical-dip variances remain for MS and HSD on 2026-11-15.
- The next diagnostic step is a date-by-date roll-forward from 2026-08-01 to 2026-11-15, comparing each day's book closing against the next available physical dip, and isolating the first date where the variance appears or materially changes.
- Review the original daily DSR, nozzle meter readings, net sales/testing treatment, tank receipt timestamps and dip entries around that first divergence.
- Do not auto-adjust opening stock, purchases, sales, or physical dip to force a match.
- This report is diagnostic only. Production remains untouched.
