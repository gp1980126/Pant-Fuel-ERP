import React, { useEffect, useRef, useState } from "react";
import { assertAiReadOnlyAction } from "../ai/stationmitraAiGuard.js";
import { analyzeStationData } from "../ai/stationmitraSmartEngine.js";

const SUGGESTIONS = [
  "आज की बिक्री और collection समझाओ",
  "किस product में variance है?",
  "आज के density और jump alerts बताओ",
  "किस party का outstanding ज्यादा है?",
  "Stock और dip समझाओ"
];

export default function SmartAiPanel({ data, session }) {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([
    { role: "ai", text: "नमस्ते! मैं StationMitra Smart AI हूँ। मैं आपके authorized station data को read-only तरीके से समझा सकता हूँ।" }
  ]);
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const recognitionBaseRef = useRef("");

  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
      recognitionRef.current = null;
    };
  }, []);

  function startVoiceQuestion() {
    if (busy || listening || typeof window === "undefined") return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages(m => [...m, { role: "ai", text: "आपके browser में voice input उपलब्ध नहीं है। Android पर Chrome में microphone permission के साथ यह सुविधा इस्तेमाल करें।" }]);
      return;
    }

    try { recognitionRef.current?.stop(); } catch {}
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognitionBaseRef.current = question.trim();
    let finalText = "";

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) finalText += text;
        else interim += text;
      }
      const combined = [recognitionBaseRef.current, finalText, interim].filter(Boolean).join(" ").trim();
      setQuestion(combined);
    };
    recognition.onerror = (event) => {
      setListening(false);
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setMessages(m => [...m, { role: "ai", text: "Voice input शुरू नहीं हो पाया। Microphone permission और Chrome की mic setting check करें।" }]);
      }
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
      const spoken = [recognitionBaseRef.current, finalText].filter(Boolean).join(" ").trim();
      if (spoken) {
        setQuestion(spoken);
        window.setTimeout(() => submitQuestion(spoken), 0);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopVoiceQuestion() {
    try { recognitionRef.current?.stop(); } catch {}
  }

  async function browserSpeak(text) {
    if (!voiceOn || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const value = String(text || "").replace(/\\s+/g, " ").trim();
    if (!value) return;

    const voices = synth.getVoices ? synth.getVoices() : [];
    const hi = voices.find(v => /^hi-IN$/i.test(v.lang)) || voices.find(v => /^hi/i.test(v.lang));
    const en = voices.find(v => /^en-IN$/i.test(v.lang)) || voices.find(v => /^en-GB$/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    const parts = value.match(/[\\u0900-\\u097F]+|[A-Za-z][A-Za-z0-9+./%-]*|[0-9]+(?:[.,][0-9]+)*/g) || [value];
    const queue = [];
    let buffer = "";
    let lastVoice = null;
    parts.forEach(part => {
      const isHindi = /[\\u0900-\\u097F]/.test(part);
      const voice = isHindi ? hi : en;
      if (lastVoice === null || voice === lastVoice) buffer += (buffer ? " " : "") + part;
      else { queue.push({ text: buffer, voice: lastVoice, hindi: /[\\u0900-\\u097F]/.test(buffer) }); buffer = part; }
      lastVoice = voice;
    });
    if (buffer) queue.push({ text: buffer, voice: lastVoice, hindi: /[\\u0900-\\u097F]/.test(buffer) });
    let index = 0;
    const playNext = () => {
      if (index >= queue.length) return;
      const item = queue[index++];
      const u = new SpeechSynthesisUtterance(item.text);
      u.lang = item.hindi ? "hi-IN" : "en-IN";
      if (item.voice) u.voice = item.voice;
      u.rate = item.hindi ? 0.92 : 0.96;
      u.pitch = 1.02;
      u.volume = 1;
      u.onend = playNext;
      u.onerror = playNext;
      synth.speak(u);
    };
    playNext();
  }

  async function speak(text) {
    if (!voiceOn || typeof window === "undefined") return;
    const value = String(text || "").trim();
    if (!value) return;

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value })
      });

      if (!response.ok) throw new Error("premium TTS unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = 1;
      audio.onended = () => URL.revokeObjectURL(url);
      audio.onerror = () => { URL.revokeObjectURL(url); browserSpeak(value); };
      await audio.play();
    } catch {
      // Safe fallback: Android/browser Hindi + Indian-English voices.
      browserSpeak(value);
    }
  }

  function submitQuestion(rawQuestion) {
    const q = String(rawQuestion || "").trim();
    if (!q || busy) return;
    assertAiReadOnlyAction("explain");
    setBusy(true);
    const answer = analyzeStationData(data, q);
    speak(answer);
    setMessages(m => [...m, { role: "user", text: q }, { role: "ai", text: answer }]);
    setQuestion("");
    window.setTimeout(() => setBusy(false), 120);
  }

  function submit(e) {
    e.preventDefault();
    submitQuestion(question);
  }

  return (
    <section className="smart-ai-page" aria-label="StationMitra Smart AI">
      <style>{`
        .smart-ai-page{max-width:980px;margin:0 auto;padding-bottom:100px}
        .smart-ai-hero{background:linear-gradient(135deg,#173b82,#2878d7);color:#fff;border-radius:18px;padding:22px;margin-bottom:14px;box-shadow:0 12px 30px rgba(23,59,130,.16)}
        .smart-ai-hero h2{margin:0 0 6px;font-size:24px}.smart-ai-hero p{margin:0;opacity:.9;font-size:13px}
        .smart-ai-scope{margin-top:12px;display:flex;gap:7px;flex-wrap:wrap}.smart-ai-scope span{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.25);padding:5px 9px;border-radius:999px;font-size:10px}
        .smart-ai-suggestions{display:flex;gap:8px;overflow-x:auto;padding:4px 0 12px}.smart-ai-suggestions button{white-space:nowrap;border:1px solid #d8e2ef;background:#fff;border-radius:999px;padding:8px 11px;font-size:11px;font-weight:700;cursor:pointer}
        .smart-ai-chat{background:#fff;border:1px solid #e1e8f0;border-radius:14px;padding:14px;min-height:260px;box-shadow:0 5px 18px rgba(15,23,42,.05)}
        .smart-ai-msg{margin:9px 0;padding:11px 12px;border-radius:12px;white-space:pre-wrap;line-height:1.55;font-size:12px;max-width:88%}
        .smart-ai-msg.user{margin-left:auto;background:#edf5ff;color:#123c73}.smart-ai-msg.ai{background:#f7f9fc;color:#27364b}
        .smart-ai-form{display:flex;gap:8px;margin-top:10px}.smart-ai-form input{flex:1;min-width:0;padding:12px;border:1px solid #ccd8e6;border-radius:10px;font-size:13px}.smart-ai-form button{border:0;background:#173b82;color:#fff;border-radius:10px;padding:0 14px;font-weight:800;cursor:pointer}.smart-ai-mic{background:#0f766e!important;min-width:52px}.smart-ai-mic.listening{background:#b91c1c!important;animation:smartAiPulse 1s infinite}@keyframes smartAiPulse{50%{transform:scale(1.04);opacity:.8}}
        .smart-ai-note{font-size:10px;color:#64748b;margin-top:9px}
        @media(max-width:600px){.smart-ai-page{padding:4px 0 90px}.smart-ai-hero{border-radius:14px;padding:17px}.smart-ai-form button{padding:0 13px}}
      `}</style>

      <div className="smart-ai-hero">
        <h2>🤖 StationMitra Smart AI</h2>
        <p>Sales, collection, stock, party outstanding और business alerts को समझने वाला read-only assistant.</p>
        <div className="smart-ai-scope">
          <span>👤 {session?.role || "User"}</span>
          <span>🔒 Read Only</span>
          <span>☁️ Authorized Data</span>
          <span>📅 FY Scoped</span>
        </div>
      </div>

      <div className="smart-ai-suggestions">
        {SUGGESTIONS.map(s => <button key={s} type="button" onClick={() => setQuestion(s)}>{s}</button>)}
      </div>

      <div className="smart-ai-chat">
        {messages.map((m, i) => <div key={i} className={`smart-ai-msg ${m.role === "user" ? "user" : "ai"}`}><b>{m.role === "user" ? "आप" : "Smart AI"}:</b> {m.text}</div>)}
        <form className="smart-ai-form" onSubmit={submit}>
          <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="जैसे: आज की बिक्री बताओ" aria-label="Smart AI question" />
          <button type="button" className={`smart-ai-mic ${listening ? "listening" : ""}`} onClick={listening ? stopVoiceQuestion : startVoiceQuestion} aria-label={listening ? "Voice input रोकें" : "Voice से सवाल पूछें"}>{listening ? "⏹️" : "🎙️"}</button><button type="submit">{busy ? "..." : "पूछें"}</button>
        </form>
        <div className="smart-ai-note">AI accounting entries को खुद नहीं बदलता। Answers authoritative StationMitra calculations से आते हैं। 🎙️ Mic दबाकर हिंदी/Hinglish में बोलें; बोलना पूरा होते ही सवाल अपने-आप AI को भेजा जाएगा। <button type="button" onClick={() => { setVoiceOn(v => !v); if (voiceOn && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} style={{marginLeft:8,border:0,borderRadius:8,padding:"5px 9px",fontWeight:700}}>{voiceOn ? "🔊 आवाज़ ON" : "🔇 आवाज़ OFF"}</button></div>
      </div>
    </section>
  );
}
