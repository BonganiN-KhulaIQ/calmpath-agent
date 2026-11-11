import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "../src/server/sessionToken";
import { advanceSession, createSession } from "../src/agent/session";
import { handleTurnRequest } from "../src/server/turnHandler";

const escalate = () =>
  advanceSession(createSession(), { tier: "T3", escalated: true, version: "0.1.0" }, "crisis_signal");

function decodePayload(token: string): string {
  const b64 = (token.split(".")[0] ?? "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf8");
}

describe("session token — documented limits (see SAFETY.md)", () => {
  it("REPLAY IS A KNOWN LIMIT: an earlier validly signed token is accepted again (same as Reset)", () => {
    // If this test ever fails, replay protection was added: update SAFETY.md and
    // sessionToken.ts, and re-check the no-server-storage constraint in CLAUDE.md.
    const earlier = signSession(createSession());
    const later = signSession(escalate());
    expect(verifySession(later).safety.tier).toBe("T3");
    expect(verifySession(earlier).safety.tier).toBe("T0");
  });

  it("a replayed earlier token can never hide the CURRENT message: it is screened from scratch", async () => {
    const earlier = signSession(createSession());
    const result = await handleTurnRequest({ text: "I want to kill myself.", sessionToken: earlier });
    expect(result.tier).toBe("T3");
    expect(result.tool).toBeNull();
  });

  it("editing a signed payload (e.g. lowering the tier) invalidates it and gives a fresh session", () => {
    const token = signSession(escalate());
    const [payload, signature] = token.split(".");
    const edited = Buffer.from(decodePayload(token).replace('"T3"', '"T0"'), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(edited).not.toBe(payload);
    expect(verifySession(`${edited}.${signature}`)).toEqual(createSession());
  });

  it("the token payload carries no conversation text", async () => {
    const result = await handleTurnRequest({
      text: "I want to kill myself, my secret phrase is xylophone-77.",
      sessionToken: null,
    });
    const payload = decodePayload(result.sessionToken);
    expect(payload).not.toContain("xylophone");
    expect(payload).not.toContain("kill");
    expect(payload).not.toContain("myself");
  });
});
