import { describe, expect, it, vi } from "vitest";
import { runAgentTurn, initialAgentState } from "../src/agent/orchestrator";
import type { ModelProvider } from "../src/safety/types";

function fakeProvider(response: string): ModelProvider & { generate: ReturnType<typeof vi.fn> } {
  return { generate: vi.fn().mockResolvedValue(response) };
}

describe("integration — planner/router/tools/composer under the safety gates", () => {
  it("selects action_plan_builder at T0 for a planning request and composes tool + model content", async () => {
    const provider = fakeProvider("Here's a gentle reflection on that.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Can you help me make a plan for this week?", provider);

    expect(result.tier).toBe("T0");
    expect(result.tool).toBe("action_plan_builder");
    expect(result.blocked).toBe(false);
    expect(result.response).toContain("Here's a gentle reflection on that.");
    expect(result.response).toContain("manageable next step");
  });

  it("never runs action_plan_builder once tier has escalated to T2, even for an explicit planning request", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    // First push the session to T2.
    const first = await runAgentTurn(session, "They would be better off without me.", provider);
    session = first.session;
    expect(session.safety.tier).toBe("T2");

    // Now a planning request in the same (still-T2) session.
    const second = await runAgentTurn(session, "Can you help me make a plan for my week?", provider);

    expect(second.tier).toBe("T2");
    expect(second.tool).not.toBe("action_plan_builder");
    expect(second.tool).toBe("balance_support");
  });

  it("routes a T2 crisis-adjacent phrase to the support pathway guide, composed with the model text", async () => {
    const provider = fakeProvider("I'm still here with you.");
    const session = initialAgentState();

    const result = await runAgentTurn(
      session,
      "I feel like they'd be better off without me, but I don't want to hurt myself.",
      provider,
    );

    expect(result.tier).toBe("T2");
    expect(result.intent).toBe("crisis_signal");
    expect(result.tool).toBe("support_pathway_guide");
    expect(result.blocked).toBe(false);
    expect(result.response).toContain("I'm still here with you.");
  });

  it("still fully bypasses planner/tools/composer/model at T3, even when the request looks like a planning ask", async () => {
    const provider = fakeProvider("should never appear");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I want to die, can we make a plan for my week?", provider);

    expect(result.tier).toBe("T3");
    expect(result.tool).toBeNull();
    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.response).not.toContain("should never appear");
    expect(result.response).toContain("not an emergency service");
  });

  it("output gate still catches a policy violation even when it's buried inside composed tool + model text", async () => {
    // Tool content is safe by construction; the model is the untrusted part here.
    const provider = fakeProvider("You have clinical depression and should take medication for it.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Can you help me find some support resources?", provider);

    expect(result.tool).toBe("resource_navigator");
    expect(result.blocked).toBe(true);
    expect(result.blockedReasons).toEqual(expect.arrayContaining(["diagnosis", "medication"]));
    expect(result.response).not.toContain("clinical depression");
  });

  it("keeps sticky escalation intact across turns even as tool selection changes turn to turn", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const first = await runAgentTurn(session, "I feel overwhelmed and hopeless about my exams.", provider);
    session = first.session;
    expect(session.safety.tier).toBe("T1");
    expect(first.tool).toBe("emotional_checkin");

    const second = await runAgentTurn(session, "Can you help me find some support resources?", provider);
    expect(second.tier).toBe("T1"); // sticky — never drops back to T0
    expect(second.tool).toBe("resource_navigator");
  });
});
