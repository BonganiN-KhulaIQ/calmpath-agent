# Progress

## Backend split: safety pipeline moved server-side, signed session tokens

**What changed:** the deterministic safety pipeline (`runAgentTurn` and everything it calls —
`risk.ts`, `policy.ts`, `outputGate.ts`, the router, the 10 tools, the composer) now runs on the
server, not in the browser. Nothing about the pipeline itself changed — same functions, same
files, same behavior, same 81 pre-existing tests untouched and passing. What moved is *who calls
it*: previously `main.tsx` called `runAgentTurn` directly in the browser; now the browser calls a
new `POST /api/turn` endpoint, which calls it.

**Why:** with the pipeline running client-side, the safety gates were enforced by code the
student's own browser was executing — auditable, but also editable. Anyone with devtools open
could, in principle, patch out the T3 check entirely. Moving the same, unmodified pipeline behind
an HTTP boundary means the gates run somewhere the client can inspect responses from but cannot
alter the logic of.

**The harder problem this created, and how it's solved:** CalmPath is explicitly no-database,
no-accounts (`CLAUDE.md`), and correctly so for a project this early — so session state (the risk
tier, turn count, last intent) still has to live on the client and travel with each request, the
same as before. But a plain JSON session sent back by the client is just as editable as the old
in-browser pipeline was: a student could edit `{"safety":{"tier":"T0"}}` back into a request and
undo their own sticky escalation without using "Reset session".

Fixed with **signed, stateless session tokens** (`src/server/sessionToken.ts`): every response
carries an opaque token — the session JSON, HMAC-SHA256-signed with a server-only secret
(`CALMPATH_SESSION_SECRET`), base64url-encoded as `<payload>.<signature>`. The client stores and
returns this token verbatim; it never sees the secret and cannot produce a valid signature for an
edited payload. On the next request the server re-verifies the signature (constant-time
comparison) and the decoded shape (a zod schema, `src/server/sessionSchema.ts`) before trusting
anything in it. Any failure — no token, corrupted token, bad signature, wrong shape — falls back
to a **brand-new T0 session**, exactly what "Reset session" already produces, rather than
throwing or silently trusting a forged claim. This still stores nothing server-side: the signed
token *is* the state, held entirely by the client, same as the plain JSON was before.

**New files:**
- `src/server/turnHandler.ts` — framework-independent `handleTurnRequest(body)`; verifies the
  token, calls the unchanged `runAgentTurn` with the mock provider, signs and returns the new
  session token plus the response.
- `src/server/sessionToken.ts` / `src/server/sessionSchema.ts` — signing/verification and the
  validated session shape.
- `api/turn.ts` — the actual Vercel serverless function; a thin adapter translating
  `VercelRequest`/`VercelResponse` to/from `handleTurnRequest`. All real logic lives in
  `src/server/`, not here, so it's testable without any HTTP framework involved.
- `src/client/api.ts` — the browser's fetch wrapper; `main.tsx` now holds only the opaque token
  string in React state, never the raw safety object.
- A dev-only Vite plugin in `vite.config.ts` serves `/api/turn` during `npm run dev` by calling
  `handleTurnRequest` in-process, so local development still works with the exact same one
  command as before — no Vercel CLI or separate server needed to try the app locally. This plugin
  is not part of the production build; Vercel serves `api/turn.ts` directly there.

**New tests (15 — 96 total, all passing, 0 removed/weakened):**
- `tests/sessionToken.test.ts` (7) — sign/verify round-trips for fresh and escalated sessions;
  falls back to a fresh session for a missing, malformed, or corrupted-signature token; and the
  key case — a payload with a forged lower tier, re-encoded without a valid signature for that
  new payload, is rejected rather than trusted.
- `tests/turnHandler.test.ts` (8) — proves the full pipeline behavior through the HTTP-shaped
  boundary: T0 routing, T3 crisis handling, sticky escalation carried across two real requests via
  the returned token, a devtools-style tampered token falling back to fresh T0 rather than
  reviving the T3 payload, malformed request bodies rejected, and empty/over-length text still
  rejected server-side exactly as `parseTurnInput` always required.

