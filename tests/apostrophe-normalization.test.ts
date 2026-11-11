import { describe, expect, it } from "vitest";
import { detectTier } from "../src/safety/risk";
import { applyOutputGate } from "../src/safety/outputGate";
import { normalizeForMatching } from "../src/safety/normalize";
import { handleTurnRequest } from "../src/server/turnHandler";

// Phone keyboards type U+2019 instead of the ASCII apostrophe. These tests
// lock in that every typographic variant is treated like the ASCII one.
const VARIANTS = ["’", "‘", "ʼ", "′", "´", "`"];

describe("apostrophe normalisation — safety detection", () => {
  it("normalizeForMatching folds every apostrophe variant to ASCII and nothing else", () => {
    for (const v of VARIANTS) {
      expect(normalizeForMatching(`don${v}t`)).toBe("don't");
    }
    expect(normalizeForMatching("plain text, no changes!")).toBe("plain text, no changes!");
  });

  it.each(VARIANTS)("T3 'don't want to be alive anymore' with typographic apostrophe variant %#", (v) => {
    expect(detectTier(`I don${v}t want to be alive anymore.`)).toBe("T3");
  });

  it("detects T3 for the typographic form of every apostrophe-bearing T3 phrasing", () => {
    expect(detectTier("I don’t want to live anymore")).toBe("T3");
    expect(detectTier("I DON’T WANT TO EXIST ANYMORE")).toBe("T3");
    expect(detectTier("I feel like I can’t cope and I’m thinking about ending my life.")).toBe("T3");
  });

  it("detects T2 and T1 phrasings typed with a typographic apostrophe", () => {
    expect(detectTier("I can’t go on")).toBe("T2");
    expect(detectTier("I don’t go on like this")).not.toBe("T3");
    expect(detectTier("I can’t cope with this semester")).toBe("T1");
  });

  it("keeps the negation guard working with a typographic apostrophe", () => {
    // Deliberately negated statement must NOT become T3, curly or straight.
    expect(detectTier("I don't want to hurt myself")).not.toBe("T3");
    expect(detectTier("I don’t want to hurt myself")).not.toBe("T3");
    expect(detectTier("I doesn’t want to hurt myself")).not.toBe("T3");
    // ...while the un-negated form still escalates.
    expect(detectTier("I want to hurt myself")).toBe("T3");
  });

  it("does not turn ordinary calm text containing apostrophes into a crisis", () => {
    expect(detectTier("I don’t understand the assignment, can you explain?")).toBe("T0");
    expect(detectTier("It’s my first year and I’m learning the ropes")).toBe("T0");
  });

  it("end to end: curly-apostrophe crisis message is T3, forced response, and sticky", async () => {
    const first = await handleTurnRequest({
      text: "I don’t want to be alive anymore.",
      sessionToken: null,
    });
    expect(first.tier).toBe("T3");
    expect(first.tool).toBeNull();

    const second = await handleTurnRequest({
      text: "Actually I’m fine now.",
      sessionToken: first.sessionToken,
    });
    expect(second.tier).toBe("T3");
  });
});

describe("apostrophe normalisation — output gate", () => {
  const fallback = "FALLBACK";

  it("blocks certainty claims written with a typographic apostrophe", () => {
    const result = applyOutputGate("I know exactly what you’re feeling.", "T0", fallback);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("certainty_claim");
    expect(result.response).toBe(fallback);
  });

  it("returns allowed responses byte-for-byte unchanged (normalisation is match-only)", () => {
    const text = "It’s okay to take a break. You’re not alone.";
    const result = applyOutputGate(text, "T0", fallback);
    expect(result.allowed).toBe(true);
    expect(result.response).toBe(text);
  });
});
