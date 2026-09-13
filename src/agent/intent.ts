export type Intent =
  | "express"
  | "understand"
  | "plan"
  | "navigate"
  | "prepare"
  | "record"
  | "learn"
  | "crisis_signal";

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(?:emergency|kill myself|hurt myself|die)\b/.test(t)) return "crisis_signal";
  if (/(plan|routine|steps|schedule)/.test(t)) return "plan";
  if (/(find|where|support|counselling|counseling)/.test(t)) return "navigate";
  if (/(appointment|doctor|visit)/.test(t)) return "prepare";
  if (/(why|what does|explain)/.test(t)) return "understand";
  return "express";
}
