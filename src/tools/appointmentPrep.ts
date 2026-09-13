import type { ToolFn } from "./types";

/** Logistics-only prep. Never suggests what a clinician should prescribe or conclude. */
export const appointmentPrep: ToolFn = () => ({
  toolId: "appointment_prep",
  summary: "Here's a simple way to prepare for that appointment.",
  details: [
    "Jot down what's been happening in your own words, in whatever order it comes to you.",
    "Write down two or three questions you want to make sure you ask.",
    "It's fine to bring notes with you — you don't need to remember everything.",
  ],
});
