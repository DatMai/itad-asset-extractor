/**
 * The vocabulary of the pipeline: brands, product lines, type words and CPU families.
 * Everything here is a table of facts. To teach the extractor a new word, add a row.
 * All text patterns are matched against normaliseText() output (lower-case words, single spaces),
 * except CPU patterns, which need the hyphens and capitals of the original text.
 */
import type { AssetType } from "./types";

/** Manufacturers. `aliases` are the spellings we accept; `type` is set when every product is one type. */
export const BRANDS: { name: string; aliases: string[]; type?: AssetType }[] = [
  { name: "HPE", aliases: ["hpe", "hewlett packard enterprise", "hp enterprise"] },
  { name: "HP", aliases: ["hp", "hp inc", "hewlett packard", "compaq"] },
  { name: "Dell", aliases: ["dell", "dell inc", "dell emc", "dell technologies", "alienware"] },
  { name: "Lenovo", aliases: ["lenovo"] },
  { name: "IBM", aliases: ["ibm"] },
  { name: "Apple", aliases: ["apple", "apple inc"] },
  { name: "Microsoft", aliases: ["microsoft", "msft"] },
  { name: "ASUS", aliases: ["asus", "asustek"] },
  { name: "Acer", aliases: ["acer"] },
  { name: "Samsung", aliases: ["samsung"] },
  { name: "Toshiba", aliases: ["toshiba"] },
  { name: "Dynabook", aliases: ["dynabook"] },
  { name: "Fujitsu", aliases: ["fujitsu"] },
  { name: "MSI", aliases: ["msi"] },
  { name: "Razer", aliases: ["razer"] },
  { name: "LG", aliases: ["lg"] },
  { name: "Huawei", aliases: ["huawei"] },
  { name: "Sony", aliases: ["sony", "vaio"] },
  { name: "Panasonic", aliases: ["panasonic"] },
  { name: "Google", aliases: ["google"] },
  { name: "Intel", aliases: ["intel"] },
  { name: "Supermicro", aliases: ["supermicro", "super micro"] },
  { name: "Cisco", aliases: ["cisco"] },
  { name: "Synology", aliases: ["synology"], type: "nas" },
  { name: "QNAP", aliases: ["qnap"], type: "nas" },
  { name: "Gigabyte", aliases: ["gigabyte"] },
  { name: "Getac", aliases: ["getac"] },
  { name: "Framework", aliases: ["framework"] },
  { name: "Logitech", aliases: ["logitech"] },
  { name: "NEC", aliases: ["nec"] },
  { name: "BenQ", aliases: ["benq"] },
  { name: "ViewSonic", aliases: ["viewsonic"] },
  { name: "Canon", aliases: ["canon"] },
  { name: "Epson", aliases: ["epson"] },
  { name: "Brother", aliases: ["brother"] },
];

