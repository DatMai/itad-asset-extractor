/**
 * Decide what each column of a table holds.
 *
 * Two kinds of evidence are combined:
 *  1. the header's name: a known name, a known name inside a longer header, an abbreviation,
 *     or a misspelling;
 *  2. the values: what the cells of the column look like (CPU names, capacities, brands, …).
 *
 * A header match can be weakened by values that look like something else, and a column with an
 * unknown header can still be mapped from its values. Every mapping carries a 0–1 confidence and
 * a sentence that says where it came from.
 */
import { COMBINED, FIELDS, targetLabel, type FieldDef } from "./fields";
import { normaliseAssetType, normaliseDate, normaliseManufacturer } from "./normalise";
import { parseFreeText } from "./parseFreeText";
import { isPlaceholder, normaliseText, round, similarity, tokens } from "./text";
import { FIELD_KEYS, type ColumnMapping, type ColumnTarget, type FieldKey } from "./types";
import { findProductLine } from "./vocab";

/** A guess weaker than this is not worth showing. */
const MIN_CONFIDENCE = 0.45;
/** How many values of a column are looked at. */
const SAMPLE_SIZE = 50;
/** Unit words in a header ("RAM (GB)") are not part of its name. */
const UNIT_WORDS = new Set(["gb", "mb", "tb", "gib", "inch", "inches", "cm"]);

/**
 * The most a mapping can score when only the values support it. Kinds with an unmistakable shape
 * (a CPU name) rank above kinds that almost anything resembles (a serial number).
 * A field that is not listed is never mapped from values alone: a date could be any date.
 */
const VALUE_ONLY_LIMIT: Partial<Record<ColumnTarget, number>> = {
  combined: 0.8,
  cpu: 0.8,
  assetType: 0.8,
  manufacturer: 0.8,
  ramGB: 0.75,
  storageGB: 0.75,
  screenInches: 0.75,
  model: 0.6,
  serialNumber: 0.6,
  assetTag: 0.6,
};

/** Fields that hold any text. Their values have no shape, so values cannot contradict the header. */
const FREE_TEXT: ColumnTarget[] = ["notes", "assignedTo", "location", "costCentre"];

const TARGETS: ColumnTarget[] = [...FIELD_KEYS, "combined"];
const definitionOf = (target: ColumnTarget): FieldDef => (target === "combined" || target === "ignore" ? COMBINED : FIELDS[target]);
/** How a kind of value is named in a reason: "3 of 3 values look like CPU". */
const kindName = (target: ColumnTarget) => (target === "combined" ? "full descriptions" : targetLabel(target));

interface Candidate {
  index: number;
  target: ColumnTarget;
  parts?: (FieldKey | null)[];
  confidence: number;
  reason: string;
}

/**
 * Map the columns of a table. `headers` may be empty when the table has no header row;
 * `rows` are the data rows, used for value evidence and for the samples shown to the user.
 */
export function mapColumns(headers: string[], rows: string[][]): ColumnMapping[] {
  const width = Math.max(headers.length, ...rows.map((row) => row.length));
  const columns: { index: number; header: string; values: string[] }[] = [];
  const candidates: Candidate[] = [];

  for (let index = 0; index < width; index++) {
    const header = (headers[index] ?? "").trim();
    const values = rows
      .map((row) => row[index] ?? "")
      .filter((cell) => !isPlaceholder(cell))
      .slice(0, SAMPLE_SIZE);
    if (header === "" && values.length === 0) continue; // an empty column
    columns.push({ index, header: header || `Column ${columnLetter(index)}`, values });
    candidates.push(...candidatesFor(index, header, values));
  }

  // Strongest first. A field goes to one column only; several columns may be "combined".
  candidates.sort((a, b) => b.confidence - a.confidence || a.index - b.index);
  const chosen = new Map<number, Candidate>();
  const owner = new Map<ColumnTarget, number>(); // field -> column that got it
  const lostField = new Map<number, ColumnTarget>(); // column -> field it wanted but lost
  for (const candidate of candidates) {
    if (chosen.has(candidate.index)) continue;
    if (candidate.target !== "combined" && owner.has(candidate.target)) {
      if (!lostField.has(candidate.index)) lostField.set(candidate.index, candidate.target);
      continue;
    }
    chosen.set(candidate.index, candidate);
    owner.set(candidate.target, candidate.index);
  }

  const headerOf = (index: number | undefined) => columns.find((column) => column.index === index)?.header;
  return columns.map(({ index, header, values }): ColumnMapping => {
    const samples = [...new Set(values)].slice(0, 3);
    const pick = chosen.get(index);
    if (pick) {
      return { index, header, target: pick.target, parts: pick.parts, confidence: round(pick.confidence, 2), reason: pick.reason, source: "rules", samples };
    }
    const lost = lostField.get(index);
    const reason = lost
      ? `${targetLabel(lost)} is already taken by "${headerOf(owner.get(lost))}"`
      : "No matching field; kept as extra data";
    return { index, header, target: "ignore", confidence: 0, reason, source: "rules", samples };
  });
}

