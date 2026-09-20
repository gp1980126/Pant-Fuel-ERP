import React, { useState } from "react";
import { assertAiReadOnlyAction } from "../ai/stationmitraAiGuard.js";

const SUGGESTIONS = [
  "आज की बिक्री और collection समझाओ",
  "किस product में variance है?",
  "आज के density और jump alerts बताओ",
  "किस party का outstanding ज्यादा है?"
];

export default function SmartAiPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);

  function submit(e) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    assertAiReadOnlyAction("explain");
    setMessages((m) => [...m, { role: "user", text: q }]);
    setQuestion("");
  }

  return (
    <section aria-label="StationMitra Smart AI">
      <h2>Smart AI</h2>
      <p>Business data समझने और alerts explain करने के लिए read-only assistant.</p>
      <div>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" onClick={() => setQuestion(s)}>{s}</button>
        ))}
      </div>
      <form onSubmit={submit}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="जैसे: आज HSD में कोई unusual variance है?"
          aria-label="Smart AI question"
        />
        <button type="submit">Ask AI</button>
      </form>
      <div>
        {messages.map((m, i) => <p key={i}><b>{m.role}:</b> {m.text}</p>)}
      </div>
    </section>
  );
}
