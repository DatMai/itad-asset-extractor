/**
 * Normalisers: turn the text of one cell into one clean value.
 *
 * Each returns { value, confidence, note }. Two rules hold everywhere:
 *  - an empty cell or a placeholder ("N/A", "-") gives value null with confidence 1: we are sure
 *    there is nothing there;
 *  - text we cannot read gives value null with confidence 0 and a note. We never guess.
 */
import { cleanText, isPlaceholder, normaliseText, parseNumber, round, tokens } from "./text";
import type { AssetType, Normalised } from "./types";
import {
  findBrand,
  findCpu,
  findNonComputerWord,
  findProductLine,
  findTypeWord,
  MONITOR_TYPE_WORDS,
  TYPE_COLUMN_ONLY_WORDS,
} from "./vocab";

const empty = <T>(): Normalised<T> => ({ value: null, confidence: 1 });
const unreadable = <T>(what: string, raw: string): Normalised<T> => ({
  value: null,
  confidence: 0,
  note: `Could not read ${what} from "${cleanText(raw)}"`,
});

// --- Capacities (RAM and storage) -------------------------------------------------------------

export type CapacityUnit = "TB" | "GB" | "MB";

interface Capacity {
  /** Number of identical parts: 2 in "2x 1TB". */
  count: number;
  amount: number;
  unit: CapacityUnit | null;
}

/**
 * An optional count, a number and an optional unit: "2x 1TB", "512 GB", "16G", "32768 MB", "512".
 * The lookbehind keeps us out of model numbers ("X2680G", "DDR4") and decimals ("M.2").
 */
const CAPACITY =
  /(?<![a-z0-9.,])(?:(\d+)\s*[x×*]\s*)?(\d+(?:[.,]\d+)?)\s*(terabytes?|gigabytes?|megabytes?|tib|gib|mib|tb|gb|mb|gigs?|megs?|t|g|m)?(?![a-z0-9])/gi;

export function toUnit(text: string | undefined): CapacityUnit | null {
  if (!text) return null;
  const first = text[0].toLowerCase();
  if (first === "t") return "TB";
  return first === "g" ? "GB" : "MB";
}

/** Convert to GB. RAM uses base 1024 (binary); drives are sold in base 1000 (decimal). */
export function toGB(amount: number, unit: CapacityUnit, base: 1000 | 1024): number {
  if (unit === "TB") return amount * base;
  if (unit === "MB") return amount / base;
  return amount;
}

function findCapacities(text: string): Capacity[] {
  // Brackets hold asides such as "(RAID 5)" or "(2 x 8 GB)" that must not be counted twice.
  const withoutAsides = text.replace(/\([^)]*\)/g, " ");
  return [...withoutAsides.matchAll(CAPACITY)].map((match) => ({
    count: match[1] ? Number(match[1]) : 1,
    amount: parseNumber(match[2]),
    unit: toUnit(match[3]),
  }));
}

/** The unit a header declares, e.g. "RAM (GB)" -> "GB". Lets us trust bare numbers below it. */
export function unitFromHeader(header: string): CapacityUnit | undefined {
  const words = tokens(header);
  if (words.some((word) => ["gb", "gib", "gigabyte", "gigabytes"].includes(word))) return "GB";
  if (words.some((word) => ["mb", "mib", "megabyte", "megabytes"].includes(word))) return "MB";
  if (words.some((word) => ["tb", "tib", "terabyte", "terabytes"].includes(word))) return "TB";
  return undefined;
}

export function normaliseRam(raw: string, headerUnit?: CapacityUnit): Normalised<number> {
  if (isPlaceholder(raw)) return empty();
  const found = findCapacities(raw);
  const capacity = found.find((item) => item.unit !== null) ?? found[0];
  if (!capacity) return unreadable("a RAM size", raw);

  // A bare number: big ones are megabytes ("16384"), small ones gigabytes ("16").
  const assumed: CapacityUnit = capacity.amount >= 512 ? "MB" : "GB";
  const unit = capacity.unit ?? headerUnit ?? assumed;
  const gb = round(capacity.count * toGB(capacity.amount, unit, 1024), 2);
  if (gb <= 0) return unreadable("a RAM size", raw);

  if (capacity.unit !== null || headerUnit) return { value: gb, confidence: 1 };
  return { value: gb, confidence: 0.7, note: `No unit given; assumed ${unit}` };
}

