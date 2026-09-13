import type { ToolFn } from "./types";

/** Used when elevated distress (T1/T2) is being explained/understood. Coping-focused, not productivity-focused. */
export const academicPressureSupport: ToolFn = () => ({
  toolId: "academic_pressure_support",
  summary: "Academic pressure can build up quietly until it feels like too much at once.",
  details: [
    "It can help to name just one part of the workload that feels heaviest right now.",
    "A short break or a conversation with a tutor or advisor can shift things more than pushing alone can.",
  ],
});
