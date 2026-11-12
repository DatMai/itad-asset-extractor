/**
 * Shared types of the extraction pipeline. This file is the contract between the pipeline
 * (src/lib/extraction) and everything that uses it (UI, LLM route, export).
 */

/** The facts we try to fill for every asset. The order is the column order in the UI and exports. */
export const FIELD_KEYS = [
  "assetType",
  "manufacturer",
  "model",
  "serialNumber",
  "cpu",
  "ramGB",
  "storageGB",
  "screenInches",
  "assetTag",
  "assignedTo",
  "location",
  "costCentre",
  "purchaseDate",
  "notes",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export const ASSET_TYPES = [
  "laptop",
  "desktop",
  "workstation",
  "server",
  "mini-pc",
  "tablet",
  "nas",
  "other",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/**
 * What a source column can be used for:
 * - a field: the whole cell is that one fact;
 * - "combined": the cell holds several facts ("i5 / 8GB / 256GB") and must be split;
 * - "ignore": not used, but its text is kept on the asset as extra data.
 */
export type ColumnTarget = FieldKey | "combined" | "ignore";

/** One sheet of a workbook (or the single table of a CSV) as plain text cells. */
export interface RawSheet {
  name: string;
  /** rows[0] is row 1 in the spreadsheet. Every cell is a trimmed string, "" when empty. */
  rows: string[][];
  hidden: boolean;
  /** Set when the sheet was larger than our limits and was cut. */
  truncated?: string;
}

/** Where we think the header row is. `rowIndex` is 0-based; null means "this table has no header". */
export interface HeaderGuess {
  rowIndex: number | null;
  confidence: number;
  reason: string;
}

/** How one source column is used, and why. Produced by mapColumns, editable by the user. */
export interface ColumnMapping {
  /** 0-based column position in the sheet. */
  index: number;
  /** Header text, or "Column C" when the table has no header row. */
  header: string;
  target: ColumnTarget;
  /** For a combined column whose header names its parts in order, e.g. "CPU / RAM / Disk". */
  parts?: (FieldKey | null)[];
  /** 0..1: how sure we are that `target` is right. */
  confidence: number;
  /** Human-readable evidence for the mapping. */
  reason: string;
  /** Who decided the mapping: our rules, the optional LLM suggestion, or the user. */
  source: "rules" | "ai" | "you";
  /** A few values from the column, shown beside the mapping so the user can judge it. */
  samples: string[];
}

/**
 * How we intend to read one sheet: where its header is and what each column holds.
 * It is guessed by planSheet() and can then be corrected by the user.
 */
export interface SheetPlan {
  sheet: RawSheet;
  header: HeaderGuess;
  columns: ColumnMapping[];
}

/** How a value was obtained. */
export type FieldSource =
  | "column" // read from a column mapped to this field
  | "parsed" // pulled out of a combined cell
  | "inferred" // derived from another value, e.g. "ThinkPad" implies Lenovo and laptop
  | "manual"; // typed by the user

/** One extracted fact about an asset. */
export interface FieldValue {
  /** The clean value, or null when the source text was empty or could not be read. */
  value: string | number | null;
  /** The source text exactly as it was in the file. Never thrown away. */
  raw: string | null;
  /** 0..1: how sure we are that `value` is right. */
  confidence: number;
  source: FieldSource;
  /**
   * Why the confidence is not 1, or where the value came from. Shown as a tooltip.
   * Every extracted value below LOW_CONFIDENCE has one.
   */
  note?: string;
}

export interface Asset {
  /** Stable key: sheet name plus row number. */
  id: string;
  sheet: string;
  /** 1-based row in the source sheet, as a spreadsheet app shows it. */
  rowNumber: number;
  kind: "computer" | "not-a-computer";
  /** For a non-computer: what it looks like, e.g. "monitor". */
  kindReason?: string;
  fields: Partial<Record<FieldKey, FieldValue>>;
  /** Data-quality remarks about the row, e.g. a duplicated serial number. Exported, joined with "; ". */
  warnings: string[];
  /** Cells of columns that were not mapped, keyed by header. Shown on screen; not in the export. */
  extras: Record<string, string>;
}

/** A row we deliberately left out, and why. Shown to the user so nothing disappears silently. */
export interface SkippedRow {
  sheet: string;
  rowNumber: number;
  reason: string;
  /** The first few cells, to recognise the row. */
  preview: string;
}

/** The result of a normaliser: a clean value (or null) and how far to trust it. */
export interface Normalised<T> {
  value: T | null;
  confidence: number;
  note?: string;
}

/** Below this, a value or mapping is shown as "check this". */
export const LOW_CONFIDENCE = 0.7;
