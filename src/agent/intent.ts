export type Intent =
  | "express"
  | "understand"
  | "plan"
  | "navigate"
  | "prepare"
  | "record"
  | "learn"
  | "greeting"
  | "crisis_signal";

// Matches a message that IS essentially just a greeting (optionally with a
// short "there"/name tail and trailing punctuation) — not one that merely
// starts with a greeting word before getting into something else. That
// distinction matters: "Hi, I don't know where to find support" must still
// classify as `navigate`, not `greeting`, so it keeps getting routed to
// actual help rather than a cheerful hello. This is why the check below
// runs LAST, after every more specific/actionable intent has had a chance
// to match, and why the pattern is anchored with `^...$` rather than a bare
// substring test.
const GREETING = /^\s*(?:hi+|hello+|hey+|hiya|heya|howdy|yo+|sup|howzit|good\s+(?:morning|afternoon|evening|day))(?:\s*,?\s*(?:there|calmpath))?[\s!.,]*$/i;

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(?:emergency|kill myself|hurt myself|die)\b/.test(t)) return "crisis_signal";
  if (/(plan|routine|steps|schedule)/.test(t)) return "plan";
  if (/(find|where|support|counselling|counseling)/.test(t)) return "navigate";
  if (/(appointment|doctor|visit)/.test(t)) return "prepare";
  if (/(why|what does|explain)/.test(t)) return "understand";
  if (GREETING.test(text.trim())) return "greeting";
  return "express";
}
