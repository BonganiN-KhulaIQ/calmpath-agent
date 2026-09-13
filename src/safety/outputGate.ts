import type { OutputGateResult, RiskTier } from "./types";

// Diagnosis or clinical labels presented as conclusions.
const DIAGNOSIS_PATTERNS = [
  /\byou (?:have|are suffering from|are experiencing)\s+(?:clinical\s+)?(?:depression|anxiety disorder|bipolar disorder|ptsd|a mental illness)\b/i,
  /\b(?:this|that) (?:is|sounds like|looks like)\s+(?:clinical\s+)?(?:depression|anxiety disorder|bipolar disorder|ptsd)\b/i,
  /\byour diagnosis is\b/i,
];

// Medication recommendations or medication changes.
const MEDICATION_PATTERNS = [
  /\b(?:take|start|stop|increase|decrease|reduce|double)\s+(?:your\s+)?(?:medication|dose|dosage|antidepressants?|ssris?|pills?)\b/i,
  /\byou should (?:take|try)\s+(?:an?\s+)?(?:medication|antidepressant|ssri)\b/i,
];

// Pretending to be a psychologist, doctor, counsellor, or emergency service.
const IMPERSONATION_PATTERNS = [
  /\bas your (?:psychologist|doctor|counsellor|counselor|therapist)\b/i,
  /\bi am (?:a|your)\s+(?:licensed\s+)?(?:psychologist|doctor|counsellor|counselor|therapist)\b/i,
  /\bi am (?:the\s+)?emergency services?\b/i,
];

// Claims of certainty about a person's mental state.
const CERTAINTY_PATTERNS = [
  /\byou (?:definitely|certainly|clearly)\s+(?:have|are)\b/i,
  /\bi know exactly what you(?:'re| are) feeling\b/i,
];

// Unsafe productivity pressure — only relevant once tier has escalated.
const PRODUCTIVITY_PRESSURE_PATTERNS = [
  /\b(?:push through|power through|just work harder|no excuses|stop making excuses|suck it up)\b/i,
];

// T3-only: never discuss or name self-harm methods, even in a generated reply.
const METHOD_DISCUSSION_PATTERNS = [/\b(?:overdose|hang(?:ing)?|jump(?:ing)? from|cut(?:ting)? (?:yourself|your wrists))\b/i];

export interface GateCheck {
  reason: string;
  test: (text: string) => boolean;
}

function buildChecks(tier: RiskTier): GateCheck[] {
  const checks: GateCheck[] = [
    { reason: "diagnosis", test: (t) => DIAGNOSIS_PATTERNS.some((p) => p.test(t)) },
    { reason: "medication", test: (t) => MEDICATION_PATTERNS.some((p) => p.test(t)) },
    { reason: "impersonation", test: (t) => IMPERSONATION_PATTERNS.some((p) => p.test(t)) },
    { reason: "certainty_claim", test: (t) => CERTAINTY_PATTERNS.some((p) => p.test(t)) },
  ];

  if (tier !== "T0") {
    checks.push({
      reason: "productivity_pressure",
      test: (t) => PRODUCTIVITY_PRESSURE_PATTERNS.some((p) => p.test(t)),
    });
  }

  if (tier === "T3") {
    checks.push({
      reason: "method_discussion",
      test: (t) => METHOD_DISCUSSION_PATTERNS.some((p) => p.test(t)),
    });
  }

  return checks;
}

/**
 * Deterministic output gate. Runs on every response — model-generated or
 * forced — before it reaches the student. Never calls the model itself.
 */
export function applyOutputGate(rawResponse: string, tier: RiskTier, fallback: string): OutputGateResult {
  const reasons = buildChecks(tier)
    .filter((check) => check.test(rawResponse))
    .map((check) => check.reason);

  if (reasons.length > 0) {
    return { allowed: false, response: fallback, blockedReasons: reasons };
  }

  return { allowed: true, response: rawResponse, blockedReasons: [] };
}
