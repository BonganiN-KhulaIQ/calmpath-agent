import { describe, expect, it } from "vitest";
import { selectTool } from "../src/agent/router";
import { evaluatePolicy } from "../src/safety/policy";

describe("selectTool", () => {
  it("routes navigate/prepare/record/learn intents to their dedicated tools regardless of tier", () => {
    const t0 = evaluatePolicy("T0", "navigate");
    expect(selectTool({ intent: "navigate", tier: "T0", policy: t0 })).toBe("resource_navigator");

    const prepare = evaluatePolicy("T1", "prepare");
    expect(selectTool({ intent: "prepare", tier: "T1", policy: prepare })).toBe("appointment_prep");

    const record = evaluatePolicy("T0", "record");
    expect(selectTool({ intent: "record", tier: "T0", policy: record })).toBe("session_summary");

    const learn = evaluatePolicy("T0", "learn");
    expect(selectTool({ intent: "learn", tier: "T0", policy: learn })).toBe("odel_navigator");
  });

  it("escalates express/understand to deeper tools once tier is elevated", () => {
    const calmExpress = evaluatePolicy("T0", "express");
    expect(selectTool({ intent: "express", tier: "T0", policy: calmExpress })).toBe("reflective_conversation");

    const elevatedExpress = evaluatePolicy("T1", "express");
    expect(selectTool({ intent: "express", tier: "T1", policy: elevatedExpress })).toBe("emotional_checkin");

    const elevatedUnderstand = evaluatePolicy("T2", "understand");
    expect(selectTool({ intent: "understand", tier: "T2", policy: elevatedUnderstand })).toBe(
      "academic_pressure_support",
    );
  });

  it("uses action_plan_builder only when policy allows planning tools", () => {
    const t0Policy = evaluatePolicy("T0", "plan");
    expect(t0Policy.allowPlanningTools).toBe(true);
    expect(selectTool({ intent: "plan", tier: "T0", policy: t0Policy })).toBe("action_plan_builder");

    const t1Policy = evaluatePolicy("T1", "plan");
    expect(t1Policy.allowPlanningTools).toBe(true);
    expect(selectTool({ intent: "plan", tier: "T1", policy: t1Policy })).toBe("action_plan_builder");
  });

  it("substitutes balance_support for action_plan_builder whenever the policy disallows planning tools", () => {
    const t2Policy = evaluatePolicy("T2", "plan");
    expect(t2Policy.allowPlanningTools).toBe(false);
    expect(selectTool({ intent: "plan", tier: "T2", policy: t2Policy })).toBe("balance_support");
  });

  it("routes crisis_signal intent (below T3) to the support pathway guide", () => {
    const t2Policy = evaluatePolicy("T2", "crisis_signal");
    expect(selectTool({ intent: "crisis_signal", tier: "T2", policy: t2Policy })).toBe(
      "support_pathway_guide",
    );
  });

  it("routes greeting intent to greeting_response regardless of tier", () => {
    const t0Policy = evaluatePolicy("T0", "greeting");
    expect(selectTool({ intent: "greeting", tier: "T0", policy: t0Policy })).toBe("greeting_response");

    const t2Policy = evaluatePolicy("T2", "greeting");
    expect(selectTool({ intent: "greeting", tier: "T2", policy: t2Policy })).toBe("greeting_response");
  });
});
