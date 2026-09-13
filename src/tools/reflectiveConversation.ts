import type { ToolFn } from "./types";

/** Default, low-key tool: mirrors back and invites more detail. No advice-giving. */
export const reflectiveConversation: ToolFn = () => ({
  toolId: "reflective_conversation",
  summary: "Let's slow down and think this through together.",
  details: [
    "Tell me a bit more about what's been going on.",
    "There's no need to have it all figured out right now.",
  ],
});
