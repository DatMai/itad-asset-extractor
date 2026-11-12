/**
 * Split one free-text cell into facts:
 *   "HP EliteBook 850 G7 - i7-10610U / 16GB / 512GB SSD / 15.6in"
 *   -> HP · EliteBook 850 G7 · Intel Core i7-10610U · 16 GB · 512 GB · 15.6"
 *
 * How: recognise the parts that have a known shape (CPU, screen size, capacities), cut them out
 * of the text, and read what is left as brand and model. Nothing is guessed: a fact that is not
 * in the text is either absent from the result or marked `inferred` with a reason.
 */
import { AMOUNT, tidyCpuText, toGB, toUnit, type CapacityUnit } from "./normalise";
import { cleanText, normaliseText, parseNumber, round, stripAccents } from "./text";
import type { AssetType } from "./types";
import {
  findBrand,
  findCpu,
  findNonComputerWord,
  findProductLine,
  findTypeWord,
  LINE_ABBREVIATIONS,
} from "./vocab";

export interface Found<T> {
  value: T;
  /** The piece of the cell the value was read from. */
  raw: string;
  confidence: number;
  /** True when the value is not written in the cell but follows from it (ThinkPad -> Lenovo). */
  inferred?: boolean;
  note?: string;
}

export interface ParsedText {
  manufacturer?: Found<string>;
  model?: Found<string>;
  assetType?: Found<AssetType>;
  cpu?: Found<string>;
  ramGB?: Found<number>;
  storageGB?: Found<number>;
  screenInches?: Found<number>;
  /** Set when the text describes something that is not a computer, e.g. "monitor". */
  nonComputer?: string;
}

