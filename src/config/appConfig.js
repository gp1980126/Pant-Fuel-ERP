/**
 * PumpPro commercial runtime configuration.
 * Values are environment-driven so one build can serve multiple stations.
 * Existing localStorage KEY is intentionally preserved for data compatibility.
 */
const ENV = import.meta.env || {};

export const PRODUCT_NAME = "Station Mitra Professional Accounting";
export const PRODUCT_VERSION = "4.0.1-hardened-commercial";
export const PUMP_NAME = String(ENV.VITE_PUMPPRO_PUMP_NAME || "Satat Filling Station").trim() || "Satat Filling Station";
export const STATION_ID = String(ENV.VITE_PUMPPRO_STATION_ID || "YOUR-STATION-ID").trim() || "YOUR-STATION-ID";
export const COMMERCIAL_MODE = String(ENV.VITE_PUMPPRO_COMMERCIAL_MODE || "true").toLowerCase() === "true";
export const CLOUD_REQUIRED = String(ENV.VITE_PUMPPRO_CLOUD_REQUIRED || "false").toLowerCase() === "true";
