import { describe, expect, it, vi } from "vitest";
import { detectTier } from "../src/safety/risk";
import { runAgentTurn, initialAgentState } from "../src/agent/orchestrator";
import type { ModelProvider } from "../src/safety/types";

function fakeProvider(response: string): ModelProvider & { generate: ReturnType<typeof vi.fn> } {
  return { generate: vi.fn().mockResolvedValue(response) };
}

describe("academic overwhelm vs. explicit crisis — tier classification", () => {
  it("does not classify ordinary academic overwhelm/planning requests as T3", () => {
    expect(
      detectTier(
        "I have several assignments due soon and I'm completely overwhelmed. Can you help me " +
          "break my workload into manageable steps without making me feel pressured?",
      ),
    ).not.toBe("T3");

    expect(detectTier("I am behind on my coursework and don't know how to organise my study time.")).not.toBe(
      "T3",
    );

    expect(detectTier("I'm exhausted and struggling to keep up with my studies.")).not.toBe("T3");
  });

  it("still reaches T3 when explicit self-harm/suicidal intent is present, even inside academic framing", () => {
    expect(detectTier("I'm overwhelmed by my assignments and I'm thinking about ending my life.")).toBe(
      "T3",
    );
    expect(
      detectTier("I don't want to be alive anymore because I feel like I'm failing my studies."),
    ).toBe("T3");
  });

  it("does not treat an ordinary mention of 'studies' as a crisis signal", () => {
    expect(detectTier("I have studies to finish tonight.")).not.toBe("T3");
    expect(detectTier("I have studies to finish tonight.")).toBe("T0");
  });
});

describe("academic overwhelm vs. explicit crisis — full orchestrator, fresh session", () => {
  it("routes ordinary academic overwhelm to academic/planning support, not the T3 forced response", async () => {
    const provider = fakeProvider("Let's take this one step at a time.");
    const session = initialAgentState();

    const result = await runAgentTurn(
      session,
      "I have several assignments due soon and I'm completely overwhelmed. Can you help me " +
        "break my workload into manageable steps without making me feel pressured?",
      provider,
    );

    expect(result.tier).not.toBe("T3");
    expect(result.tool).not.toBeNull();
    expect(result.blocked).toBe(false);
    expect(provider.generate).toHaveBeenCalledTimes(1);
  });

  it("routes 'behind on coursework' to non-crisis support", async () => {
    const provider = fakeProvider("okay");
    const result = await runAgentTurn(
      initialAgentState(),
      "I am behind on my coursework and don't know how to organise my study time.",
      provider,
    );
    expect(result.tier).not.toBe("T3");
    expect(result.tool).not.toBeNull();
  });

  it("routes exhaustion/struggling-with-studies to non-crisis support", async () => {
    const provider = fakeProvider("okay");
    const result = await runAgentTurn(
      initialAgentState(),
      "I'm exhausted and struggling to keep up with my studies.",
      provider,
    );
    expect(result.tier).not.toBe("T3");
    expect(result.tool).not.toBeNull();
  });

  it("still activates the T3 pathway when self-harm intent is present inside academic framing", async () => {
    const provider = fakeProvider("should never be used");
    const result = await runAgentTurn(
      initialAgentState(),
      "I'm overwhelmed by my assignments and I'm thinking about ending my life.",
      provider,
    );
    expect(result.tier).toBe("T3");
    expect(result.tool).toBeNull();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.response).toContain("not an emergency service");
  });

  it("still activates the T3 pathway for 'don't want to be alive' framed around failing studies", async () => {
    const provider = fakeProvider("should never be used");
    const result = await runAgentTurn(
      initialAgentState(),
      "I don't want to be alive anymore because I feel like I'm failing my studies.",
      provider,
    );
    expect(result.tier).toBe("T3");
    expect(result.tool).toBeNull();
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("does not treat an ordinary evening-studies mention as a crisis, end to end", async () => {
    const provider = fakeProvider("okay");
    const result = await runAgentTurn(initialAgentState(), "I have studies to finish tonight.", provider);
    expect(result.tier).toBe("T0");
    expect(result.blocked).toBe(false);
  });
});

describe("sticky escalation explains an apparent false positive across turns (not a classification bug)", () => {
  it("an academic-overwhelm message reached after a real T3 message in the SAME session correctly stays at T3", async () => {
    // This documents the exact sequence from manual testing: a crisis-level
    // message first, then an ordinary academic-overwhelm message, in the
    // same un-reset session. SAFETY.md requires escalation to be sticky —
    // this must NOT drop back down. It is not the same as the
    // academic-overwhelm message being misclassified on its own; the tests
    // above confirm that message alone resolves to a non-T3 tier in a fresh
    // session.
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const crisisTurn = await runAgentTurn(
      session,
      "I feel like I can't cope anymore and I'm thinking about ending my life.",
      provider,
    );
    session = crisisTurn.session;
    expect(crisisTurn.tier).toBe("T3");

    const academicTurn = await runAgentTurn(
      session,
      "I have several assignments due soon and I'm completely overwhelmed. Can you help me " +
        "break my workload into manageable steps without making me feel pressured?",
      provider,
    );
    expect(academicTurn.tier).toBe("T3");
    expect(academicTurn.tool).toBeNull();
  });

  it("the same academic-overwhelm message in a brand-new (reset) session is not T3", async () => {
    const provider = fakeProvider("okay");
    const freshSession = initialAgentState();

    const result = await runAgentTurn(
      freshSession,
      "I have several assignments due soon and I'm completely overwhelmed. Can you help me " +
        "break my workload into manageable steps without making me feel pressured?",
      provider,
    );
    expect(result.tier).not.toBe("T3");
  });
});
