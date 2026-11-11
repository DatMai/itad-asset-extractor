/**
 * Split one free-text cell into facts:
 *   "HP EliteBook 850 G7 - i7-10610U / 16GB / 512GB SSD / 15.6in"
 *   -> HP · EliteBook 850 G7 · Intel Core i7-10610U · 16 GB · 512 GB · 15.6"
 *
 * How: recognise the parts that have a known shape (CPU, screen size, capacities), cut them out
 * of the text, and read what is left as brand and model. Nothing is guessed: a fact that is not
 * in the text is either absent from the result or marked `inferred` with a reason.
 */
import { tidyCpuText, toGB, toUnit, type CapacityUnit } from "./normalise";
import { cleanText, normaliseText, round, stripAccents } from "./text";
import type { AssetType } from "./types";
import {
  CPU_GENERATION,
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
 * "16GB", "2x 4TB HDD", "16 GB RAM". Group 4 is the whole label part, group 5 the label word.
 */
const SIZE =
  /(?<![a-z0-9.])(?:(\d+)\s*[x×]\s*)?(\d+(?:\.\d+)?)\s*(TB|GB|MB|TiB|GiB|MiB|gigs?)(?![a-z0-9])(\s*(?:of\s+)?(RAM|memory|DDR\d?|SSD|HDD|NVMe|SAS|SATA|eMMC|flash|disk|drive|storage)\b)?/gi;
/** A label written before the size: "RAM: 16GB", "SSD 512GB". */
const LABEL_BEFORE = /(RAM|memory|mem|SSD|HDD|NVMe|disk|drive|storage)\s*[:=-]?\s*$/i;
const RAM_LABEL = /^(ram|memory|mem|ddr\d?)$/i;

/** RAM comes in a short list of sizes. A loose "476GB" is not RAM, whatever its position. */
const RAM_SIZES = [1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32, 36, 40, 48, 64, 96, 128, 192, 256, 384, 512, 768, 1024, 1536, 2048];

/** What separates the parts of a description: | , ; ( ) / and a dash with spaces around it. */
const DELIMITERS = /\s*[|,;()/]\s*|\s+[-–]\s+/;

interface SizeToken {
  /** Position and length in the text, so the size can be cut out. */
  index: number;
  length: number;
  /** The size as written, without a label that belongs to the next size. */
  text: string;
  count: number;
  amount: number;
  unit: CapacityUnit;
  kind: "ram" | "storage" | "loose";
  /** True when the kind comes from a written label ("SSD"), false when from unit or count. */
  labelled: boolean;
}

export function parseFreeText(text: string): ParsedText {
  const result: ParsedText = {};
  // The working copy. Each recognised part is replaced by " | " so that what remains is the
  // brand and model, already separated from the specs.
  let rest = stripAccents(tidyCpuText(text));
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
      note: cpu.hasModel ? undefined : "No model number given",
    };
    cut(cpu.index, cpu.length);
    rest = rest.replace(CPU_GENERATION, " | ");
  }

  // 2. Screen size: the first number with an inch mark that is a believable size.
  const screen = [...rest.matchAll(SCREEN)].find((match) => +match[1] >= 7 && +match[1] <= 55);
  if (screen) {
    result.screenInches = { value: +screen[1], raw: screen[0], confidence: 0.95 };
    cut(screen.index, screen[0].length);
  }

  // 3. Capacities: find them all, decide which is RAM and which is storage, then cut them out
  //    (last first, so earlier positions stay valid).
  const sizes = findSizes(rest);
  Object.assign(result, resolveRamAndStorage(sizes));
  for (const size of [...sizes].reverse()) cut(size.index, size.length);

  // 4. Shorthand for product lines is expanded, so the lookups below see "Latitude", not "Lat".
  const asWritten = rest;
  for (const { abbreviation, expansion } of LINE_ABBREVIATIONS) {
    rest = rest.replace(new RegExp(String.raw`\b${abbreviation}\b`, "i"), expansion);
  }
  const wasAbbreviated = rest !== asWritten;

  // 5. Words: product line, type, accessory, brand.
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
  if (accessory && !result.cpu && !result.ramGB && !typeWord) result.nonComputer = accessory.label;

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

  // 6. Model: what is left once brand and type words are removed. Only when something in the
  //    cell shows it describes a device; "see notes" must not become a model.
  const describesDevice = Boolean(maker || line || result.cpu || result.ramGB || result.storageGB || result.screenInches);
  const notModel = [maker && words.slice(maker.index, maker.index + maker.length), typeWord?.word, accessory?.word];
  const model = describesDevice ? findModel(rest, notModel) : null;
  if (model) {
    result.model = {
      value: model,
      raw: wasAbbreviated ? (findModel(asWritten, notModel) ?? model) : model,
      confidence: wasAbbreviated ? 0.8 : line ? 0.9 : maker ? 0.75 : 0.6,
      note: wasAbbreviated ? "Abbreviation expanded" : undefined,
    };
  }

  return result;
}

