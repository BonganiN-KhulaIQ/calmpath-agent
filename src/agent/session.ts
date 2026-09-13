import { createSafetyState } from "../safety/guard";
import type { SafetyState } from "../safety/types";
import type { Intent } from "./intent";

/**
 * Ephemeral, in-memory-only session context.
 *
 * Deliberately excludes raw conversation text: SAFETY.md requires that
 * safety state never contain raw student text and that no crisis content
 * be persisted. Only tier, counters, and the last classified intent are
 * carried between turns.
 */
export interface SessionContext {
  safety: SafetyState;
  turnCount: number;
  lastIntent: Intent | null;
}

export function createSession(): SessionContext {
  return {
    safety: createSafetyState(),
    turnCount: 0,
    lastIntent: null,
  };
}

/**
 * Produces the next session context from an already-resolved safety state
 * and classified intent. Does not accept or store raw text.
 */
export function advanceSession(
  session: SessionContext,
  nextSafety: SafetyState,
  intent: Intent,
): SessionContext {
  return {
    safety: nextSafety,
    turnCount: session.turnCount + 1,
    lastIntent: intent,
  };
}