/** A screen size needs its unit in free text; otherwise any small number would qualify. */
const SCREEN = /(?<![a-z0-9.])(\d{1,2}(?:\.\d{1,2})?)\s?(?:''|["”″]|-?\s?inch(?:es)?\b|-?in\b)/gi;

/**
 * A size with a unit, an optional "N x" in front and an optional label behind:
 * "16GB", "2x 4TB HDD", "16 GB RAM", "1,92TB", "8G".
 * Groups: 1 count, 2 amount (shared with the column normaliser), 3 unit, 4 the whole label part,
 * 5 the label word. The unit must not run into more letters or digits, so the "G5" of
 * "EliteBook 840 G5" and the "T" of "3660 Tower" are not units.
 */
const SIZE = new RegExp(
  String.raw`(?<![a-z0-9.])(?:(\d+)\s*[x×]\s*)?${AMOUNT}\s*(TB|GB|MB|TiB|GiB|MiB|gigs?|G|T)(?![a-z0-9])(\s*(?:of\s+)?(RAM|memory|DDR\d?|SSD|HDD|NVMe|SAS|SATA|eMMC|flash|disk|drive|storage)\b)?`,
  "gi",
);
/**
 * A drive size with the unit left out: "512 SSD", "256SSD", "2 x 512 SSD".
 * Group 1 is the count, group 2 the number. The count is part of the pattern because a count
 * left behind in the text would be read with the next size: "2 x 512 SSD 16GB" as 2 x 16GB.
 */
const DRIVE_WITHOUT_UNIT = /(?<![a-z0-9.,-])(?:(\d+)\s*[x×]\s*)?(\d{3,4})\s?(?:SSD|HDD|NVMe|SATA|eMMC)\b/gi;
/**
 * The sizes drives are sold in. A number in front of "SSD" counts only when it is one of these,
 * so the model number in "Latitude 5490 SSD" or "EliteDesk 800 SSD" is not read as a capacity.
 * Some of these are model numbers too ("IdeaPad 320", "HP 250"): see findDrivesWithoutUnit.
 */
const DRIVE_SIZES = [120, 128, 160, 180, 240, 250, 256, 320, 480, 500, 512, 750, 960, 1000, 1024, 2000];
/** "3G", "4G" and "5G" are mobile networks far more often than they are sizes. */
const MOBILE_NETWORKS = [3, 4, 5];
/** A label written before the size: "RAM: 16GB", "SSD 512GB". */
const LABEL_BEFORE = /(RAM|memory|mem|SSD|HDD|NVMe|disk|drive|storage)\s*[:=-]?\s*$/i;
const RAM_LABEL = /^(ram|memory|mem|ddr\d?)$/i;
/**
 * The smallest size drives are sold in. A drive word in front of a smaller size does not label
 * it: in "Latitude 5490 SSD 8GB" the word says what kind of drive the laptop has, and 8GB is
 * its memory.
 */
const SMALLEST_DRIVE_GB = 120;

/** RAM comes in a short list of sizes. A loose "476GB" is not RAM, whatever its position. */
const RAM_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 36, 40, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048];

/** What separates the parts of a description: | , ; ( ) / and a dash with spaces around it. */
const DELIMITERS = /\s*[|,;()/]\s*|\s+[-–]\s+/;

/**
 * Where a remark about the machine starts: "... with charger", "... no HDD", "... + dock".
 * The word must stand alone between spaces, so the "+" of "RS1221+" and the
 * "Plus" of "Gen10 Plus" stay in the model.
 */
const TRAILING_NOTE = /\s(?:with|without|incl\.?|includes?|including|missing|no|\+|&)\s/i;
/** "with 1TB external HDD": a drive that is not inside the computer. */
const EXTERNAL = /\bexternal\b/;
/** A remark that says a part is absent: "missing 256GB SSD", "without charger", "no HDD". */
const ABSENT = /^(?:missing|without|no)\b/;
/**
 * The types whose screen is part of the device. For any other type a screen size written in a
 * remark ("OptiPlex 7060 with 24in LCD") may describe a monitor that comes with it.
 */
const TYPES_WITH_OWN_SCREEN: (AssetType | undefined)[] = ["laptop", "tablet"];
/** A decimal comma as AMOUNT reads it: "1,92", "8,1". */
const DECIMAL_COMMA = /^\d{1,2},\d{1,2}$/;

interface SizeToken {
  /** Position and length in the text, so the size can be cut out. */
  index: number;
  length: number;
  /** The size as written, without a label that belongs to the next size. */
  text: string;
  count: number;
  amount: number;
  unit: CapacityUnit;
  /** "ignore" is a size that repeats the one before it: the "(2x8GB)" after "16GB". */
  kind: "ram" | "storage" | "loose" | "ignore";
  /** True when the kind comes from a written label ("SSD"), false when from unit or count. */
  labelled: boolean;
  /** Why this size is less certain than it looks, when it is. */
  doubt?: "unit-assumed" | "comma" | "bare-letter";
}

export function parseFreeText(text: string): ParsedText {
  const result: ParsedText = {};
  // The working copy. Each recognised part is replaced by " | " so that what remains is the
  // brand and model, already separated from the specs.
  // "w/" is spelt out first: its slash would otherwise be taken for a separator between parts.
  let rest = stripAccents(tidyCpuText(text)).replace(/\bw\/(?!o\b)\s*/gi, "with ").replace(/\bw\/o\b/gi, "without");
  const cut = (index: number, length: number) => {
    rest = `${rest.slice(0, index)} | ${rest.slice(index + length)}`;
  };

  // 1. CPU.
  const cpu = findCpu(rest);
  if (cpu) {
    result.cpu = {
      value: cpu.name,
      raw: rest.slice(cpu.index, cpu.index + cpu.length).trim(),
      confidence: cpu.hasModel ? 0.95 : 0.6,
      note: cpu.hasModel ? undefined : (cpu.doubt ?? "No model number given"),
    };
    cut(cpu.index, cpu.length);
  }

  // 2. Screen size: the first number with an inch mark that is a believable size.
  //    Steps 2 and 3 stop where a remark about an accessory starts, so the 24 inches of
  //    "OptiPlex 7060 + 24in monitor" are not given to the desktop.
  const remarkStart = trailingRemarkIndex(rest);
  const screen = [...ownSpecs(rest).matchAll(SCREEN)].find((match) => +match[1] >= 7 && +match[1] <= 55);
  // Remembered for step 6, where the type is known: a screen in a remark is doubted there.
  const screenIsInRemark = screen !== undefined && remarkStart !== null && screen.index >= remarkStart;
  if (screen) {
    result.screenInches = { value: +screen[1], raw: screen[0], confidence: 0.95 };
    cut(screen.index, screen[0].length);
  }

  // 3. Capacities: find them all, decide which is RAM and which is storage, then cut them out
  //    (last first, so earlier positions stay valid).
  const sizes = findSizes(ownSpecs(rest));
  Object.assign(result, resolveRamAndStorage(sizes));
  for (const size of [...sizes].reverse()) cut(size.index, size.length);

  // 4. Shorthand for product lines is expanded, so the lookups below see "Latitude", not "Lat".
  const asWritten = rest;
  rest = expandAbbreviations(rest);
  const wasAbbreviated = rest !== asWritten;

  // 5. "EliteBook 840 G5 with charger", "ThinkPad T480 + dock": once a known product line has
  //    been named, what follows "with", "no" or "+" is a remark about that computer. It is set
  //    aside, so that an accessory mentioned in it does not turn the computer into an accessory.
  //    "Dock for ThinkPad T480" is untouched: there the accessory word comes first.
  const remarkAt = trailingRemarkIndex(rest);
  if (remarkAt !== null) rest = rest.slice(0, remarkAt);

  // 6. Words: product line, type, accessory, brand.
  const words = normaliseText(rest);
  const line = findProductLine(words);
  // Hide the line while looking for type words, so "Surface Laptop" is a model, not a type.
  const wordsWithoutLine = line ? words.replace(line.line, " ") : words;
  const typeWord = findTypeWord(wordsWithoutLine);
  const accessory = findNonComputerWord(wordsWithoutLine);
  const brand = findBrand(words);
  // "ThinkPad T480 with Intel graphics": a brand named after the product line is not the maker.
  const maker = brand && !(line?.manufacturer && brand.index > line.index) ? brand : null;

  // An accessory word only wins when nothing says "computer": no CPU, no RAM, no type word.
  // A RAM value that is itself a guess (one unlabelled size) does not count: in "iPhone 12 64GB"
  // the word is the stronger evidence, and the guess is withdrawn.
  const ramIsGuess = result.ramGB !== undefined && result.ramGB.confidence <= 0.6;
  if (accessory && !result.cpu && (!result.ramGB || ramIsGuess) && !typeWord) {
    result.nonComputer = accessory.label;
    delete result.ramGB;
  }

  if (maker) {
    result.manufacturer = { value: maker.name, raw: maker.name, confidence: 0.95 };
  } else if (line?.manufacturer) {
    result.manufacturer = inferred(line.manufacturer, line.line);
  }

  if (typeWord) {
    result.assetType = { value: typeWord.type, raw: typeWord.word, confidence: 0.95 };
  } else if (!result.nonComputer && line) {
    result.assetType = inferred(line.type, line.line);
  } else if (!result.nonComputer && maker?.type) {
    result.assetType = inferred(maker.type, maker.name); // every Synology product is a NAS
  }

  // "OptiPlex 7060 with 24in LCD": a desktop, workstation or server has no screen of its own, so
  // a size written in the remark may be a monitor that comes with it. The remark names nothing
  // we know as an accessory (step 2 would have dropped the size), so the value is kept, for
  // checking. A laptop or a tablet has its own screen and "with 14 inch display" describes it.
  if (result.screenInches && screenIsInRemark && !TYPES_WITH_OWN_SCREEN.includes(result.assetType?.value)) {
    result.screenInches = { ...result.screenInches, confidence: 0.6, note: 'Written after "with"; it may be a separate monitor' };
  }

  // 7. Model: what is left once brand and type words are removed. Only when something in the
  //    cell shows it describes a device; "see notes" must not become a model.
  const describesDevice = Boolean(maker || line || result.cpu || result.ramGB || result.storageGB || result.screenInches);
  const makerAsWritten = maker && words.slice(maker.index, maker.index + maker.length);
  const notModel = [makerAsWritten, typeWord?.word, accessory?.word];
  const startsWith = [makerAsWritten, line?.line];
  const model = describesDevice ? findModel(rest, notModel, startsWith) : null;
  if (model) {
    const confidence = wasAbbreviated ? 0.8 : line ? 0.9 : maker ? 0.75 : 0.6;
    result.model = {
      value: model.text,
      raw: wasAbbreviated ? (findModel(asWritten, notModel, startsWith)?.text ?? model.text) : model.text,
      confidence,
      note: wasAbbreviated ? "Abbreviation expanded" : undefined,
    };
    // Text in front of the model ("Faulty -", "1x", "Grade A:") was left out. That is a choice,
    // not a certainty, so the model is shown for checking with the words that were dropped.
    if (model.leftOut !== "") {
      result.model.confidence = Math.min(confidence, 0.6);
      result.model.note = `Text before the model was left out: "${model.leftOut}"`;
    }
  }

  return result;
}

/** A value that is not written in the cell but follows from a word that is. */
function inferred<T>(value: T, from: string): Found<T> {
  return { value, raw: from, confidence: 0.8, inferred: true, note: `Inferred from "${from}"` };
}

/** "Lat 5490" -> "Latitude 5490": write out the shorthand for product lines. */
function expandAbbreviations(text: string): string {
  let expanded = text;
  for (const { abbreviation, expansion } of LINE_ABBREVIATIONS) {
    expanded = expanded.replace(new RegExp(String.raw`\b${abbreviation}\b`, "i"), expansion);
  }
  return expanded;
}

/**
 * Where a remark about the computer starts ("... with charger"), or null when there is none.
 * It only counts after a known product line: without one we cannot tell that the text in front
 * is a computer, and "HP 65W charger with cable" must stay an accessory.
 */
function trailingRemarkIndex(text: string): number | null {
  const remark = TRAILING_NOTE.exec(text);
  if (!remark) return null;
  const before = expandAbbreviations(text.slice(0, remark.index));
  return findProductLine(normaliseText(before)) ? remark.index : null;
}

/**
 * The part of the text whose screen size and capacities belong to the computer itself.
 * "OptiPlex 7060 + 24in monitor", "Latitude 5490 with 1TB external HDD": the numbers after the
 * remark describe the accessory, so the text is cut there. So is a remark about a part that is
 * absent ("missing 256GB SSD", "no HDD"): that drive is not in the computer. Any other remark
 * ("with 16GB RAM and 512GB SSD") describes the computer, and the whole text is returned.
 * The result is the start of `text`, so positions found in it are valid in `text` as well.
 */
function ownSpecs(text: string): string {
  const remarkAt = trailingRemarkIndex(text);
  if (remarkAt === null) return text;
  const remark = normaliseText(text.slice(remarkAt));
  const namesAccessory = findNonComputerWord(remark) !== null || EXTERNAL.test(remark);
  return namesAccessory || ABSENT.test(remark) ? text.slice(0, remarkAt) : text;
}

/** Every number that could be a drive size with the unit left out: "512 SSD", "256SSD". */
function findDrivesWithoutUnit(text: string): SizeToken[] {
  const tokens: SizeToken[] = [];
  for (const match of text.matchAll(DRIVE_WITHOUT_UNIT)) {
    const amount = Number(match[2]);
    if (!DRIVE_SIZES.includes(amount)) continue;
    tokens.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
      count: match[1] ? Number(match[1]) : 1,
      amount,
      unit: "GB",
      kind: "storage",
      labelled: true,
      doubt: "unit-assumed",
    });
  }
  return tokens;
}

