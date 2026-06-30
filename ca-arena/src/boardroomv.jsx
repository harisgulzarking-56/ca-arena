import { useState, useRef, useEffect } from "react";

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,400&family=Crimson+Pro:ital,wght@0,300;0,400;0,500;1,300&display=swap');`;

const STYLES = `
  ${FONTS}
  * { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --mahogany: #1a0a06;
    --mahogany-mid: #2d1208;
    --mahogany-light: #4a1e0d;
    --felt: #0d2818;
    --felt-light: #163d24;
    --gold: #c9a84c;
    --gold-light: #e8cc7a;
    --gold-dim: #7a6030;
    --cream: #f2e8d5;
    --cream-dim: #a89878;
    --smoke: #d4c9b0;
    --blood: #8b1a1a;
    --text: #f2e8d5;
    --border: rgba(201,168,76,0.25);
  }

  body {
    background: var(--mahogany);
    font-family: 'Crimson Pro', serif;
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* HEADER */
  .header {
    background: linear-gradient(180deg, #0d0503 0%, var(--mahogany) 100%);
    border-bottom: 1px solid var(--border);
    padding: 16px 32px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .logo {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: var(--gold);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .logo span { color: var(--cream-dim); font-style: italic; font-size: 14px; margin-left: 10px; letter-spacing: 1px; text-transform: none; }

  .role-badge {
    background: var(--mahogany-light);
    border: 1px solid var(--border);
    padding: 6px 16px;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--gold-dim);
  }

  /* KEY INPUT SCREEN */
  .key-screen {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
  }

  .key-card {
    background: var(--mahogany-mid);
    border: 1px solid var(--border);
    padding: 48px;
    max-width: 480px;
    width: 100%;
    text-align: center;
  }

  .key-card h2 {
    font-family: 'Playfair Display', serif;
    font-size: 28px;
    color: var(--gold);
    margin-bottom: 8px;
  }

  .key-card p {
    color: var(--cream-dim);
    font-size: 16px;
    line-height: 1.6;
    margin-bottom: 32px;
  }

  .key-input {
    width: 100%;
    background: var(--mahogany);
    border: 1px solid var(--border);
    color: var(--cream);
    font-family: 'Crimson Pro', serif;
    font-size: 15px;
    padding: 12px 16px;
    outline: none;
    margin-bottom: 16px;
    transition: border-color 0.2s;
  }

  .key-input:focus { border-color: var(--gold); }

  .btn-primary {
    background: var(--gold);
    color: var(--mahogany);
    border: none;
    padding: 12px 32px;
    font-family: 'Playfair Display', serif;
    font-size: 15px;
    letter-spacing: 1px;
    cursor: pointer;
    width: 100%;
    transition: background 0.2s;
  }

  .btn-primary:hover { background: var(--gold-light); }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  /* SCENARIO SELECT */
  .scenario-screen {
    flex: 1;
    padding: 40px;
    max-width: 900px;
    margin: 0 auto;
    width: 100%;
  }

  .screen-title {
    font-family: 'Playfair Display', serif;
    font-size: 32px;
    color: var(--gold);
    margin-bottom: 8px;
  }

  .screen-sub {
    color: var(--cream-dim);
    font-size: 16px;
    margin-bottom: 40px;
  }

  .scenario-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 20px;
  }

  .scenario-card {
    background: var(--mahogany-mid);
    border: 1px solid var(--border);
    padding: 28px;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }

  .scenario-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 3px; height: 100%;
    background: var(--gold);
    transform: scaleY(0);
    transition: transform 0.2s;
    transform-origin: bottom;
  }

  .scenario-card:hover { border-color: var(--gold); transform: translateY(-2px); }
  .scenario-card:hover::before { transform: scaleY(1); }

  .scenario-company {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--gold-dim);
    margin-bottom: 10px;
  }

  .scenario-title {
    font-family: 'Playfair Display', serif;
    font-size: 20px;
    color: var(--cream);
    margin-bottom: 10px;
    line-height: 1.3;
  }

  .scenario-desc {
    font-size: 14px;
    color: var(--cream-dim);
    line-height: 1.6;
  }

  .scenario-tag {
    display: inline-block;
    margin-top: 16px;
    font-size: 11px;
    letter-spacing: 1px;
    padding: 3px 10px;
    border: 1px solid var(--blood);
    color: var(--blood);
  }

  /* BOARDROOM */
  .boardroom {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0;
  }

  .meeting-header {
    background: var(--mahogany-mid);
    border-bottom: 1px solid var(--border);
    padding: 16px 32px;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .meeting-company {
    font-size: 11px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--gold-dim);
  }

  .meeting-title {
    font-family: 'Playfair Display', serif;
    font-size: 18px;
    color: var(--cream);
  }

  .meeting-sep { color: var(--border); }

  .boardroom-body {
    flex: 1;
    display: flex;
    overflow: hidden;
    height: calc(100vh - 160px);
  }

  /* NPC PANEL */
  .npc-panel {
    width: 220px;
    background: #0f0604;
    border-right: 1px solid var(--border);
    padding: 24px 0;
    overflow-y: auto;
    flex-shrink: 0;
  }

  .npc-panel-title {
    font-size: 10px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--gold-dim);
    padding: 0 20px 16px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 16px;
  }

  .npc-item {
    padding: 12px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: background 0.15s;
  }

  .npc-item.speaking { background: rgba(201,168,76,0.08); }

  .npc-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Playfair Display', serif;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
    border: 2px solid transparent;
    transition: border-color 0.2s;
  }

  .npc-item.speaking .npc-avatar { border-color: var(--gold); }

  .npc-info { overflow: hidden; }

  .npc-name {
    font-size: 13px;
    color: var(--cream);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .npc-role {
    font-size: 11px;
    color: var(--cream-dim);
    white-space: nowrap;
  }

  .speaking-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--gold);
    animation: pulse 1s infinite;
    flex-shrink: 0;
  }

  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

  /* TRANSCRIPT */
  .transcript-area {
    flex: 1;
    overflow-y: auto;
    padding: 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--felt);
    background-image:
      radial-gradient(ellipse at 20% 0%, rgba(22,61,36,0.6) 0%, transparent 60%),
      radial-gradient(ellipse at 80% 100%, rgba(13,40,24,0.8) 0%, transparent 50%);
  }

  .msg-block {
    display: flex;
    gap: 14px;
    padding: 14px 0;
    border-bottom: 1px solid rgba(201,168,76,0.06);
    animation: fadeIn 0.4s ease;
  }

  @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

  .msg-block.player { flex-direction: row-reverse; }

  .msg-avatar {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: 'Playfair Display', serif;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
    align-self: flex-start;
    margin-top: 2px;
  }

  .msg-content { flex: 1; max-width: 75%; }
  .msg-block.player .msg-content { text-align: right; }

  .msg-speaker {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--gold-dim);
    margin-bottom: 5px;
  }

  .msg-block.player .msg-speaker { color: #4a7c9b; }

  .msg-text {
    font-size: 16px;
    line-height: 1.7;
    color: var(--cream);
  }

  .msg-block.player .msg-text {
    background: rgba(30,60,90,0.4);
    padding: 10px 14px;
    display: inline-block;
    text-align: left;
  }

  .msg-block.system .msg-content {
    background: rgba(201,168,76,0.06);
    border-left: 3px solid var(--gold-dim);
    padding: 12px 16px;
    border-radius: 0;
  }

  .msg-block.system .msg-text {
    color: var(--cream-dim);
    font-style: italic;
    font-size: 15px;
  }

  .msg-block.feedback .msg-content {
    background: rgba(139,26,26,0.15);
    border: 1px solid rgba(139,26,26,0.4);
    padding: 16px 20px;
    width: 100%;
  }

  .msg-block.feedback .msg-speaker { color: #c0624a; letter-spacing: 1px; }

  .feedback-scores {
    display: flex;
    gap: 20px;
    margin-top: 12px;
    flex-wrap: wrap;
  }

  .score-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }

  .score-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: var(--cream-dim); }

  .score-bar-wrap { width: 60px; height: 4px; background: rgba(255,255,255,0.1); }

  .score-bar { height: 100%; background: var(--gold); transition: width 0.5s; }

  .score-val { font-size: 12px; color: var(--gold); font-family: 'Playfair Display', serif; }

  /* INPUT */
  .input-area {
    background: var(--mahogany-mid);
    border-top: 1px solid var(--border);
    padding: 20px 32px;
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }

  .speech-input {
    flex: 1;
    background: var(--mahogany);
    border: 1px solid var(--border);
    color: var(--cream);
    font-family: 'Crimson Pro', serif;
    font-size: 16px;
    padding: 12px 16px;
    resize: none;
    outline: none;
    min-height: 52px;
    max-height: 140px;
    line-height: 1.5;
    transition: border-color 0.2s;
  }

  .speech-input:focus { border-color: var(--gold-dim); }
  .speech-input::placeholder { color: rgba(168,152,120,0.4); }

  .btn-speak {
    background: var(--gold);
    color: var(--mahogany);
    border: none;
    padding: 12px 24px;
    font-family: 'Playfair Display', serif;
    font-size: 14px;
    letter-spacing: 1px;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
    align-self: flex-end;
  }

  .btn-speak:hover:not(:disabled) { background: var(--gold-light); }
  .btn-speak:disabled { opacity: 0.4; cursor: not-allowed; }

  .btn-back {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--cream-dim);
    padding: 8px 18px;
    font-family: 'Crimson Pro', serif;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
    letter-spacing: 1px;
  }
  .btn-back:hover { border-color: var(--gold-dim); color: var(--gold); }

  .thinking-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    color: var(--cream-dim);
    font-style: italic;
    font-size: 14px;
  }

  .dot-anim span {
    display: inline-block;
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--gold-dim);
    margin: 0 2px;
    animation: dotBounce 1.2s infinite;
  }
  .dot-anim span:nth-child(2){animation-delay:0.2s}
  .dot-anim span:nth-child(3){animation-delay:0.4s}
  @keyframes dotBounce{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}

  .error-msg { color: #c0624a; font-size: 13px; padding: 8px 0; }

  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--mahogany-light); }
`;

