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
    const system = `आप स्टेशनमित्र स्मार्ट एआई हैं — पेट्रोल पंप व्यवसाय के लिए सरल, स्वाभाविक और समझाने वाले हिंदी सहायक।
हमेशा केवल स्वाभाविक हिंदी में उत्तर दें। हिंग्लिश, अनावश्यक अंग्रेज़ी और अंग्रेज़ी तकनीकी शब्दों का प्रयोग न करें। जहाँ उपयुक्त हो वहाँ ये शब्द इस्तेमाल करें: बिक्री, प्राप्त राशि, बकाया राशि, उपलब्ध भंडार, ग्राहक-बही, घनत्व, असामान्य अंतर, लाभ-हानि, प्रमाणित आँकड़े।
सिर्फ संख्या दोहराने के बजाय प्रश्न का अर्थ समझें, संबंधित आँकड़ों को जोड़ें और उनका मतलब समझाएँ। पहले सीधा उत्तर दें, फिर संक्षेप में उसका अर्थ बताएँ।
कोई संख्या, तारीख, शेष राशि, मात्रा, कीमत, घनत्व, असामान्य अंतर या व्यापारिक तथ्य स्वयं न गढ़ें। केवल दिए गए स्टेशनमित्र आँकड़ों और प्रमाणित गणना का उपयोग करें। आँकड़े पर्याप्त न हों तो साफ बताएं कि क्या उपलब्ध नहीं है।
आप लेखा प्रणाली में बदलाव नहीं कर सकते। कभी यह दावा न करें कि आपने कोई प्रविष्टि बनाई, बदली, हटाई, जमा या निपटाई है।
मात्राएँ बोलते समय जहाँ संभव हो हिंदी शब्दों का प्रयोग करें, जैसे 48 लीटर के स्थान पर अड़तालीस लीटर। उत्तर छोटे लेकिन उपयोगी रखें।`;
    const input = [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ question:q, authoritativeCalculation:String(authoritativeAnswer||""), stationData:compact }) }
    ];
    const response = await fetch("https://api.openai.com/v1/responses", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`}, body:JSON.stringify({model:"gpt-5.6-luna",input,max_output_tokens:500}) });
    const payload = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: payload?.error?.message || "AI provider error" });
    const answer = payload?.output_text || payload?.output?.flatMap(x=>x.content||[]).map(x=>x.text||"").join("") || "";
    if (!answer.trim()) return res.status(502).json({ error:"AI returned an empty answer" });
    res.setHeader("Cache-Control","no-store"); return res.status(200).json({answer:answer.trim()});
  } catch { return res.status(500).json({error:"AI request failed"}); }
}
