import type { OutputGateResult, RiskTier } from "./types";
import { matchCandidates } from "./normalize";

/**
 * Deterministic output gate. Runs on every response — model-generated or
 * forced — before it reaches the student. Never calls the model itself.
 *
 * The gate was first written against fixed, hand-reviewed text. Free-form model
 * text phrases the same unsafe ideas in many more ways ("you may have an
 * anxiety disorder", "try upping your dose"), so each category below covers
 * hedged and indirect forms as well as flat statements. Matching runs on
 * normalised text (see normalize.ts), including digit/symbol readings, so
 * lookalike letters, invisible characters and "st0p" style spellings are caught.
 *
 * Two categories (diagnosis, medication) are evaluated sentence by sentence so
 * that a SAFE sentence is not blocked just because it mentions the topic:
 * "I can't diagnose you", "please don't stop your medication", or "ask your
 * doctor whether medication could help" are exactly what we want to say.
 * Every other category is a plain whole-text match.
 *
 * This is pattern-based, so it is a net with holes, not a guarantee. It is one
 * layer next to the model's system prompt and the T3 bypass. See PROGRESS.md
 * for what is still not covered.
 */

const alt = (words: readonly string[]): string => words.join("|");

// ---------------------------------------------------------------- diagnosis

// Clinical conditions that are only ever named when diagnosing (bare "anxiety"
// and "depression" are handled separately because they are also everyday words).
const DX_CLINICAL = alt([
  "(?:clinical|major|chronic|severe|mild|persistent) depress\\w*",
  "(?:generali[sz]ed |social |separation |health )?anxiety disorder",
  "panic (?:disorder|attacks?)",
  "bipolar\\w*",
  "ptsd",
  "post ?traumatic stress\\w*",
  "adhd",
  "attention deficit\\w*",
  "ocd",
  "obsessive[- ]compulsive\\w*",
  "schizo\\w*",
  "psychosis",
  "psychotic\\w*",
  "(?:borderline|personality) (?:personality )?disorder",
  "bpd",
  "eating disorder",
  "anorexi\\w*",
  "bulimi\\w*",
  "binge[- ]eating disorder",
  "autis\\w*",
  "dyslexi\\w*",
  "mental (?:illness|disorder|health (?:condition|disorder))",
  "(?:a |the )?(?:mood|anxiety|depressive|personality|psychiatric|clinical) disorder",
]);

// Everyday words that are also diagnoses. "anxiety about exams" is a feeling,
// "you have anxiety" is a label, so a following preposition is not a match.
const DX_BARE = "depress\\w*|anxiety(?!\\s+(?:about|over|around|before|from|because|when|at|in|with|and stress)\\b)";

const MODIFIERS = "(?:(?:an?|some|the|clinical|severe|mild|major|chronic|generali[sz]ed|social|seasonal|untreated|undiagnosed|classic|textbook|full[- ]blown)\\s+){0,3}";
const HEDGES = "(?:(?:probably|likely|possibly|perhaps|might|may|could|must|seem to|appear to|definitely|certainly|clearly|obviously|really|actually|do|just)\\s+){0,3}";

