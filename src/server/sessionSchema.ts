import { z } from "zod";

/**
 * Validated shape of a `SessionContext` once it has round-tripped through a
 * signed token (see sessionToken.ts). This is the boundary for data coming
 * back FROM the client on every request — it is untrusted input until it has
 * both passed HMAC verification AND matched this shape.
 *
 * Kept in sync by hand with `SafetyState` (safety/types.ts), `Intent`
 * (agent/intent.ts) and `SessionContext` (agent/session.ts). If those change,
 * update this schema in the same commit.
 */
export const SessionContextSchema = z.object({
  safety: z.object({
    tier: z.enum(["T0", "T1", "T2", "T3"]),
    escalated: z.boolean(),
    version: z.string(),
  }),
  turnCount: z.number().int().nonnegative(),
  lastIntent: z
    .enum([
      "express",
      "understand",
      "plan",
      "navigate",
      "prepare",
      "record",
      "learn",
      "crisis_signal",
    ])
    .nullable(),
});

export type ValidatedSessionContext = z.infer<typeof SessionContextSchema>;
