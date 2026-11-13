// GENERATED FILE - DO NOT EDIT. Source: src/server/turnApi.ts.
// Rebuild with `npm run build:api`. See scripts/build-api.mjs for why this exists.

// src/server/turnHandler.ts
import { z as z4 } from "zod";

// src/agent/schema.ts
import { z } from "zod";
var TurnInputSchema = z.object({
  text: z.string().min(1, "empty turn").max(4e3, "turn too long")
});
function parseTurnInput(raw) {
  return TurnInputSchema.parse(raw);
}

// src/agent/intent.ts
var GREETING = /^\s*(?:hi+|hello+|hey+|hiya|heya|howdy|yo+|sup|howzit|good\s+(?:morning|afternoon|evening|day))(?:\s*,?\s*(?:there|calmpath))?[\s!.,]*$/i;
function classifyIntent(text) {
  const t = text.toLowerCase();
  if (/\b(?:emergency|kill myself|hurt myself|die)\b/.test(t)) return "crisis_signal";
  if (/(plan|routine|steps|schedule)/.test(t)) return "plan";
  if (/(find|where|support|counselling|counseling)/.test(t)) return "navigate";
  if (/(appointment|doctor|visit)/.test(t)) return "prepare";
  if (/(why|what does|explain)/.test(t)) return "understand";
  if (GREETING.test(text.trim())) return "greeting";
  return "express";
}

// src/safety/normalize.ts
var APOSTROPHE_VARIANTS = /[‘’‛ʼʹ′´`＇]/g;
var INVISIBLE = /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;
var COMBINING_MARKS = /[̀-ͯ]/g;
var LOOKALIKES = {
  // Cyrillic
  "\u0430": "a",
  "\u0441": "c",
  "\u0435": "e",
  "\u0456": "i",
  "\u0458": "j",
  "\u043E": "o",
  "\u0440": "p",
  "\u0455": "s",
  "\u0443": "y",
  "\u0445": "x",
  "\u043A": "k",
  "\u043C": "m",
  "\u043D": "h",
  "\u0442": "t",
  "\u0501": "d",
  "\u04CF": "l",
  "\u0491": "r",
  "\u0432": "b",
  "\u0433": "r",
  "\u0457": "i",
  // Greek
  "\u03BF": "o",
  "\u03B1": "a",
  "\u03B5": "e",
  "\u03B9": "i",
  "\u03BA": "k",
  "\u03BD": "v",
  "\u03C1": "p",
  "\u03C4": "t",
  "\u03C5": "u",
  "\u03C7": "x",
  "\u03B7": "n",
  "\u03C9": "w",
  "\u03BC": "u",
  // Latin extensions
  "\u0131": "i",
  "\u0261": "g",
  "\u0251": "a",
  "\u0237": "j"
};
var LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKES).join("")}]`, "g");
var INTRA_WORD_PUNCT = /(?<=[a-z])[.\-_·•‧‐-―](?=[a-z])/g;
function normalizeForMatching(text) {
  return text.replace(APOSTROPHE_VARIANTS, "'").normalize("NFKC").replace(INVISIBLE, "").normalize("NFD").replace(COMBINING_MARKS, "").normalize("NFC").toLowerCase().replace(LOOKALIKE_RE, (c) => LOOKALIKES[c] ?? c).replace(INTRA_WORD_PUNCT, "").replace(/\s+/g, " ").trim();
}
var LEET_COMMON = {
  "0": "o",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  "$": "s"
};
function applyLeet(text, oneAs) {
  return text.replace(/[a-z0-9@$]+/g, (token) => {
    if (!/[a-z]/.test(token) || !/[0-9@$]/.test(token)) return token;
    return token.replace(/[0-9@$]/g, (c) => c === "1" ? oneAs : LEET_COMMON[c] ?? c);
  });
}
function matchCandidates(text) {
  const base = normalizeForMatching(text);
  return [.../* @__PURE__ */ new Set([base, applyLeet(base, "i"), applyLeet(base, "l")])];
}

