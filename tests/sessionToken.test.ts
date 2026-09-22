import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/server/sessionToken";
import { createSession, advanceSession } from "../src/agent/session";

describe("session token signing", () => {
  it("round-trips a fresh session unchanged", () => {
    const session = createSession();
    const token = signSession(session);
    expect(verifySession(token)).toEqual(session);
  });

  it("round-trips a session whose lastIntent is the newer 'greeting' value", () => {
    // Regression guard: sessionSchema.ts hard-codes the Intent list by
    // hand and must be kept in sync whenever agent/intent.ts's Intent
    // union grows — this would silently fail (falling back to a fresh
    // session) if that schema were forgotten when "greeting" was added.
    const withGreeting = advanceSession(
      createSession(),
      { tier: "T0", escalated: false, version: "0.1.0" },
      "greeting",
    );
    const token = signSession(withGreeting);
    expect(verifySession(token)).toEqual(withGreeting);
  });

  it("round-trips an escalated session unchanged", () => {
    const escalated = advanceSession(
      createSession(),
      { tier: "T3", escalated: true, version: "0.1.0" },
      "crisis_signal",
    );
    const token = signSession(escalated);
    expect(verifySession(token)).toEqual(escalated);
  });

  it("falls back to a fresh session when no token is given", () => {
    expect(verifySession(null)).toEqual(createSession());
    expect(verifySession(undefined)).toEqual(createSession());
  });

  it("falls back to a fresh session for a malformed token string", () => {
    expect(verifySession("not-a-real-token")).toEqual(createSession());
    expect(verifySession("only.one.dot.too.many")).toEqual(createSession());
    expect(verifySession("")).toEqual(createSession());
  });

  it("rejects a tampered payload even with a structurally valid token", () => {
    const escalated = advanceSession(
      createSession(),
      { tier: "T3", escalated: true, version: "0.1.0" },
      "crisis_signal",
    );
    const token = signSession(escalated);
    const [payload, signature] = token.split(".");

    // Attacker decodes the payload, forges a lower tier, re-encodes it,
    // but cannot produce a valid signature for the forged payload without
    // the server's secret.
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...escalated, safety: { ...escalated.safety, tier: "T0" } }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const forgedToken = `${forgedPayload}.${signature}`;

    expect(forgedToken).not.toBe(token);
    // The forged, lower-tier claim must NOT be honored. It must fall back
    // to a fresh session — never to the attacker's forged T0 claim being
    // trusted as if it were legitimately verified.
    expect(verifySession(forgedToken)).toEqual(createSession());
    expect(payload).toBeDefined();
  });

  it("rejects a token with a corrupted signature", () => {
    const token = signSession(createSession());
    const [payload] = token.split(".");
    expect(verifySession(`${payload}.not-a-valid-signature`)).toEqual(createSession());
  });

  it("rejects a validly-signed payload that doesn't match the expected session shape", () => {
    // Even a token the server itself would sign for a shape-invalid input
    // must not be accepted back — the shape check is a second, independent
    // line of defense beyond the signature.
    const wrongShapeToken = signSession({ not: "a session" } as never);
    expect(verifySession(wrongShapeToken)).toEqual(createSession());
  });
});
