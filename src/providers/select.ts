import type { ModelProvider } from "../safety/types";
import { mockProvider } from "./mock";
import { createRelayProvider } from "./relay";
import { createReplyReviewer, withReview } from "./reviewer";

/**
 * Picks the provider for this server process.
 * - No CALMPATH_LLM_API_KEY, or CALMPATH_PROVIDER=mock: the deterministic mock (today's behaviour).
 * - Otherwise: the hosted relay, ALWAYS wrapped in the second-pass reviewer. There is deliberately
 *   no setting that turns the reviewer off: a model reply that has not been reviewed is not used.
 *   Both fall back to the mock on any failure.
 */
export function selectProvider(
  env: Record<string, string | undefined> = process.env,
  fetchImpl?: typeof fetch,
): ModelProvider {
  const apiKey = env["CALMPATH_LLM_API_KEY"]?.trim();
  if (!apiKey || env["CALMPATH_PROVIDER"] === "mock") return mockProvider;
  const model = env["CALMPATH_LLM_MODEL"]?.trim();
  const reviewModel = env["CALMPATH_REVIEW_MODEL"]?.trim();
  const shared = fetchImpl ? { fetchImpl } : {};
  const relay = createRelayProvider({ apiKey, ...(model ? { model } : {}), fallback: mockProvider, ...shared });
  const reviewer = createReplyReviewer({ apiKey, ...(reviewModel ? { model: reviewModel } : {}), ...shared });
  return withReview(relay, reviewer, mockProvider);
}