const DIAGNOSIS_PATTERNS: readonly RegExp[] = [
  // "you have / may have / show signs of ..." + any condition, bare words included.
  new RegExp(
    `\\byou ${HEDGES}(?:have|had|got|suffer from|(?:are|seem to be|appear to be|may be|might be|could be) suffering from|show(?:ing)? signs of|meet the criteria for|display symptoms of|are living with)\\s+${MODIFIERS}(?:${DX_CLINICAL}|${DX_BARE})\\b`,
  ),
  // Softer verbs only with clearly clinical terms ("struggling with anxiety" is ordinary support language).
  new RegExp(
    `\\byou ${HEDGES}(?:are experiencing|are dealing with|are struggling with|are battling|are showing)\\s+${MODIFIERS}(?:${DX_CLINICAL})\\b`,
  ),
  // "it / this / your symptoms sound like ..." + condition.
  new RegExp(
    `\\b(?:it|this|that|these|those|your symptoms|what you(?:'re| are) (?:describing|experiencing|going through|feeling))\\s+(?:sounds?|looks?|seems?|feels?|is|are|could be|might be|may be|is probably|is likely|points? to|suggests?|indicates?|(?:is|are) consistent with|(?:is|are) in line with|(?:is|are) typical of|(?:is|are) characteristic of|match(?:es)?|fits?|resembles?)\\s*(?:like\\s+|to\\s+)?(?:a (?:case|sign) of\\s+)?${MODIFIERS}(?:${DX_CLINICAL}|depress\\w*)\\b`,
  ),
  // Labelling the student: "you're depressed", "you may be bipolar".
  /\byou(?:'re| are| may be| might be| could be| must be| seem to be)\s+(?:(?:probably|likely|clearly|obviously|definitely|certainly|just|really|actually)\s+)*(?:clinically\s+)?(?:depressed|bipolar|suicidal|mentally ill|psychotic|schizophrenic|traumati[sz]ed|addicted)\b/,
  // Announcing a diagnosis.
  /\bi (?:diagnose|can diagnose|will diagnose|am diagnosing)\b|\bi'll diagnose\b|\byour diagnosis\b|\bthe diagnosis is\b/,
];

// -------------------------------------------------------------- medication

const MED_VERBS = alt([
  "take", "taking", "start", "starting", "begin", "beginning", "try", "trying", "stop", "stopping", "quit", "quitting",
  "increase", "increasing", "up", "upping", "decrease", "decreasing", "reduce", "reducing", "cut", "cutting",
  "skip", "skipping", "double", "doubling", "halve", "halving", "raise", "raising", "lower", "lowering",
  "switch(?:ing)? to", "come off", "coming off", "go(?:ing)? off", "get on", "getting on", "ask for", "get(?:ting)? a prescription for",
]);

const MED_NOUNS = alt([
  "medications?", "meds?", "medicines?", "doses?", "dosages?", "prescriptions?", "antidepressants?", "anti[- ]?anxiety\\w*",
  "ssris?", "snris?", "benzos?", "benzodiazepines?", "sleeping (?:pills?|tablets?|meds?)", "pills?", "tablets?", "painkillers?",
  "xanax", "valium", "prozac", "zoloft", "lexapro", "cipralex", "citalopram", "sertraline", "fluoxetine", "escitalopram",
  "amitriptyline", "diazepam", "alprazolam", "lithium", "ritalin", "methylphenidate", "stilnox", "zolpidem", "melatonin",
]);

const MED_DETERMINERS = "(?:(?:your|\\w+'s|the|a|an|some|any|more|less|another|different|new|stronger|higher|lower|bigger|smaller|little|bit|of|on|up|down|back|half|\\d+|one|two|three|a couple of)\\s+){0,4}";

const MEDICATION_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b(?:${MED_VERBS})\\s+${MED_DETERMINERS}(?:${MED_NOUNS})\\b`),
  // Past tense is advice only after a condition: "you'd feel better if you stopped your lithium".
  // Without one it is usually the model echoing what the student said.
  new RegExp(`\\b(?:if|once|when|had) you (?:\\w+\\s+)?(?:stopped|started|skipped|increased|reduced|doubled|halved|raised|lowered|switched to|came off|went off|cut)\\s+(?:taking\\s+)?${MED_DETERMINERS}(?:${MED_NOUNS})\\b`),
  // "you'd benefit from an anti-anxiety prescription", "you need medication"
  new RegExp(`\\byou(?:'d| would| could| might| may| should| ought to)?\\s*(?:benefit from|be better off (?:on|with)|do well on|need)\\s+${MED_DETERMINERS}(?:${MED_NOUNS})\\b`),
  /\byou should (?:take|try|get)\s+(?:an?\s+)?(?:medication|antidepressant|ssri)/,
];

// A sentence mentioning medication or a diagnosis is fine when it is a
// disclaimer, a warning not to change medication, or a pointer to a clinician.
const FIRST_PERSON_CANNOT =
  /\bi (?:can't|cannot|can not|won't|will not|am not able to|am unable to|am not qualified to|am not allowed to|don't give|do not give|don't diagnose|do not diagnose)\b|\bi'm (?:not able to|unable to|not qualified to|not allowed to)\b/;
const DONT_CHANGE =
  /\b(?:don't|do not|never|please don't|please do not|shouldn't|should not|avoid)\s+(?:\w+\s+){0,2}(?:stop|skip|change|quit|start|increase|reduce|double|cut|come off|go off|alter|adjust|switch)/;
const CLINICIAN_REFERRAL =
  /\b(?:ask|asking|talk|talking|speak|speaking|check|checking|consult|consulting|discuss|discussing|see|seeing|contact|contacting|chat|raise|raising|bring|bringing)\b[^.!?]*\b(?:doctor|pharmacist|psychiatrist|clinician|gp|prescriber|healthcare|health care|nurse|clinic|health professional|medical professional)\b/;
const REFERRAL_UNDERMINED = /\b(?:without|instead of|rather than|no need|don't need|do not need|but|just|honestly|actually|however)\b/;

// "You said you stopped taking your medication" describes what the student did;
// it is not advice. Blank out that "taking" before medication matching. After
// "if/once/when/had you" it is advice again ("if you stopped taking your meds").
const DESCRIPTIVE_TAKING =
  /\b(?<!\b(?:if|once|when|had) you )(?<!\b(?:if|once|when|had) you \w+ )(?:stopped|started|began|been|kept|were|was|had|have|missed|forgot to)\s+(?:\w+\s+)?taking\b/g;

function isSafeSentence(sentence: string): boolean {
  if (FIRST_PERSON_CANNOT.test(sentence) || DONT_CHANGE.test(sentence)) return true;
  return CLINICIAN_REFERRAL.test(sentence) && !REFERRAL_UNDERMINED.test(sentence);
}

function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?\n])\s+/).filter((s) => s.length > 0);
}

