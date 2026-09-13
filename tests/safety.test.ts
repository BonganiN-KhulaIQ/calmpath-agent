import { describe, expect, it } from "vitest";
import { detectTier } from "../src/safety/risk";
import { createSafetyState, resolveTurnTier } from "../src/safety/guard";

describe("CalmPath safety", () => {
  it("detects explicit urgent language", () => {
    expect(detectTier("I want to die")).toBe("T3");
    expect(detectTier("I am going to kill myself")).toBe("T3");
  });

  it("detects concerning language", () => {
    expect(detectTier("They would be better off without me")).toBe("T2");
  });

  it("keeps escalation sticky", () => {
    const state = resolveTurnTier(createSafetyState(), { text: "I feel overwhelmed and hopeless" });
    const later = resolveTurnTier(state, { text: "I am okay now" });
    expect(later.tier).toBe("T1");
  });

  it("never lowers T3", () => {
    const state = resolveTurnTier(createSafetyState(), { text: "I want to die" });
    const later = resolveTurnTier(state, { text: "Let's talk about my timetable" });
    expect(later.tier).toBe("T3");
  });
});
