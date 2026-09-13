import type { ToolFn } from "./types";

/** Generic ODeL study-navigation guidance. No institution-specific claims beyond public structure. */
export const odelNavigator: ToolFn = () => ({
  toolId: "odel_navigator",
  summary: "Here's a general way to navigate distance-learning study support.",
  details: [
    "Check your module site for tutorial letters, discussion forums, and official deadlines.",
    "Your institution's student support or academic advising office can help with study planning questions.",
  ],
});
