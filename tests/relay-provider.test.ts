import { describe, expect, it, vi } from "vitest";
import { createRelayProvider, RELAY_SYSTEM_PROMPT } from "../src/providers/relay";
import { selectProvider } from "../src/providers/select";
import { mockProvider } from "../src/providers/mock";
import { handleTurnRequest } from "../src/server/turnHandler";
import { classifyIntent } from "../src/agent/intent";

const ctx = { tier: "T1", intent: "express", text: "I feel overwhelmed" } as const;

function okFetch(text: string) {
  return vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200 }));
}

describe("relay provider", () => {
  it("sends the key server-side, a safety system prompt and the student's text", async () => {
    const fetchImpl = okFetch("That sounds heavy. What feels like the smallest next step?");
    const p = createRelayProvider({ apiKey: "sk-test", fallback: mockProvider, fetchImpl });
    const out = await p.generate(ctx);
    expect(out).toContain("smallest next step");
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.system).toContain(RELAY_SYSTEM_PROMPT);
    expect(body.messages).toEqual([{ role: "user", content: "I feel overwhelmed" }]);
  });

  it.each([
    ["HTTP error", async () => new Response("nope", { status: 500 })],
    ["empty reply", async () => new Response(JSON.stringify({ content: [] }), { status: 200 })],
    ["network failure", async () => { throw new Error("down"); }],
  ])("falls back to the mock on %s and never throws", async (_n, impl) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = createRelayProvider({ apiKey: "k", fallback: mockProvider, fetchImpl: impl as unknown as typeof fetch });
    expect(await p.generate(ctx)).toBe(await mockProvider.generate(ctx));
    expect(warn.mock.calls.flat().join(" ")).not.toContain("overwhelmed");
    warn.mockRestore();
  });

  it("times out and falls back", async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_r, rej) => init.signal?.addEventListener("abort", () => rej(new Error("abort"))))) as unknown as typeof fetch;
    const p = createRelayProvider({ apiKey: "k", fallback: mockProvider, fetchImpl: hang, timeoutMs: 20 });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await p.generate(ctx)).toBe(await mockProvider.generate(ctx));
  });
});

describe("selectProvider", () => {
  it("uses the mock without a key, or when forced", () => {
    expect(selectProvider({})).toBe(mockProvider);
    expect(selectProvider({ CALMPATH_LLM_API_KEY: "k", CALMPATH_PROVIDER: "mock" })).toBe(mockProvider);
  });
  it("uses the relay when a key is set", () => {
    expect(selectProvider({ CALMPATH_LLM_API_KEY: "k" })).not.toBe(mockProvider);
  });
});

describe("relay inside the safety pipeline", () => {
  it("is never called at T3", async () => {
    const generate = vi.fn(async () => "model text");
    const r = await handleTurnRequest({ text: "I want to kill myself." }, { generate });
    expect(r.tier).toBe("T3");
    expect(generate).not.toHaveBeenCalled();
  });

  it("has unsafe model output replaced by the output gate", async () => {
    const generate = async () => "You have clinical depression and should take medication.";
    const r = await handleTurnRequest({ text: "I feel so overwhelmed lately" }, { generate });
    expect(r.blocked).toBe(true);
    expect(r.response).not.toMatch(/clinical depression/i);
  });
});

describe("coursework pressure routing", () => {
  it("routes assignment/deadline messages to the understand intent", () => {
    expect(classifyIntent("I have 3 assignments due")).toBe("understand");
    expect(classifyIntent("my exam is on Friday")).toBe("understand");
  });
  it("does not change how plain distress or greetings route", () => {
    expect(classifyIntent("I feel overwhelmed")).toBe("express");
    expect(classifyIntent("Hi")).toBe("greeting");
    expect(classifyIntent("I feel overwhelmed and hopeless about my exams.")).toBe("express");
  });
  it("uses the academic pressure tool once the session is elevated", async () => {
    const a = await handleTurnRequest({ text: "I feel overwhelmed" }, mockProvider);
    expect(a.tier).toBe("T1");
    const b = await handleTurnRequest({ text: "I have 3 assignments due", sessionToken: a.sessionToken }, mockProvider);
    expect(b.tool).toBe("academic_pressure_support");
    expect(b.response).not.toBe(a.response);
  });
});