/** The same text with each token replaced by spaces, so every position stays where it was. */
function blankOut(text: string, tokens: SizeToken[]): string {
  let blanked = text;
  for (const { index, length } of tokens) {
    blanked = blanked.slice(0, index) + " ".repeat(length) + blanked.slice(index + length);
  }
  return blanked;
}

/** True when the text has a comma outside the piece that starts at `index`. */
function hasCommaOutside(text: string, index: number, length: number): boolean {
  return (text.slice(0, index) + text.slice(index + length)).includes(",");
}

/** Every capacity in the text, classified as RAM, storage or "loose" (not yet known). */
function findSizes(fullText: string): SizeToken[] {
  // Drives without a unit are found first and hidden from the search below. Otherwise the "SSD"
  // of "512 SSD 8GB" would be used twice: for 512, and as a label in front of 8GB.
  const drivesWithoutUnit = findDrivesWithoutUnit(fullText);
  const text = blankOut(fullText, drivesWithoutUnit);
  const firstNumberAt = fullText.search(/\d/);
  const tokens: SizeToken[] = [];
  let previousEnd = 0;
  for (const match of text.matchAll(SIZE)) {
    const unit = toUnit(match[3]);
    if (!unit) continue;
    const count = match[1] ? Number(match[1]) : 1;
    const amount = parseNumber(match[2]);
    const isBareLetter = match[3].length === 1; // "8G", "1T"
    if (isBareLetter && unit === "GB" && count === 1 && MOBILE_NETWORKS.includes(amount)) continue;
    const sizeEnd = match.index + match[0].length - (match[4]?.length ?? 0);

    // A label before the size ("SSD 512GB") beats a label after it, which then belongs to the
    // next size: in "SSD 512GB RAM 16GB" the word RAM describes 16GB.
    const wordBefore = LABEL_BEFORE.exec(text.slice(previousEnd, match.index))?.[1];
    // A drive word in front of a size no drive has ("SSD 8GB") is not its label. The size is
    // then labelled by what is written after it ("SSD 8GB RAM"), or left unlabelled.
    const isDriveWord = wordBefore !== undefined && !RAM_LABEL.test(wordBefore);
    const tooSmallForDrive = count * toGB(amount, unit, 1000) < SMALLEST_DRIVE_GB;
    const labelBefore = isDriveWord && tooSmallForDrive ? undefined : wordBefore;
    const label = labelBefore ?? match[5];
    const end = labelBefore ? sizeEnd : match.index + match[0].length;
    const labelKind = label ? (RAM_LABEL.test(label) ? "ram" : "storage") : undefined;

    const token: SizeToken = {
      index: match.index,
      length: end - match.index,
      text: text.slice(match.index, end).trim(),
      count,
      amount,
      unit,
      kind: "loose",
      labelled: Boolean(label),
    };

    const previous = tokens[tokens.length - 1];
    if (previous && isBreakdownOf(previous, token, text.slice(previousEnd, match.index))) {
      // "16GB (2x8GB)": the same memory written twice. Count it once. If only the breakdown is
      // labelled ("16GB (2x8GB DDR4)"), the label describes the total as well.
      token.kind = "ignore";
      if (labelKind && previous.kind === "loose") {
        previous.kind = labelKind;
        previous.labelled = true;
      }
    } else if (labelKind) token.kind = labelKind;
    else if (unit === "TB") token.kind = "storage"; // nobody lists terabytes of RAM
    else if (count > 1 && amount >= 100) token.kind = "storage"; // "2 x 960GB" is drives; "2x 8GB" is RAM modules

    // "8,256GB": in megabytes a thousands comma is normal ("32,768 MB"). In GB or TB the comma
    // may just as well separate two values ("i5,8,256GB"), so the size is kept but flagged.
    // "8,1TB": a decimal comma is trusted when it is the only comma in the cell ("1,92TB SSD").
    // When other commas separate the parts ("5490,i5,8,1TB") this one may be a separator too.
    const amountAt = match.index + match[0].indexOf(match[2]);
    const isDoubtfulDecimal = DECIMAL_COMMA.test(match[2]) && hasCommaOutside(text, amountAt, match[2].length);
    if ((/,\d{3}/.test(match[2]) && unit !== "MB") || isDoubtfulDecimal) token.doubt = "comma";
    else if (isBareLetter) token.doubt = "bare-letter";

    tokens.push(token);
    previousEnd = end;
  }
  // The first number in the text is not taken as a drive: it is the model number far more often
  // ("IdeaPad 320 HDD", "HP 250 SSD"). A drive size comes after the model or another size.
  // With a count in front ("2 x 512 SSD") it is a drive wherever it stands: no model is written so.
  tokens.push(...drivesWithoutUnit.filter((token) => token.count > 1 || token.index !== firstNumberAt));

  // A bare letter is trusted as a unit only next to another size: "8G 256G" is RAM and storage,
  // while a lone "8G" could be anything.
  const kept = tokens.length >= 2 ? tokens : tokens.filter((token) => token.doubt !== "bare-letter");
  // In the order they are written; the caller cuts them out of the text from the last one back.
  return kept.sort((a, b) => a.index - b.index);
}