/** A value that is not written in the cell but follows from a word that is. */
function inferred<T>(value: T, from: string): Found<T> {
  return { value, raw: from, confidence: 0.8, inferred: true, note: `Inferred from "${from}"` };
}

/** Every capacity in the text, classified as RAM, storage or "loose" (not yet known). */
function findSizes(text: string): SizeToken[] {
  const tokens: SizeToken[] = [];
  let previousEnd = 0;
  for (const match of text.matchAll(SIZE)) {
    const unit = toUnit(match[3]);
    if (!unit) continue;
    const count = match[1] ? Number(match[1]) : 1;
    const amount = Number(match[2]);
    const sizeEnd = match.index + match[0].length - (match[4]?.length ?? 0);

    // A label before the size ("SSD 512GB") beats a label after it, which then belongs to the
    // next size: in "SSD 512GB RAM 16GB" the word RAM describes 16GB.
    const labelBefore = LABEL_BEFORE.exec(text.slice(previousEnd, match.index))?.[1];
    const label = labelBefore ?? match[5];
    const end = labelBefore ? sizeEnd : match.index + match[0].length;
    previousEnd = end;

    let kind: SizeToken["kind"] = "loose";
    if (label) kind = RAM_LABEL.test(label) ? "ram" : "storage";
    else if (unit === "TB") kind = "storage"; // nobody lists terabytes of RAM
    else if (count > 1 && amount >= 100) kind = "storage"; // "2 x 960GB" is drives; "2x 8GB" is RAM modules

    tokens.push({
      index: match.index,
      length: end - match.index,
      text: text.slice(match.index, end).trim(),
      count,
      amount,
      unit,
      kind,
      labelled: Boolean(label),
    });
  }
  return tokens;
}

const ramGB = (token: SizeToken) => round(token.count * toGB(token.amount, token.unit, 1024), 2);
const storageGB = (token: SizeToken) => round(token.count * toGB(token.amount, token.unit, 1000), 1);

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

  const drives = sizes.filter((token) => token.kind === "storage");
  if (drives.length > 0) {
    storage = {
      value: round(drives.reduce((sum, token) => sum + storageGB(token), 0), 1),
      raw: drives.map((token) => token.text).join(" + "),
      confidence: drives.every((token) => token.labelled) ? 0.95 : 0.9,
    };
  }

  const loose = sizes.filter((token) => token.kind === "loose");
  if (!ram && !storage && loose.length >= 2) {
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

  return { ...(ram && { ramGB: ram }), ...(storage && { storageGB: storage }) };
}

/**
 * The model is the leading text of the cell. When the cell starts with a spec, it is the first
 * piece that names a brand or a product line. `notModel` lists words to remove from it.
 */
function findModel(rest: string, notModel: (string | null | undefined)[]): string | null {
  const pieces = rest.split(DELIMITERS).map(cleanText);
  const namesDevice = (piece: string) => findBrand(normaliseText(piece)) || findProductLine(normaliseText(piece));
  let model = pieces[0] !== "" ? pieces[0] : (pieces.find(namesDevice) ?? "");

  for (const phrase of notModel) {
    if (!phrase) continue;
    // The phrase is in normalised form ("mini pc"); in the text its words may be joined by "-".
    const pattern = new RegExp(String.raw`\b${phrase.split(" ").join(String.raw`[\s-]+`)}\b`, "i");
    model = model.replace(pattern, " ");
  }
  model = cleanText(model).replace(/^[-–:.,\s]+|[-–:.,\s]+$/g, "");
  return model === "" ? null : model;
}