/** Every plausible use of one column, each with its confidence and reason. */
function candidatesFor(index: number, header: string, values: string[]): Candidate[] {
  const names = TARGETS.map((target) => ({ target, name: header ? nameScore(header, definitionOf(target)) : null }));
  const suggested = names.reduce((best, item) => ((item.name?.score ?? 0) > (best.name?.score ?? 0) ? item : best));

  // "CPU / RAM / Disk": the header itself lists the parts of the cell, in order.
  const parts = suggested.name?.score === 1 ? null : partsOfHeader(header);
  if (parts) {
    const labels = parts.map((part) => (part ? FIELDS[part].label : "?")).join(", ");
    return [{ index, target: "combined", parts, confidence: 0.95, reason: `The header lists ${labels}, in that order` }];
  }

  const kinds = kindsOf(values);
  const candidates: Candidate[] = [];
  for (const { target, name } of names) {
    let confidence: number;
    let reason: string;

    if (name) {
      // The header names this field. Values that look like something else count against it;
      // values we cannot classify (names, places) count neither way.
      const odd = FREE_TEXT.includes(target) ? 0 : kinds.filter((kind) => kind !== null && !fitsNamedColumn(kind, target)).length;
      const against = values.length > 0 ? odd / values.length : 0;
      confidence = name.score * (1 - 0.4 * against);
      reason = against >= 0.3 ? `${name.reason}, but ${odd} of ${values.length} values look like something else` : name.reason;
    } else {
      // The header does not name this field. Map it only when most values have its shape.
      const limit = VALUE_ONLY_LIMIT[target];
      const matching = kinds.filter((kind) => kind !== null && fitsUnnamedColumn(kind, target)).length;
      const support = values.length > 0 ? matching / values.length : 0;
      if (!limit || support < 0.6) continue;
      confidence = limit * support;
      reason = `${matching} of ${values.length} values look like ${kindName(target)}`;
      if (suggested.name) {
        // Header and values disagree: go with the values, but make the user look.
        confidence = Math.min(confidence, 0.65);
        reason += `, although the header "${header}" suggests ${targetLabel(suggested.target)}`;
      }
    }
    if (confidence >= MIN_CONFIDENCE) candidates.push({ index, target, confidence, reason });
  }
  return candidates;
}

// --- Evidence from the header ------------------------------------------------------------------

/** How well a header names a field: 1 for a known name, less for a partial or misspelt one. */
function nameScore(header: string, field: FieldDef): { score: number; reason: string } | null {
  const words = tokens(header).filter((word) => !UNIT_WORDS.has(word));
  const name = words.join(" ");
  if (name === "") return null;
  const compact = (text: string) => text.replace(/ /g, "");

  // 1. A known name: "S/N", "Serial No.", "serialnumber".
  const known = [...field.synonyms, ...(field.wholeHeaderOnly ?? [])];
  if (known.some((synonym) => compact(synonym) === compact(name))) {
    return { score: 1, reason: `"${header}" is a known name for ${field.label}` };
  }

  // 2. A known name inside a longer header: "Device Serial Number". The longest one counts.
  const inside = field.synonyms
    .filter((synonym) => synonym.split(" ").every((word) => words.includes(word)))
    .sort((a, b) => b.length - a.length)[0];
  if (inside) {
    const share = inside.split(" ").length / words.length;
    return { score: 0.7 + 0.25 * share, reason: `"${header}" contains "${inside}"` };
  }

  // 3. An abbreviation of a known one-word name: "Manuf", "Loc", "Mdl", "Scr".
  if (words.length === 1 && name.length >= 3) {
    const full = known.find((synonym) => !synonym.includes(" ") && synonym.length >= name.length + 2 && isAbbreviation(name, synonym));
    if (full) return { score: 0.8, reason: `"${header}" looks like an abbreviation of "${full}"` };
  }

  // 4. A misspelling: at most one wrong letter in six. "Seriel No", "Procesor".
  if (compact(name).length >= 6) {
    const closest = field.synonyms
      .map((synonym) => ({ synonym, score: similarity(name, synonym) }))
      .sort((a, b) => b.score - a.score)[0];
    if (closest && closest.score > 0.8) {
      return { score: 0.9 * closest.score, reason: `"${header}" is close to "${closest.synonym}"` };
    }
  }
  return null;
}

/**
 * People shorten a word in two ways: they keep its beginning ("manuf") or its consonants
 * ("mdl"). The second form is only accepted when the short word has no vowel at all, so that
 * an ordinary word is not taken for shorthand ("date" is not "department").
 */