const NPCS = [
  { id: "ceo", name: "Mr. Tariq Malik", role: "Chief Executive Officer", initials: "TM", color: "#8b1a1a", bg: "#3d0b0b",
    persona: "You are Tariq Malik, CEO of the company. You are visionary, decisive, and slightly impatient with detail-focused people. You think big picture. You are demanding but fair. You occasionally cut people off. You rarely praise — when you do, it lands heavy." },
  { id: "cfo", name: "Ms. Aisha Noor", role: "Chief Financial Officer", initials: "AN", color: "#2a6496", bg: "#0d2535",
    persona: "You are Aisha Noor, CFO. You are methodical, data-driven, and skeptical of optimism. You always ask about cash flow, margins, and risk. You speak in numbers when possible. You challenge weak financial reasoning firmly but professionally." },
  { id: "investor", name: "Mr. Fawad Rahim", role: "Lead Investor", initials: "FR", color: "#5a7a3a", bg: "#1e2e12",
    persona: "You are Fawad Rahim, lead investor. You are blunt, ROI-obsessed, and have seen a hundred pitches. You cut through narrative to ask what the return is. You have little patience for vague answers. Occasionally sardonic." },
  { id: "legal", name: "Ms. Sana Qureshi", role: "Legal Counsel", initials: "SQ", color: "#7a5a2a", bg: "#2e2010",
    persona: "You are Sana Qureshi, legal counsel. You are cautious, procedural, and always flag risk. You speak in terms of liability, compliance, and exposure. You are polite but firm when something is legally problematic." },
];

