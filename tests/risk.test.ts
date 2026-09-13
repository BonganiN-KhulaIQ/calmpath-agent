import { describe, expect, it } from "vitest";
import { detectTier } from "../src/safety/risk";

describe("detectTier — T0 through T3", () => {
  it("classifies ordinary conversation as T0", () => {
    expect(detectTier("Can you help me plan my study schedule for this week?")).toBe("T0");
    expect(detectTier("Hi, I have a question about my assignment.")).toBe("T0");
  });

  it("classifies sustained distress language as T1", () => {
    expect(detectTier("I feel completely overwhelmed and exhausted lately.")).toBe("T1");
    expect(detectTier("I am not coping with everything right now.")).toBe("T1");
  });

  it("classifies ambiguous high-concern language as T2", () => {
    expect(detectTier("Everyone would be better off without me.")).toBe("T2");
    expect(detectTier("I just want to disappear forever.")).toBe("T2");
  });

  it("classifies explicit danger language as T3", () => {
    expect(detectTier("I want to die.")).toBe("T3");
    expect(detectTier("I am going to kill myself.")).toBe("T3");
  });
});
