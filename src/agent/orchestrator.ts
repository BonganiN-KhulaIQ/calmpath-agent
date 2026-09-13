import { parseTurnInput } from "./schema";
import { classifyIntent, type Intent } from "./intent";
import { createSession, advanceSession, type SessionContext } from "./session";
import { selectTool } from "./router";
import { composeResponse } from "./composer";
import { resolveTurnTier } from "../safety/guard";
import { evaluatePolicy } from "../safety/policy";
import { applyOutputGate } from "../safety/outputGate";
import { GENERIC_BLOCKED_RESPONSE } from "../safety/fallback";
import { runTool } from "../tools/index";
import type { ToolId } from "../tools/registry";
import type { ModelProvider, RiskTier } from "../safety/types";

export interface AgentTurnResult {
  session: SessionContext;
  response: string;
  tier: RiskTier;
  intent: Intent;
  /** Which local tool produced the structured content in this response, if any (null at T3). */
  tool: ToolId | null;
  blocked: boolean;
  blockedReasons: readonly string[];
}

/**
 * Runs one full student turn through the deterministic pipeline:
 *
 *   turn -> preScreen -> context -> intent -> policy
 *        -> planner/router -> tools -> composer
 *        -> outputGate -> response
 *
 * The safety gates are authoritative and unchanged by this stage:
 *   - The model is never called before the safety tier is resolved.
 *   - A forced T3 tier bypasses the planner, tools, composer, AND the
 *     model entirely — the policy's forced response is used as-is.
 *   - The router only ever reads policy.allowPlanningTools; it cannot
 *     independently decide to run a planning tool the policy disallows.
 *   - Every response — forced, or tool+model composed — passes through
 *     the same deterministic output gate before it is returned. Nothing
 *     the planner/tools/composer produce is exempt from that gate.
 */
export async function runAgentTurn(
  session: SessionContext,
  rawText: string,
  provider: ModelProvider,
): Promise<AgentTurnResult> {
  const { text } = parseTurnInput({ text: rawText });

  // 1. preScreen — deterministic tier resolution, sticky escalation.
  const nextSafety = resolveTurnTier(session.safety, { text });
  const tier = nextSafety.tier;

  // 2. intent classification (independent of tier).
  const intent = classifyIntent(text);

  // 3. policy gate — decides, before any generation or tool work, what
  //    this turn may do. This decision is not revisited below.
  const policy = evaluatePolicy(tier, intent);

  let rawResponse: string;
  let toolId: ToolId | null = null;

  if (policy.allowModelGeneration) {
    // 4. planner/router — picks exactly one local tool for this turn.
    toolId = selectTool({ intent, tier, policy });

    // 5. tools — deterministic, pure content generation. No model call,
    //    no I/O, cannot itself decide to skip the output gate.
    const toolOutput = runTool(toolId, { tier, intent, text, policy });

    // 6. composer — merges tool content with the model's reflective text.
    const modelText = await provider.generate({ tier, intent, text });
    rawResponse = composeResponse(toolOutput, modelText);
  } else {
    // T3: policy forces a fixed response; planner/tools/composer/model
    // are all bypassed, exactly as before this phase.
    rawResponse = policy.forcedResponse ?? GENERIC_BLOCKED_RESPONSE;
  }

  // 7. deterministic output gate — runs on every response, forced or composed.
  const fallback = policy.forcedResponse ?? GENERIC_BLOCKED_RESPONSE;
  const gated = applyOutputGate(rawResponse, tier, fallback);

  // 8. context/session update — ephemeral, no raw text retained.
  const nextSession = advanceSession(session, nextSafety, intent);

  return {
    session: nextSession,
    response: gated.response,
    tier,
    intent,
    tool: policy.allowModelGeneration ? toolId : null,
    blocked: !gated.allowed,
    blockedReasons: gated.blockedReasons,
  };
}

export function initialAgentState(): SessionContext {
  return createSession();
}
