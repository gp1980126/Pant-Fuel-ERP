# StationMitra Android + Smart AI — Architecture

## Layers
- Existing StationMitra accounting/domain layer
- Mobile UI shell
- AI read-only service/adaptor
- Reporting/export layer
- Auth/role/pump/FY context
- Cloud synchronization

## AI safety boundary
AI receives only authorized, scoped data. It can summarize, explain and flag; it does not bypass authorization, accounting locks, FY boundaries, station isolation or audit controls.

## Android delivery
Phase 1 uses responsive/PWA-compatible React/Vite UI. Phase 2 can package the same frontend as Android (for example WebView/Capacitor) without duplicating accounting logic.

## Data context
Every AI/report query must carry:
- authenticated user
- station/pump
- financial year
- permitted role
- date range
- product scope where applicable

## Integrity
Existing cloud authorization and locked-period controls remain authoritative. Client-side AI must never write accounting state directly.
