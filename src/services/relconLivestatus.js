/**
 * RELCON live totalizer reader — READ ONLY.
 *
 * This module only reads the installed RELCON local web application.
 * It never calls pump-control, shift-close, save, or transaction endpoints.
 *
 * Local Vite development should proxy /relcon-api -> http://192.168.0.188
 * so the browser does not need CORS access to the RELCON controller.
 */

export const RELCON_PROXY_PATH = import.meta.env.VITE_RELCON_PROXY_PATH || "/relcon-api/function_livestatus.php";

function isLocalStationMode() {
  const host = String(window.location.hostname || "").toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

const PHYSICAL_PUMP_ORDER = {
  HSD: [1, 2, 9, 10],
  MS: [3, 4, 5, 6],
  CNG: [7, 8],
};

const LOGICAL_NOZZLES = {
  MS: ["MS-1", "MS-2", "MS-3", "MS-4"],
  HSD: ["HSD-1", "HSD-2", "HSD-3", "HSD-4"],
  CNG: ["CNG-1", "CNG-2"],
};

function asNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeResponse(payload) {
  if (!payload) return null;
  if (typeof payload === "string") {
    try { return JSON.parse(payload); } catch { return null; }
  }
  return payload;
}

function getNozzleRows(payload) {
  const p = normalizeResponse(payload);
  const candidates = [
    p?.allnozzlestatus,
    p?.allNozzleStatus,
    p?.data?.allnozzlestatus,
    p?.data?.allNozzleStatus,
  ];
  const rows = candidates.find(Array.isArray);
  return Array.isArray(rows) ? rows.filter(Boolean) : [];
}

/**
 * RELCON's response uses Pump_No as the physical dispenser/nozzle number
 * (for example the UI labels Gilbarco[5-9] / [5-10] correspond to Pump_No 9/10).
 * Nozzle_No is retained as part of the physical key for future multi-nozzle
 * dispensers.
 */
function physicalKey(row) {
  return [
    String(row?.DU_No ?? ""),
    String(row?.Pump_No ?? ""),
    String(row?.Nozzle_No ?? ""),
  ].join(":");
}

export function mapRelconNozzleRows(rows) {
  const byFuel = { MS: [], HSD: [], CNG: [] };

  rows.forEach(row => {
    const fuel = String(row?.Grade_Name || "").trim().toUpperCase();
    const pumpNo = asNumber(row?.Pump_No);
    const total = asNumber(row?.Nozzle_Total);
    if (!byFuel[fuel] || pumpNo === null || total === null) return;

    byFuel[fuel].push({
      fuel,
      pumpNo,
      total,
      nozzleNo: asNumber(row?.Nozzle_No),
      duNo: asNumber(row?.DU_No),
      physicalKey: physicalKey(row),
      raw: row,
    });
  });

  const result = {};

  Object.entries(PHYSICAL_PUMP_ORDER).forEach(([fuel, pumpOrder]) => {
    const logical = LOGICAL_NOZZLES[fuel] || [];
    const available = byFuel[fuel].slice();

    pumpOrder.forEach((pumpNo, index) => {
      const row = available.find(x => x.pumpNo === pumpNo);
      if (!row || !logical[index]) return;

      result[logical[index]] = {
        logicalNozzle: logical[index],
        fuel,
        closing: row.total,
        pumpNo: row.pumpNo,
        nozzleNo: row.nozzleNo,
        duNo: row.duNo,
        physicalKey: row.physicalKey,
      };
    });
  });

  return result;
}

export async function fetchRelconLiveStatus({
  endpoint = RELCON_PROXY_PATH,
  signal,
} = {}) {
  if (!isLocalStationMode()) {
    throw new Error("RELCON read केवल StationMitra Local Station Mode में उपलब्ध है। Cloud/Vercel से 192.168.0.188 तक पहुँचना सुरक्षित/संभव नहीं है।");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: "",
    cache: "no-store",
    signal,
  });

  if (!response.ok) {
    throw new Error(`RELCON HTTP ${response.status}`);
  }

  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("RELCON response JSON नहीं है।");
  }

  const rows = getNozzleRows(payload);
  if (!rows.length) {
    throw new Error("RELCON response में allnozzlestatus नहीं मिला।");
  }

  return {
    fetchedAt: new Date().toISOString(),
    rows,
    mapping: mapRelconNozzleRows(rows),
    raw: payload,
  };
}