// src/safety/risk.ts
var T3 = [
  // Explicit intent-to-act phrasing, including "thinking about" ideation.
  /\b(?:going to|about to|planning to|gonna|thinking about|thinking of|think about|think of|considering)\s+(?:kill|hurt|harm)(?:ing)?\s+myself\b/i,
  // Bare "want to/wanna X myself", excluded when directly negated.
  /\b(?<!don'?t\s)(?<!do not\s)(?<!doesn'?t\s)(?:want to|wanna)\s+(?:kill|hurt|harm)\s+myself\b/i,
  /\b(?:i want|i wanna|i am going|i'm going)\s+to\s+die\b/i,
  // "end/ending my life" or "...it all" — covers gerund and bare forms, and
  // matches regardless of what precedes it (e.g. "thinking about ending my
  // life"), since ending one's own life is itself the signal.
  /\b(?:kill|end|ending)\s+(?:my life|it all)\b/i,
  /\b(?:take|taking)\s+my\s+(?:own\s+)?life\b/i,
  // Explicit statement of not wanting to continue living.
  /\bdon'?t\s+want\s+to\s+(?:be alive|live|exist)\s+anymore\b/i
];
var T2 = [
  /\b(?:can't|cannot|dont|don't)\s+go\s+on\b/i,
  /\b(?:better off|burden)\s+without\s+me\b/i,
  /\b(?:disappear|vanish)\s+(?:for good|forever)\b/i
];
var T1 = [
  /\b(?:overwhelmed|exhausted|hopeless|isolated|burnt out|burned out)\b/i,
  // "can't cope" added alongside "not coping" — same distress, different
  // natural phrasing (found via the T3 regression investigation).
  /\b(?:not coping|can(?:'t|not) cope|struggling badly)\b/i
];
function detectTier(rawText) {
  const candidates = matchCandidates(rawText);
  const hits = (patterns) => candidates.some((text) => patterns.some((p) => p.test(text)));
  if (hits(T3)) return "T3";
  if (hits(T2)) return "T2";
  if (hits(T1)) return "T1";
  return "T0";
}
function maxTier(a, b) {
  const order = { T0: 0, T1: 1, T2: 2, T3: 3 };
  return order[a] >= order[b] ? a : b;
}

// src/safety/guard.ts
function createSafetyState() {
  return { tier: "T0", escalated: false, version: "0.1.0" };
}
function resolveTurnTier(state, input) {
  const detected = detectTier(input.text);
  const tier = maxTier(state.tier, detected);
  return {
    ...state,
    tier,
    escalated: state.escalated || tier !== "T0"
  };
}
function canUseCalmPlanning(tier) {
  return tier === "T0" || tier === "T1";
}

// src/agent/session.ts
function createSession() {
  return {
    safety: createSafetyState(),
    turnCount: 0,
    lastIntent: null
  };
}
function advanceSession(session, nextSafety, intent) {
  return {
    safety: nextSafety,
    turnCount: session.turnCount + 1,
    lastIntent: intent
  };
}

// src/agent/router.ts
var ELEVATED_TIERS = ["T1", "T2"];
function selectTool({ intent, tier, policy }) {
  switch (intent) {
    case "crisis_signal":
      return "support_pathway_guide";
    case "navigate":
      return "resource_navigator";
    case "prepare":
      return "appointment_prep";
    case "record":
      return "session_summary";
    case "learn":
      return "odel_navigator";
    case "greeting":
      return "greeting_response";
    case "plan":
      return policy.allowPlanningTools ? "action_plan_builder" : "balance_support";
    case "understand":
      return ELEVATED_TIERS.includes(tier) ? "academic_pressure_support" : "reflective_conversation";
    case "express":
    default:
      return ELEVATED_TIERS.includes(tier) ? "emotional_checkin" : "reflective_conversation";
  }
}

// src/agent/composer.ts
function composeResponse(toolOutput, modelText) {
  const detailBlock = toolOutput.details && toolOutput.details.length > 0 ? `
${toolOutput.details.map((line) => `- ${line}`).join("\n")}` : "";
  return `${toolOutput.summary}${detailBlock}

${modelText}`;
}

// src/safety/resources.ts
import { z as z2 } from "zod";

// src/data/resources.za.json
var resources_za_default = {
  registryStatus: "unverified-demonstration",
  resources: [
    { id: "sadag", name: "South African Depression and Anxiety Group", officialUrl: "https://www.sadag.org/", contact: null },
    { id: "lifeline-sa", name: "Lifeline South Africa", officialUrl: null, contact: null },
    { id: "unisa-support", name: "UNISA student support", officialUrl: "https://www.unisa.ac.za/", contact: null }
  ]
};

// src/safety/resources.ts
var ResourceEntrySchema = z2.object({
  id: z2.string(),
  name: z2.string(),
  officialUrl: z2.string().nullable(),
  contact: z2.string().nullable()
});
var ResourceRegistrySchema = z2.object({
  registryStatus: z2.enum(["verified", "unverified-demonstration"]),
  resources: z2.array(ResourceEntrySchema)
});
function loadRegistry() {
  const parsed = ResourceRegistrySchema.safeParse(resources_za_default);
  if (!parsed.success) {
    return { registryStatus: "unverified-demonstration", resources: [] };
  }
  return parsed.data;
}
var resourceRegistry = loadRegistry();
function crisisResourceLine() {
  if (resourceRegistry.resources.length === 0) {
    return "Please contact local emergency services or a crisis line, or reach out to someone you trust.";
  }
  const names = resourceRegistry.resources.map((r) => r.name).join(", ");
  const marker = resourceRegistry.registryStatus === "unverified-demonstration" ? " (demonstration list \u2014 not yet verified)" : "";
  return `You could reach out to: ${names}${marker}.`;
}

// src/safety/fallback.ts
function buildT3ForcedResponse() {
  return [
    "I hear that things feel very hard right now, and I want to take that seriously.",
    "I'm an AI support and navigation tool, not an emergency service, and I can't keep you safe on my own.",
    "Please contact local emergency services or a crisis line right now, or reach out to someone you trust who can be with you.",
    crisisResourceLine(),
    "I'm still here with you, and we can keep talking."
  ].join(" ");
}
var GENERIC_BLOCKED_RESPONSE = "I'm not able to say that. I can't give a diagnosis, medication advice, or act as a clinician, but I can help you think through what's going on and find a practical next step or appropriate support.";

// src/safety/policy.ts
function evaluatePolicy(tier, intent) {
  const allowPlanningTools = canUseCalmPlanning(tier);
  if (tier === "T3") {
    return {
      tier,
      intent,
      allowModelGeneration: false,
      forcedResponse: buildT3ForcedResponse(),
      requireCrisisResource: true,
      allowPlanningTools: false,
      blockedTopics: ["method", "severity", "timing", "planning", "diagnosis", "medication"]
    };
  }
  if (tier === "T2") {
    return {
      tier,
      intent,
      allowModelGeneration: true,
      forcedResponse: null,
      requireCrisisResource: true,
      allowPlanningTools,
      blockedTopics: ["diagnosis", "medication", "productivity_pressure"]
    };
  }
  if (tier === "T1") {
    return {
      tier,
      intent,
      allowModelGeneration: true,
      forcedResponse: null,
      requireCrisisResource: false,
      allowPlanningTools,
      blockedTopics: ["diagnosis", "medication", "productivity_pressure"]
    };
  }
  return {
    tier,
    intent,
    allowModelGeneration: true,
    forcedResponse: null,
    requireCrisisResource: false,
    allowPlanningTools,
    blockedTopics: ["diagnosis", "medication"]
  };
}

// src/safety/outputGate.ts
var DIAGNOSIS_PATTERNS = [
  /\byou (?:have|are suffering from|are experiencing)\s+(?:clinical\s+)?(?:depression|anxiety disorder|bipolar disorder|ptsd|a mental illness)\b/i,
  /\b(?:this|that) (?:is|sounds like|looks like)\s+(?:clinical\s+)?(?:depression|anxiety disorder|bipolar disorder|ptsd)\b/i,
  /\byour diagnosis is\b/i
];
var MEDICATION_PATTERNS = [
  /\b(?:take|start|stop|increase|decrease|reduce|double)\s+(?:your\s+)?(?:medication|dose|dosage|antidepressants?|ssris?|pills?)\b/i,
  /\byou should (?:take|try)\s+(?:an?\s+)?(?:medication|antidepressant|ssri)\b/i
];
var IMPERSONATION_PATTERNS = [
  /\bas your (?:psychologist|doctor|counsellor|counselor|therapist)\b/i,
  /\bi am (?:a|your)\s+(?:licensed\s+)?(?:psychologist|doctor|counsellor|counselor|therapist)\b/i,
  /\bi am (?:the\s+)?emergency services?\b/i
];
var CERTAINTY_PATTERNS = [
  /\byou (?:definitely|certainly|clearly)\s+(?:have|are)\b/i,
  /\bi know exactly what you(?:'re| are) feeling\b/i
];
var PRODUCTIVITY_PRESSURE_PATTERNS = [
  /\b(?:push through|power through|just work harder|no excuses|stop making excuses|suck it up)\b/i
];
var METHOD_DISCUSSION_PATTERNS = [/\b(?:overdose|hang(?:ing)?|jump(?:ing)? from|cut(?:ting)? (?:yourself|your wrists))\b/i];
function buildChecks(tier) {
  const checks = [
    { reason: "diagnosis", test: (t) => DIAGNOSIS_PATTERNS.some((p) => p.test(t)) },
    { reason: "medication", test: (t) => MEDICATION_PATTERNS.some((p) => p.test(t)) },
    { reason: "impersonation", test: (t) => IMPERSONATION_PATTERNS.some((p) => p.test(t)) },
    { reason: "certainty_claim", test: (t) => CERTAINTY_PATTERNS.some((p) => p.test(t)) }
  ];
  if (tier !== "T0") {
    checks.push({
      reason: "productivity_pressure",
      test: (t) => PRODUCTIVITY_PRESSURE_PATTERNS.some((p) => p.test(t))
    });
  }
  if (tier === "T3") {
    checks.push({
      reason: "method_discussion",
      test: (t) => METHOD_DISCUSSION_PATTERNS.some((p) => p.test(t))
    });
  }
  return checks;
}
function applyOutputGate(rawResponse, tier, fallback) {
  const matchable = normalizeForMatching(rawResponse);
  const reasons = buildChecks(tier).filter((check) => check.test(matchable)).map((check) => check.reason);
  if (reasons.length > 0) {
    return { allowed: false, response: fallback, blockedReasons: reasons };
  }
  return { allowed: true, response: rawResponse, blockedReasons: [] };
}

// src/tools/reflectiveConversation.ts
var reflectiveConversation = () => ({
  toolId: "reflective_conversation",
  summary: "Let's slow down and think this through together.",
  details: [
    "Tell me a bit more about what's been going on.",
    "There's no need to have it all figured out right now."
  ]
});

// src/tools/emotionalCheckin.ts
var emotionalCheckin = () => ({
  toolId: "emotional_checkin",
  summary: "That sounds like a lot to be carrying right now.",
  details: [
    "How has this been affecting your day-to-day, like sleep, eating, or getting things done?",
    "Is there anyone in your life you've been able to talk to about this?"
  ]
});

// src/tools/odelNavigator.ts
var odelNavigator = () => ({
  toolId: "odel_navigator",
  summary: "Here's a general way to navigate distance-learning study support.",
  details: [
    "Check your module site for tutorial letters, discussion forums, and official deadlines.",
    "Your institution's student support or academic advising office can help with study planning questions."
  ]
});

// src/tools/academicPressureSupport.ts
var academicPressureSupport = () => ({
  toolId: "academic_pressure_support",
  summary: "Academic pressure can build up quietly until it feels like too much at once.",
  details: [
    "It can help to name just one part of the workload that feels heaviest right now.",
    "A short break or a conversation with a tutor or advisor can shift things more than pushing alone can."
  ]
});

// src/tools/balanceSupport.ts
var balanceSupport = () => ({
  toolId: "balance_support",
  summary: "Rather than adding more to do right now, let's focus on steadying things a little.",
  details: [
    "A small, low-pressure thing \u2014 some rest, food, water, or a short walk \u2014 can matter more than a task list today.",
    "Whatever you get to today is enough for today."
  ]
});

// src/tools/resourceNavigator.ts
var resourceNavigator = () => {
  const marker = resourceRegistry.registryStatus === "unverified-demonstration" ? " (demonstration list \u2014 not yet verified)" : "";
  const details = resourceRegistry.resources.length > 0 ? resourceRegistry.resources.map((r) => `${r.name}${marker}`) : ["Local emergency services or a trusted crisis line"];
  return {
    toolId: "resource_navigator",
    summary: "Here are some support options you could look into:",
    details
  };
};

// src/tools/appointmentPrep.ts
var appointmentPrep = () => ({
  toolId: "appointment_prep",
  summary: "Here's a simple way to prepare for that appointment.",
  details: [
    "Jot down what's been happening in your own words, in whatever order it comes to you.",
    "Write down two or three questions you want to make sure you ask.",
    "It's fine to bring notes with you \u2014 you don't need to remember everything."
  ]
});

// src/tools/actionPlanBuilder.ts
var actionPlanBuilder = () => ({
  toolId: "action_plan_builder",
  summary: "Let's sketch out one small, manageable next step \u2014 not a whole plan at once.",
  details: [
    "Pick just one thing that would help most in the next day or two.",
    "Break that one thing into a step small enough to feel doable, even on a low-energy day.",
    "It's okay to adjust or drop this if it stops being helpful."
  ]
});

// src/tools/sessionSummary.ts
var sessionSummary = (ctx) => ({
  toolId: "session_summary",
  summary: "Here's a quick recap of this conversation so far.",
  details: [
    `We've exchanged messages during this session (current check-in level: ${ctx.tier}).`,
    "I don't keep a saved transcript \u2014 this recap only reflects what's active in this session right now."
  ]
});

// src/tools/supportPathwayGuide.ts
var supportPathwayGuide = () => ({
  toolId: "support_pathway_guide",
  summary: "I want to make sure you have real support around this, not just me.",
  details: [
    "Please consider reaching out to someone you trust, or a support service, about how you're feeling.",
    crisisResourceLine()
  ]
});

// src/tools/greetingResponse.ts
var greetingResponse = ({ tier }) => {
  if (tier === "T0") {
    return {
      toolId: "greeting_response",
      summary: "Hello! I'm glad you're here.",
      details: [
        "How are you doing today?",
        "You can share as much or as little as you'd like."
      ]
    };
  }
  return {
    toolId: "greeting_response",
    summary: "Hello \u2014 thanks for saying hi.",
    details: ["I also want to check in on how you've been feeling, since things sounded tough earlier."]
  };
};

// src/tools/index.ts
var TOOL_IMPLEMENTATIONS = {
  reflective_conversation: reflectiveConversation,
  emotional_checkin: emotionalCheckin,
  odel_navigator: odelNavigator,
  academic_pressure_support: academicPressureSupport,
  balance_support: balanceSupport,
  resource_navigator: resourceNavigator,
  appointment_prep: appointmentPrep,
  action_plan_builder: actionPlanBuilder,
  session_summary: sessionSummary,
  support_pathway_guide: supportPathwayGuide,
  greeting_response: greetingResponse
};
function runTool(toolId, ctx) {
  return TOOL_IMPLEMENTATIONS[toolId](ctx);
}

// src/agent/orchestrator.ts
async function runAgentTurn(session, rawText, provider) {
  const { text } = parseTurnInput({ text: rawText });
  const nextSafety = resolveTurnTier(session.safety, { text });
  const tier = nextSafety.tier;
  const intent = classifyIntent(text);
  const policy = evaluatePolicy(tier, intent);
  let rawResponse;
  let toolId = null;
  if (policy.allowModelGeneration) {
    toolId = selectTool({ intent, tier, policy });
    const toolOutput = runTool(toolId, { tier, intent, text, policy });
    const modelText = await provider.generate({ tier, intent, text });
    rawResponse = composeResponse(toolOutput, modelText);
  } else {
    rawResponse = policy.forcedResponse ?? GENERIC_BLOCKED_RESPONSE;
  }
  const fallback = policy.forcedResponse ?? GENERIC_BLOCKED_RESPONSE;
  const gated = applyOutputGate(rawResponse, tier, fallback);
  const nextSession = advanceSession(session, nextSafety, intent);
  return {
    session: nextSession,
    response: gated.response,
    tier,
    intent,
    tool: policy.allowModelGeneration ? toolId : null,
    blocked: !gated.allowed,
    blockedReasons: gated.blockedReasons
  };
}

// src/providers/mock.ts
var mockProvider = {
  async generate(context) {
    if (context.tier === "T3") {
      return "I can stay with you, but I am not an emergency service. Please seek immediate human support through an appropriate emergency or crisis pathway.";
    }
    if (context.tier === "T2") {
      return "It sounds like things may be getting difficult. We can focus on support and a manageable next step.";
    }
    if (context.tier === "T1") {
      return "That sounds like a lot to carry. We can slow things down and work out one manageable next step.";
    }
    return "I\u2019m here to help you think through what is happening and find a practical next step.";
  }
};

// src/server/sessionToken.ts
import { createHmac, timingSafeEqual } from "node:crypto";

// src/server/sessionSchema.ts
import { z as z3 } from "zod";
var SessionContextSchema = z3.object({
  safety: z3.object({
    tier: z3.enum(["T0", "T1", "T2", "T3"]),
    escalated: z3.boolean(),
    version: z3.string()
  }),
  turnCount: z3.number().int().nonnegative(),
  lastIntent: z3.enum([
    "express",
    "understand",
    "plan",
    "navigate",
    "prepare",
    "record",
    "learn",
    "greeting",
    "crisis_signal"
  ]).nullable()
});

// src/server/sessionToken.ts
var MIN_SECRET_LENGTH = 32;
var SessionConfigError = class extends Error {
};
function fallbackAllowed() {
  const vercelEnv = process.env["VERCEL_ENV"];
  if (vercelEnv !== void 0 && vercelEnv !== "" && vercelEnv !== "development") return false;
  if (process.env["NODE_ENV"] === "production") return false;
  return true;
}
var DEV_FALLBACK_SECRET = "calmpath-local-development-fallback-secret-DO-NOT-USE-IN-PRODUCTION";
function resolveSecret() {
  const secret = process.env["CALMPATH_SESSION_SECRET"];
  if (secret && secret.length > 0) {
    if (secret.length < MIN_SECRET_LENGTH) {
      throw new SessionConfigError(
        `CALMPATH_SESSION_SECRET is too short (${secret.length} characters). Use at least ${MIN_SECRET_LENGTH} random characters.`
      );
    }
    return secret;
  }
  if (!fallbackAllowed()) {
    throw new SessionConfigError(
      "CALMPATH_SESSION_SECRET is not set. Set it in the Vercel project's Environment Variables for every environment that serves traffic (Production AND Preview). Session signing must not run on the public development fallback key in a deployed environment."
    );
  }
  console.warn(
    "[calmpath] CALMPATH_SESSION_SECRET is not set \u2014 using the insecure, publicly known development fallback key. This only runs on a local development machine; deployed environments refuse to start without a real secret."
  );
  return DEV_FALLBACK_SECRET;
}
function toBase64Url(input) {
  return input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}
function sign(payloadB64) {
  return toBase64Url(createHmac("sha256", resolveSecret()).update(payloadB64).digest());
}
function signSession(session) {
  const payloadB64 = toBase64Url(Buffer.from(JSON.stringify(session), "utf8"));
  return `${payloadB64}.${sign(payloadB64)}`;
}
function verifySession(token) {
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

// src/server/turnHandler.ts
var TurnRequestSchema = z4.object({
  text: z4.string(),
  sessionToken: z4.string().nullable().optional()
});
var TurnRequestError = class extends Error {
};
async function handleTurnRequest(rawBody) {
  const parsed = TurnRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    throw new TurnRequestError("Request body must be { text: string, sessionToken?: string }");
  }
  const { text, sessionToken } = parsed.data;
  const session = verifySession(sessionToken ?? null);
  const result = await runAgentTurn(session, text, mockProvider);
  return {
    sessionToken: signSession(result.session),
    response: result.response,
    tier: result.tier,
    intent: result.intent,
    tool: result.tool,
    blocked: result.blocked,
    blockedReasons: result.blockedReasons
  };
}

// src/server/turnApi.ts
async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  try {
    const result = await handleTurnRequest(req.body);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof TurnRequestError) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err instanceof SessionConfigError) {
      console.error(`[calmpath] ${err.message}`);
      res.status(500).json({ error: "CalmPath is temporarily unavailable." });
      return;
    }
    res.status(400).json({ error: "That message couldn't be sent." });
  }
}
export {
  handler as default
};