function isAbbreviation(short: string, full: string): boolean {
  if (full.startsWith(short)) return true;
  if (/[aeiou]/.test(short) || short[0] !== full[0]) return false;
  let matched = 0; // letters of `short` found in `full`, in order
  for (const letter of full) if (letter === short[matched]) matched++;
  return matched === short.length;
}

/** For a header such as "CPU / RAM / Disk": the field each part names, or null if it is not a list. */
function partsOfHeader(header: string): (FieldKey | null)[] | null {
  const pieces = header.split(/\s*[/|,&+]\s*|\s+and\s+/i);
  if (pieces.length < 2) return null;
  const parts = pieces.map((piece) => FIELD_KEYS.find((key) => nameScore(piece, FIELDS[key])?.score === 1) ?? null);
  const distinct = new Set(parts.filter((part) => part !== null));
  return distinct.size >= 2 ? parts : null;
}

/** True when a cell reads like the title of a column we know. Used to find the header row. */
export function isKnownColumnName(text: string): boolean {
  return TARGETS.some((target) => nameScore(text, definitionOf(target)) !== null) || partsOfHeader(text) !== null;
}

// --- Evidence from the values ------------------------------------------------------------------

/** "IT-0001", "LAP 123": a short letter prefix and a running number. */
const TAG = /^([a-z]{1,6})[-_ ]?\d{2,8}$/i;

/** What a value looks like. A lone size is "small" or "large" until a header says RAM or storage. */
type ValueKind = ColumnTarget | "smallSize" | "largeSize";

/** Would a value of this kind be at home in a column whose header says `target`? */
function fitsNamedColumn(kind: ValueKind, target: ColumnTarget): boolean {
  if (kind === target) return true;
  // A bare "256 GB" could be RAM or storage; under a header that says which, it is that.
  if (kind === "smallSize" || kind === "largeSize") return target === "ramGB" || target === "storageGB";
  // A model cell often carries the brand or the specs as well; rows deal with that.
  return kind === "combined" && target === "model";
}

/** Without a header to lean on, the size itself decides: small is RAM, large is storage. */
function fitsUnnamedColumn(kind: ValueKind, target: ColumnTarget): boolean {
  if (kind === "smallSize") return target === "ramGB";
  if (kind === "largeSize") return target === "storageGB";
  return kind === target;
}

function kindsOf(values: string[]): (ValueKind | null)[] {
  const kinds = values.map(kindOfValue);
  // Asset tags share one prefix ("IT-0001", "IT-0002"); serial numbers do not.
  const prefixes = values.map((value) => TAG.exec(value)?.[1].toLowerCase());
  const onePrefix = values.length >= 2 && prefixes.every((prefix) => prefix !== undefined && prefix === prefixes[0]);
  return onePrefix ? kinds.map((kind) => (kind === "serialNumber" ? "assetTag" : kind)) : kinds;
}

/** What one cell looks like on its own, or null when it could be anything (a name, a place). */
export function kindOfValue(value: string): ValueKind | null {
  if (isPlaceholder(value)) return null;
  const parsed = parseFreeText(value);
  const line = findProductLine(normaliseText(value));
  const facts = [
    parsed.manufacturer && !parsed.manufacturer.inferred, // a brand, written out
    line,
    parsed.cpu,
    parsed.ramGB ?? parsed.storageGB,
    parsed.screenInches,
    (parsed.assetType && !parsed.assetType.inferred) || parsed.nonComputer, // a type word
  ].filter(Boolean).length;

  if (facts >= 2) return "combined";
  if (parsed.cpu) return "cpu";
  if (parsed.screenInches) return "screenInches";
  const size = parsed.ramGB ?? parsed.storageGB;
  if (size) {
    // Below 0.7 the parser only went by magnitude: one bare size, no label, no "TB", no "2x".
    if (size.confidence < 0.7) return parsed.ramGB ? "smallSize" : "largeSize";
    return parsed.ramGB ? "ramGB" : "storageGB";
  }
  if (line) return "model"; // "Latitude 5420", "Surface Laptop 5"
  if (tokens(value).length <= 3) {
    if (normaliseAssetType(value).confidence === 1) return "assetType";
    if (normaliseManufacturer(value).confidence === 1) return "manufacturer";
  }
  if (normaliseDate(value).confidence >= 0.7) return "purchaseDate";
  return looksLikeSerial(value) ? "serialNumber" : null;
}

/** One token of letters and digits, 5–25 long: "7HKQ2M3", "C02FK8ZTMD6R". */
function looksLikeSerial(value: string): boolean {
  const oneToken = /^[a-z0-9][a-z0-9\-_/.]{4,24}$/i.test(value);
  const mixed = /\d/.test(value) && (/[a-z]/i.test(value) || value.length >= 8);
  return oneToken && mixed;
}

/** 0 -> "A", 25 -> "Z", 26 -> "AA": the column name a spreadsheet shows. */
export function columnLetter(index: number): string {
  let letters = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}
