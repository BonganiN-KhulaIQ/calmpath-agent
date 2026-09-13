import { describe, expect, it } from "vitest";
import { detectTier } from "../src/safety/risk";

describe("crisis regression — natural-language T3 phrasings previously missed", () => {
  it("detects each of the four reported natural-language crisis statements as T3", () => {
    expect(detectTier("I feel like I can't cope anymore and I'm thinking about ending my life.")).toBe(
      "T3",
    );
    expect(detectTier("I'm thinking about killing myself.")).toBe("T3");
    expect(detectTier("I don't want to be alive anymore.")).toBe("T3");
    expect(detectTier("I want to end my life.")).toBe("T3");
  });

  it("still detects the previously-passing literal phrasings", () => {
    expect(detectTier("I am going to kill myself.")).toBe("T3");
    expect(detectTier("I want to die.")).toBe("T3");
  });

  it("detects additional common real-world phrasings of the same signal", () => {
    expect(detectTier("I want to kill myself.")).toBe("T3");
    expect(detectTier("I'm planning to end it all.")).toBe("T3");
    expect(detectTier("I've been thinking about hurting myself.")).toBe("T3");
    expect(detectTier("I just want to take my own life.")).toBe("T3");
  });
});

describe("crisis regression — negation must not be misread as intent", () => {
  it("does not classify a negated self-harm statement as T3 on its own", () => {
    // "hurt myself" appears, but it is explicitly negated — this must not,
    // by itself, read as an urgent self-harm signal.
    expect(detectTier("I don't want to hurt myself.")).not.toBe("T3");
    expect(detectTier("I do not want to hurt myself.")).not.toBe("T3");
  });

  it("still resolves the known T2 scenario correctly when combined with a T2 signal, not T3", () => {
    // Regression lock for the exact sentence used in the T2 integration test:
    // a negated self-harm mention must not upgrade an otherwise-T2 message to T3.
    expect(detectTier("I feel like they'd be better off without me, but I don't want to hurt myself.")).toBe(
      "T2",
    );
  });
});

describe("crisis regression — ordinary language must not false-positive", () => {
  it("does not trigger on the previously-discovered 'studies' substring issue", () => {
    expect(detectTier("I've been struggling to keep up with my studies and diet this week.")).not.toBe(
      "T3",
    );
    expect(detectTier("I feel overwhelmed and hopeless about my studies.")).not.toBe("T3");
  });

  it("does not trigger on ordinary mentions of related but unrelated words", () => {
    expect(detectTier("My diet has been all over the place lately.")).toBe("T0");
    expect(detectTier("Let's talk about my timetable instead.")).toBe("T0");
    expect(detectTier("Can you help me plan my study schedule for this week?")).toBe("T0");
  });

  it("still recognizes 'can't cope' as elevated (T1), a synonym of 'not coping'", () => {
    expect(detectTier("I can't cope anymore.")).toBe("T1");
  });
});
