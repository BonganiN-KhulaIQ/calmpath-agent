import type { ToolFn } from "./types";

/** Used when distress is elevated (T1/T2 "express" turns). Names the difficulty without labeling it. */
export const emotionalCheckin: ToolFn = () => ({
  toolId: "emotional_checkin",
  summary: "That sounds like a lot to be carrying right now.",
  details: [
    "How has this been affecting your day-to-day, like sleep, eating, or getting things done?",
    "Is there anyone in your life you've been able to talk to about this?",
  ],
});
