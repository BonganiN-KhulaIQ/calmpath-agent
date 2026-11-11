import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionConfigError, signSession } from "../src/server/sessionToken";
import { createSession } from "../src/agent/session";
import handler from "../src/server/turnApi";

const KEYS = ["CALMPATH_SESSION_SECRET", "VERCEL_ENV", "NODE_ENV"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  delete process.env["CALMPATH_SESSION_SECRET"];
  delete process.env["VERCEL_ENV"];
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.restoreAllMocks();
});

describe("public fallback signing key is local-development only", () => {
  it("is allowed on a developer machine (no VERCEL_ENV) and warns", () => {
    expect(() => signSession(createSession())).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it("is allowed under `vercel dev` (VERCEL_ENV=development)", () => {
    process.env["VERCEL_ENV"] = "development";
    expect(() => signSession(createSession())).not.toThrow();
  });

  it.each(["production", "preview"])("is refused on a Vercel %s deployment", (env) => {
    process.env["VERCEL_ENV"] = env;
    expect(() => signSession(createSession())).toThrow(SessionConfigError);
    expect(() => signSession(createSession())).toThrow(/Preview/);
  });

  it("is refused when NODE_ENV=production even outside Vercel", () => {
    process.env["NODE_ENV"] = "production";
    expect(() => signSession(createSession())).toThrow(SessionConfigError);
  });

  it("a real 32+ character secret works in every environment", () => {
    process.env["CALMPATH_SESSION_SECRET"] = "k".repeat(40);
    for (const env of ["production", "preview", "development"]) {
      process.env["VERCEL_ENV"] = env;
      expect(() => signSession(createSession())).not.toThrow();
    }
  });

  it("a too-short secret is a SessionConfigError", () => {
    process.env["CALMPATH_SESSION_SECRET"] = "short";
    expect(() => signSession(createSession())).toThrow(SessionConfigError);
  });
});

function fakeRes() {
  const res = {
    code: 0,
    body: undefined as unknown,
    status(c: number) {
      res.code = c;
      return res;
    },
    json(b: unknown) {
      res.body = b;
      return res;
    },
  };
  return res;
}

describe("POST /api/turn on a misconfigured deployment", () => {
  it("answers 500 with a generic message, logs the cause, and never logs the student's text", async () => {
    process.env["VERCEL_ENV"] = "preview";
    const res = fakeRes();
    const secretText = "my private message about exams zq7";
    await handler({ method: "POST", body: { text: secretText, sessionToken: null } } as never, res as never);

    expect(res.code).toBe(500);
    expect(res.body).toEqual({ error: "CalmPath is temporarily unavailable." });

    const logged = JSON.stringify([
      ...vi.mocked(console.error).mock.calls,
      ...vi.mocked(console.warn).mock.calls,
    ]);
    expect(logged).toContain("CALMPATH_SESSION_SECRET");
    expect(logged).not.toContain("zq7");
    expect(logged).not.toContain("exams");
  });

  it("still answers 400 for an invalid message (empty text) when correctly configured", async () => {
    process.env["CALMPATH_SESSION_SECRET"] = "k".repeat(40);
    process.env["VERCEL_ENV"] = "production";
    const res = fakeRes();
    await handler({ method: "POST", body: { text: "", sessionToken: null } } as never, res as never);
    expect(res.code).toBe(400);
  });

  it("serves a normal turn when correctly configured", async () => {
    process.env["CALMPATH_SESSION_SECRET"] = "k".repeat(40);
    process.env["VERCEL_ENV"] = "preview";
    const res = fakeRes();
    await handler(
      { method: "POST", body: { text: "I have an assignment due.", sessionToken: null } } as never,
      res as never,
    );
    expect(res.code).toBe(200);
    expect((res.body as { tier: string }).tier).toBe("T0");
  });
});
