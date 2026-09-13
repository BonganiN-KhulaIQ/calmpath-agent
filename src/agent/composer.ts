import type { ToolOutput } from "../tools/types";

/**
 * Merges the tool's deterministic content with the provider's generated
 * text into one response string. Pure string composition — no policy
 * decisions are made here, and the result still passes through the
 * output gate afterwards, same as any other response.
 */
export function composeResponse(toolOutput: ToolOutput, modelText: string): string {
  const detailBlock =
    toolOutput.details && toolOutput.details.length > 0
      ? `\n${toolOutput.details.map((line) => `- ${line}`).join("\n")}`
      : "";

  return `${toolOutput.summary}${detailBlock}\n\n${modelText}`;
}