/**
 * True when `token` only repeats the size before it as "N x part": "16GB (2x8GB)", "16GB 2x8GB".
 * `between` is the text that separates the two; anything more than an opening bracket means
 * they are two separate facts.
 */
function isBreakdownOf(previous: SizeToken, token: SizeToken, between: string): boolean {
  return token.count > 1 && ramGB(token) === ramGB(previous) && /^[\s(=:]*$/.test(between);
}

const ramGB = (token: SizeToken) => round(token.count * toGB(token.amount, token.unit, 1024), 2);
const storageGB = (token: SizeToken) => round(token.count * toGB(token.amount, token.unit, 1000), 1);
const sumStorageGB = (tokens: SizeToken[]) => round(tokens.reduce((sum, token) => sum + storageGB(token), 0), 1);

/** Decide RAM and storage from the classified sizes: labels first, then position, then magnitude. */
function resolveRamAndStorage(sizes: SizeToken[]): Pick<ParsedText, "ramGB" | "storageGB"> {
  let ram: Found<number> | undefined;
  let storage: Found<number> | undefined;
  // A loose size becomes RAM only when it is a size RAM actually comes in.
  const asRam = (token: SizeToken, confidence: number, note: string) =>
    RAM_SIZES.includes(ramGB(token)) ? { value: ramGB(token), raw: token.text, confidence, note } : undefined;
  const asStorage = (token: SizeToken, confidence: number, note: string) => ({
    value: storageGB(token),
    raw: token.text,
    confidence,
    note,
  });

  const labelledRam = sizes.find((token) => token.kind === "ram");
  if (labelledRam) ram = { value: ramGB(labelledRam), raw: labelledRam.text, confidence: 0.95 };
  // "8,16GB RAM" read as 8.16 GB: the label says RAM, but no memory has that size. The number is
  // kept as written and shown for checking.
  if (ram && !RAM_SIZES.includes(ram.value)) {
    ram = { ...ram, confidence: 0.6, note: `${ram.value} GB is not a size RAM comes in; check the number` };
  }

  const drives = sizes.filter((token) => token.kind === "storage");
  if (drives.length > 0) {
    storage = {
      value: sumStorageGB(drives),
      raw: drives.map((token) => token.text).join(" + "),
      confidence: drives.every((token) => token.labelled) ? 0.95 : 0.9,
    };
    // "512 SSD": the drive word is there but the unit is not. GB is a guess, so it is shown
    // for checking (0.6 is below the review threshold).
    if (drives.some((token) => token.doubt === "unit-assumed")) {
      storage = { ...storage, confidence: 0.6, note: "No unit written; GB assumed" };
    }
  }

  const loose = sizes.filter((token) => token.kind === "loose");
  if (!ram && !storage && loose.length >= 3) {
    // Three or more sizes and no label: usually RAM and several drives. Every size is used and
    // the note says how, so nothing is dropped silently.
    const ramToken = loose.find((token) => RAM_SIZES.includes(ramGB(token)) && ramGB(token) <= 128);
    const others = loose.filter((token) => token !== ramToken);
    const note = `${loose.length} unlabelled sizes; ${ramToken ? "the first RAM-sized one taken as RAM, " : ""}the rest added up as storage`;
    if (ramToken) ram = asRam(ramToken, 0.6, note);
    storage = { value: sumStorageGB(others), raw: others.map((token) => token.text).join(" + "), confidence: 0.6, note };
  } else if (!ram && !storage && loose.length === 2) {
    // The usual order is RAM then storage. Written big-first, the smaller one is still the RAM.
    const [first, second] = loose;
    const swapped = ramGB(first) > ramGB(second);
    const confidence = swapped ? 0.7 : 0.8;
    const note = swapped ? "Sizes not labelled; the smaller one taken as RAM" : "Sizes not labelled; read as RAM then storage";
    ram = asRam(swapped ? second : first, confidence, note);
    storage = asStorage(swapped ? first : second, confidence, note);
  } else if (!ram && !storage && loose.length === 1) {
    const note = "Only one size in the cell and no label";
    if (ramGB(loose[0]) <= 64) ram = asRam(loose[0], 0.6, `${note}; small, so taken as RAM`);
    else storage = asStorage(loose[0], 0.6, `${note}; large, so taken as storage`);
  } else if (!ram && loose.length > 0) {
    ram = asRam(loose[0], 0.8, "Not labelled; the other size in the cell is the storage");
  } else if (!storage && loose.length > 0) {
    storage = asStorage(loose[0], 0.8, "Not labelled; the other size in the cell is the RAM");
  }

  if (sizes.some((token) => token.doubt === "comma")) {
    const note = "A comma in a size was read as part of the number; it may separate two values";
    ram = ram && { ...ram, confidence: Math.min(ram.confidence, 0.6), note };
    storage = storage && { ...storage, confidence: Math.min(storage.confidence, 0.6), note };
  }

  return { ...(ram && { ramGB: ram }), ...(storage && { storageGB: storage }) };
}

/** A phrase in normalised form ("mini pc") as a pattern; in the text its words may be joined by "-". */
const phrasePattern = (phrase: string) => new RegExp(String.raw`\b${phrase.split(" ").join(String.raw`[\s-]+`)}\b`, "i");

/** Remove the `notModel` phrases from a piece of text, then tidy the ends. */
function withoutPhrases(text: string, notModel: (string | null | undefined)[]): string {
  let result = text;
  for (const phrase of notModel) {
    if (phrase) result = result.replace(phrasePattern(phrase), " ");
  }
  return cleanText(result).replace(/^[-–:.,\s]+|[-–:.,\s]+$/g, "");
}

/**
 * The model is the piece of the cell that names the brand or the product line; when no piece
 * does, it is the leading piece. Inside the piece the model starts at the brand or line
 * (`startsWith`) and stops at a trailing remark ("... with charger"). `notModel` lists words to
 * remove from it. `leftOut` is the text in front of the model that was not used ("Faulty", "1x").
 */
function findModel(
  rest: string,
  notModel: (string | null | undefined)[],
  startsWith: (string | null | undefined)[],
): { text: string; leftOut: string } | null {
  const pieces = rest.split(DELIMITERS).map(cleanText);
  const namesDevice = (piece: string) => findBrand(normaliseText(piece)) || findProductLine(normaliseText(piece));
  // A piece that is only the brand or only a type word ("Laptop") is empty once those are removed.
  const hasModelText = (piece: string) => withoutPhrases(piece, notModel) !== "";

  const named = pieces.findIndex((piece) => namesDevice(piece) && hasModelText(piece));
  const chosen = named !== -1 ? named : 0;
  const piece = pieces[chosen];

  // Where the brand or the product line starts inside the piece; 0 when neither is in it.
  const starts = startsWith.flatMap((phrase) => {
    const at = phrase ? piece.search(phrasePattern(phrase)) : -1;
    return at === -1 ? [] : [at];
  });
  const start = starts.length > 0 ? Math.min(...starts) : 0;

  const body = piece.slice(start);
  const remark = TRAILING_NOTE.exec(body);
  const text = withoutPhrases(remark ? body.slice(0, remark.index) : body, notModel);
  if (text === "") return null;

  const before = [...pieces.slice(0, chosen), piece.slice(0, start)];
  const leftOut = before.map((part) => withoutPhrases(part, notModel)).filter((part) => part !== "").join(" - ");
  return { text, leftOut };
}
