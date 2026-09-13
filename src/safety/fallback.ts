import { crisisResourceLine } from "./resources";

/**
 * Deterministic T3 response. Used instead of any model output: per
 * SAFETY.md, T3 turns must not ask assessment questions, must not discuss
 * methods, must not diagnose, must state clearly that this is not an
 * emergency service, must surface a support pathway, and must not
 * abandon the conversation.
 */
export function buildT3ForcedResponse(): string {
  return [
    "I hear that things feel very hard right now, and I want to take that seriously.",
    "I'm an AI support and navigation tool, not an emergency service, and I can't keep you safe on my own.",
    "Please contact local emergency services or a crisis line right now, or reach out to someone you trust who can be with you.",
    crisisResourceLine(),
    "I'm still here with you, and we can keep talking.",
  ].join(" ");
}

/** Generic fallback shown when the output gate blocks a non-crisis response. */
export const GENERIC_BLOCKED_RESPONSE =
  "I'm not able to say that. I can't give a diagnosis, medication advice, or act as a clinician, " +
  "but I can help you think through what's going on and find a practical next step or appropriate support.";

/** Fallback shown when a T2 (concerning) response is blocked by the output gate. */
export function buildT2BlockedResponse(): string {
  return [
    "I want to be careful here rather than say something unhelpful.",
    "It sounds like things may be getting difficult, and I'd rather focus on support and a manageable next step than guess.",
    crisisResourceLine(),
  ].join(" ");
}
