# CalmPath — Claude Code Brief

You are building the agent core of CalmPath AI.

## Mission
Implement a small, auditable, browser-first agent for African ODeL student wellbeing navigation.

## Architecture
turn
-> preScreen
-> context
-> intent
-> policy
-> planner/router
-> tools
-> composer
-> outputGate

Safety is deterministic. The LLM is a provider, not the safety authority.

## Tiers
T0 Calm, T1 Elevated, T2 Concerning, T3 Urgent.
Escalation is sticky. Never lower a committed tier.

## Tools
Implement these local capabilities:
- reflective_conversation
- emotional_checkin
- odel_navigator
- academic_pressure_support
- balance_support
- resource_navigator
- appointment_prep
- action_plan_builder
- session_summary
- support_pathway_guide

Tool selection is driven by intent + tier, not tone.

## Provider
Use an interface:
- Mock provider first.
- Hosted relay provider later.
- Ollama/local provider later.

Never put API keys in browser source.

## Important constraints
- No diagnosis.
- No clinical impersonation.
- No medication advice.
- No institutional medical-record uploads.
- No accounts/database/analytics.
- No server-side conversation storage.
- No raw text in safety event state.
- No crisis content in logs/persistence.
- Keep agent/safety/provider code independent of React.

## Coding style
TypeScript strict.
Prefer small modules and pure functions.
Avoid LangChain.
Use Zod for boundaries.
Write tests for safety and routing.
Do not delete or weaken existing tests to make them pass.

## Execution discipline
Before coding, inspect the repository and git status.
Read README.md and SAFETY.md.
Implement only the requested phase.
Run tests/typecheck before reporting completion.
Leave a concise progress note in `PROGRESS.md`.
