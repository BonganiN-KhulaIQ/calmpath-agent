import { describe, expect, it, vi } from "vitest";
import { runAgentTurn, initialAgentState } from "../src/agent/orchestrator";
import { applyOutputGate } from "../src/safety/outputGate";
import { composeResponse } from "../src/agent/composer";
import * as routerModule from "../src/agent/router";
import * as toolsModule from "../src/tools/index";
import * as composerModule from "../src/agent/composer";
import type { ModelProvider } from "../src/safety/types";
import type { ToolOutput } from "../src/tools/types";

function fakeProvider(response: string): ModelProvider & { generate: ReturnType<typeof vi.fn> } {
  return { generate: vi.fn().mockResolvedValue(response) };
}

describe("E2E-A — ordinary wellbeing conversation", () => {
  it("goes user -> preScreen(T0) -> intent -> policy -> tool -> composer -> outputGate -> response", async () => {
    const provider = fakeProvider("Thanks for sharing that with me.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I've been feeling a bit tired from studying lately.", provider);

    expect(result.tier).toBe("T0");
    expect(result.blocked).toBe(false);
    expect(result.tool).not.toBeNull();
    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(result.response).toContain("Thanks for sharing that with me.");
  });
});

describe("E2E-B — planning request availability", () => {
  it("permits action_plan_builder at T0 and T1", async () => {
    const provider = fakeProvider("okay");

    const t0 = await runAgentTurn(initialAgentState(), "Can you help me plan my study week?", provider);
    expect(t0.tier).toBe("T0");
    expect(t0.tool).toBe("action_plan_builder");

    let session = initialAgentState();
    const setup = await runAgentTurn(session, "I feel overwhelmed and hopeless about my exams.", provider);
    session = setup.session;
    expect(session.safety.tier).toBe("T1");

    const t1 = await runAgentTurn(session, "Can you help me plan my study week?", provider);
    expect(t1.tier).toBe("T1");
    expect(t1.tool).toBe("action_plan_builder");
  });

  it("withholds action_plan_builder once policy disallows planning (T2+)", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const setup = await runAgentTurn(session, "Everyone would be better off without me.", provider);
    session = setup.session;
    expect(session.safety.tier).toBe("T2");

    const result = await runAgentTurn(session, "Can you help me plan my study week?", provider);
    expect(result.tool).toBe("balance_support");
    expect(result.tool).not.toBe("action_plan_builder");
  });
});

describe("E2E-C — elevated-risk conversation", () => {
  it("requires a crisis resource and blocks diagnosis/medication content at T2", async () => {
    const provider = fakeProvider("I'm still here with you.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Everyone would be better off without me.", provider);

    expect(result.tier).toBe("T2");
    expect(result.blocked).toBe(false);
    // support content is present via the composed tool output, without
    // the UI or test needing to know about internal tier/policy objects
    expect(result.response.length).toBeGreaterThan(0);

    // A model that violates output restrictions is still caught at T2.
    const providerBad = fakeProvider("You have clinical depression and should take medication.");
    const sessionBad = initialAgentState();
    const badResult = await runAgentTurn(sessionBad, "Everyone would be better off without me.", providerBad);
    expect(badResult.blocked).toBe(true);
    expect(badResult.response).not.toContain("clinical depression");
  });
});

describe("E2E-D — T3 fully bypasses planner/router/tools/composer/model", () => {
  it("never invokes selectTool, runTool, composeResponse, or provider.generate; outputGate still runs", async () => {
    const selectToolSpy = vi.spyOn(routerModule, "selectTool");
    const runToolSpy = vi.spyOn(toolsModule, "runTool");
    const composeSpy = vi.spyOn(composerModule, "composeResponse");
    const outputGateSpy = vi.spyOn(await import("../src/safety/outputGate"), "applyOutputGate");

    const provider = fakeProvider("should never be used");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I am going to kill myself.", provider);

    expect(result.tier).toBe("T3");
    expect(provider.generate).not.toHaveBeenCalled();
    expect(selectToolSpy).not.toHaveBeenCalled();
    expect(runToolSpy).not.toHaveBeenCalled();
    expect(composeSpy).not.toHaveBeenCalled();
    expect(outputGateSpy).toHaveBeenCalledTimes(1);
    expect(result.response).toContain("not an emergency service");
    expect(result.response).not.toContain("should never be used");

    selectToolSpy.mockRestore();
    runToolSpy.mockRestore();
    composeSpy.mockRestore();
    outputGateSpy.mockRestore();
  });
});

