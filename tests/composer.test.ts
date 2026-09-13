import { describe, expect, it } from "vitest";
import { composeResponse } from "../src/agent/composer";
import type { ToolOutput } from "../src/tools/types";

describe("composeResponse", () => {
  it("includes the tool summary, each detail line, and the model text verbatim", () => {
    const tool: ToolOutput = {
      toolId: "reflective_conversation",
      summary: "Summary line.",
      details: ["Detail one.", "Detail two."],
    };

    const result = composeResponse(tool, "Model reply text.");

    expect(result).toContain("Summary line.");
    expect(result).toContain("Detail one.");
    expect(result).toContain("Detail two.");
    expect(result).toContain("Model reply text.");
  });

  it("handles tools with no details", () => {
    const tool: ToolOutput = { toolId: "reflective_conversation", summary: "Just a summary." };
    const result = composeResponse(tool, "Model text.");
    expect(result).toContain("Just a summary.");
    expect(result).toContain("Model text.");
  });
});
