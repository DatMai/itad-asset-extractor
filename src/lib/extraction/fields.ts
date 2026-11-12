/**
 * The target fields and the names their columns go by.
 *
 * Synonyms are written the way normaliseText() produces them: lower case, no accents, words
 * separated by single spaces ("S/N" is "s n", "Số sê-ri" is "so se ri"). To teach the extractor
 * a new column name, add it to the right list. Do not add speculative names: a wrong synonym
 * maps a column to the wrong field with high confidence.
 */
import type { ColumnTarget, FieldKey } from "./types";

export interface FieldDef {
  /** Shown in the UI and used in messages. */
  label: string;
  /** Names a column holding this field may have. */
  synonyms: string[];
  /**
   * Generic words that only count when they are the whole header. "Type" alone means asset type,
   * but "Storage Type" must not match it.
   */
  wholeHeaderOnly?: string[];
  /**
   * Words that change what the column holds when they stand next to a name of this field:
   * "HDD Type" holds "SSD", "Memory Slots" holds a count. A header that contains a synonym and
   * one of these words is not taken as this field.
   */
  notWith?: string[];
}

/** Next to "HDD" or "RAM" these words name a property of the part, not how large it is. */
const NOT_A_CAPACITY = ["type", "serial", "slot", "slots", "speed", "status", "wiped", "interface", "health", "count", "make", "model", "brand"];

export const FIELDS: Record<FieldKey, FieldDef> = {
  assetType: {
    label: "Asset type",
    synonyms: ["asset type", "device type", "equipment type", "hardware type", "form factor", "asset category", "device category", "asset class", "loai thiet bi", "loai tb", "loai may", "chung loai"],
    wholeHeaderOnly: ["type", "category", "class", "kind", "loai"],
  },
  manufacturer: {
    label: "Manufacturer",
    synonyms: ["manufacturer", "brand", "vendor", "oem", "mfr", "mfg", "maker", "hang sx", "hang san xuat", "nha san xuat", "nsx", "thuong hieu"],
    wholeHeaderOnly: ["make", "hang"],
  },
  model: {
    label: "Model",
    synonyms: ["model", "model name", "model number", "model no", "product name", "dong may", "ten may", "kieu may"],
    wholeHeaderOnly: ["product", "mau"],
  },
  serialNumber: {
    label: "Serial number",
    synonyms: ["serial", "serial number", "serial no", "serial num", "s n", "service tag", "svc tag", "so serial", "so seri", "so se ri", "so may"],
    wholeHeaderOnly: ["sn", "seri"],
  },
  cpu: {
    label: "CPU",
    synonyms: ["cpu", "processor", "proc", "chipset", "vi xu ly", "bo xu ly", "bo vi xu ly"],
    wholeHeaderOnly: ["chip"],
    // "Processor Type" and "CPU Model" do hold the processor's name, so they are not listed.
    notWith: ["speed", "count"],
  },
  ramGB: {
    label: "RAM (GB)",
    synonyms: ["ram", "memory", "mem", "bo nho", "bo nho trong", "dung luong ram"],
    notWith: NOT_A_CAPACITY,
  },
  storageGB: {
    label: "Storage (GB)",
    synonyms: ["storage", "hdd", "ssd", "hdd ssd", "disk", "hard drive", "hard disk", "o cung", "o dia", "luu tru"],
    wholeHeaderOnly: ["capacity", "drive", "drives", "dung luong"],
    notWith: NOT_A_CAPACITY,
  },
  screenInches: {
    label: "Screen (in)",
    synonyms: ["screen", "screen size", "display", "display size", "monitor size", "man hinh", "kich thuoc man hinh"],
    wholeHeaderOnly: ["lcd", "panel"],
  },
  assetTag: {
    label: "Asset tag",
    synonyms: ["asset tag", "asset id", "asset no", "asset number", "asset code", "tag no", "tag number", "inventory no", "inventory number", "ma tai san", "ma ts"],
    wholeHeaderOnly: ["tag", "barcode"],
  },
  assignedTo: {
    label: "Assigned to",
    synonyms: ["assigned to", "assignee", "assigned user", "used by", "custodian", "end user", "user name", "username", "nguoi dung", "nguoi su dung", "nhan vien"],
    wholeHeaderOnly: ["user", "owner", "employee", "staff"],
  },
  location: {
    label: "Location",
    synonyms: ["location", "vi tri", "dia diem", "van phong", "chi nhanh"],
    wholeHeaderOnly: ["site", "office", "room", "building", "branch", "city"],
  },
  costCentre: {
    label: "Cost centre",
    synonyms: ["cost centre", "cost center", "department", "dept", "business unit", "phong ban", "bo phan"],
    wholeHeaderOnly: ["cc", "team", "division"],
  },
  purchaseDate: {
    label: "Purchase date",
    synonyms: ["purchase date", "purchased", "date purchased", "date of purchase", "purchase dt", "acquisition date", "date acquired", "ngay mua", "ngay nhap"],
    wholeHeaderOnly: ["bought", "acquired"],
  },
  notes: {
    label: "Notes",
    synonyms: ["notes", "note", "comments", "comment", "remarks", "remark", "ghi chu"],
  },
};

/** Names of a column that holds a whole description to be split ("Item Description"). */
export const COMBINED: FieldDef = {
  label: "Combined (split automatically)",
  synonyms: ["description", "desc", "item description", "asset description", "product description", "details", "specs", "spec", "specification", "specifications", "configuration", "config", "mo ta", "cau hinh", "thong so", "ten thiet bi"],
  wholeHeaderOnly: ["item", "equipment", "device", "asset", "hardware", "thiet bi"],
};

/** The label of anything a column can be mapped to. */
export function targetLabel(target: ColumnTarget): string {
  if (target === "combined") return COMBINED.label;
  if (target === "ignore") return "Not used";
  return FIELDS[target].label;
}
