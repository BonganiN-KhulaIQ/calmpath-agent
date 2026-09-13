import type { ToolFn } from "./types";

/**
 * Safe substitute for action_plan_builder whenever planning tools are
 * disabled by policy (T2/T3). Deliberately avoids task lists, deadlines,
 * or any productivity framing.
 */
export const balanceSupport: ToolFn = () => ({
  toolId: "balance_support",
  summary: "Rather than adding more to do right now, let's focus on steadying things a little.",
  details: [
    "A small, low-pressure thing — some rest, food, water, or a short walk — can matter more than a task list today.",
    "Whatever you get to today is enough for today.",
  ],
});
