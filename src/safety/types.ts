import type { Intent } from "../agent/intent";

export type RiskTier = "T0" | "T1" | "T2" | "T3";

export interface SafetyState {
  tier: RiskTier;
  escalated: boolean;
  version: string;
}

export interface TurnInput {
  text: string;
}

export interface GuardedContext {
  tier: RiskTier;
  intent: Intent;
  text: string;
}

export interface ModelProvider {
  generate(context: GuardedContext): Promise<string>;
}

/** Deterministic decision produced by the policy gate, before any tool/model work. */
export interface PolicyDecision {
  tier: RiskTier;
  intent: Intent;
  /** Whether the provider may be called at all for this turn. */
  allowModelGeneration: boolean;
  /** Non-null when the policy mandates a fixed, deterministic response instead of generation. */
  forcedResponse: string | null;
  /** Whether a crisis/support pathway must be surfaced alongside the response. */
  requireCrisisResource: boolean;
  /** Whether planning/productivity-oriented tools are permitted at this tier. */
  allowPlanningTools: boolean;
  /** Topic categories the output gate must scrub for on this turn. */
  blockedTopics: readonly string[];
}

/** Result of the deterministic post-generation output gate. */
export interface OutputGateResult {
  allowed: boolean;
  response: string;
  blockedReasons: readonly string[];
}
