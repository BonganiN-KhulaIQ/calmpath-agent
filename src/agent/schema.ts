import { z } from "zod";

/**
 * Boundary validation for a single student turn.
 * This is the only place raw free-text enters the pipeline, so it is
 * validated here rather than trusted implicitly downstream.
 */
export const TurnInputSchema = z.object({
  text: z.string().min(1, "empty turn").max(4000, "turn too long"),
});

export type ValidatedTurnInput = z.infer<typeof TurnInputSchema>;

export function parseTurnInput(raw: unknown): ValidatedTurnInput {
  return TurnInputSchema.parse(raw);
}
