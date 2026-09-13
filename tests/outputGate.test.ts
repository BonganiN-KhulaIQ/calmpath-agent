import { describe, expect, it } from "vitest";
import { applyOutputGate } from "../src/safety/outputGate";

const FALLBACK = "FALLBACK_TEXT";

describe("applyOutputGate", () => {
  it("passes through safe, ordinary text unchanged", () => {
    const result = applyOutputGate("That sounds like a lot to carry right now.", "T1", FALLBACK);
    expect(result.allowed).toBe(true);
    expect(result.response).toBe("That sounds like a lot to carry right now.");
    expect(result.blockedReasons).toHaveLength(0);
  });

  it("blocks diagnosis presented as a conclusion", () => {
    const result = applyOutputGate("You have clinical depression.", "T1", FALLBACK);
    expect(result.allowed).toBe(false);
    expect(result.response).toBe(FALLBACK);
    expect(result.blockedReasons).toContain("diagnosis");
  });

  it("blocks medication recommendations", () => {
    const result = applyOutputGate("You should take an antidepressant for this.", "T1", FALLBACK);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("medication");
  });

  it("blocks clinical or emergency-service impersonation", () => {
    const result = applyOutputGate("As your therapist, I recommend this.", "T1", FALLBACK);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("impersonation");

    const emergencyClaim = applyOutputGate("I am the emergency services.", "T1", FALLBACK);
    expect(emergencyClaim.allowed).toBe(false);
    expect(emergencyClaim.blockedReasons).toContain("impersonation");
  });

  it("blocks claims of certainty about someone's mental state", () => {
    const result = applyOutputGate("You definitely have this exact problem.", "T1", FALLBACK);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("certainty_claim");
  });

  it("blocks unsafe productivity pressure once tier has escalated, but not at T0", () => {
    const escalated = applyOutputGate("Just push through and stop making excuses.", "T2", FALLBACK);
    expect(escalated.allowed).toBe(false);
    expect(escalated.blockedReasons).toContain("productivity_pressure");

    const calm = applyOutputGate("Just push through and stop making excuses.", "T0", FALLBACK);
    expect(calm.allowed).toBe(true);
  });

  it("blocks method discussion only at T3", () => {
    const atT3 = applyOutputGate("Some people consider an overdose.", "T3", FALLBACK);
    expect(atT3.allowed).toBe(false);
    expect(atT3.blockedReasons).toContain("method_discussion");
  });
});
