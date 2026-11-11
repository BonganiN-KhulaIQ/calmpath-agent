/**
 * Text normalisation for deterministic pattern matching.
 *
 * Phone keyboards (iOS "smart punctuation", many Android keyboards) type a
 * typographic apostrophe (U+2019) instead of the ASCII one, so "don’t" would
 * never match a pattern written as "don't". Every safety pattern is written
 * with the ASCII apostrophe, so text is folded to it before matching.
 *
 * This is for MATCHING ONLY. Never use the result as the text shown to or
 * stored for the student.
 */
const APOSTROPHE_VARIANTS = /[‘’‛ʼʹ′´`＇]/g;

export function normalizeForMatching(text: string): string {
  return text.replace(APOSTROPHE_VARIANTS, "'");
}
