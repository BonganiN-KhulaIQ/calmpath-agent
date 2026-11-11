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
 *
 * KNOWN, ACCEPTED LIMIT — replay: a token is valid for as long as the secret
 * is. A client that keeps an EARLIER token (say one issued before it
 * escalated) can send it again, which is equivalent to Reset: the server
 * cannot tell, because telling would need per-session server state, which the
 * no-storage constraint rules out. Adding an expiry would not close this
 * (it only shortens the window) and would silently lower a committed tier for
 * a tab left open past the expiry, so none is added. Detection of the
 * CURRENT message is unaffected: every turn is screened from scratch, so a
 * replayed token can never hide what the student writes now. Documented in
 * SAFETY.md; pinned by tests/token-limits.test.ts.
 */

const MIN_SECRET_LENGTH = 32;

/**
 * Thrown when session signing cannot run safely (missing or weak secret in a
 * deployed environment). Distinct from a bad request so the HTTP layer can
 * answer 500 and log the misconfiguration instead of blaming the student.
 * The message never contains conversation content.
 */
export class SessionConfigError extends Error {}

/**
 * The public development fallback key may only be used on a developer's own
 * machine (plain `npm run dev`, `vercel dev`, tests). Any deployed
 * environment is refused: production, AND preview, because preview URLs are
 * reachable by anyone and this key is in the public repository, so anyone
 * could forge a validly signed token there.
 */
function fallbackAllowed(): boolean {
  const vercelEnv = process.env["VERCEL_ENV"];
  if (vercelEnv !== undefined && vercelEnv !== "" && vercelEnv !== "development") return false;
  if (process.env["NODE_ENV"] === "production") return false;
  return true;
}

const DEV_FALLBACK_SECRET =
  "calmpath-local-development-fallback-secret-DO-NOT-USE-IN-PRODUCTION";

function resolveSecret(): string {
  const secret = process.env["CALMPATH_SESSION_SECRET"];
  if (secret && secret.length > 0) {
    // A short secret makes the HMAC guessable. Refuse it everywhere, not just
    // in production, so a weak value is caught the first time it is used.
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new SessionConfigError(
        `CALMPATH_SESSION_SECRET is too short (${secret.length} characters). ` +
          `Use at least ${MIN_SECRET_LENGTH} random characters.`,
      );
    }
    return secret;
  }

  if (!fallbackAllowed()) {
    throw new SessionConfigError(
      "CALMPATH_SESSION_SECRET is not set. Set it in the Vercel project's " +
        "Environment Variables for every environment that serves traffic " +
        "(Production AND Preview). Session signing must not run on the " +
        "public development fallback key in a deployed environment.",
    );
  }

  // eslint-disable-next-line no-console
  console.warn(
    "[calmpath] CALMPATH_SESSION_SECRET is not set — using the insecure, " +
      "publicly known development fallback key. This only runs on a local " +
      "development machine; deployed environments refuse to start without " +
      "a real secret.",
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
