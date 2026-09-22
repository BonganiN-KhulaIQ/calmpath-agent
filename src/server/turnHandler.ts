import { z } from "zod";
import { runAgentTurn, initialAgentState } from "../agent/orchestrator";
import { mockProvider } from "../providers/mock";
import { signSession, verifySession } from "./sessionToken";
import type { RiskTier } from "../safety/types";
import type { Intent } from "../agent/intent";
import type { ToolId } from "../tools/registry";

/**
 * Platform-independent request handling for one CalmPath turn.
 *
 * This is the seam between "the deterministic safety pipeline" (unchanged —
 * still exactly `runAgentTurn` from agent/orchestrator.ts) and whatever HTTP
 * framework ends up calling it. Keeping it free of any request/response
 * types from Vercel/Express/etc. means it can be unit-tested directly (see
 * tests/turnHandler.test.ts) and reused if the hosting platform ever
 * changes.
 */

const TurnRequestSchema = z.object({
  text: z.string(),
  sessionToken: z.string().nullable().optional(),
});

export class TurnRequestError extends Error {}

export interface TurnResponseBody {
  sessionToken: string;
  response: string;
  tier: RiskTier;
  intent: Intent;
  tool: ToolId | null;
  blocked: boolean;
  blockedReasons: readonly string[];
}

/**
 * Handles one turn end-to-end: verifies the incoming session token (falling
 * back to a fresh session on any tampering, per sessionToken.ts), runs the
 * full safety pipeline server-side with the mock provider, and returns a
 * freshly signed token for the next request.
 *
 * Throws `TurnRequestError` for a malformed request body, and re-throws
 * whatever `runAgentTurn` / `parseTurnInput` throw for invalid turn text
 * (e.g. empty or over-length) — callers map both to an HTTP 400.
 */
export async function handleTurnRequest(rawBody: unknown): Promise<TurnResponseBody> {
  const parsed = TurnRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new TurnRequestError("Request body must be { text: string, sessionToken?: string }");
  }

  const { text, sessionToken } = parsed.data;
  const session = verifySession(sessionToken ?? null);

  const result = await runAgentTurn(session, text, mockProvider);

  return {
    sessionToken: signSession(result.session),
    response: result.response,
    tier: result.tier,
    intent: result.intent,
    tool: result.tool,
    blocked: result.blocked,
    blockedReasons: result.blockedReasons,
  };
}

/** A signed token for a brand-new session, e.g. to seed the client on first load. */
export function freshSessionToken(): string {
  return signSession(initialAgentState());
}