export function normaliseStorage(raw: string, headerUnit?: CapacityUnit): Normalised<number> {
  if (isPlaceholder(raw)) return empty();
  const found = findCapacities(raw);

  // Add up every capacity that has a unit: "256GB SSD + 1TB HDD", "4 x 1.92TB".
  const total = found.reduce(
    (sum, item) => (item.unit ? sum + item.count * toGB(item.amount, item.unit, 1000) : sum),
    0,
  );
  if (total > 0) return { value: round(total, 1), confidence: 1 };

  const bare = found[0];
  if (!bare || bare.amount <= 0) return unreadable("a storage size", raw);
  if (headerUnit) {
    return { value: round(bare.count * toGB(bare.amount, headerUnit, 1000), 1), confidence: 1 };
  }
  // A bare number with no unit anywhere: "2" is almost certainly TB, "512" almost certainly GB.
  const unit: CapacityUnit = bare.amount <= 16 ? "TB" : "GB";
  return {
    value: round(bare.count * toGB(bare.amount, unit, 1000), 1),
    confidence: unit === "TB" ? 0.5 : 0.7,
    note: `No unit given; assumed ${unit}`,
  };
}

// --- Screen size ------------------------------------------------------------------------------

/** A one- or two-digit number with an optional inch or cm mark: 14", 14 inch, 14in, 24-inch, 35.6 cm. */
const SCREEN =
  /(?<![a-z0-9.,])(\d{1,2}(?:[.,]\d{1,2})?)(?!\d)\s*(''|["”″]|-?\s?inch(?:es)?\b|-?in\b|cm\b)?/gi;

export function normaliseScreen(raw: string): Normalised<number> {
  if (isPlaceholder(raw)) return empty();
  const found = [...raw.matchAll(SCREEN)];
  // Prefer a number that carries a unit ('FHD 15.6" IPS'); otherwise take the first number.
  const match = found.find((item) => item[2]) ?? found[0];
  if (!match) return unreadable("a screen size", raw);

  const isCentimetres = match[2]?.toLowerCase() === "cm";
  const inches = round(parseNumber(match[1]) / (isCentimetres ? 2.54 : 1), 1);
  if (inches < 5 || inches > 60) return unreadable("a screen size", raw);
  return { value: inches, confidence: match[2] ? 1 : 0.9 };
}

// --- Asset type -------------------------------------------------------------------------------

/** For the value of a "type" column. `nonComputer` is set for monitors, keyboards and the like. */
export function normaliseAssetType(raw: string): Normalised<AssetType> & { nonComputer?: string } {
  if (isPlaceholder(raw)) return empty();
  const text = normaliseText(raw);

  // In a type column "Laptop dock" is a dock, so accessory words are checked first.
  const accessory = findNonComputerWord(text)?.label ?? (MONITOR_TYPE_WORDS.test(text) ? "monitor" : undefined);
  if (accessory) return { value: null, confidence: 1, nonComputer: accessory };

  const typeWord = findTypeWord(text);
  if (typeWord) return { value: typeWord.type, confidence: 1 };

  const hint = findProductLine(text) ?? TYPE_COLUMN_ONLY_WORDS.find((entry) => entry.pattern.test(text));
  if (hint) return { value: hint.type, confidence: 0.9 };

  return { value: "other", confidence: 0.5, note: `Unrecognised type "${cleanText(raw)}"` };
}

// --- Manufacturer -----------------------------------------------------------------------------

export function normaliseManufacturer(raw: string): Normalised<string> {
  if (isPlaceholder(raw)) return empty();
  const brand = findBrand(normaliseText(raw));
  // Use the table only when the cell starts with the brand ("Dell Inc."), not when it mentions one.
  if (brand && brand.index === 0) return { value: brand.name, confidence: 1 };
  return { value: cleanText(raw), confidence: 0.9, note: "Not a manufacturer we know; kept as written" };
}

// --- CPU --------------------------------------------------------------------------------------

/** Remove the noise of system exports: "Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz". */
export function tidyCpuText(text: string): string {
  return cleanText(text.replace(/\((?:R|TM|C)\)|[®™©]/gi, " ").replace(/@\s*\d+(?:\.\d+)?\s*GHz/gi, " "));
}

export function normaliseCpu(raw: string): Normalised<string> {
  if (isPlaceholder(raw)) return empty();
  const cpu = findCpu(tidyCpuText(raw));
  if (!cpu) return { value: cleanText(raw), confidence: 0.6, note: "Not a CPU family we know; kept as written" };
  if (!cpu.hasModel) return { value: cpu.name, confidence: 0.7, note: "No model number given" };
  return { value: cpu.name, confidence: 1 };
}

// --- Dates ------------------------------------------------------------------------------------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Build YYYY-MM-DD, or null when the day does not exist (31 February) or the year is absurd. */
function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  const exists =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!exists || year < 1980 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Two-digit years: 00–49 are 2000s, 50–99 are 1900s. */
const fullYear = (year: number) => (year >= 100 ? year : year < 50 ? 2000 + year : 1900 + year);

/**
 * Dates are parsed by hand, not with `new Date(text)`, whose result depends on the browser and
 * reads 12/03/2021 as December. Ambiguous day/month order is read day first (Australia).
 */
export function normaliseDate(raw: string): Normalised<string> {
  if (isPlaceholder(raw)) return empty();
  const text = cleanText(raw);
  const result = (iso: string | null, confidence: number, note?: string): Normalised<string> =>
    iso ? { value: iso, confidence, note } : unreadable("a date", raw);

  // 2021-08-19 or 2021/08/19, optionally followed by a time.
  let match = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(text);
  if (match) return result(isoDate(+match[1], +match[2], +match[3]), 1);

  // 12/03/2021, 12-03-21: two numbers and a year.
  match = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})$/.exec(text);
  if (match) {
    const [first, second, year] = [+match[1], +match[2], fullYear(+match[3])];
    if (second > 12) {
      return result(isoDate(year, first, second), 0.7, `Read as month/day because ${second} cannot be a month`);
    }
    const unambiguous = first > 12 || first === second;
    return result(
      isoDate(year, second, first),
      unambiguous ? 1 : 0.8,
      unambiguous ? undefined : "Could be day/month or month/day; read as day/month",
    );
  }

  // 12 Mar 2021, 12-Mar-21.
  match = /^(\d{1,2})[\s-]+([a-z]{3,9})\.?[\s,-]+(\d{4}|\d{2})$/i.exec(text);
  if (match) return result(isoDate(fullYear(+match[3]), monthNumber(match[2]), +match[1]), 1);

  // March 12, 2021.
  match = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i.exec(text);
  if (match) return result(isoDate(+match[3], monthNumber(match[1]), +match[2]), 1);

  // A date exported as Excel's day count, e.g. 44267. Day 0 is 30 December 1899.
  if (/^\d{5}$/.test(text)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(text) * 86_400_000);
    const iso = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    return result(iso, 0.6, "Looks like a spreadsheet day number");
  }

  return unreadable("a date", raw);
}

/** 1–12 for a month name or abbreviation, 0 when it is not a month. */
function monthNumber(name: string): number {
  return MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1;
}

// --- Plain text fields ------------------------------------------------------------------------

export function normaliseSerial(raw: string): Normalised<string> {
  if (isPlaceholder(raw)) return empty();
  const value = cleanText(raw).replace(/^'/, ""); // a leading apostrophe forces "text" in Excel
  if (/^\d(?:\.\d+)?e\+?\d+$/i.test(value)) {
    return { value, confidence: 0.3, note: "A spreadsheet rounded this number; the original digits are lost" };
  }
  if (/\s/.test(value)) return { value, confidence: 0.6, note: "Serial numbers rarely contain spaces" };
  return { value, confidence: 1 };
}

/** Model, asset tag, person, location, cost centre, notes: kept as written, tidied. */
export function normalisePlainText(raw: string): Normalised<string> {
  if (isPlaceholder(raw)) return empty();
  return { value: cleanText(raw), confidence: 1 };
}
