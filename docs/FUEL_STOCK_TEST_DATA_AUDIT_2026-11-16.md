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


## Date-wise opening-dip roll-forward — corrected comparison

The DSR dip row represents the day's opening/opposite stock. Therefore compare the date's physical dip with the previous date's closing book stock, i.e. opening + all fillings before the dip date - all canonical net sales before the dip date. Comparing a day's dip with that same day's end-of-day book stock creates a false variance.

| Dip date | MS book before day | MS dip | MS variance | HSD book before day | HSD dip | HSD variance |
|---|---:|---:|---:|---:|---:|---:|
| 2026-08-01 | 9,356.00 | 9,356 | 0.00 | 7,500.00 | 7,500 | 0.00 |
| 2026-08-02 | 7,960.37 | 7,955 | -5.37 | 6,286.13 | 6,306 | +19.87 |
| 2026-08-03 | 7,067.02 | 7,059 | -8.02 | 5,238.05 | 5,283 | +44.95 |
| 2026-08-04 | 6,146.80 | 6,140 | -6.80 | 3,472.36 | 3,556 | +83.64 |
| 2026-08-05 | 10,332.76 | 10,294 | -38.76 | 17,085.36 | 17,036 | -49.36 |
| 2026-09-07 | 9,303.90 | 8,025 | -1,278.90 | 9,471.97 | 7,750 | -1,721.97 |
| 2026-09-08 | 8,456.88 | 8,013 | -443.88 | 7,906.30 | 7,729 | -177.30 |
| 2026-11-14 | 6,535.49 | 5,072 | -1,463.49 | 13,366.94 | 12,599 | -767.94 |
| 2026-11-15 | 5,180.92 | 11,653 | +6,472.08 | 11,896.75 | 15,094 | +3,197.25 |

### Key findings
- 2026-08-01 opening figures match exactly (user confirmed).
- Small cumulative negative drift appears by early August; it grows gradually across the period.
- 2026-09-07 is a major one-day negative dip outlier for both fuels; 2026-09-08 values move back much closer to the prior roll-forward, so inspect the original DSR/dip image for 07-Sep before treating it as a stock movement.
- 2026-11-15 has a large positive dip variance for both fuels; this is the latest dip row and needs source photo/DSR verification.
- A date-wise audit must distinguish daily opening dip from same-day closing stock and must account for purchase/filling time versus dip capture time.
- This roll-forward is diagnostic. No app_state data was modified.
