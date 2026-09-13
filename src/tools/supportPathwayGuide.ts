import type { ToolFn } from "./types";
import { crisisResourceLine } from "../safety/resources";

/**
 * For crisis-adjacent language below the T3 forced-response threshold
 * (i.e. T2 crisis_signal intent). Encourages human support without
 * assessment questions or method discussion.
 */
export const supportPathwayGuide: ToolFn = () => ({
  toolId: "support_pathway_guide",
  summary: "I want to make sure you have real support around this, not just me.",
  details: [
    "Please consider reaching out to someone you trust, or a support service, about how you're feeling.",
    crisisResourceLine(),
  ],
});
