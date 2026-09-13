import { describe, expect, it } from "vitest";
import { evaluatePolicy } from "../src/safety/policy";

describe("evaluatePolicy", () => {
  it("allows generation and planning tools at T0", () => {
    const decision = evaluatePolicy("T0", "plan");
    expect(decision.allowModelGeneration).toBe(true);
    expect(decision.forcedResponse).toBeNull();
    expect(decision.allowPlanningTools).toBe(true);
    expect(decision.requireCrisisResource).toBe(false);
  });

  it("allows generation and planning tools at T1 but flags crisis-adjacent topics", () => {
    const decision = evaluatePolicy("T1", "express");
    expect(decision.allowModelGeneration).toBe(true);
    expect(decision.allowPlanningTools).toBe(true);
    expect(decision.requireCrisisResource).toBe(false);
    expect(decision.blockedTopics).toContain("diagnosis");
  });

  it("allows generation but disables planning tools and requires crisis resources at T2", () => {
    const decision = evaluatePolicy("T2", "navigate");
    expect(decision.allowModelGeneration).toBe(true);
    expect(decision.allowPlanningTools).toBe(false);
    expect(decision.requireCrisisResource).toBe(true);
    expect(decision.blockedTopics).toContain("productivity_pressure");
  });

  it("blocks generation entirely and forces a safe response at T3", () => {
    const decision = evaluatePolicy("T3", "crisis_signal");
    expect(decision.allowModelGeneration).toBe(false);
    expect(decision.allowPlanningTools).toBe(false);
    expect(decision.requireCrisisResource).toBe(true);
    expect(decision.forcedResponse).not.toBeNull();
    expect(decision.blockedTopics).toEqual(
      expect.arrayContaining(["method", "severity", "timing", "planning"]),
    );
  });

  it("T3 forced response never asks about method, severity, timing, or plan", () => {
    const decision = evaluatePolicy("T3", "crisis_signal");
    const text = decision.forcedResponse ?? "";
    expect(text.toLowerCase()).not.toMatch(/\b(method|how would you|when do you plan|what time)\b/);
    expect(text.toLowerCase()).toContain("not an emergency service");
  });
});