const SCENARIOS = [
  { id: 1, company: "FreshMart", title: "Q3 Revenue Shortfall — Emergency Board Review", difficulty: "Intern", topic: "Revenue recognition & cost control",
    brief: "FreshMart's Q3 revenue came in 18% below forecast. COGS jumped due to a supplier contract revision. The board has been called in. As the intern who prepared the variance report, you must present your findings and recommendations." },
  { id: 2, company: "IronForge Industries", title: "Acquisition Proposal — Should We Buy SteelPath Ltd?", difficulty: "Junior Analyst", topic: "Business combinations & due diligence",
    brief: "IronForge is evaluating a PKR 2.4 billion acquisition of SteelPath Ltd, a smaller competitor with patchy financials. The deal could double capacity — or double liabilities. You've been asked to present your analysis to the board." },
  { id: 3, company: "CrescentLogix", title: "Inventory Write-Down — Audit Committee Session", difficulty: "Intern", topic: "IAS 2 Inventories & impairment",
    brief: "CrescentLogix holds PKR 800M in slow-moving tech inventory now worth far less after a market shift. The audit committee wants to understand the accounting treatment and its P&L impact. You prepared the memo." },
];

const SYSTEM_PROMPT = (npcs, scenario, history, playerRole) => `
You are running a boardroom meeting simulation set in the CA Arena universe — a fictional Pakistani business world. The meeting is about: ${scenario.title} at ${scenario.company}.

BACKGROUND: ${scenario.brief}

THE BOARD:
${npcs.map(n => `- ${n.name} (${n.role}): ${n.persona}`).join('\n')}

THE PLAYER: ${playerRole} — a young CA student participating in this board meeting.

CONVERSATION SO FAR:
${history.map(m => `${m.speaker}: ${m.text}`).join('\n')}

YOUR TASK:
The player just spoke. Generate the board's response as a realistic meeting moment. Follow these rules:

1. NOT all board members respond every time. Pick 1-3 who would naturally react. Decide based on what was said.
2. They may agree, disagree, build on it, challenge it, or have side exchanges with each other.
3. Keep each person's response to 2-4 sentences max. This is a meeting, not a speech.
4. After their responses, include a FEEDBACK block evaluating the player's last statement.
5. Be harsh but fair. This is how CA students learn.

Respond ONLY in this JSON format:
{
  "responses": [
    { "npc_id": "ceo|cfo|investor|legal", "text": "..." },
    ...
  ],
  "feedback": {
    "overall": "2-3 sentence honest assessment of what the player said",
    "scores": {
      "clarity": 0-10,
      "financial_reasoning": 0-10,
      "confidence": 0-10,
      "relevance": 0-10
    },
    "improve": "One specific, actionable thing they should do differently"
  }
}
`;

