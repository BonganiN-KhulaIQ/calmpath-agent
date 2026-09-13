import { describe, expect, it, vi } from "vitest";
import { runAgentTurn, initialAgentState } from "../src/agent/orchestrator";
import type { ModelProvider } from "../src/safety/types";

function fakeProvider(response: string): ModelProvider & { generate: ReturnType<typeof vi.fn> } {
  return { generate: vi.fn().mockResolvedValue(response) };
}

describe("runAgentTurn — pipeline ordering", () => {
  it("never calls the model at T3 (forced deterministic response instead)", async () => {
    const provider = fakeProvider("this should never be used");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I want to die.", provider);

    expect(provider.generate).not.toHaveBeenCalled();
    expect(result.tier).toBe("T3");
    expect(result.tool).toBeNull();
    expect(result.response).toContain("not an emergency service");
  });

  it("calls the model with the resolved tier and classified intent at T0-T2", async () => {
    const provider = fakeProvider("Here is a calm, safe reply.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "Can you help me find counselling support?", provider);

    expect(provider.generate).toHaveBeenCalledTimes(1);
    expect(provider.generate).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "T0", intent: "navigate" }),
    );
    expect(result.blocked).toBe(false);
    expect(result.tool).toBe("resource_navigator");
    // The composer merges tool content with the model's text; the model's
    // text is preserved verbatim inside the composed response.
    expect(result.response).toContain("Here is a calm, safe reply.");
  });

  it("resolves tier and intent before generation, regardless of provider behavior", async () => {
    const calls: string[] = [];
    const provider: ModelProvider = {
      generate: async (context) => {
        calls.push(`generate:${context.tier}:${context.intent}`);
        return "reply";
      },
    };
    const session = initialAgentState();

    await runAgentTurn(session, "I feel overwhelmed and hopeless about my exams.", provider);

    // The only generate call already carries the fully-resolved tier/intent —
    // proving preScreen + intent classification completed first.
    expect(calls).toEqual(["generate:T1:express"]);
  });

  it("routes a blocked (prohibited) generated response through the output gate fallback", async () => {
    const provider = fakeProvider("You have clinical depression and should take medication.");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I'm just feeling a bit stressed about exams.", provider);

    expect(result.blocked).toBe(true);
    expect(result.blockedReasons).toEqual(expect.arrayContaining(["diagnosis", "medication"]));
    expect(result.response).not.toContain("clinical depression");
  });

  it("keeps escalation sticky across turns via the session", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const first = await runAgentTurn(session, "I feel overwhelmed and hopeless.", provider);
    session = first.session;
    expect(session.safety.tier).toBe("T1");

    const second = await runAgentTurn(session, "Let's talk about my timetable instead.", provider);
    expect(second.tier).toBe("T1");
    expect(second.session.safety.tier).toBe("T1");
  });

  it("never lowers a committed T3 tier on a later calm turn", async () => {
    const provider = fakeProvider("okay");
    let session = initialAgentState();

    const first = await runAgentTurn(session, "I want to die.", provider);
    session = first.session;
    expect(session.safety.tier).toBe("T3");

    const second = await runAgentTurn(session, "Actually never mind, let's discuss my assignment.", provider);
    expect(second.tier).toBe("T3");
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("does not persist raw student text in session state", async () => {
    const provider = fakeProvider("okay");
    const session = initialAgentState();

    const result = await runAgentTurn(session, "I want to die.", provider);

    expect(JSON.stringify(result.session)).not.toContain("I want to die");
  });
});
