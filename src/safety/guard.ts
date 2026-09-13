import { detectTier, maxTier } from "./risk";
import type { RiskTier, SafetyState, TurnInput } from "./types";

export function createSafetyState(): SafetyState {
  return { tier: "T0", escalated: false, version: "0.1.0" };
}

export function resolveTurnTier(state: SafetyState, input: TurnInput): SafetyState {
  const detected = detectTier(input.text);
  const tier = maxTier(state.tier, detected);
  return {
    ...state,
    tier,
    escalated: state.escalated || tier !== "T0",
  };
}

export function canUseCalmPlanning(tier: RiskTier): boolean {
  return tier === "T0" || tier === "T1";
}
