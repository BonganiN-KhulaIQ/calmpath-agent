import { createHmac, timingSafeEqual } from "node:crypto";
import { createSession, type SessionContext } from "../agent/session";
import { SessionContextSchema } from "./sessionSchema";

/**
 * Server-signed, stateless session tokens.
 *
 * CalmPath is explicitly no-database, no-accounts (CLAUDE.md) and the safety
 * pipeline is sticky-escalation-only (SAFETY.md: a committed tier can never
 * drop). Once the pipeline moved server-side, the session state itself had
 * to travel with the client between requests — but a plain JSON blob would
 * let anyone open devtools, edit `{"safety":{"tier":"T0",...}}` back into
 * their request, and undo their own escalation without using Reset.
 *
 * Signing the session with an HMAC the client never sees the key for closes
 * that specific hole: the client can still discard its token to start over
 * (that's just Reset), but it cannot forge a *different* prior session state
 * — any tampering fails verification and is treated as "no session", i.e.
 * a fresh T0 start, never as a trusted claim of a lower tier than was
 * actually reached.
 *
 * This still stores nothing server-side: the signed token itself IS the
 * state, kept entirely on the client, exactly as before.
 */

const DEV_FALLBACK_SECRET =
  "calmpath-local-development-fallback-secret-DO-NOT-USE-IN-PRODUCTION";

function resolveSecret(): string {
  const secret = process.env["CALMPATH_SESSION_SECRET"];
  if (secret && secret.length > 0) return secret;

  if (process.env["VERCEL_ENV"] === "production") {
    throw new Error(
      "CALMPATH_SESSION_SECRET is not set. Set it in the Vercel project's " +
        "Environment Variables before deploying to production — session " +
        "signing must not run on a fallback secret in production.",
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[calmpath] CALMPATH_SESSION_SECRET is not set — using an insecure, " +
      "development-only fallback signing key. This is fine for local dev " +
      "and preview only. Set the real environment variable before going " +
      "to production.",
  );
  return DEV_FALLBACK_SECRET;
}

function toBase64Url(input: Buffer): string {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function sign(payloadB64: string): string {
  return toBase64Url(createHmac("sha256", resolveSecret()).update(payloadB64).digest());
}

/** Produces a signed, opaque token string carrying the given session. */
export function signSession(session: SessionContext): string {
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Verifies and decodes a session token. Any failure — missing token,
 * malformed token, bad signature, or a payload that doesn't match the
 * expected shape — deterministically falls back to a brand-new session
 * rather than throwing or trusting the input. That fallback is exactly what
 * clicking "Reset session" already produces, so a tampered or corrupted
 * token degrades to the same safe, unprivileged state instead of causing an
 * error or, worse, being partially trusted.
 */
export function verifySession(token: string | null | undefined): SessionContext {
  if (!token) return createSession();

  const parts = token.split(".");
  if (parts.length !== 2) return createSession();
  const [payloadB64, signatureB64] = parts;
  if (!payloadB64 || !signatureB64) return createSession();

  const expected = sign(payloadB64);
  const provided = Buffer.from(signatureB64);
  const wanted = Buffer.from(expected);
  if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
    return createSession();
  }

  try {
    const parsedJson = JSON.parse(fromBase64Url(payloadB64).toString("utf8"));
    const result = SessionContextSchema.safeParse(parsedJson);
    if (!result.success) return createSession();
    return result.data;
  } catch {
    return createSession();
  }
}