/** Product lines that tell us the manufacturer and the type on their own. */
export const PRODUCT_LINES: { line: string; manufacturer?: string; type: AssetType }[] = [
  { line: "latitude", manufacturer: "Dell", type: "laptop" },
  { line: "inspiron", manufacturer: "Dell", type: "laptop" },
  { line: "vostro", manufacturer: "Dell", type: "laptop" },
  { line: "xps", manufacturer: "Dell", type: "laptop" },
  { line: "optiplex", manufacturer: "Dell", type: "desktop" },
  { line: "precision", manufacturer: "Dell", type: "workstation" },
  { line: "poweredge", manufacturer: "Dell", type: "server" },
  { line: "thinkpad", manufacturer: "Lenovo", type: "laptop" },
  { line: "thinkbook", manufacturer: "Lenovo", type: "laptop" },
  { line: "ideapad", manufacturer: "Lenovo", type: "laptop" },
  { line: "yoga", manufacturer: "Lenovo", type: "laptop" },
  { line: "legion", manufacturer: "Lenovo", type: "laptop" },
  { line: "thinkcentre", manufacturer: "Lenovo", type: "desktop" },
  { line: "ideacentre", manufacturer: "Lenovo", type: "desktop" },
  { line: "thinkstation", manufacturer: "Lenovo", type: "workstation" },
  { line: "thinksystem", manufacturer: "Lenovo", type: "server" },
  { line: "elitebook", manufacturer: "HP", type: "laptop" },
  { line: "probook", manufacturer: "HP", type: "laptop" },
  { line: "zbook", manufacturer: "HP", type: "laptop" },
  { line: "pavilion", manufacturer: "HP", type: "laptop" },
  { line: "spectre", manufacturer: "HP", type: "laptop" },
  { line: "elitedesk", manufacturer: "HP", type: "desktop" },
  { line: "prodesk", manufacturer: "HP", type: "desktop" },
  { line: "eliteone", manufacturer: "HP", type: "desktop" },
  { line: "proliant", manufacturer: "HPE", type: "server" },
  { line: "macbook", manufacturer: "Apple", type: "laptop" },
  { line: "imac", manufacturer: "Apple", type: "desktop" },
  { line: "mac mini", manufacturer: "Apple", type: "mini-pc" },
  { line: "mac studio", manufacturer: "Apple", type: "desktop" },
  { line: "mac pro", manufacturer: "Apple", type: "workstation" },
  { line: "ipad", manufacturer: "Apple", type: "tablet" },
  { line: "surface laptop", manufacturer: "Microsoft", type: "laptop" },
  { line: "surface book", manufacturer: "Microsoft", type: "laptop" },
  { line: "surface pro", manufacturer: "Microsoft", type: "tablet" },
  { line: "surface go", manufacturer: "Microsoft", type: "tablet" },
  { line: "surface studio", manufacturer: "Microsoft", type: "desktop" },
  { line: "zenbook", manufacturer: "ASUS", type: "laptop" },
  { line: "vivobook", manufacturer: "ASUS", type: "laptop" },
  { line: "expertbook", manufacturer: "ASUS", type: "laptop" },
  { line: "expertcenter", manufacturer: "ASUS", type: "desktop" },
  { line: "aspire", manufacturer: "Acer", type: "laptop" },
  { line: "travelmate", manufacturer: "Acer", type: "laptop" },
  { line: "swift", manufacturer: "Acer", type: "laptop" },
  { line: "veriton", manufacturer: "Acer", type: "desktop" },
  { line: "nuc", manufacturer: "Intel", type: "mini-pc" },
  { line: "galaxy book", manufacturer: "Samsung", type: "laptop" },
  { line: "toughbook", manufacturer: "Panasonic", type: "laptop" },
  { line: "chromebook", type: "laptop" },
];

/** Shorthand people type for a product line. Expanded in the model, with the original kept as raw. */
export const LINE_ABBREVIATIONS: { abbreviation: string; expansion: string }[] = [
  { abbreviation: "lat", expansion: "Latitude" },
  { abbreviation: "opti", expansion: "OptiPlex" },
  { abbreviation: "mbp", expansion: "MacBook Pro" },
  { abbreviation: "mba", expansion: "MacBook Air" },
];

/**
 * Generic words that name a kind of computer. Order matters: the first match wins, so
 * "mini pc" must come before the bare "pc" of desktop.
 */
export const TYPE_WORDS: { pattern: RegExp; type: AssetType }[] = [
  { pattern: /\b(mobile workstation|laptop|notebook|ultrabook|netbook|may tinh xach tay|xach tay)\b/, type: "laptop" },
  { pattern: /\b(server|may chu)\b/, type: "server" },
  { pattern: /\b(workstation|may tram)\b/, type: "workstation" },
  { pattern: /\b(mini pc|minipc|micro pc|thin client)\b/, type: "mini-pc" },
  { pattern: /\b(nas|network attached storage)\b/, type: "nas" },
  { pattern: /\b(tablet|may tinh bang)\b/, type: "tablet" },
  { pattern: /\b(desktop|all in one|aio|pc|may tinh de ban|may ban)\b/, type: "desktop" },
];

/** Words that only mean a type when they are the whole value of a "type" column. */
export const TYPE_COLUMN_ONLY_WORDS: { pattern: RegExp; type: AssetType }[] = [
  { pattern: /\b(tower|sff|small form factor|usff)\b/, type: "desktop" },
  { pattern: /\b(rack|blade)\b/, type: "server" },
  { pattern: /\b(convertible|2 in 1)\b/, type: "laptop" },
];

/** Things that turn up in asset lists but are not computers. */
export const NON_COMPUTER_WORDS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(monitor|man hinh)\b/, label: "monitor" },
  { pattern: /\b(keyboard|ban phim)\b/, label: "keyboard" },
  { pattern: /\b(mouse|mice|trackpad|chuot)\b/, label: "mouse" },
  { pattern: /\b(dock|docking station|port replicator)\b/, label: "dock" },
  { pattern: /\b(printer|plotter|multifunction|mfp|may in)\b/, label: "printer" },
  { pattern: /\b(scanner|may quet)\b/, label: "scanner" },
  { pattern: /\b(projector|may chieu)\b/, label: "projector" },
  { pattern: /\b(headset|headphones?|speakerphone|speakers?|webcam|microphone)\b/, label: "audio/video accessory" },
  { pattern: /\b(phone|iphone|smartphone|handset|dien thoai)\b/, label: "phone" },
  { pattern: /\b(switch|router|firewall|access point|modem)\b/, label: "network device" },
  { pattern: /\b(ups|pdu)\b/, label: "power equipment" },
  { pattern: /\b(tv|television)\b/, label: "TV" },
  { pattern: /\b(cable|adapter|adaptor|charger|power supply|hub|kvm|usb drive|flash drive|external drive)\b/, label: "accessory" },
  { pattern: /\b(licen[cs]e|software|subscription)\b/, label: "software" },
];

