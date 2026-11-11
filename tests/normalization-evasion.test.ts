import { describe, expect, it } from "vitest";
import { detectTier } from "../src/safety/risk";
import { matchCandidates, normalizeForMatching } from "../src/safety/normalize";
import { applyOutputGate } from "../src/safety/outputGate";
import { handleTurnRequest } from "../src/server/turnHandler";

const ZWSP = "​";
const ZWJ = "‍";
const SHY = "­";

describe("normalisation — crisis text in disguised forms is still T3", () => {
  it.each([
    ["zero-width space inside a word", `I want to k${ZWSP}ill myself`],
    ["zero-width joiner inside a word", `I want to end my li${ZWJ}fe`],
    ["soft hyphen inside a word", `I'm thinking about k${SHY}illing myself`],
    ["fullwidth letters", "I want to ｋｉｌｌ myself"],
    ["accented letters", "I want to kíll mysélf"],
    ["Cyrillic lookalike letters", "I want to кill myself"],
    ["Cyrillic lookalike 'o' and 'e' in die", "I want to diе"],
    ["Greek lookalike letters", "I want to end my lιfe"],
    ["dots between letters", "I want to k.i.l.l myself"],
    ["hyphens between letters", "I want to end my l-i-f-e"],
    ["repeated spaces and newlines", "I want to   kill\n\nmyself"],
    ["tabs between words", "I want to\tend\tmy\tlife"],
    ["upper case", "I WANT TO KILL MYSELF"],
    ["digit substitution (1 as i)", "I want to k1ll myself"],
    ["digit substitution (1 as l)", "I want to end my 1ife"],
    ["digit substitution (3 as e)", "I want to di3"],
    ["symbol substitution", "I want to k!ll mys3lf".replace("!", "1")],
    ["curly apostrophe plus zero-width", `I don’t want to be a${ZWSP}live anymore`],
    ["combined tricks", `I dоn’t w${ZWSP}ant to l1ve anymоre`],
  ])("%s", (_name, text) => {
    expect(detectTier(text)).toBe("T3");
  });

  it("handles T2 and T1 phrasings in disguised forms too", () => {
    expect(detectTier(`I can${ZWSP}'t go on`)).toBe("T2");
    expect(detectTier("I’m so оverwhelmed")).toBe("T1");
    expect(detectTier("I'm h0peless")).toBe("T1");
  });

  it("end to end: a disguised crisis message gets the forced T3 response and stays T3", async () => {
    const first = await handleTurnRequest({
      text: `I want to k${ZWSP}1ll mys3lf`,
      sessionToken: null,
    });
    expect(first.tier).toBe("T3");
    expect(first.tool).toBeNull();
    const second = await handleTurnRequest({ text: "never mind, I'm fine", sessionToken: first.sessionToken });
    expect(second.tier).toBe("T3");
  });
});

describe("normalisation — no new false positives", () => {
  it.each([
    "I have 3 assignments due and 4 modules to finish",
    "My student number ends in 7 and I'm in 1st year",
    "I scored 85% in MAT1613 and 1 in STA1501",
    "Can you help me plan my week? I've got 5 days left",
    "It's well-being and self-care I want help with",
    "I need an e-mail template for my lecturer",
    "I need to kill the process in my COS1501 practical",
    "Cómo estás? I'm a bit tired but okay",
    "I don’t want to hurt myself",
    `I don${ZWSP}'t want to hurt myself`,
    "I do not want to hurt myself",
    "The deadline is 20.11.2026, I'll plan around it",
  ])("%s stays below T3", (text) => {
    expect(detectTier(text)).not.toBe("T3");
  });

  it("ordinary calm text stays T0", () => {
    expect(detectTier("I have 3 assignments due. Can you help me plan my week?")).toBe("T0");
    expect(detectTier("Where can I find the library hours for 2026?")).toBe("T0");
  });

  it("leaves plain numbers untouched when applying digit substitutions", () => {
    const candidates = matchCandidates("I have 3 assignments in 2026");
    expect(candidates).toEqual(["i have 3 assignments in 2026"]);
  });
});

describe("normalizeForMatching — behaviour", () => {
  it("is idempotent", () => {
    const once = normalizeForMatching(`Don’t  k${ZWSP}ill ＭＥ`);
    expect(normalizeForMatching(once)).toBe(once);
  });

  it("does not mutate anything it should not: input string is unchanged", () => {
    const input = `I don’t know ${ZWSP}`;
    normalizeForMatching(input);
    expect(input).toBe(`I don’t know ${ZWSP}`);
  });
});

describe("output gate — normalised matching, original text returned", () => {
  const fallback = "FALLBACK";

  it("blocks a disguised diagnosis claim", () => {
    const text = `This s${ZWSP}ounds like clinical deprеssion.`;
    const result = applyOutputGate(text, "T0", fallback);
    expect(result.allowed).toBe(false);
    expect(result.blockedReasons).toContain("diagnosis");
  });

  it("returns allowed text byte-for-byte, including accents and invisible characters", () => {
    const text = `Café break? Take it’s okay.${ZWSP}`;
    const result = applyOutputGate(text, "T0", fallback);
    expect(result.allowed).toBe(true);
    expect(result.response).toBe(text);
  });
});
