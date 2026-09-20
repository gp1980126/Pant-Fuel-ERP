export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "AI provider is not configured" });

  try {
    const { question, data, authoritativeAnswer } = req.body || {};
    const q = String(question || "").trim();
    if (!q) return res.status(400).json({ error: "Question is required" });

    const safeData = data && typeof data === "object" ? data : {};
    const compact = {
      sales: Array.isArray(safeData.sales) ? safeData.sales.slice(-300) : [],
      credits: Array.isArray(safeData.credits) ? safeData.credits.slice(-300) : [],
      parties: Array.isArray(safeData.parties) ? safeData.parties : [],
      ledgerOpenings: Array.isArray(safeData.ledgerOpenings) ? safeData.ledgerOpenings : [],
      ledgerPayments: Array.isArray(safeData.ledgerPayments) ? safeData.ledgerPayments.slice(-300) : [],
      dipReadings: Array.isArray(safeData.dipReadings) ? safeData.dipReadings.slice(-100) : []
    };

    const system = `You are StationMitra Smart AI, a friendly Indian petrol-pump business assistant.
Answer in natural Hindi/Hinglish matching the user's language. Never invent numbers, dates, balances, fuel quantities, prices, density, jump alerts, or business facts.
Use ONLY the supplied StationMitra data and the authoritative calculation result. If the data is insufficient, say so clearly.
Explain the answer conversationally, not as a raw dump of numbers. Read rupee amounts, litres and percentages naturally.
You are read-only: never claim to create, edit, delete, post, settle, or change accounting entries.
Keep answers concise but useful for a petrol-pump owner.`;

    const input = [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({
        question: q,
        authoritativeCalculation: String(authoritativeAnswer || ""),
        stationData: compact
      }) }
    ];

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: "gpt-5.6-luna", input, max_output_tokens: 500 })
    });

    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.message || "AI provider error" });

    const answer = payload?.output_text || payload?.output?.flatMap(x => x.content || []).map(x => x.text || "").join("") || "";
    if (!answer.trim()) return res.status(502).json({ error: "AI returned an empty answer" });

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ answer: answer.trim() });
  } catch (error) {
    return res.status(500).json({ error: "AI request failed" });
  }
}
