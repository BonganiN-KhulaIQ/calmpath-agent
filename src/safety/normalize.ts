/**
 * Text normalisation for deterministic pattern matching.
 *
 * Every safety pattern is written against plain lowercase ASCII English. Real
 * text, and deliberate evasion, arrives in other shapes: typographic
 * apostrophes from phone keyboards ("don’t"), invisible characters pasted or
 * inserted between letters, fullwidth or accented letters, lookalike letters
 * from other alphabets, stray punctuation or repeated spaces inside a phrase,
 * and digit/symbol substitutions ("k1ll mys3lf").
 *
 * Everything here is for MATCHING ONLY. Never use the result as text shown to
 * or stored for the student, and never log it (it can contain crisis content).
 *
 * Deliberately NOT handled (cannot be recovered without guessing, or would
 * cause false positives): masked letters ("k*ll"), repeated letters
 * ("diiie"), letters separated by spaces ("d i e"), misspellings, other
 * languages. See PROGRESS.md.
 */

const APOSTROPHE_VARIANTS = /[‘’‛ʼʹ′´`＇]/g;

// Zero-width and formatting characters, soft hyphen, bidi controls, BOM,
// variation selectors. None of these are visible, all can split a word.
const INVISIBLE =
  /[­͏؜ᅟᅠ឴឵᠋-᠎​-‏‪-‮⁠-⁯ㅤ︀-️﻿ﾠ]/g;

const COMBINING_MARKS = /[̀-ͯ]/g;

// Lookalike letters from Cyrillic, Greek and a few Latin extensions, folded to
// the ASCII letter they imitate. Applied after lowercasing.
const LOOKALIKES: Readonly<Record<string, string>> = {
  // Cyrillic
  "а": "a", "с": "c", "е": "e", "і": "i", "ј": "j",
  "о": "o", "р": "p", "ѕ": "s", "у": "y", "х": "x",
  "к": "k", "м": "m", "н": "h", "т": "t", "ԁ": "d",
  "ӏ": "l", "ґ": "r", "в": "b", "г": "r", "ї": "i",
  // Greek
  "ο": "o", "α": "a", "ε": "e", "ι": "i", "κ": "k",
  "ν": "v", "ρ": "p", "τ": "t", "υ": "u", "χ": "x",
  "η": "n", "ω": "w", "μ": "u",
  // Latin extensions
  "ı": "i", "ɡ": "g", "ɑ": "a", "ȷ": "j",
};
const LOOKALIKE_RE = new RegExp(`[${Object.keys(LOOKALIKES).join("")}]`, "g");

// Punctuation used to split a word ("k.i.l.l", "k-i-l-l", "k_i_l_l", "k·i·l·l")
// when it sits directly between two letters.
const INTRA_WORD_PUNCT = /(?<=[a-z])[.\-_·•‧‐-―](?=[a-z])/g;

/** Base normalisation: safe for any text, including model output. */
export function normalizeForMatching(text: string): string {
  return text
    // First: NFKC would turn U+00B4 (acute accent) into a space plus a combining
    // mark, so apostrophe variants must be folded before it runs.
    .replace(APOSTROPHE_VARIANTS, "'")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(LOOKALIKE_RE, (c) => LOOKALIKES[c] ?? c)
    .replace(INTRA_WORD_PUNCT, "")
    .replace(/\s+/g, " ")
    .trim();
}

const LEET_COMMON: Readonly<Record<string, string>> = {
  "0": "o", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

function applyLeet(text: string, oneAs: "i" | "l"): string {
  return text.replace(/[a-z0-9@$]+/g, (token) => {
    // Only touch words that mix letters with substitution characters, so plain
    // numbers ("3 assignments", "2024") are left alone.
    if (!/[a-z]/.test(token) || !/[0-9@$]/.test(token)) return token;
    return token.replace(/[0-9@$]/g, (c) => (c === "1" ? oneAs : (LEET_COMMON[c] ?? c)));
  });
}

/**
 * Every form of the text that safety patterns should be tested against: the
 * base normalisation plus digit/symbol-substitution readings ("1" can stand
 * for "i" or "l"). A pattern matching ANY candidate counts as a match.
 */
export function matchCandidates(text: string): string[] {
  const base = normalizeForMatching(text);
  return [...new Set([base, applyLeet(base, "i"), applyLeet(base, "l")])];
}
