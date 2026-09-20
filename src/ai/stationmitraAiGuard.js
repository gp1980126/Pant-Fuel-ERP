/**
 * Read-only guard for StationMitra Smart AI.
 * AI may inspect scoped business data but must not mutate accounting state.
 */
export function assertAiReadOnlyAction(action) {
  const allowed = new Set(["summarize", "explain", "detect", "compare", "forecast"]);
  if (!allowed.has(action)) {
    throw new Error("Smart AI is read-only for this build.");
  }
  return true;
}

export function buildAiContext({ userId, role, stationId, financialYear, dateFrom, dateTo }) {
  return Object.freeze({
    userId,
    role,
    stationId,
    financialYear,
    dateFrom,
    dateTo
  });
}
