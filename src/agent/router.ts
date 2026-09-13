import type { Intent } from "./intent";
import type { PolicyDecision, RiskTier } from "../safety/types";
import type { ToolId } from "../tools/registry";

export interface RouterInput {
  intent: Intent;
  tier: RiskTier;
  policy: PolicyDecision;
}

const ELEVATED_TIERS: readonly RiskTier[] = ["T1", "T2"];

/**
 * Selects exactly one tool for the turn. Pure function of intent, tier,
 * and the already-computed policy decision — never inspects raw text and
 * never makes its own model call. This function is only ever invoked when
 * `policy.allowModelGeneration` is true (T0–T2); T3 bypasses the planner
 * entirely and uses the policy's forced response instead.
 *
 * The policy gate remains authoritative: this router reads
 * `policy.allowPlanningTools` rather than re-deriving tier logic, so a
 * planning-tool decision can never be made independently of the gate.
 */
export function selectTool({ intent, tier, policy }: RouterInput): ToolId {
  switch (intent) {
    case "crisis_signal":
      // Reachable only at T2 (T3 never reaches the planner at all).
      return "support_pathway_guide";

    case "navigate":
      return "resource_navigator";

    case "prepare":
      return "appointment_prep";

    case "record":
      return "session_summary";

    case "learn":
      return "odel_navigator";

    case "plan":
      return policy.allowPlanningTools ? "action_plan_builder" : "balance_support";

    case "understand":
      return ELEVATED_TIERS.includes(tier) ? "academic_pressure_support" : "reflective_conversation";

    case "express":
    default:
      return ELEVATED_TIERS.includes(tier) ? "emotional_checkin" : "reflective_conversation";
  }
}