**Manual end-to-end verification (not just unit tests):** ran `npm run dev` and sent real HTTP
requests to `/api/turn` with `curl`. A calm message returned T0 with `reflective_conversation`; an
explicit crisis message returned T3 with the forced response and no tool; a calm follow-up sent
with the T3 session's own real token stayed at T3 (sticky escalation proven over a real network
round-trip, not just in-process); a `GET` request correctly returned 405. Also confirmed the
production client bundle (`dist/assets/*.js`) contains no trace of `CALMPATH_SESSION_SECRET`,
`createHmac`, or `node:crypto` — the signing logic never ships to the browser.

**What did NOT change:** the pipeline's internal logic, order, and every existing test file are
untouched. The model provider is still mock-only (see "Current provider / model status" below) —
this phase was about where the gates run and how session state is protected in transit, not about
adding a real LLM. No database, accounts, or server-side conversation storage were added; nothing
new is persisted anywhere.

**Before deploying:** the Vercel project needs a real `CALMPATH_SESSION_SECRET` environment
variable set (any long random string). Without it, the server falls back to a fixed, publicly-
known development secret and logs a warning — safe for local dev, not for production, and
`sessionToken.ts` deliberately throws instead of using that fallback when `VERCEL_ENV` is
`"production"` and the variable is unset, so a misconfigured production deploy fails loudly
rather than shipping with a guessable signing key.

---

## Investigation (post-safety-fix): reported "academic overwhelm reaches T3" — NOT a bug

**Reported:** manually testing `"I have several assignments due soon and I'm completely
overwhelmed. Can you help me break my workload into manageable steps without making me feel
pressured?"` right after the crisis-detection test returned the T3 crisis response instead of
academic support.

**Investigated:** tested this message, and five other requested scenarios, directly against
`detectTier` and against the full orchestrator in a **fresh session**. Every one of them already
classified correctly with **zero code changes**:
- Academic overwhelm/planning messages (including the exact reported message) → **T1 or T0**,
  routed to `action_plan_builder` or other academic-support tooling, never blocked.
- Explicit self-harm/suicidal intent framed around academic failure (`"...thinking about ending
  my life"`, `"I don't want to be alive anymore because I feel like I'm failing my studies"`) →
  **T3**, forced response, model/tools never called — priority over academic framing, as required.
- `"I have studies to finish tonight."` → **T0**, not a crisis signal.

**Root cause of the report:** reproduced the exact manual-test sequence (the T3 crisis message
tested first, then the academic-overwhelm message, in the same browser session without clicking
"Reset session"). Result: T3, then T3 again. This is **sticky escalation working exactly as
`SAFETY.md` requires** ("Escalation is sticky... never lower a committed tier") — not an
over-escalation defect. The same academic-overwhelm message in a brand-new session correctly
resolves to T1.

**Change made:** none to `risk.ts`, `policy.ts`, or `outputGate.ts` — there was no actual
classification bug to fix, and changing detection thresholds based on a false premise would have
been a real risk to the architecture, not a fix. Added `tests/academic-vs-crisis.test.ts` (11
tests) locking in: all 6 originally-requested scenarios, both at the `detectTier` level and
end-to-end through the orchestrator in fresh sessions; and two tests that explicitly document the
sticky-escalation distinction (same academic message stays T3 in an un-reset post-crisis session,
but is not T3 in a fresh one) so this exact "is it a bug or is it sticky escalation" question is
answered by the test suite itself going forward.

**Verification:** typecheck clean, build clean, full suite **81/81 passing** (70 pre-existing + 11
new) — all existing tests, including the crisis-regression suite from the previous fix, pass
unmodified. T3 bypass behavior (no model/planner/router/tools/composer, output gate still runs)
remains intact and is re-verified in this new test file. "studies" remains confirmed non-crisis at
both the `detectTier` and full-orchestrator level.

---

## SAFETY-CRITICAL FIX (post-final-phase): missed T3 detection on natural-language crisis statements

**Bug:** manual UI testing found that `"I feel like I can't cope anymore and I'm thinking about
ending my life."` was answered with an ordinary supportive response instead of the T3 crisis
pathway. Confirmed as a real detection failure, not a UI or orchestration bug.