/** True if any sentence matches a pattern and is not an exempt, safe sentence. */
function flaggedSentence(text: string, patterns: readonly RegExp[]): boolean {
  return splitSentences(text).some((sentence) => patterns.some((p) => p.test(sentence)) && !isSafeSentence(sentence));
}

// ----------------------------------------------------------- impersonation

const PROFESSIONS = alt([
  "psycholog\\w*", "psychiatr\\w*", "doctors?", "drs?\\b", "counsel+ors?", "counsel+ers?", "therapists?", "clinicians?",
  "social workers?", "nurses?", "physicians?", "medical professionals?", "paramedics?", "healthcare (?:professional|worker)s?",
  "mental health (?:professional|practitioner|expert|worker)s?", "crisis (?:counsel+or|worker|line|operator)s?",
  "emergency (?:services?|responders?|operators?|dispatchers?|hotlines?|lines?)",
]);
const CREDENTIALS = "(?:(?:fully|trained|licen[cs]ed|qualified|registered|professional|clinical|certified|experienced|real|actual|human)\\s+){0,3}";

const IMPERSONATION_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b(?:i am|i'm|im|i work as|i was|i've been|i have been)\\s+(?:(?:also|really|actually|basically|still)\\s+)?(?:an?\\s+|your\\s+|the\\s+)?${CREDENTIALS}(?:${PROFESSIONS})\\b`),
  new RegExp(`\\b(?:as|speaking as)\\s+(?:an?\\s+|your\\s+|the\\s+)${CREDENTIALS}(?:${PROFESSIONS})\\b`),
  /\bin my (?:professional|clinical|medical) (?:opinion|judge?ment|experience)\b/,
  /\bi (?:can|will|'ll) (?:diagnose|prescribe|treat|medicate) you\b|\bi'll (?:diagnose|prescribe|treat|medicate) you\b/,
  // Promising to summon emergency help: this tool cannot, and a student may rely on it.
  /\bi(?:'ll| will| can|'m going to| am going to)\s+(?:call|send|dispatch|contact|alert|get)\s+(?:an?\s+|the\s+)?(?:ambulance|police|paramedics?|emergency services?|help)\b/,
];

// --------------------------------------------------------------- certainty

const CERTAINTY_PATTERNS: readonly RegExp[] = [
  /\byou (?:definitely|certainly|clearly|obviously|undoubtedly|absolutely)\s+(?:have|are|feel|need|suffer)\b/,
  /\bi know exactly (?:what|how) you(?:'re| are)?\b/,
  /\bi know (?:how|what) you(?:'re| are)? (?:feel\w*|going through|experiencing|thinking)\b/,
  /\bi can tell (?:that )?you(?:'re| are| have| must)\b/,
  /\bthere(?:'s| is) no doubt (?:that )?you\b/,
  /\bi(?:'m| am) (?:100%|completely|absolutely|totally|one hundred percent) (?:sure|certain)\b/,
  /\byou are (?:clearly|obviously|definitely|certainly|undoubtedly)\s+(?:suffering|struggling|unwell|ill|sick|depressed|anxious|traumati[sz]ed)\b/,
  // Promises and guarantees this tool has no way to keep.
  /\bi (?:promise|guarantee|swear)\b/,
  /\b(?:everything|it|things) (?:will|is going to|are going to) (?:definitely|certainly|absolutely|always) be\b/,
  /\byou will (?:definitely|certainly|absolutely) (?:pass|be fine|be okay|be ok|get through)\b/,
];

// ------------------------------------------------------ discouraging support

const SUPPORT_TARGETS =
  "(?:anyone|anybody|a doctor|your (?:family|parents|doctor|friends|tutor|lecturer|mom|mum|dad)|a counsel+or|a therapist|professional help|a professional)";

const DISCOURAGE_SUPPORT_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\b(?:don't|do not|never|shouldn't|should not)\\s+(?:tell|talk to|speak to|see|call|contact|reach out to|ask|trust)\\s+${SUPPORT_TARGETS}`),
  new RegExp(`\\b(?:you don't need|you do not need|no need (?:for|to see)|there's no need (?:for|to see))\\s+(?:a |an |to see )?(?:doctor|professional|counsel+or|therapist|psychologist|help)\\b`),
  /\bkeep (?:this|it|that) (?:a secret|between us|to yourself|quiet|secret)\b/,
  /\bour (?:little )?secret\b/,
  /\bwhy bother (?:telling|talking|asking|seeing|calling|going)\b/,
];

