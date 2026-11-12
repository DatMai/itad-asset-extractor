/**
 * The browser side of the optional AI suggestion: decide which columns to ask about, build a
 * request that sends as little as possible, and apply the answer without trusting it.
 */
import { isKnownColumnName, kindOfValue } from "@/lib/extraction/mapColumns";
import { isPlaceholder, round, tokens } from "@/lib/extraction/text";
import { FIELD_KEYS, LOW_CONFIDENCE, type ColumnMapping, type ColumnTarget, type SheetPlan } from "@/lib/extraction/types";
import { BRANDS, LINE_ABBREVIATIONS, PRODUCT_LINES, findNonComputerWord, findTypeWord } from "@/lib/extraction/vocab";
import type { SuggestRequest } from "./schema";

/** An AI suggestion is shown as "Medium" at most, so the user still looks at it. */
const AI_CONFIDENCE_LIMIT = 0.8;
const TARGETS: ColumnTarget[] = [...FIELD_KEYS, "combined"];

/** The columns worth asking about: unused or flagged by the rules, and not decided by the user. */
export function unclearColumns(plan: SheetPlan): ColumnMapping[] {
  return plan.columns.filter(
    (column) => column.source !== "you" && (column.target === "ignore" || column.confidence < LOW_CONFIDENCE),
  );
}

/**
 * What leaves the browser: the name of every column (so the model knows which fields are taken)
 * and up to five sample values of the unclear columns only. Values of settled columns are never
 * sent. In a sample, a word is sent as written only when it is a hardware word, a spec or a
 * short number; every other word (a name, an email, a serial number, a phone number) is sent
 * as its shape. See maskSample.
 */
export function buildSuggestRequest(plan: SheetPlan): SuggestRequest {
  const unclear = new Set(unclearColumns(plan).map((column) => column.index));
  const hasHeaderRow = plan.header.rowIndex !== null;
  const headerIsDoubtful = plan.header.confidence < LOW_CONFIDENCE;
  const dataRows = plan.sheet.rows.slice(plan.header.rowIndex === null ? 0 : plan.header.rowIndex + 1);

  return {
    columns: plan.columns.map((column) => {
      const isUnclear = unclear.has(column.index);
      const values = dataRows.map((row) => row[column.index] ?? "").filter((cell) => !isPlaceholder(cell));
      return {
        index: column.index,
        // Without a header row the names are our own "Column A", "Column B": nothing to mask.
        header: (hasHeaderRow ? maskHeader(column.header, headerIsDoubtful) : column.header).slice(0, 120),
        mappedTo: isUnclear ? null : column.target,
        samples: isUnclear ? [...new Set(values)].slice(0, 5).map((value) => maskSample(value).slice(0, 80)) : [],
      };
    }),
  };
}

/**
 * The kinds of value that describe hardware in general, not one person or one device. Only
 * these may leave the browser as written. Serial numbers, asset tags and anything the rules
 * cannot classify (kindOfValue returns null: a name, an email, a place) are not in the list.
 */
const SPEC_KINDS = new Set<string>([
  "cpu", "ramGB", "storageGB", "smallSize", "largeSize", "screenInches",
  "model", "manufacturer", "assetType", "purchaseDate", "combined",
]);

const readsAsSpec = (text: string) => SPEC_KINDS.has(kindOfValue(text) ?? "");

/**
 * The shape of a text: "Sarah Lee" -> "Aaaaa Aaa", "7HKQ2M3" -> "9AAA9A9", "a.b@c.com" ->
 * "a.a@a.aaa". Capitals, digits and punctuation are enough for the model to tell a name from an
 * email from a serial number, and the real text stays in the browser.
 * \p{L} and \p{N} are "any letter" and "any digit" in any alphabet, so "Nguyễn" is masked too;
 * \p{M} are accents stored as separate characters, which are dropped.
 */
export function shapeOf(text: string): string {
  return text
    .replace(/\p{M}/gu, "")
    .replace(/[\p{L}\p{N}]/gu, (character) => {
      if (/\p{N}/u.test(character)) return "9";
      return /\p{Lu}/u.test(character) ? "A" : "a";
    });
}

/**
 * A word that could be an identifier: it has an "@" (an email), or a digit and at least five
 * characters (five is the shortest serial number the rules accept). "16GB", "5420" and "i7" are
 * too short to identify anything; "i7-1185G7" and "512GB" are long enough but read as a spec.
 */
const isCodeLike = (word: string) => (word.includes("@") || (/\d/.test(word) && word.length >= 5)) && !readsAsSpec(word);

/** For column names: mask the code-like words and leave the rest. Splitting on (\s+) keeps the spaces. */
const maskCodeWords = (text: string) =>
  text.split(/(\s+)/).map((word) => (isCodeLike(word) ? shapeOf(word) : word)).join("");

/**
 * Hardware words that vocab.ts has no table for: it knows them only inside its CPU patterns, and
 * the units and drive words live in the patterns of normalise.ts and parseFreeText.ts.
 */
const SPEC_WORDS = [
  "gb", "tb", "mb", "inch", "inches", // units
  "ssd", "hdd", "nvme", "sata", "emmc", "pcie", "ram", "memory", "ddr", "disk", "drive", "storage", // drive and memory words
  "core", "ultra", "xeon", "gold", "silver", "bronze", "platinum", "scalable", "ryzen", "threadripper", // CPU families
  "epyc", "celeron", "pentium", "atom", "athlon", "snapdragon", "amd", "qualcomm", "gen",
];