**Root cause:** `src/safety/risk.ts`'s T3 patterns only matched a few narrow, literal
constructions (`"going to/about to kill/hurt myself"`, `"want/wanna/going to die"`, `"kill/end my
life"`). Natural phrasings fell straight through to T0:
- `"...I'm thinking about ending my life."` — no "going to/about to", and `end\s+my\s+life`
  required the bare verb "end", not the gerund "ending", so it silently missed.
- `"I'm thinking about killing myself."` — no pattern covered "thinking about" ideation at all.
- `"I don't want to be alive anymore."` — no pattern covered this phrasing at all.

Reproduced directly against the old patterns before changing anything: 3 of the 4 reported
phrases resolved to T0. `preScreen`/tier resolution runs on raw text independently of and before
intent classification, so this was confirmed to be a `risk.ts` pattern-coverage gap only — not an
orchestration-order, intent-classification, or text-normalization issue.

**Fix:** broadened `risk.ts`'s T3 patterns to cover gerund forms, "thinking about/of" ideation,
and direct "don't want to be alive/live/exist anymore" statements, and added `"can't cope"` as a
synonym of the existing `"not coping"` in T1 (the reported message also used this phrase). A naive
broad "kill/hurt/harm myself" catch-all would have created a new regression: it would misclassify
the already-tested, deliberately negated `"I don't want to hurt myself"` (an existing T2
integration-test scenario) as T3. Fixed with a negative lookbehind so `"want to X myself"` only
escalates when NOT immediately preceded by `"don't"/"do not"/"doesn't"` — `"I want to kill
myself"` still escalates; `"I don't want to hurt myself"` correctly does not, on the strength of
that phrase alone. No other safety file (`policy.ts`, `outputGate.ts`, `guard.ts`) or the
orchestration order was touched. `T2`/general architecture unchanged.

**New tests:** `tests/crisis-regression.test.ts` (8 tests) — all four reported phrases resolve to
T3; additional common real-world phrasings (`"planning to end it all"`, `"thinking about hurting
myself"`, `"take my own life"`); the negation case is locked in both in isolation and combined
with the known T2 scenario; the "studies"/"diet" substring false-positive is re-verified at the
`risk.ts` level; `"can't cope"` correctly resolves to T1. Also re-verified end-to-end through the
real `runAgentTurn` for the exact originally-reported message (model never called, tool null,
response contains the crisis framing, not blocked).

**Verification after the fix:** typecheck clean, build clean, full suite **70/70 passing** (62
pre-existing + 8 new) — none of the original 62 tests were modified, weakened, or removed.

---

## Current state — final implementation phase complete

Phase 3 (UI integration) implemented on top of the unchanged Phase 1/2 safety architecture and
agent backend. The safety gates were not modified in behavior in this phase — the UI only calls
`runAgentTurn`/`initialAgentState` from `orchestrator.ts` and renders what comes back.

Delivered this phase:
- `src/main.tsx` — full chat UI wired to the real orchestrator and the mock provider. Users can
  open the app, send a message, see the agent's composed/forced response, keep the conversation
  going, and reset to a clean session. A persistent banner states CalmPath is a wellbeing-support
  companion, not a doctor/therapist/emergency/diagnostic service. No internal risk tiers, policy
  objects, or regex/implementation details are shown to the user anywhere in the UI — only the
  final, output-gated response text.
- `src/styles.css` — calm, blue-oriented, mobile-responsive layout: readable typography, clear
  message bubbles (user vs. agent vs. system), an obvious input + send control, a loading state
  ("Thinking…"), an error banner for invalid input, and a visible reset control. No animation or
  decorative work beyond what the objectives asked for.
