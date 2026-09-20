export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: "OPENAI_API_KEY is not configured" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || "").trim().slice(0, 3500);
    if (!text) {
      res.status(400).json({ error: "Text is required" });
      return;
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "marin",
        input: text,
        instructions: "Speak naturally like a friendly Indian petrol-pump business assistant. Use warm, confident, conversational Hindi/Hinglish. Pronounce Hindi words naturally in Hindi and English business/product terms naturally in Indian English. Do not sound robotic. Use short natural pauses. Read rupee amounts, litres, percentages and dates clearly. Do not translate or change the meaning of the text.",
        response_format: "mp3"
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      res.status(response.status).json({ error: "TTS provider error", detail: detail.slice(0, 500) });
      return;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(audio);
  } catch (error) {
    res.status(500).json({ error: "TTS request failed" });
  }
}