/** In a "type" column, "Display" or "Screen" also means a monitor. In free text it does not. */
export const MONITOR_TYPE_WORDS = /\b(display|screen|lcd)\b/;

// --- CPU families ---------------------------------------------------------------------------

/** "2x " or "2 x " in front of a server CPU (but not the tail of a longer number). */
const COUNT = String.raw`(?:(?<![\d.])(\d)\s*[x×]\s*)?`;
/** The model digits must not be the start of a capacity such as "512GB". */
const NOT_A_SIZE = String.raw`(?!\d|\s*[GTM]B\b)`;

interface CpuRule {
  pattern: RegExp;
  /** Build the canonical name from the match (group 1 is always the socket count). */
  name: (match: RegExpExecArray) => string;
  /** Which group holds the model number. A CPU without one ("i7") is only a partial answer. */
  modelGroup: number;
}

const tidy = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

const CPU_RULES: CpuRule[] = [
  {
    pattern: new RegExp(String.raw`${COUNT}(?:Intel\s+)?Core\s+Ultra\s+([3579])(?:[\s-]+(\d{3}[A-Z]{1,2}))?`, "i"),
    name: (m) => tidy(`Intel Core Ultra ${m[2]} ${m[3]?.toUpperCase() ?? ""}`),
    modelGroup: 3,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:Intel\s+)?(?:Core\s+)?\b(i[3579])\b(?:[\s-]?(\d{4,5}${NOT_A_SIZE}[A-Z]{0,2}\d?))?`, "i"),
    name: (m) => `Intel Core ${m[2].toLowerCase()}${m[3] ? `-${m[3].toUpperCase()}` : ""}`,
    modelGroup: 3,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:Intel\s+)?Core\s+([357])\s+(\d{3}[A-Z]{1,2})\b`, "i"),
    name: (m) => `Intel Core ${m[2]} ${m[3].toUpperCase()}`,
    modelGroup: 3,
  },
  {
    pattern: new RegExp(
      String.raw`${COUNT}(?:Intel\s+)?Xeon\b((?:\s+(?:Gold|Silver|Bronze|Platinum|Scalable|Max))?(?:[\s-]+[A-Z]\d?)?[\s-]*\d{4,5}${NOT_A_SIZE}[A-Z]{0,2}\d?(?:\s?v\d)?)?`,
      "i",
    ),
    name: (m) => tidy(`Intel Xeon ${tidy(m[2])}`),
    modelGroup: 2,
  },
  {
    pattern: new RegExp(
      String.raw`${COUNT}(?:AMD\s+)?Ryzen\b((?:\s+(?:Threadripper|AI|[3579]))?(?:\s+PRO)?(?:\s+([A-Z]?\d{3,4}${NOT_A_SIZE}[A-Z0-9]{0,4}))?)`,
      "i",
    ),
    name: (m) => tidy(`AMD Ryzen ${tidy(m[2])}`),
    modelGroup: 3,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:AMD\s+)?EPYC\b(?:\s+(\d{4}[A-Z]{0,2}\d?))?`, "i"),
    name: (m) => tidy(`AMD EPYC ${m[2]?.toUpperCase() ?? ""}`),
    modelGroup: 2,
  },
  {
    // "M2 SSD" and "M.2" are drive formats, not Apple chips.
    pattern: new RegExp(String.raw`${COUNT}(?:Apple\s+)?\b(M[1-5])\b(?!\s*(?:SSD|NVMe|SATA))(?:\s+(Pro|Max|Ultra)\b)?`, "i"),
    name: (m) => tidy(`Apple ${m[2].toUpperCase()} ${m[3] ? m[3][0].toUpperCase() + m[3].slice(1).toLowerCase() : ""}`),
    modelGroup: 2,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:Intel\s+)?(Celeron|Pentium|Atom)\b((?:\s+(?:Gold|Silver))?(?:\s+[A-Z]?\d{3,5}${NOT_A_SIZE}[A-Z]{0,2})?)`, "i"),
    name: (m) => tidy(`Intel ${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()} ${tidy(m[3])}`),
    modelGroup: 3,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:AMD\s+)?Athlon\b((?:\s+(?:Gold|Silver|PRO))?(?:\s+[A-Z]?\d{3,4}${NOT_A_SIZE}[A-Z]{0,2})?)`, "i"),
    name: (m) => tidy(`AMD Athlon ${tidy(m[2])}`),
    modelGroup: 2,
  },
  {
    pattern: new RegExp(String.raw`${COUNT}(?:Qualcomm\s+)?Snapdragon\b((?:\s+X)?(?:\s+(?:Elite|Plus))?(?:\s+\d+cx?)?)`, "i"),
    name: (m) => tidy(`Qualcomm Snapdragon ${tidy(m[2])}`),
    modelGroup: 2,
  },
];

export interface CpuMatch {
  /** Canonical name, e.g. "2x Intel Xeon Gold 6230". */
  name: string;
  /** Position and length of the matched text, so a caller can cut it out. */
  index: number;
  length: number;
  /** False when only the family was written ("i7", "Xeon") and the exact model is unknown. */
  hasModel: boolean;
}

/** "11th gen" right after a CPU, or "11th Gen" right before it. */
const GENERATION = String.raw`(\d{1,2})(?:st|nd|rd|th)\s+gen(?:eration)?`;
const GENERATION_AFTER = new RegExp(String.raw`^[\s,]*${GENERATION}\b`, "i");
const GENERATION_BEFORE = new RegExp(String.raw`\b${GENERATION}\s*$`, "i");

/** Find the first CPU mentioned in a piece of text, or null. */
export function findCpu(text: string): CpuMatch | null {
  let best: CpuMatch | null = null;
  for (const rule of CPU_RULES) {
    const match = rule.pattern.exec(text);
    if (!match) continue;
    if (best && best.index <= match.index) continue; // keep the earliest; earlier rules win ties
    const count = match[1] ? `${match[1]}x ` : "";
    best = {
      name: count + rule.name(match),
      index: match.index,
      length: match[0].length,
      hasModel: tidy(match[rule.modelGroup]) !== "",
    };
  }
  if (!best || best.hasModel) return best;

  // "Core i5 11th gen": with no model number, a generation next to the CPU is the only
  // precision there is. It becomes part of the match. A generation elsewhere in the text
  // ("X1 Carbon 7th Gen") belongs to the model and is left alone.
  const after = GENERATION_AFTER.exec(text.slice(best.index + best.length));
  const before = GENERATION_BEFORE.exec(text.slice(0, best.index));
  if (after) {
    return { ...best, name: `${best.name} ${after[1]}th gen`, length: best.length + after[0].length };
  }
  if (before) {
    return { ...best, name: `${best.name} ${before[1]}th gen`, index: before.index, length: best.index + best.length - before.index };
  }
  return best;
}

// --- Lookups ----------------------------------------------------------------------------------

const wholeWords = (phrase: string) => new RegExp(String.raw`\b${phrase}\b`);

// Built once: these lookups run for every cell of every row.
const BRAND_PATTERNS = BRANDS.flatMap((brand) => brand.aliases.map((alias) => ({ brand, alias, pattern: wholeWords(alias) })));
const LINE_PATTERNS = PRODUCT_LINES.map((entry) => ({ entry, pattern: wholeWords(entry.line) }));

export interface BrandMatch {
  name: string;
  type?: AssetType;
  /** Position of the alias in the normalised text, and its length. */
  index: number;
  length: number;
}

/** Find the first brand named in normalised text. The longest alias wins at the same position. */
export function findBrand(normalised: string): BrandMatch | null {
  let best: BrandMatch | null = null;
  for (const { brand, alias, pattern } of BRAND_PATTERNS) {
    const at = normalised.search(pattern);
    if (at === -1) continue;
    const better = !best || at < best.index || (at === best.index && alias.length > best.length);
    if (better) best = { name: brand.name, type: brand.type, index: at, length: alias.length };
  }
  return best;
}

/** Find a known product line ("thinkpad", "mac mini") in normalised text, with its position. */
export function findProductLine(normalised: string) {
  for (const { entry, pattern } of LINE_PATTERNS) {
    const index = normalised.search(pattern);
    if (index !== -1) return { ...entry, index };
  }
  return null;
}

/** Find a generic type word ("laptop", "server") in normalised text. */
export function findTypeWord(normalised: string): { type: AssetType; word: string } | null {
  for (const { pattern, type } of TYPE_WORDS) {
    const match = pattern.exec(normalised);
    if (match) return { type, word: match[0] };
  }
  return null;
}

/** Find a non-computer word ("monitor", "keyboard") in normalised text. */
export function findNonComputerWord(normalised: string): { label: string; word: string } | null {
  for (const { pattern, label } of NON_COMPUTER_WORDS) {
    const match = pattern.exec(normalised);
    if (match) return { label, word: match[0] };
  }
  return null;
}
