# CalmPath Safety Contract

CalmPath is wellbeing navigation/support, not a clinical or emergency service.

## Risk tiers
- T0 Calm: ordinary conversation, study stress, planning.
- T1 Elevated: sustained distress, exhaustion, hopelessness, isolation.
- T2 Concerning: ambiguous/high-concern language about not coping, disappearing, burden, etc.
- T3 Urgent: explicit indication of immediate danger/self-harm risk.

Tier escalation is sticky for the session. A later turn must never lower an already committed tier.

## Required ordering
student turn
-> deterministic pre-screen
-> context assembly
-> intent/need classification
-> safety policy gate
-> planner/router
-> local tool execution
-> response composer
-> deterministic output gate
-> response

The model must never be called before the safety tier is resolved.

## T3 behaviour
Do not ask assessment questions about method, severity, timing, or planning.
Do not discuss or name methods.
Do not diagnose.
Clearly state that the system is AI support/navigation, not an emergency service.
Surface an appropriate verified crisis/emergency/support pathway when available.
Encourage immediate human help/trusted-person support.
Do not abandon the conversation.
Do not persist crisis content.

## Output restrictions
Block:
- diagnosis or clinical labels presented as conclusions;
- medication recommendations or medication changes;
- claims of certainty about a person's mental state;
- pretending to be a psychologist, doctor, counsellor, or emergency service;
- unsafe productivity pressure at higher tiers.

## Privacy
No database, account, student number, institutional medical record, analytics, or server-side conversation store.
Session data is ephemeral by default.
Safety state must not contain raw student text.

## Resource verification
Public contact details must be verified against official sources before being shown as verified.
Unverified demonstration resources must be visibly marked.
