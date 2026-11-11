/** Small text helpers shared by the whole pipeline. */

/**
 * Reduce text to lower-case letters and digits separated by single spaces, so that
 * "S/N", "s.n." and "S N" compare equal and "Số sê-ri" becomes "so se ri".
 */
export function normaliseText(text: string): string {
  return stripAccents(text.replace(/#|№/g, " no ")) // "Serial #" means "serial no"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Máy tính" -> "May tinh". Case and punctuation are kept. */
export function stripAccents(text: string): string {
  return text
    .normalize("NFD") // split accented letters into letter + accent
    .replace(/[̀-ͯ]/g, "") // drop the accents
    .replace(/đ/g, "d") // Vietnamese đ has no decomposed form
    .replace(/Đ/g, "D");
}

export function tokens(text: string): string[] {
  const normalised = normaliseText(text);
  return normalised === "" ? [] : normalised.split(" ");
}

/** Words people type instead of leaving a cell empty. Compared after normaliseText. */
const PLACEHOLDERS = new Set([
  "",
  "na",
  "n a",
  "none",
  "null",
  "nil",
  "unknown",
  "not applicable",
  "not available",
  "tbc",
  "tba",
  "tbd",
  "khong",
  "khong co",
]);

/** True for an empty cell and for stand-ins such as "N/A", "-", "?" or "unknown". */
export function isPlaceholder(text: string): boolean {
  return PLACEHOLDERS.has(normaliseText(text));
}

/** Trim and collapse inner whitespace. */
export function cleanText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * How alike two strings are, from 0 to 1: one minus the share of letters that must be changed
 * to turn one into the other (Levenshtein distance). One typo in "seriel number" scores 0.92.
 * Spaces, case and accents are ignored. Used only to catch misspelt column names; abbreviations
 * such as "S/N" are handled by the synonym lists, because no string measure links them.
 */
export function similarity(a: string, b: string): number {
  const left = normaliseText(a).replace(/ /g, "");
  const right = normaliseText(b).replace(/ /g, "");
  const longest = Math.max(left.length, right.length);
  return longest === 0 ? 0 : 1 - editDistance(left, right) / longest;
}

/** Levenshtein distance: the fewest single-letter inserts, deletes or swaps between two strings. */
function editDistance(a: string, b: string): number {
  // previous[j] = distance between the first i-1 letters of a and the first j letters of b.
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
    }
    previous = current;
  }
  return previous[b.length];
}

/**
 * Read a number that may use a decimal comma ("15,6") or a thousands comma ("32,768").
 * A comma followed by exactly three digits is a thousands separator; otherwise it is a decimal.
 */
export function parseNumber(text: string): number {
  const withoutThousands = text.replace(/,(?=\d{3}(?!\d))/g, "");
  return Number.parseFloat(withoutThousands.replace(",", "."));
}

/** Round to at most `digits` decimals without trailing float noise. */
export function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
