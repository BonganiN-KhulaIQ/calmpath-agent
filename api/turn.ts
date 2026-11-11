import type { VercelRequest, VercelResponse } from "@vercel/node";
import { handleTurnRequest, TurnRequestError } from "../src/server/turnHandler";
import { SessionConfigError } from "../src/server/sessionToken";

/**
 * Vercel serverless function: POST /api/turn
 *
 * Thin HTTP adapter only — all real logic (safety pipeline, session
 * signing/verification) lives in src/server/turnHandler.ts and
 * src/server/sessionToken.ts, which are framework-independent and unit
 * tested directly. This file's only job is translating between Vercel's
 * request/response objects and that handler.
 *
 * No conversation text or session state is stored here or anywhere else —
 * this function is stateless per invocation, matching CLAUDE.md's
 * "no accounts/database/analytics, no server-side conversation storage"
 * constraint.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await handleTurnRequest(req.body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof TurnRequestError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof SessionConfigError) {
      // Server misconfiguration (missing or weak signing secret), not the
      // student's fault. Log the cause for the operator; the message names a
      // setting and never contains conversation content.
      // eslint-disable-next-line no-console
      console.error(`[calmpath] ${err.message}`);
      res.status(500).json({ error: "CalmPath is temporarily unavailable." });
      return;
    }
    // Covers parseTurnInput's zod error for empty/over-length text, and any
    // other unexpected validation failure. Never leak internal error detail.
    res.status(400).json({ error: "That message couldn't be sent." });
  }
}
