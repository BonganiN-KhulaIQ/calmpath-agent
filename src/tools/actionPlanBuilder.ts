import type { ToolFn } from "./types";

/**
 * Only ever selected when policy.allowPlanningTools is true (T0/T1).
 * Keeps steps small and optional in tone — never framed as pressure or targets.
 */
export const actionPlanBuilder: ToolFn = () => ({
  toolId: "action_plan_builder",
  summary: "Let's sketch out one small, manageable next step — not a whole plan at once.",
  details: [
    "Pick just one thing that would help most in the next day or two.",
    "Break that one thing into a step small enough to feel doable, even on a low-energy day.",
    "It's okay to adjust or drop this if it stops being helpful.",
  ],
});
