import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/server/sessionToken";
import { createSession } from "../src/agent/session";

const ORIGINAL = process.env["CALMPATH_SESSION_SECRET"];
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env["CALMPATH_SESSION_SECRET"];
  else process.env["CALMPATH_SESSION_SECRET"] = ORIGINAL;
});

describe("session secret strength", () => {
  it("rejects a secret shorter than 32 characters", () => {
    process.env["CALMPATH_SESSION_SECRET"] = "short-secret";
    expect(() => signSession(createSession())).toThrow(/too short/);
  });

  it("accepts a 32+ character secret and round-trips a session", () => {
    process.env["CALMPATH_SESSION_SECRET"] = "x".repeat(32);
    const token = signSession(createSession());
    expect(verifySession(token).turnCount).toBe(0);
  });
});

describe("vercel.json security headers", () => {
  const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")) as {
    headers: { source: string; headers: { key: string; value: string }[] }[];
  };
  const forSource = (source: string) =>
    Object.fromEntries(
      (config.headers.find((h) => h.source === source)?.headers ?? []).map((h) => [h.key, h.value]),
    );

  it("sets a strict CSP, no framing, nosniff and no referrer on every route", () => {
    const h = forSource("/(.*)");
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).not.toContain("unsafe-inline");
    expect(h["Content-Security-Policy"]).not.toContain("unsafe-eval");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("no-referrer");
  });

  it("marks API responses as non-cacheable", () => {
    expect(forSource("/api/(.*)")["Cache-Control"]).toBe("no-store");
  });
});