/** "mac mini" -> "mac", "mini": a sample is checked one word at a time. */
const wordsOf = (phrases: string[]) => phrases.flatMap((phrase) => phrase.split(" "));

/** Every single word the extractor knows as hardware: brands, product lines, their shorthand, spec words. */
const HARDWARE_WORDS = new Set([
  ...wordsOf(BRANDS.flatMap((brand) => brand.aliases)),
  ...wordsOf(PRODUCT_LINES.map((entry) => entry.line)),
  ...LINE_ABBREVIATIONS.map((entry) => entry.abbreviation),
  ...SPEC_WORDS,
]);

/** A brand, a product line, a spec word, or a type word such as "laptop" or "monitor". */
const isHardwareWord = (word: string) =>
  HARDWARE_WORDS.has(word) || findTypeWord(word) !== null || findNonComputerWord(word) !== null;

/** The letters and digits of a word, in any alphabet: "(04)" -> "04", "15.6" -> "156". */
const lettersAndDigits = (word: string) => word.replace(/[^\p{L}\p{N}]/gu, "");

/** The longest word with a digit that is sent without being a spec: "5420", "T14", "G7". */
const SHORT_NUMBER = 4;

/**
 * May this one word of a sample leave the browser as written? Only when it says something
 * about hardware in general. The answer is "no" unless one of the rules below says "yes", so a
 * word we know nothing about (a name, a place, a remark) is always masked.
 */
function mayLeave(word: string): boolean {
  if (word.includes("@")) return false; // an email address
  if (!/\p{N}/u.test(word)) {
    // No digit: every part must be a hardware word. "(Dell)" and "SSD/HDD" pass, "Dell/John" does not.
    // tokens() keeps a-z only, so the length check stops a word in another alphabet passing as "no parts".
    const parts = tokens(word);
    const nothingDropped = parts.join("").length === lettersAndDigits(word).length;
    return nothingDropped && parts.length > 0 && parts.every(isHardwareWord);
  }
  // With a digit: a spec ("16GB", "i7-1185G7", "2021-03-04") or too short to identify anything.
  return readsAsSpec(word) || lettersAndDigits(word).length <= SHORT_NUMBER;
}

const isBareNumber = (word: string | undefined) => word !== undefined && /^\p{N}+$/u.test(lettersAndDigits(word));

/**
 * Two bare numbers in a row ("0412 345 678") are a phone number written with spaces, not a model
 * number. `words` comes from split(/(\s+)/), so the neighbours of a word are two places away.
 */
const isInNumberRun = (words: string[], at: number) =>
  isBareNumber(words[at]) && (isBareNumber(words[at - 2]) || isBareNumber(words[at + 2]));

/** Decide word by word. Splitting on (\s+) keeps the spaces, so the text is put back as it was. */
function maskWords(text: string): string {
  const words = text.split(/(\s+)/);
  return words.map((word, at) => (mayLeave(word) && !isInNumberRun(words, at) ? word : shapeOf(word))).join("");
}

/**
 * One sample value, as it is sent. Masking is the default, twice over: a value that does not
 * read as a hardware detail goes out as its shape whole, and in one that does ("Latitude 5420 -
 * John Smith") only the hardware words stay: "Latitude 5420 - Aaaa Aaaaa".
 */
export function maskSample(value: string): string {
  return readsAsSpec(value) ? maskWords(value) : shapeOf(value);
}

/**
 * One column name, as it is sent. The model needs real names ("Keeper", "Bin") to be of any
 * use, so words are sent as written. Two guards for the case where a data row was taken for
 * the header row: code-like words are always masked, and when the header row itself is a
 * doubtful guess, every name that is not a column name we know is masked whole.
 */
function maskHeader(header: string, headerIsDoubtful: boolean): string {
  if (headerIsDoubtful && !isKnownColumnName(header)) return shapeOf(header);
  return maskCodeWords(header);
}

/**
 * Apply the model's suggestions to a plan. The answer is treated as untrusted input:
 * only unclear columns can change, the field must be one we know, a field already read from
 * another column is not taken away, and the confidence is clamped.
 */
export function applySuggestions(
  plan: SheetPlan,
  suggestions: { index: number; target: string; confidence: number; reason: string }[],
): SheetPlan {
  const askedAbout = new Set(unclearColumns(plan).map((column) => column.index));
  let columns = plan.columns;

  for (const suggestion of suggestions) {
    const target = TARGETS.find((known) => known.toLowerCase() === suggestion.target.toLowerCase());
    if (!target || !askedAbout.has(suggestion.index)) continue; // includes "unmapped"

    const isTaken = target !== "combined" && columns.some((column) => column.index !== suggestion.index && column.target === target);
    if (isTaken) continue;

    columns = columns.map((column) =>
      column.index === suggestion.index
        ? {
            ...column,
            target,
            parts: undefined,
            confidence: round(Math.min(Math.max(suggestion.confidence, 0), AI_CONFIDENCE_LIMIT), 2),
            reason: `AI suggestion: ${suggestion.reason}`,
            source: "ai" as const,
          }
        : column,
    );
  }
  return { ...plan, columns };
}
