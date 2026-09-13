import React, { useCallback, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { runAgentTurn, initialAgentState } from "./agent/orchestrator";
import { mockProvider } from "./providers/mock";
import type { SessionContext } from "./agent/session";

interface DisplayMessage {
  id: number;
  role: "user" | "agent" | "system";
  text: string;
}

let messageIdCounter = 0;
function nextMessageId(): number {
  messageIdCounter += 1;
  return messageIdCounter;
}

const INTRO_MESSAGE: DisplayMessage = {
  id: 0,
  role: "system",
  text:
    "This is the start of a new, private session. Nothing you type here is saved once you " +
    "close or reset it.",
};

function App() {
  const [session, setSession] = useState<SessionContext>(() => initialAgentState());
  const [messages, setMessages] = useState<DisplayMessage[]>([INTRO_MESSAGE]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToEnd = useCallback(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (text.length === 0 || loading) return;

    setError(null);
    setMessages((prev) => [...prev, { id: nextMessageId(), role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const result = await runAgentTurn(session, text, mockProvider);
      setSession(result.session);
      setMessages((prev) => [...prev, { id: nextMessageId(), role: "agent", text: result.response }]);
    } catch {
      // Turn validation (e.g. empty/too-long input) failed before any safety
      // state changed. Session is left exactly as it was.
      setError("That message couldn't be sent — try a shorter message.");
    } finally {
      setLoading(false);
      setTimeout(scrollToEnd, 0);
    }
  }

  function handleReset() {
    setSession(initialAgentState());
    setMessages([{ ...INTRO_MESSAGE, id: nextMessageId() }]);
    setInput("");
    setError(null);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <span className="mark" aria-hidden="true">
            ⌒•
          </span>
          <span className="brand-name">CalmPath</span>
        </div>
        <button type="button" className="reset-button" onClick={handleReset}>
          Reset session
        </button>
      </header>

      <div className="disclaimer" role="note">
        CalmPath is a digital wellbeing-support companion, not a doctor, therapist, or emergency
        service, and it does not diagnose. If you are in immediate danger, please contact local
        emergency services or a crisis line right now.
      </div>

      <main className="chat-shell">
        <div className="message-list" role="log" aria-live="polite">
          {messages.map((m) => (
            <div key={m.id} className={`message message-${m.role}`}>
              {m.text.split("\n").map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ))}
          {loading && (
            <div className="message message-agent message-pending" aria-live="polite">
              <p>Thinking…</p>
            </div>
          )}
          <div ref={listEndRef} />
        </div>

        {error && (
          <div className="error-banner" role="alert">
            {error}
          </div>
        )}

        <form className="composer" onSubmit={handleSubmit}>
          <label htmlFor="composer-input" className="sr-only">
            Message CalmPath
          </label>
          <textarea
            id="composer-input"
            className="composer-input"
            placeholder="Share what's on your mind…"
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            disabled={loading}
          />
          <button type="submit" className="send-button" disabled={loading || input.trim().length === 0}>
            Send
          </button>
        </form>
        <p className="muted footnote">
          CalmPath is a research prototype for wellbeing navigation, not a substitute for
          professional care.
        </p>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
