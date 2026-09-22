export const TOOL_IDS = [
  "reflective_conversation",
  "emotional_checkin",
  "odel_navigator",
  "academic_pressure_support",
  "balance_support",
  "resource_navigator",
  "appointment_prep",
  "action_plan_builder",
  "session_summary",
  "support_pathway_guide",
  "greeting_response",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];
