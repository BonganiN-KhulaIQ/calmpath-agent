import { describe, expect, it } from "vitest";
import { TOOL_IDS, runTool } from "../src/tools/index";
import { applyOutputGate } from "../src/safety/outputGate";
import { evaluatePolicy } from "../src/safety/policy";
import type { RiskTier } from "../src/safety/types";

const SAMPLE_TIER: RiskTier = "T1";
const policy = evaluatePolicy(SAMPLE_TIER, "express");

describe("tool content safety", () => {
  it.each(TOOL_IDS)("output of '%s' never trips the output gate", (toolId) => {
    const output = runTool(toolId, { tier: SAMPLE_TIER, intent: "express", text: "sample turn", policy });
    const combined = [output.summary, ...(output.details ?? [])].join(" ");

    const gated = applyOutputGate(combined, SAMPLE_TIER, "FALLBACK");

    expect(gated.allowed).toBe(true);
    expect(gated.blockedReasons).toHaveLength(0);
  });

  it("session_summary never includes the raw turn text, only tier metadata", () => {
    const output = runTool("session_summary", {
      tier: "T0",
      intent: "record",
      text: "something very specific and private",
      policy: evaluatePolicy("T0", "record"),
    });

    const combined = [output.summary, ...(output.details ?? [])].join(" ");
    expect(combined).not.toContain("something very specific and private");
  });

  it("resource_navigator marks unverified resources as unverified", () => {
    const output = runTool("resource_navigator", {
      tier: "T0",
      intent: "navigate",
      text: "where can I get support",
      policy: evaluatePolicy("T0", "navigate"),
    });

    const combined = (output.details ?? []).join(" ");
    expect(combined).toMatch(/not yet verified/i);
  });
});
