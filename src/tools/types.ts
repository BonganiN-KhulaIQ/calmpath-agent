import type { Intent } from "../agent/intent";
import type { PolicyDecision, RiskTier } from "../safety/types";
import type { ToolId } from "./registry";

/**
 * Context passed to a tool for a single turn. Tools are pure functions:
 * no model calls, no I/O, no randomness. `text` is used transiently to
 * shape output within this call only — tools must not retain it.
 */
export interface ToolContext {
  tier: RiskTier;
  intent: Intent;
  text: string;
  policy: PolicyDecision;
}

export interface ToolOutput {
  toolId: ToolId;
  summary: string;
  details?: readonly string[];
}

export type ToolFn = (ctx: ToolContext) => ToolOutput;
