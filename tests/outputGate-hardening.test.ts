import { describe, expect, it } from "vitest";
import { applyOutputGate } from "../src/safety/outputGate";
import { buildT3ForcedResponse } from "../src/safety/fallback";
import { runTool } from "../src/tools/index";
import { TOOL_IDS } from "../src/tools/registry";
import { evaluatePolicy } from "../src/safety/policy";

const FALLBACK = "FALLBACK_TEXT";
const gate = (text: string, tier: "T0" | "T1" | "T2" | "T3" = "T1") => applyOutputGate(text, tier, FALLBACK);

describe("output gate hardening: free-form model phrasings that used to slip through", () => {
  const blocked: Array<[string, string]> = [
    // The four phrasings found by hand before this phase
    ["diagnosis", "You probably have depression, so you should start taking antidepressants."],
    ["diagnosis", "It sounds like you may have an anxiety disorder."],
    ["medication", "Try upping your dose a little, it should help."],
    ["impersonation", "I'm a trained counsellor and I can help you here."],
    // diagnosis
    ["diagnosis", "That sounds like depression to me."],
    ["diagnosis", "You're probably depressed."],
    ["diagnosis", "You show signs of ADHD."],
    ["diagnosis", "I think you may have post-traumatic stress."],
    ["diagnosis", "What you are describing is textbook bipolar disorder."],
    ["diagnosis", "Your diagnosis is pretty clear."],
    ["diagnosis", "You are struggling with generalised anxiety disorder."],
    // medication
    ["medication", "You should stop taking your meds."],
    ["medication", "Have you thought about starting an SSRI?"],
    ["medication", "Cut your dose in half and see how you feel."],
    ["medication", "Take two Xanax and get some rest."],
    ["medication", "You could switch to a different antidepressant."],
    ["medication", "Just skip the pills tonight."],
    // impersonation
    ["impersonation", "As a psychologist, I'd say this is common."],
    ["impersonation", "I'm a mental health professional and I'm here for you."],
    ["impersonation", "Don't worry, I'll call an ambulance for you."],
    ["impersonation", "I can send help to where you are."],
    ["impersonation", "In my professional opinion, you are fine."],
    // certainty
    ["certainty_claim", "I know exactly how you feel."],
    ["certainty_claim", "I can tell you're depressed."],
    ["certainty_claim", "There is no doubt that you are exhausted and ill."],
    // discouraging support
    ["discourages_support", "Don't tell anyone about this."],
    ["discourages_support", "You don't need a doctor for this."],
    ["discourages_support", "Keep this between us."],
    ["discourages_support", "There's no need to see a counsellor."],
    // found by probing after the first version
    ["medication", "This is classic anxiety, and you'd benefit from an anti-anxiety prescription."],
    ["medication", "Honestly, you'd feel better if you stopped your lithium."],
    ["medication", "You'd feel better if you stopped taking your medication."],
    ["medication", "Skipping tonight's dose won't hurt."],
    ["diagnosis", "Your symptoms are consistent with an anxiety disorder."],
    ["diagnosis", "You seem to be suffering from a panic disorder."],
    ["substance_suggestion", "A glass of wine or two would help you relax tonight."],
    ["substance_suggestion", "Try some dagga to take the edge off."],
    ["certainty_claim", "Everything will definitely be fine, I promise."],
    ["certainty_claim", "You will definitely pass if you just stay calm."],
    ["discourages_support", "No one needs to know, it's our secret."],
    ["discourages_support", "Why bother telling your family? They won't understand."],
  ];

  it.each(blocked)("blocks (%s): %s", (reason, text) => {
    const r = gate(text);
    expect(r.allowed).toBe(false);
    expect(r.response).toBe(FALLBACK);
    expect(r.blockedReasons).toContain(reason);
  });

  it("blocks unsafe productivity pressure from model text once escalated, but not at T0", () => {
    for (const text of ["Just snap out of it.", "You need to work harder.", "Other people have it worse than you."]) {
      expect(gate(text, "T1").blockedReasons).toContain("productivity_pressure");
      expect(gate(text, "T0").allowed).toBe(true);
    }
  });
});

describe("output gate hardening: good supportive replies must still pass", () => {
  const safe = [
    "That sounds really tough. A counsellor or doctor could help you work out what's going on.",
    "I'm not a doctor or a therapist, just a companion to help you find support.",
    "I can't diagnose anything, but it might help to talk to a doctor about how you've been feeling.",
    "Please don't stop taking any medication you've been prescribed without speaking to your doctor.",
    "It might be worth asking your doctor or pharmacist whether medication could help.",
    "Assignments pile up fast. Try picking the smallest one and giving it ten minutes.",
    "You might be feeling anxious about the exams, and that makes sense.",
    "You have a lot on your plate right now.",
    "You have anxiety about exams, and many students do.",
    "It sounds like a lot to carry. Is there someone you trust you could talk to?",
    "You don't have to tell anyone before you're ready, though a friend or tutor might help.",
    "Take a short break, drink some water, and take a few slow breaths.",
    "I'm a companion, not a counsellor, and I can't replace one.",
    "I can help you find how to reach your university's support services.",
    "Is it okay if we look at just one module for now?",
    "Sleep, food and short breaks often make a difference. It can also help to avoid alcohol and too much caffeine.",
    "Have a glass of water and take a few slow breaths before you start.",
    "You said you stopped taking your medication. It could help to talk to your doctor or pharmacist about that.",
    "Taking one small step at a time can help, like opening the study guide for ten minutes.",
    "I can't promise how things will go, but we can look at one small step together.",
  ];
  it.each(safe)("passes: %s", (text) => {
    for (const tier of ["T0", "T1", "T2"] as const) {
      const r = gate(text, tier);
      expect(r.blockedReasons, text).toEqual([]);
      expect(r.allowed).toBe(true);
      expect(r.response).toBe(text);
    }
  });

  it("does not block the deterministic T3 forced response or any local tool's content", () => {
    expect(gate(buildT3ForcedResponse(), "T3").allowed).toBe(true);
    for (const toolId of TOOL_IDS) {
      for (const tier of ["T0", "T1", "T2"] as const) {
        const policy = evaluatePolicy(tier, "express");
        const out = runTool(toolId, { tier, intent: "express", text: "help", policy });
        const text = [out.summary, ...(out.details ?? [])].join("\n");
        expect(gate(text, tier).blockedReasons, `${toolId}@${tier}`).toEqual([]);
      }
    }
  });
});

describe("output gate hardening: evasion via formatting", () => {
  it.each([
    ["zero-width character inside a word", "You should start taking anti​depressants."],
    ["hyphenated drug name", "Try upping your anti-depressants."],
    ["curly apostrophe", "I’m a licensed psychologist."],
    ["digit/symbol substitution", "St0p t4king your m3ds."],
    ["Cyrillic lookalike letters", "You should stop taking your mеds."],
    ["mixed case and extra spaces", "YOU   MAY   HAVE   an  Anxiety   Disorder."],
  ])("still blocks: %s", (_label, text) => {
    expect(gate(text).allowed).toBe(false);
  });
});

describe("output gate hardening: a safe sentence cannot launder an unsafe one", () => {
  it("blocks when an unsafe sentence sits next to a disclaimer", () => {
    const r = gate("I can't diagnose you. You probably have depression.");
    expect(r.allowed).toBe(false);
    expect(r.blockedReasons).toContain("diagnosis");
  });
  it("blocks a fake referral that undermines the clinician", () => {
    const r = gate("You could ask your doctor, but honestly just stop taking your pills.");
    expect(r.allowed).toBe(false);
    expect(r.blockedReasons).toContain("medication");
  });
});
