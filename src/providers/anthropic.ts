/**
 * One server-side call to the Anthropic Messages API, shared by the reply
 * provider (relay.ts) and the second-pass reviewer (reviewer.ts).
 *
 * Returns the reply text, or a short status label on any failure. It never
 * throws and never puts request or reply text into the label, so callers can
 * log the label without leaking anything a student wrote.
 */

export const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export interface MessagesCall {
  apiKey: string;
  model: string;
  system: string;
  userContent: string;
  maxTokens: number;
  timeoutMs: number;
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export type MessagesResult = { ok: true; text: string } | { ok: false; label: string };

export async function callMessages(call: MessagesCall): Promise<MessagesResult> {
  const { apiKey, model, system, userContent, maxTokens, timeoutMs, endpoint = ANTHROPIC_ENDPOINT, fetchImpl = fetch } = call;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: userContent }] }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, label: `HTTP ${res.status}` };
    const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
    const text = (data.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text as string)
      .join("")
      .trim();
    return text ? { ok: true, text } : { ok: false, label: "empty reply" };
  } catch {
    return { ok: false, label: "request failed or timed out" };
  } finally {
    clearTimeout(timer);
  }
}
