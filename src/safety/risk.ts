import type { RiskTier } from "./types";

// T3 — explicit self-harm/suicidal-intent signals. Each pattern is written to
// match how this is actually phrased in natural language (including gerunds
// and "thinking about" ideation), not just a single literal construction.
//
// Patterns 1 and 2 are intentionally NOT bare "kill/hurt/harm myself"
// catch-alls: an unguarded bare pattern would also match a deliberately
// negated statement like "I don't want to hurt myself" (a real, tested T2
// scenario — see tests/crisis-regression.test.ts), which is the opposite of
// a crisis signal. Pattern 2's negative lookbehind exists specifically to
// keep that distinction: "I want to hurt myself" escalates, "I don't want to
// hurt myself" does not (on the strength of this pattern alone — it may
// still be T2 via a separate T2 signal in the same message).
const T3 = [
  // Explicit intent-to-act phrasing, including "thinking about" ideation.
  /\b(?:going to|about to|planning to|gonna|thinking about|thinking of|think about|think of|considering)\s+(?:kill|hurt|harm)(?:ing)?\s+myself\b/i,
  // Bare "want to/wanna X myself", excluded when directly negated.
  /\b(?<!don'?t\s)(?<!do not\s)(?<!doesn'?t\s)(?:want to|wanna)\s+(?:kill|hurt|harm)\s+myself\b/i,
  /\b(?:i want|i wanna|i am going|i'm going)\s+to\s+die\b/i,
  // "end/ending my life" or "...it all" — covers gerund and bare forms, and
  // matches regardless of what precedes it (e.g. "thinking about ending my
  // life"), since ending one's own life is itself the signal.
  /\b(?:kill|end|ending)\s+(?:my life|it all)\b/i,
  /\b(?:take|taking)\s+my\s+(?:own\s+)?life\b/i,
  // Explicit statement of not wanting to continue living.
  /\bdon'?t\s+want\s+to\s+(?:be alive|live|exist)\s+anymore\b/i,
];

const T2 = [
  /\b(?:can't|cannot|dont|don't)\s+go\s+on\b/i,
  /\b(?:better off|burden)\s+without\s+me\b/i,
  /\b(?:disappear|vanish)\s+(?:for good|forever)\b/i,
];

const T1 = [
  /\b(?:overwhelmed|exhausted|hopeless|isolated|burnt out|burned out)\b/i,
  // "can't cope" added alongside "not coping" — same distress, different
  // natural phrasing (found via the T3 regression investigation).
  /\b(?:not coping|can(?:'t|not) cope|struggling badly)\b/i,
];

export function detectTier(text: string): RiskTier {
  if (T3.some((p) => p.test(text))) return "T3";
  if (T2.some((p) => p.test(text))) return "T2";
  if (T1.some((p) => p.test(text))) return "T1";
  return "T0";
}

export function maxTier(a: RiskTier, b: RiskTier): RiskTier {
  const order: Record<RiskTier, number> = { T0: 0, T1: 1, T2: 2, T3: 3 };
  return order[a] >= order[b] ? a : b;
}
