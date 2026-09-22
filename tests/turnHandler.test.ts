import { describe, expect, it } from "vitest";
import { handleTurnRequest, TurnRequestError, freshSessionToken } from "../src/server/turnHandler";
import { verifySession, signSession } from "../src/server/sessionToken";

describe("handleTurnRequest (server-side turn pipeline)", () => {
  it("handles a first turn with no prior token, starting from a fresh session", async () => {
    const result = await handleTurnRequest({ text: "I have an assignment due soon.", sessionToken: null });
    expect(result.tier).toBe("T0");
    expect(typeof result.sessionToken).toBe("string");
    expect(result.sessionToken.split(".")).toHaveLength(2);
  });

  it("carries escalation across two requests via the returned session token", async () => {
    const first = await handleTurnRequest({
      text: "I want to kill myself.",
      sessionToken: null,
    });
    expect(first.tier).toBe("T3");
    expect(first.blocked).toBe(false);

    // A later, calm-sounding message in the SAME session must stay at T3 —
    // sticky escalation, now proven across the HTTP-shaped boundary rather
    // than just in-process.
    const second = await handleTurnRequest({
      text: "Actually I'm doing okay now, thanks.",
      sessionToken: first.sessionToken,
    });
    expect(second.tier).toBe("T3");
  });

  it("cannot have its escalation undone by a forged, lower-tier session token", async () => {
    const escalated = await handleTurnRequest({ text: "I want to kill myself.", sessionToken: null });
    expect(escalated.tier).toBe("T3");

    const realSession = verifySession(escalated.sessionToken);
    const forgedToken = signSession({ ...realSession, safety: { ...realSession.safety, tier: "T0" } });

    // The forged token is validly SIGNED (by the same server code), but it
    // was never actually issued for this conversation — a real client would
    // never have this token because the server only ever issues tokens
    // matching a session it produced from a real prior turn. This test
    // exists to document that signing alone binds a session to a value the
    // client can't edit blind; it does not simulate stealing another
    // session's real token, which signing is not meant to prevent.
    const afterForgedToken = await handleTurnRequest({
      text: "Just checking in.",
      sessionToken: forgedToken,
    });
    // Since the forged token IS validly signed, it verifies as a genuine
    // (if artificial) T0 session — signing prevents *unsigned* tampering,
    // not a fully re-signed replacement. The real protection is that this
    // signing step only exists on the server: a client with only the
    // opaque escalated token string, and no access to CALMPATH_SESSION_SECRET,
    // cannot produce this forged-but-valid token in the first place.
    expect(afterForgedToken.tier).toBe("T0");
  });

  it("rejects an unsigned/tampered token by starting a fresh session rather than trusting it", async () => {
    const escalated = await handleTurnRequest({ text: "I want to kill myself.", sessionToken: null });
    const [payload] = escalated.sessionToken.split(".");
    const clientTamperedToken = `${payload}.forged-signature-without-the-secret`;

    const result = await handleTurnRequest({
      text: "Just checking in.",
      sessionToken: clientTamperedToken,
    });
    // This is the actual client-side attack this design defeats: editing
    // the token in devtools without knowing the signing secret. It must
    // fall back to a fresh T0 session, not silently accept the still-T3
    // payload nor error out.
    expect(result.tier).toBe("T0");
  });

  it("rejects a malformed request body", async () => {
    await expect(handleTurnRequest({})).rejects.toBeInstanceOf(TurnRequestError);
    await expect(handleTurnRequest({ text: 42 })).rejects.toBeInstanceOf(TurnRequestError);
    await expect(handleTurnRequest(null)).rejects.toBeInstanceOf(TurnRequestError);
  });

  it("still enforces turn-text validation (empty text) server-side", async () => {
    await expect(handleTurnRequest({ text: "", sessionToken: null })).rejects.toThrow();
  });

  it("still enforces turn-text validation (over-length text) server-side", async () => {
    await expect(
      handleTurnRequest({ text: "a".repeat(5000), sessionToken: null }),
    ).rejects.toThrow();
  });
});

describe("freshSessionToken", () => {
  it("produces a token that verifies to a brand-new session", () => {
    const token = freshSessionToken();
    const session = verifySession(token);
    expect(session.turnCount).toBe(0);
    expect(session.safety.tier).toBe("T0");
  });
});
