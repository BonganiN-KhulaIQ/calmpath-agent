import type { Intent } from "../agent/intent";
import { canUseCalmPlanning } from "./guard";
import { buildT3ForcedResponse } from "./fallback";
import type { PolicyDecision, RiskTier } from "./types";

/**
 * Deterministic policy gate. Runs after tier resolution and intent
 * classification, before any planner/router/tool/model work. Pure
 * function of (tier, intent) — no model call, no randomness, no I/O
 * beyond the static forced-response text.
 */
export function evaluatePolicy(tier: RiskTier, intent: Intent): PolicyDecision {
  const allowPlanningTools = canUseCalmPlanning(tier);

  if (tier === "T3") {
    return {
      tier,
      intent,
      allowModelGeneration: false,
      forcedResponse: buildT3ForcedResponse(),
      requireCrisisResource: true,
      allowPlanningTools: false,
      blockedTopics: ["method", "severity", "timing", "planning", "diagnosis", "medication"],
    };
  }

  if (tier === "T2") {
    return {
      tier,
      intent,
      allowModelGeneration: true,
      forcedResponse: null,
      requireCrisisResource: true,
      allowPlanningTools,
      blockedTopics: ["diagnosis", "medication", "productivity_pressure"],
    };
  }

  if (tier === "T1") {
    return {
      tier,
      intent,
      allowModelGeneration: true,
      forcedResponse: null,
      requireCrisisResource: false,
      allowPlanningTools,
      blockedTopics: ["diagnosis", "medication", "productivity_pressure"],
    };
  }

  return {
    tier,
    intent,
    allowModelGeneration: true,
    forcedResponse: null,
    requireCrisisResource: false,
    allowPlanningTools,
    blockedTopics: ["diagnosis", "medication"],
  };
}
