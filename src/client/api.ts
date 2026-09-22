/**
 * Browser-side client for the /api/turn endpoint.
 *
 * The browser now holds only an opaque, server-signed session token (a
 * string) between turns — never the raw SafetyState/tier object, and never
 * conversation text beyond what's shown on screen for that page load. The
 * safety pipeline itself no longer runs in the browser at all; this file
 * exists so the UI has one small, typed place to reach the server from.
 */

export interface TurnApiResult {
  sessionToken: string;
  response: string;
}

export class TurnApiError extends Error {}

export async function sendTurn(sessionToken: string | null, text: string): Promise<TurnApiResult> {
  let res: Response;
  try {
    res = await fetch("/api/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionToken, text }),
    });
  } catch {
    throw new TurnApiError("network_error");
  }

  if (!res.ok) {
    throw new TurnApiError("request_failed");
  }

  const data = (await res.json()) as TurnApiResult;
  return data;
}
