import type { ToolId } from "./registry";
import type { ToolContext, ToolFn, ToolOutput } from "./types";
import { reflectiveConversation } from "./reflectiveConversation";
import { emotionalCheckin } from "./emotionalCheckin";
import { odelNavigator } from "./odelNavigator";
import { academicPressureSupport } from "./academicPressureSupport";
import { balanceSupport } from "./balanceSupport";
import { resourceNavigator } from "./resourceNavigator";
import { appointmentPrep } from "./appointmentPrep";
import { actionPlanBuilder } from "./actionPlanBuilder";
import { sessionSummary } from "./sessionSummary";
import { supportPathwayGuide } from "./supportPathwayGuide";

const TOOL_IMPLEMENTATIONS: Record<ToolId, ToolFn> = {
  reflective_conversation: reflectiveConversation,
  emotional_checkin: emotionalCheckin,
  odel_navigator: odelNavigator,
  academic_pressure_support: academicPressureSupport,
  balance_support: balanceSupport,
  resource_navigator: resourceNavigator,
  appointment_prep: appointmentPrep,
  action_plan_builder: actionPlanBuilder,
  session_summary: sessionSummary,
  support_pathway_guide: supportPathwayGuide,
};

export function runTool(toolId: ToolId, ctx: ToolContext): ToolOutput {
  return TOOL_IMPLEMENTATIONS[toolId](ctx);
}

export { TOOL_IDS } from "./registry";
export type { ToolId } from "./registry";
export type { ToolContext, ToolOutput } from "./types";