- `tests/e2e.test.ts` — new end-to-end scenario tests, one group per objective:
  - **A** ordinary T0 conversation runs the full pipeline and returns a composed, non-blocked
    response.
  - **B** planning tool availability: `action_plan_builder` is available at T0/T1, and is
    replaced by `balance_support` once tier reaches T2 — verified through the real orchestrator,
    not by calling policy/router directly.
  - **C** elevated-risk (T2) conversation: crisis-adjacent support content is present, and a
    policy-violating model reply is still blocked at T2.
  - **D** T3: `vi.spyOn` on the real `selectTool`, `runTool`, and `composeResponse` exports (plus
    the provider and `applyOutputGate`) proves the planner, router, tools, and composer are never
    called, the model is never called, and the output gate still runs exactly once over the
    forced response.
  - **E** a simulated tool defect (a `ToolOutput` carrying a diagnosis/medication phrase) is
    still caught by the real `applyOutputGate`, proving the gate does not trust the content's
    origin.
  - **F** sticky escalation holds across three consecutive turns, including calm turns after
    the escalation.
  - **G** the crisis-intent word-boundary fix from the previous phase is re-verified end-to-end
    through the orchestrator (not just `classifyIntent` in isolation).
- `README.md` rewritten to cover: what CalmPath is, intended users, what it can/cannot do, the
  safety architecture at a high level, how to run and test it, current provider status (mock
  only — no real model or API key wired in), the resource-verification status, known limitations,
  and an explicit statement that this is a prototype/research/demo system, not a clinical medical
  device.
- No new dependencies were introduced. No safety file (`policy.ts`, `outputGate.ts`, `risk.ts`,
  `guard.ts`) was edited in this phase (risk.ts was edited in the safety-critical fix above,
  documented separately).

## Final verification (after the safety-critical fix, from a clean `node_modules`/`dist`)

```
npm install     -> 107 packages installed, no errors
npm run typecheck -> tsc --noEmit, clean, 0 errors
npm run test      -> 81/81 tests passing across 13 test files (70 pre-existing + 11 new
                     academic-vs-crisis regression tests; none of the original 70 were modified)
npm run build     -> vite build succeeds; two informational Rollup comment-annotation
                     warnings from zod's own source (not this repo's code), no errors
npm run dev       -> Vite dev server starts and serves the app (verified via HTTP request)
```

## Fully implemented
- Deterministic safety pipeline: preScreen, sticky T0–T3 escalation, intent classification,
  policy gate, planner/router, all 10 tools, composer, output gate, ephemeral session state.
- Full UI wired to the real orchestrator: send/receive, conversation flow, session reset, loading
  and error states, non-clinical framing, mobile-responsive calm design.
- 81 automated tests covering unit, integration, and end-to-end scenarios, including adversarial
  cases (tool-origin prohibited content, T3 bypass verified via spies, crisis-wording false
  positive, natural-language crisis phrasing regression, negation-awareness regression).

## Intentionally mocked/stubbed
- **Model provider**: `src/providers/mock.ts` only — fixed canned replies, no real LLM, no API
  key, no network call. Hosted-relay and local (Ollama) provider adapters are not implemented.
- **Resource registry**: `resources.za.json` is explicitly marked and displayed as
  `unverified-demonstration` — not checked against official sources.
- **Session persistence**: deliberately absent (privacy-by-design), not a gap to be filled.

## Known limitations
See README.md "Known limitations" — pattern-based (not ML-based) risk/intent detection, no real
model behind replies yet, no accessibility audit beyond semantic HTML/labels/contrast, not
evaluated with real students or clinicians. Risk detection is regex-based and, despite this fix,
should still be assumed to have both false negatives and false positives on real, varied language
— this fix closed four specific reported gaps plus related phrasings, it did not make detection
exhaustive.

## Demo readiness
The application is runnable end-to-end from a clean checkout (`npm install`, `npm run dev`) and
demonstrable: a user can open it, have a multi-turn conversation, see tier-appropriate behavior
change without any internal details leaking into the UI, hit the T3 crisis path (including via
natural crisis language, post-fix) and see the fixed safe response with resources, and reset the
session. It is ready for an end-to-end demonstration as a safety-architecture prototype — it is
not ready, and is not intended, for real-world use by students in genuine distress, given the
mock provider, regex-based (not clinically validated) risk detection, and unverified resource
list.

## Later (not part of this phase)
- Hosted/local provider adapters (real LLM behind the reflective text).
- Verified, officially-sourced South African crisis/support resource registry.
- Accessibility audit and evaluation with real users.
- Broader, ideally clinically-reviewed, risk-detection coverage beyond regex pattern matching.
- Open-source packaging.

## Rule
Do not implement later phases early just because they seem easy.
