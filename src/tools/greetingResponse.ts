import type { ToolFn } from "./types";

/**
 * Returns a warm greeting back when the student's message is essentially
 * just a greeting ("hi", "good morning", etc. — see the `GREETING` pattern
 * in agent/intent.ts for exactly what qualifies).
 *
 * Only ever reached when the policy gate has already allowed model
 * generation (T0–T2) — a session already escalated to T3 still gets the
 * forced crisis response for a later "hi", exactly as sticky escalation
 * requires. If the session is still elevated (T1/T2) when the greeting
 * arrives, this acknowledges that instead of pretending everything is
 * cheerful again.
 */
export const greetingResponse: ToolFn = ({ tier }) => {
  if (tier === "T0") {
    return {
      toolId: "greeting_response",
      summary: "Hello! I'm glad you're here.",
      details: [
        "How are you doing today?",
        "You can share as much or as little as you'd like.",
      ],
    };
  }

  return {
    toolId: "greeting_response",
    summary: "Hello — thanks for saying hi.",
    details: ["I also want to check in on how you've been feeling, since things sounded tough earlier."],
  };
};
