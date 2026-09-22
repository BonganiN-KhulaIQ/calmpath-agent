# CalmPath AI — Agent Prototype

A privacy-preserving, non-clinical wellbeing navigation companion for African ODeL (Open
Distance e-Learning) students, built as an auditable, browser-first agent with a deterministic
safety pipeline.

**This is a research/demo prototype, not a clinical medical device.** It does not diagnose,
prescribe, or provide emergency services. See [Safety architecture](#safety-architecture-high-level)
and [What it cannot do](#what-it-cannot-do) below.

## What CalmPath is

CalmPath is a small chat-based agent intended for students studying at a distance (ODeL) who
want a low-stakes place to talk through study stress, workload, and everyday wellbeing, and to
be pointed toward appropriate human support when it's needed. The chat UI runs in the browser, but
the safety pipeline itself runs server-side (a Vercel serverless function) so it can't be edited
from devtools; there is still no account, no database, and no server-side conversation storage —
session state travels with the browser as a signed, opaque token instead (see
[Architecture: client/server split](#architecture-clientserver-split) below).

## Intended users / use case

- ODeL students who want to think out loud about study pressure, balance, or where to find
  support, outside of a formal counselling appointment.
- A prototype for researchers and student-support teams evaluating what a deterministic,
  auditable safety layer around an AI wellbeing companion could look like — not a production
  service.

## What it can do

Every response is produced by one of ten fixed, local tools plus a language-model provider, chosen
by a deterministic router based on what the student seems to need and how the conversation has
escalated:
- a warm greeting back on a plain "hi" (`greeting_response`) — routed like any other intent, so it
  never overrides sticky escalation or a more specific request in the same message
- reflective, supportive conversation (`reflective_conversation`, `emotional_checkin`)
- study/work balance support, without productivity pressure (`balance_support`)
- small, optional planning support, only when risk level permits it (`action_plan_builder`)
- general distance-learning navigation guidance (`odel_navigator`)
- coping-focused academic-pressure support (`academic_pressure_support`)
- pointing to support resources and pathways (`resource_navigator`, `support_pathway_guide`)
- appointment-preparation checklists (`appointment_prep`)
- a same-session recap of the conversation, metadata only (`session_summary`)

## What it cannot do

CalmPath will not, and is designed not to:
- diagnose or name a clinical condition,
- recommend, start, stop, or change medication,
- claim to be a psychologist, doctor, counsellor, or emergency service,
- claim certainty about anyone's mental state,
- ask assessment questions about method, severity, timing, or planning during a crisis-level turn,
- discuss or name self-harm methods,
- persist raw conversation text, or store any data outside the current browser session,
- act on institutional medical records, accounts, or analytics — none of that exists in this
  system.

If you are in immediate danger, CalmPath will tell you to contact local emergency services or a
crisis line — it cannot act as one itself.

## Safety architecture (high level)

Every turn runs through a fixed, deterministic pipeline, in this order, before anything reaches
the student:

```
turn -> preScreen -> intent classification -> policy gate
     -> planner/router -> tools -> composer
     -> output gate -> response
```

- **preScreen** classifies the turn into a risk tier, T0 (calm) through T3 (urgent), using
  pattern-based detection — not the model. Escalation is *sticky*: once a session reaches a
  tier, it can never drop back down within that session.
- **policy gate** decides, before any generation happens, what the turn is allowed to do at its
  tier — e.g. whether planning tools are permitted, whether a crisis resource must be shown.
- At **T3**, the policy gate forces a fixed, pre-written safe response. The planner, router,
  tools, composer, and the model provider are **never called** at T3 — there is nothing for the
  model to do or say at that tier.
- Below T3, the **router** picks one of the ten tools based on intent and tier, the **tool**
  produces deterministic, hand-reviewed content, and the **composer** merges that with the
  model's generated reply.
- The **output gate** then scans the *entire* response — forced or composed — for diagnosis
  language, medication recommendations, clinical/emergency impersonation, certainty claims about
  someone's mental state, unsafe productivity pressure, or (at T3) method discussion, and replaces
  it with a safe fallback if anything is caught. This runs on every response with no exceptions,
  regardless of whether the content came from the model or a tool.
- **Session state** is ephemeral, in-memory only, and holds just the risk tier, a turn counter,
  and the last classified intent — never raw conversation text.

Full detail is in [`SAFETY.md`](./SAFETY.md) and [`CLAUDE.md`](./CLAUDE.md).

## Architecture: client/server split

The pipeline above now runs **server-side**, not in the browser:

- `POST /api/turn` (a Vercel serverless function, `api/turn.ts`) is the only way a turn reaches
  the pipeline. The browser sends `{ text, sessionToken }` and gets back
  `{ sessionToken, response, ... }`.
- All real logic lives in `src/server/turnHandler.ts` (calls the unchanged `runAgentTurn`) and
  `src/server/sessionToken.ts` (signs/verifies session state) — both framework-independent and
  directly unit-tested, with `api/turn.ts` as a thin HTTP adapter over them.
- The browser (`src/main.tsx`, via `src/client/api.ts`) holds only an **opaque, server-signed
  token** between turns — never the raw safety state. The token is the session's JSON payload,
  HMAC-signed with a server-only secret (`CALMPATH_SESSION_SECRET`) so the client can carry it
  around but cannot edit it: any tampering (a devtools attempt to roll a session's tier back
  down, or just a corrupted token) is rejected and falls back to a fresh T0 session — the same
  outcome as clicking "Reset session", never a crash and never a trusted forged claim.
- `npm run dev` still works exactly as one command: a small dev-only Vite plugin serves
  `/api/turn` locally by calling the same handler in-process, so there's no separate server or
  Vercel CLI needed to try the app on your own machine.
- Nothing here adds a database, accounts, or persistence — the signed token itself *is* the
  session state, held entirely by the browser, same as before this change. See `PROGRESS.md` for
  the full writeup of why this changed and how it was verified.

## Running it locally

Requires Node.js (developed against Node 22) and npm.

```bash
npm install
npm run dev        # starts the Vite dev server
```

Then open the printed local URL in a browser.

## Testing

```bash
npm run typecheck  # tsc --noEmit
npm run test       # vitest run
npm run build      # production build (vite build)
```

As of the latest verification pass: typecheck is clean, all 96 tests pass, and the production
build succeeds. See `PROGRESS.md` for the exact command output from the most recent run.

## Deploying (Vercel)

Set one environment variable in the Vercel project's settings before deploying to production:

- `CALMPATH_SESSION_SECRET` — any long, random string. It signs session tokens so a student's
  browser can carry their session between requests without being able to edit it. Without this
  set, the server falls back to a fixed, publicly-known development secret in local/preview use
  and logs a warning; it deliberately refuses to start with that fallback in a production
  deployment (`VERCEL_ENV === "production"`) so a missing secret fails loudly instead of shipping
  an insecure default.

## Current provider / model status

CalmPath currently ships with a **mock provider only** (`src/providers/mock.ts`) — a small,
fixed set of tier-appropriate canned replies. No API key, no network call, no real language
model is wired in yet. The provider interface is designed so a hosted-relay or local (e.g.
Ollama) provider can be swapped in later without changing the safety pipeline, but that work has
not been done. Nothing in this repository sends data to, or receives generated text from, an
external LLM API today.

## South African resources

`src/data/resources.za.json` holds the resource list shown to students, and is loaded through a
schema-validated, fail-closed path (`src/safety/resources.ts`): if the file is missing or
malformed, the app falls back to an empty, still-clearly-unverified registry rather than showing
unvetted contact details. The bundled list is explicitly marked
`"registryStatus": "unverified-demonstration"` and is shown to students with a visible
"not yet verified" label — it has not been checked against official sources and should not be
treated as a verified crisis-resource directory before that happens.

## Known limitations

- Resource data is demonstration-only and unverified — see above.
- The mock provider's replies are fixed and simple; there is no real language-model reasoning
  behind supportive replies yet.
- Risk-tier and intent detection are pattern/regex-based, not ML-based, and will have both false
  positives and false negatives on real, varied student language. They are deliberately
  conservative in structure (sticky escalation, fail-closed) but not exhaustively validated
  against real usage.
- No persistence: closing the tab loses the conversation. This is intentional (privacy-by-design),
  not a bug, but means CalmPath cannot yet resume a conversation across sessions.
- No accessibility audit beyond basic semantic HTML, labels, and contrast has been performed.
- Not evaluated with real students or clinicians. Not reviewed by a mental-health professional or
  approved for use with people in genuine crisis. It is a software-architecture prototype, not a
  validated support tool.

## Development rules

1. Do not weaken, bypass, or redesign safety gates to make a feature work.
2. Do not add persistence, identity fields, document upload, analytics, or a database.
3. Keep safety deterministic and auditable.
4. Run `npm run typecheck` and `npm run test` after meaningful changes.
5. Keep prompts/tasks small and finish one phase before starting another.

Read `SAFETY.md` before changing anything safety-related, and `CLAUDE.md` for the architecture
and coding-style brief.