// ------------------------------------------------- substances as coping

const SUBSTANCE_PATTERNS: readonly RegExp[] = [
  /\b(?:have|try|take|smoke|use|grab|pour|get|drink|down)\s+(?:yourself\s+)?(?:(?:a|an|some|one|two|a couple of)\s+)?(?:(?:glass|glasses|bottle|shot|shots) of\s+)?(?:alcohol|wine|beer|whisk(?:e)?y|vodka|brandy|gin|rum|dagga|weed|cannabis|marijuana|joint|nyaope|vape)\b/,
  /\ba (?:glass of (?:wine|beer)|beer|shot|joint|drink or two|few drinks)(?: or (?:two|three|a few))?\s+(?:would|will|could|might|can)\s+(?:help|take the edge|calm|relax)/,
];

// ---------------------------------------------------- productivity pressure

// Unsafe productivity pressure — only relevant once tier has escalated.
const PRODUCTIVITY_PRESSURE_PATTERNS: readonly RegExp[] = [
  /\b(?:push through|power through|just work harder|work harder|no excuses|stop making excuses|suck it up)\b/,
  /\b(?:snap out of it|get over it|man up|toughen up|stop being lazy|stop being so lazy|stop complaining|stop whining)\b/,
  /\byou (?:just )?(?:need|have|must) to (?:just )?(?:focus|try harder|work harder|push|be stronger|be tougher)\b/,
  /\b(?:other people|others) have it (?:worse|harder)\b/,
  /\bsleep when you(?:'re| are) (?:dead|done)\b/,
];

// T3-only: never discuss or name self-harm methods, even in a generated reply.
const METHOD_DISCUSSION_PATTERNS: readonly RegExp[] = [
  /\b(?:overdose|hang(?:ing)?|jump(?:ing)? from|cut(?:ting)? (?:yourself|your wrists))\b/,
];

export interface GateCheck {
  reason: string;
  test: (candidates: readonly string[]) => boolean;
}

const wholeText = (patterns: readonly RegExp[]) => (candidates: readonly string[]) =>
  candidates.some((text) => patterns.some((p) => p.test(text)));

const perSentence =
  (patterns: readonly RegExp[], prepare: (text: string) => string = (t) => t) =>
  (candidates: readonly string[]) =>
    candidates.some((text) => flaggedSentence(prepare(text), patterns));

const dropDescriptiveTaking = (text: string): string => text.replace(DESCRIPTIVE_TAKING, (m) => m.replace(/taking$/, "~"));

function buildChecks(tier: RiskTier): GateCheck[] {
  const checks: GateCheck[] = [
    { reason: "diagnosis", test: perSentence(DIAGNOSIS_PATTERNS) },
    { reason: "medication", test: perSentence(MEDICATION_PATTERNS, dropDescriptiveTaking) },
    { reason: "impersonation", test: wholeText(IMPERSONATION_PATTERNS) },
    { reason: "certainty_claim", test: wholeText(CERTAINTY_PATTERNS) },
    { reason: "discourages_support", test: wholeText(DISCOURAGE_SUPPORT_PATTERNS) },
    { reason: "substance_suggestion", test: wholeText(SUBSTANCE_PATTERNS) },
  ];

  if (tier !== "T0") {
    checks.push({ reason: "productivity_pressure", test: wholeText(PRODUCTIVITY_PRESSURE_PATTERNS) });
  }

  if (tier === "T3") {
    checks.push({ reason: "method_discussion", test: wholeText(METHOD_DISCUSSION_PATTERNS) });
  }

  return checks;
}

export function applyOutputGate(rawResponse: string, tier: RiskTier, fallback: string): OutputGateResult {
  // Match on normalised text (apostrophes, invisible characters, lookalike
  // letters, leetspeak readings). The response returned to the student is
  // still the original text.
  const candidates = matchCandidates(rawResponse);
  const reasons = buildChecks(tier)
    .filter((check) => check.test(candidates))
    .map((check) => check.reason);

  if (reasons.length > 0) {
    return { allowed: false, response: fallback, blockedReasons: reasons };
  }

  return { allowed: true, response: rawResponse, blockedReasons: [] };
}
