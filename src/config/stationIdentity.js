// Tenant identity (white-label) — Phase 13 multi-tenancy.
// Tracked source must stay IDENTITY-NEUTRAL so one commercial build can serve
// any petrol pump. A deployment sets these via env vars (see .env.example).
// Phase 14 will move these into per-tenant DB config resolved after login.
const ENV = import.meta.env || {};
const clean = v => String(v ?? "").trim();

export const STATION_NAME        = clean(ENV.VITE_PUMPPRO_PUMP_NAME) || "Satat Filling Station";
export const STATION_GSTIN       = clean(ENV.VITE_PUMPPRO_GSTIN);
export const STATION_STATE_CODE  = clean(ENV.VITE_PUMPPRO_STATE_CODE);
export const STATION_ADDR_LINE   = clean(ENV.VITE_PUMPPRO_ADDR);
export const STATION_DEALER_LINE = clean(ENV.VITE_PUMPPRO_DEALER_LINE);
export const STATION_JURISDICTION = clean(ENV.VITE_PUMPPRO_JURISDICTION);
export const DEFAULT_SUPPLIER    = clean(ENV.VITE_PUMPPRO_SUPPLIER);