export function BoardroomV() {
  const [apiKey, setApiKey] = useState("");
  const [phase, setPhase] = useState("key"); // key | scenario | meeting
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speakingNpcs, setSpeakingNpcs] = useState([]);
  const [error, setError] = useState("");
  const transcriptRef = useRef(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const startMeeting = (sc) => {
    setScenario(sc);
    setMessages([
      { type: "system", text: `${sc.company} Board Meeting convened. ${sc.brief}` },
      { type: "npc", npc_id: "ceo", speaker: "Mr. Tariq Malik", text: "Let's get started. We don't have all day. I want to hear from our analyst — walk us through what happened and what you recommend." }
    ]);
    setPhase("meeting");
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const playerText = input.trim();
    setInput("");
    setError("");

    const playerMsg = { type: "player", speaker: "You (Intern)", text: playerText };
    const newMessages = [...messages, playerMsg];
    setMessages(newMessages);
    setLoading(true);

    const history = newMessages.filter(m => m.type === "player" || m.type === "npc").map(m => ({
      speaker: m.speaker,
      text: m.text
    }));

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM_PROMPT(NPCS, scenario, history, "Intern"),
          messages: [{ role: "user", content: "Generate the board's response and feedback now." }]
        })
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      const raw = data.content[0].text;
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);

      const respondingIds = parsed.responses.map(r => r.npc_id);
      setSpeakingNpcs(respondingIds);

      const npcMessages = parsed.responses.map(r => {
        const npc = NPCS.find(n => n.id === r.npc_id);
        return { type: "npc", npc_id: r.npc_id, speaker: npc?.name || r.npc_id, text: r.text };
      });

      const feedbackMsg = parsed.feedback ? {
        type: "feedback",
        speaker: "Board Assessment",
        text: parsed.feedback.overall,
        scores: parsed.feedback.scores,
        improve: parsed.feedback.improve
      } : null;

      setMessages(prev => [...prev, ...npcMessages, ...(feedbackMsg ? [feedbackMsg] : [])]);
      setTimeout(() => setSpeakingNpcs([]), 3000);

    } catch (e) {
      setError("API error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const npcAvatarStyle = (npc) => ({
    background: npc.bg,
    color: npc.color,
    border: `2px solid ${npc.color}44`
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">
        <div className="header">
          <div className="logo">CA Arena <span>Boardroom</span></div>
          {phase === "meeting" && scenario && (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="role-badge">Intern</div>
              <button className="btn-back" onClick={() => setPhase("scenario")}>← Exit Meeting</button>
            </div>
          )}
        </div>

        {phase === "key" && (
          <div className="key-screen">
            <div className="key-card">
              <h2>Enter the Boardroom</h2>
              <p>Paste your Anthropic API key to activate the AI board members. Your key stays in this session only — never stored.</p>
              <input
                className="key-input"
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
              <button className="btn-primary" onClick={() => apiKey.trim() && setPhase("scenario")} disabled={!apiKey.trim()}>
                Enter
              </button>
            </div>
          </div>
        )}

        {phase === "scenario" && (
          <div className="scenario-screen">
            <div className="screen-title">Select a Board Meeting</div>
            <div className="screen-sub">Choose a scenario. You will be the intern presenting to the board.</div>
            <div className="scenario-grid">
              {SCENARIOS.map(sc => (
                <div key={sc.id} className="scenario-card" onClick={() => startMeeting(sc)}>
                  <div className="scenario-company">{sc.company}</div>
                  <div className="scenario-title">{sc.title}</div>
                  <div className="scenario-desc">{sc.brief}</div>
                  <div className="scenario-tag">{sc.topic}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "meeting" && (
          <div className="boardroom">
            <div className="meeting-header">
              <div className="meeting-company">{scenario?.company}</div>
              <div className="meeting-sep">—</div>
              <div className="meeting-title">{scenario?.title}</div>
            </div>
            <div className="boardroom-body">
              <div className="npc-panel">
                <div className="npc-panel-title">Board Members</div>
                {NPCS.map(npc => (
                  <div key={npc.id} className={`npc-item ${speakingNpcs.includes(npc.id) ? "speaking" : ""}`}>
                    <div className="npc-avatar" style={npcAvatarStyle(npc)}>{npc.initials}</div>
                    <div className="npc-info">
                      <div className="npc-name">{npc.name.split(" ").slice(-1)[0]}</div>
                      <div className="npc-role">{npc.role.split(" ").slice(0, 2).join(" ")}</div>
                    </div>
                    {speakingNpcs.includes(npc.id) && <div className="speaking-dot" />}
                  </div>
                ))}
                <div style={{ borderTop: "1px solid var(--border)", margin: "16px 0 0" }}>
                  <div className="npc-item">
                    <div className="npc-avatar" style={{ background: "#0d2535", color: "#4a7c9b", border: "2px solid #4a7c9b44" }}>YU</div>
                    <div className="npc-info">
                      <div className="npc-name" style={{ color: "#7ab0cc" }}>You</div>
                      <div className="npc-role">Intern</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="transcript-area" ref={transcriptRef}>
                {messages.map((msg, i) => {
                  const npc = NPCS.find(n => n.id === msg.npc_id);
                  if (msg.type === "system") return (
                    <div key={i} className="msg-block system">
                      <div className="msg-content"><div className="msg-text">{msg.text}</div></div>
                    </div>
                  );
                  if (msg.type === "feedback") return (
                    <div key={i} className="msg-block feedback">
                      <div className="msg-content">
                        <div className="msg-speaker">⚖ Board Assessment</div>
                        <div className="msg-text">{msg.text}</div>
                        {msg.scores && (
                          <div className="feedback-scores">
                            {Object.entries(msg.scores).map(([k, v]) => (
                              <div key={k} className="score-item">
                                <div className="score-label">{k.replace("_", " ")}</div>
                                <div className="score-bar-wrap"><div className="score-bar" style={{ width: `${v * 10}%` }} /></div>
                                <div className="score-val">{v}/10</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {msg.improve && <div style={{ marginTop: 12, fontSize: 14, color: "var(--cream-dim)", fontStyle: "italic", borderTop: "1px solid rgba(139,26,26,0.3)", paddingTop: 10 }}>💡 {msg.improve}</div>}
                      </div>
                    </div>
                  );
                  if (msg.type === "player") return (
                    <div key={i} className="msg-block player">
                      <div className="msg-avatar" style={{ background: "#0d2535", color: "#4a7c9b" }}>YU</div>
                      <div className="msg-content">
                        <div className="msg-speaker">You</div>
                        <div className="msg-text">{msg.text}</div>
                      </div>
                    </div>
                  );
                  return (
                    <div key={i} className="msg-block">
                      <div className="msg-avatar" style={npc ? npcAvatarStyle(npc) : {}}>{npc?.initials || "?"}</div>
                      <div className="msg-content">
                        <div className="msg-speaker">{msg.speaker}</div>
                        <div className="msg-text">{msg.text}</div>
                      </div>
                    </div>
                  );
                })}
                {loading && (
                  <div className="thinking-indicator">
                    <div className="dot-anim"><span/><span/><span/></div>
                    Board is deliberating...
                  </div>
                )}
                {error && <div className="error-msg">{error}</div>}
              </div>
            </div>

            <div className="input-area">
              <textarea
                className="speech-input"
                placeholder="Address the board... (Enter to speak, Shift+Enter for new line)"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
              />
              <button className="btn-speak" onClick={sendMessage} disabled={loading || !input.trim()}>
                {loading ? "..." : "Speak"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
export default BoardroomV;