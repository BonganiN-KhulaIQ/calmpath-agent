import type { ToolFn } from "./types";

/**
 * Summarizes only non-sensitive session metadata (turn count) — never raw
 * conversation text, per SAFETY.md's "no raw text in safety state" rule.
 */
export const sessionSummary: ToolFn = (ctx) => ({
  toolId: "session_summary",
  summary: "Here's a quick recap of this conversation so far.",
  details: [
    `We've exchanged messages during this session (current check-in level: ${ctx.tier}).`,
    "I don't keep a saved transcript — this recap only reflects what's active in this session right now.",
  ],
});