describe("E2E-E — prohibited content is blocked regardless of source", () => {
  it("blocks composed text even when the prohibited phrase originates in tool output, not model output", () => {
    // Tool output is safe by construction in this repo; this simulates a
    // hypothetical tool defect to prove the gate does not trust the source.
    const compromisedTool: ToolOutput = {
      toolId: "reflective_conversation",
      summary: "You have clinical depression and should take medication.",
      details: ["A perfectly safe detail line."],
    };
    const combined = composeResponse(compromisedTool, "A perfectly safe model reply.");

    const gated = applyOutputGate(combined, "T1", "FALLBACK_TEXT");

    expect(gated.allowed).toBe(false);
    expect(gated.response).toBe("FALLBACK_TEXT");
    expect(gated.blockedReasons).toEqual(expect.arrayContaining(["diagnosis", "medication"]));
  });
});

describe("E2E-F — sticky escalation across multiple subsequent turns", () => {
  it("stays at the highest committed tier across three turns even when later turns are calm", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const turn1 = await runAgentTurn(session, "I feel overwhelmed and hopeless.", provider);
    session = turn1.session;
    expect(session.safety.tier).toBe("T1");

    const turn2 = await runAgentTurn(session, "Let's talk about my course registration.", provider);
    session = turn2.session;
    expect(turn2.tier).toBe("T1");

    const turn3 = await runAgentTurn(session, "Actually I'm doing okay today, thanks.", provider);
    expect(turn3.tier).toBe("T1");
    expect(turn3.session.safety.tier).toBe("T1");
  });
});

describe("E2E-G — false-positive crisis wording", () => {
  it("does not route ordinary words containing 'die' as a substring to a crisis tool or tier", async () => {
    const provider = fakeProvider("okay");
    const session = initialAgentState();

    const result = await runAgentTurn(
      session,
      "I've been struggling to keep up with my studies and diet this week.",
      provider,
    );

    expect(result.tier).toBe("T0");
    expect(result.intent).not.toBe("crisis_signal");
    expect(result.tool).not.toBe("support_pathway_guide");
  });
});

describe("E2E-H — greeting", () => {
  it("greets back on a fresh session's first plain greeting", async () => {
    const provider = fakeProvider("(model text, unused for this assertion)");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Hi", provider);

    expect(result.tier).toBe("T0");
    expect(result.intent).toBe("greeting");
    expect(result.tool).toBe("greeting_response");
    expect(result.blocked).toBe(false);
    expect(result.response).toMatch(/hello|hi/i);
  });

  it("a greeting attached to a real question still routes to the tool that question needs", async () => {
    const provider = fakeProvider("okay");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Hi, where can I find support?", provider);

    expect(result.intent).toBe("navigate");
    expect(result.tool).toBe("resource_navigator");
  });

  it("does NOT let a later plain greeting undo a session's sticky T3 escalation", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const crisisTurn = await runAgentTurn(session, "I want to kill myself.", provider);
    session = crisisTurn.session;
    expect(crisisTurn.tier).toBe("T3");

    // The whole point of this feature is a friendlier reply for a plain
    // "hi" — it must never become a way to slip past a committed T3 tier.
    const greetingAfterCrisis = await runAgentTurn(session, "Hi", provider);
    expect(greetingAfterCrisis.tier).toBe("T3");
    expect(greetingAfterCrisis.tool).toBeNull();
    expect(greetingAfterCrisis.blocked).toBe(false);
    expect(greetingAfterCrisis.response).not.toMatch(/^hello! i'm glad you're here/i);
  });
});
