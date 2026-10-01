export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error:"Method not allowed" }); return; }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(503).json({ error:"OPENAI_API_KEY is not configured" }); return; }
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const text = String(body.text || "").trim().slice(0,3500);
    if (!text) { res.status(400).json({error:"Text is required"}); return; }
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method:"POST", headers:{"Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:"gpt-4o-mini-tts",voice:"marin",input:text,instructions:"केवल स्वाभाविक भारतीय हिंदी में बोलें। हिंग्लिश या अंग्रेज़ी शब्द न मिलाएँ। संख्याएँ, रुपये, लीटर, किलोग्राम और तारीखें साफ़ और स्वाभाविक हिंदी में बोलें। उदाहरण: 48 लीटर डीजल को अड़तालीस लीटर डीजल की तरह बोलें। आवाज़ मित्रवत, स्पष्ट और बातचीत जैसी हो; अर्थ न बदलें।",response_format:"mp3"})
    });
    if (!response.ok) { const detail=await response.text(); res.status(response.status).json({error:"TTS provider error",detail:detail.slice(0,500)}); return; }
    const audio=Buffer.from(await response.arrayBuffer()); res.setHeader("Content-Type","audio/mpeg"); res.setHeader("Cache-Control","no-store"); res.status(200).send(audio);
  } catch { res.status(500).json({error:"TTS request failed"}); }
}
