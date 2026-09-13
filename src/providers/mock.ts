import type { ModelProvider } from "../safety/types";

export const mockProvider: ModelProvider = {
  async generate(context) {
    if (context.tier === "T3") {
      return "I can stay with you, but I am not an emergency service. Please seek immediate human support through an appropriate emergency or crisis pathway.";
    }
    if (context.tier === "T2") {
      return "It sounds like things may be getting difficult. We can focus on support and a manageable next step.";
    }
    if (context.tier === "T1") {
      return "That sounds like a lot to carry. We can slow things down and work out one manageable next step.";
    }
    return "I’m here to help you think through what is happening and find a practical next step.";
  },
};
