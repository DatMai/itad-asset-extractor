/**
 * Turn the rows of one sheet into assets, following a plan (header row + column mapping).
 *
 * Each row is built in two passes:
 *  1. a column mapped to one field gives that field, through its normaliser;
 *  2. a combined column (and the model column, which often hides a brand or specs) fills
 *     whatever is still missing.
 * A value from its own column always beats a value dug out of a description.
 */
import {
  normaliseAssetType,
  normaliseCpu,
  normaliseDate,
  normaliseManufacturer,
  normalisePlainText,
  normaliseRam,
  normaliseScreen,
  normaliseSerial,
  normaliseStorage,
  unitFromHeader,
} from "./normalise";
import { parseFreeText, type Found } from "./parseFreeText";
import { normaliseText, round } from "./text";
import { LOW_CONFIDENCE, type Asset, type ColumnMapping, type FieldKey, type FieldValue, type Normalised, type SheetPlan, type SkippedRow } from "./types";
import { findProductLine } from "./vocab";

type Normaliser = (raw: string, header: string) => Normalised<string | number> & { nonComputer?: string };

/** The normaliser of each field. The header is passed because it can carry a unit: "RAM (GB)". */
export const NORMALISERS: Record<FieldKey, Normaliser> = {
  assetType: normaliseAssetType,
  manufacturer: normaliseManufacturer,
  model: normalisePlainText,
  serialNumber: normaliseSerial,
  cpu: normaliseCpu,
  ramGB: (raw, header) => normaliseRam(raw, unitFromHeader(header)),
  storageGB: (raw, header) => normaliseStorage(raw, unitFromHeader(header)),
  screenInches: normaliseScreen,
  assetTag: normalisePlainText,
  assignedTo: normalisePlainText,
  location: normalisePlainText,
  costCentre: normalisePlainText,
  purchaseDate: normaliseDate,
  notes: normalisePlainText,
};

/** The facts parseFreeText can find in a description. */
const PARSED_KEYS = ["manufacturer", "model", "assetType", "cpu", "ramGB", "storageGB", "screenInches"] as const;

/** A row needs at least one of these to count as an asset; a person and a place are not enough. */
const IDENTIFYING: FieldKey[] = ["model", "serialNumber", "manufacturer", "cpu", "ramGB", "storageGB", "assetTag", "assetType"];

/** Column names that mean "how many devices this row stands for". */
const QUANTITY_NAMES = ["qty", "quantity", "count", "units", "no of units", "so luong", "sl"];

/** "TOTAL", "Sub-total", "Count", "Tổng cộng" at the start of a nearly empty row. */
const SUMMARY_WORD = /^((grand|sub) ?)?totals?\b|^(sum|count|tong|tong cong)\b/;

/**
 * "Total", "Sub-total", "Grand total" at the start of a row with any number of cells:
 * "Total units | 3 | | | Total weight | 12kg". The shorter words above are left out here because
 * they also start ordinary cells ("Tống Văn A" is a person, "Count" may be a name).
 */
const TOTAL_WORD = /^((grand|sub) ?)?totals?\b/;

/** A type cell that only says "this is a computer", which every row of the list is. */
const GENERIC_TYPE = /^(pc|pcs|computer|computers|may tinh)$/;

/** A type word in the plural names a group of devices, not one: "Latitude laptops". */
const PLURAL_TYPE_WORD = /\b(laptops|desktops|workstations|servers|notebooks|monitors|tablets|pcs)\b/;

/** The row warnings that depend on serial numbers. applyEdits recomputes them after an edit. */
export const NO_SERIAL_WARNING = "No serial number";
export const DUPLICATE_SERIAL_PREFIX = "Same serial number as";

/** How many other rows a duplicate-serial warning names before it says "and N more rows". */
const MAX_ROWS_LISTED = 3;

export function extractSheet(plan: SheetPlan): { assets: Asset[]; skipped: SkippedRow[] } {
  const { sheet, header, columns } = plan;
  const headerRow = header.rowIndex === null ? null : sheet.rows[header.rowIndex];
  const firstDataRow = header.rowIndex === null ? 0 : header.rowIndex + 1;
  const hasSerialColumn = columns.some((column) => column.target === "serialNumber");
  const quantityColumn = columns.find((column) => column.target === "ignore" && QUANTITY_NAMES.includes(normaliseText(column.header)));
  const mappedColumns = columns.filter((column) => column.target !== "ignore").length;
  const assets: Asset[] = [];
  const skipped: SkippedRow[] = [];

  for (let index = firstDataRow; index < sheet.rows.length; index++) {
    const row = sheet.rows[index];
    const filled = row.filter((cell) => cell !== "");
    if (filled.length === 0) continue; // a blank row needs no explanation

    const rowNumber = index + 1;
    const skip = (reason: string) =>
      skipped.push({ sheet: sheet.name, rowNumber, reason, preview: filled.slice(0, 4).join(" · ").slice(0, 80) });

    if (headerRow && sameText(filled, headerRow)) {
      skip("Repeats the header row");
      continue;
    }
    const firstCell = normaliseText(filled[0]);
    if (TOTAL_WORD.test(firstCell) || (filled.length <= 3 && SUMMARY_WORD.test(firstCell))) {
      skip("Summary row, not an asset");
      continue;
    }
    // "Laptops", "Prepared by John Smith": one cell of words in a table of several columns is a
    // heading or a note. A lone tag or serial number ("AT-009") has a digit, so it is kept.
    // So is a device whose name has no digit ("Apple MacBook Air"): it names a product line.
    // The line word alone ("Latitude") or with a plural ("Latitude laptops") is the heading of
    // a group of such devices, not one of them.
    const line = findProductLine(firstCell);
    const namesOneDevice = line !== null && firstCell !== line.line && !PLURAL_TYPE_WORD.test(firstCell);
    if (filled.length === 1 && mappedColumns >= 3 && !/\d/.test(filled[0]) && !namesOneDevice) {
      skip("Section heading or note, not an asset");
      continue;
    }

    const asset = buildAsset(sheet.name, rowNumber, row, columns);
    const hasDetails = IDENTIFYING.some((key) => {
      const value = asset.fields[key]?.value;
      return value !== null && value !== undefined && value !== "other";
    });
    if (!hasDetails && asset.kind === "computer") {
      skip("No asset details recognised in this row");
      continue;
    }
    if (asset.kind === "computer" && hasSerialColumn && !asset.fields.serialNumber?.value) {
      asset.warnings.push(NO_SERIAL_WARNING);
    }
    // We output one asset per row. A quantity above 1 means the list undercounts, so say it.
    const quantity = quantityColumn ? Number(row[quantityColumn.index]) : 1;
    if (quantity > 1) asset.warnings.push(`This row stands for ${quantity} devices`);
    assets.push(asset);
  }
  return { assets, skipped };
}

function buildAsset(sheetName: string, rowNumber: number, row: string[], columns: ColumnMapping[]): Asset {
  const fields: Asset["fields"] = {};
  const extras: Record<string, string> = {};
  const warnings: string[] = [];
  let accessory: string | undefined; // set when the row is not a computer, e.g. "monitor"

  // Pass 1: one column, one field.
  for (const column of columns) {
    const cell = row[column.index] ?? "";
    if (cell === "" || column.target === "combined") continue;
    if (column.target === "ignore") {
      extras[column.header] = cell; // kept, so nothing in the file is lost
      continue;
    }
    const isGenericType = column.target === "assetType" && GENERIC_TYPE.test(normaliseText(cell));
    // "PC" or "Computer" in a type column does not say which kind; it is read as "other", to be
    // replaced in pass 2 when the model names a product line.
    const result = isGenericType
      ? { value: "other", confidence: 0.5, note: `Generic type "${cell}"` }
      : NORMALISERS[column.target](cell, column.header);
    const confidence = round(result.confidence * column.confidence, 2);
    fields[column.target] = {
      value: result.value,
      raw: cell,
      confidence,
      source: "column",
      note: withColumnDoubt(result.note, column, confidence),
    };
    accessory ??= result.nonComputer;
  }
  // A type column that names a computer type settles the question; a description cannot overrule
  // it. "other" names nothing, so it settles nothing.
  const typeFromColumn = fields.assetType;
  const typeIsSettled = typeFromColumn?.value != null && typeFromColumn.value !== "other";
  // A CPU or RAM in the row's own columns also says "computer": a dock has neither.
  const rowSaysComputer = typeIsSettled || fields.cpu?.value != null || fields.ramGB?.value != null;

  // Pass 2: fill the gaps from cells that hold several facts.
  const fill = (key: FieldKey, value: FieldValue | undefined) => {
    if (!value) return;
    if (fields[key]?.value == null) fields[key] = value;
    // An "other" from the type column gives way to a type found in the model or description.
    // The column text stays as the raw value and the note names both sources.
    else if (key === "assetType" && typeFromColumn?.value === "other" && fields.assetType === typeFromColumn) {
      const origin = value.source === "inferred" ? "inferred from" : "read in";
      fields.assetType = { ...value, raw: typeFromColumn.raw, note: `Type column said "${typeFromColumn.raw}"; type ${origin} "${value.raw}"` };
    }
  };
  for (const column of columns) {
    const cell = row[column.index] ?? "";
    if (cell === "" || (column.target !== "combined" && column.target !== "model")) continue;

    // "CPU / RAM / Disk" with "i5-8365U / 8GB / 256GB": the header gives the order of the parts.
    const byPosition = column.parts ? splitByParts(cell, column) : null;
    if (byPosition) {
      for (const [key, value] of Object.entries(byPosition)) fill(key as FieldKey, value);
      continue;
    }

    const parsed = parseFreeText(cell);
    if (parsed.nonComputer) {
      // "EliteBook 840 G5 with charger" beside a CPU and RAM is a laptop that comes with a
      // charger. The row stays a computer and the mention is kept as a warning.
      if (!rowSaysComputer) accessory ??= parsed.nonComputer;
      else if (fields.cpu?.value != null || fields.ramGB?.value != null) addOnce(warnings, `Mentions: ${parsed.nonComputer}`);
    }
    const fromText = (found: Found<string | number> | undefined): FieldValue | undefined => {
      if (!found) return undefined;
      const confidence = round(found.confidence * column.confidence, 2);
      return {
        value: found.value,
        raw: found.raw,
        confidence,
        source: found.inferred ? "inferred" : "parsed",
        note: withColumnDoubt(found.note ?? `Read from "${column.header}"`, column, confidence),
      };
    };

    if (column.target === "model") {
      // A model cell such as "Dell Lat 5420 i7 16GB" is really a description: use the model
      // found inside it. A clean model cell ("iMac 24-inch") is left exactly as written.
      const holdsMore = parsed.ramGB || parsed.storageGB || (parsed.manufacturer && !parsed.manufacturer.inferred);
      if (holdsMore && parsed.model) fields.model = fromText(parsed.model);
    }
    for (const key of PARSED_KEYS) {
      const isListed = !column.parts || column.parts.includes(key); // a parts column gives only its parts
      const isOwnField = column.target === "model" && key === "model";
      if (isListed && !isOwnField) fill(key, fromText(parsed[key]));
    }
  }

  return {
    id: `${sheetName}#${rowNumber}`,
    sheet: sheetName,
    rowNumber,
    kind: accessory ? "not-a-computer" : "computer",
    kindReason: accessory,
    fields,
    warnings,
    extras,
  };
}

/**
 * A value can be doubtful only because we are not sure what its column holds. The cell must then
 * say so itself, with the evidence the column was matched on; otherwise it is highlighted with
 * no reason. A value that is not highlighted, or a column we are sure of, gets nothing added.
 */
function withColumnDoubt(note: string | undefined, column: ColumnMapping, confidence: number): string | undefined {
  if (confidence >= LOW_CONFIDENCE || column.confidence >= 1) return note;
  const doubt = `Column "${column.header}" is a guess: ${column.reason}`;
  return note ? `${note}. ${doubt}` : doubt;
}

function addOnce(list: string[], item: string): void {
  if (!list.includes(item)) list.push(item);
}

/** Split a cell by the parts its header lists, or null when the cell has a different number of parts. */
function splitByParts(cell: string, column: ColumnMapping): Partial<Record<FieldKey, FieldValue>> | null {
  const pieces = cell.split(/\s*[/|,;]\s*|\s+-\s+/).map((piece) => piece.trim());
  if (!column.parts || pieces.length !== column.parts.length) return null;

  const values: Partial<Record<FieldKey, FieldValue>> = {};
  column.parts.forEach((part, position) => {
    if (!part || pieces[position] === "") return;
    const result = NORMALISERS[part](pieces[position], "");
    const confidence = round(result.confidence * column.confidence, 2);
    values[part] = {
      value: result.value,
      raw: pieces[position],
      confidence,
      source: "parsed",
      note: withColumnDoubt(result.note ?? `Part ${position + 1} of "${column.header}"`, column, confidence),
    };
  });
  return values;
}

/** True when a row has the same cells as the header row (a header repeated inside the data). */
function sameText(filled: string[], headerRow: string[]): boolean {
  const header = headerRow.filter((cell) => cell !== "").map(normaliseText);
  return filled.length === header.length && filled.every((cell, position) => normaliseText(cell) === header[position]);
}

/**
 * Add a warning to every asset whose serial number also appears on another row.
 * The warning names a few of the other rows and counts the rest: a column that repeats one text
 * on 5,000 rows must not produce 5,000 warnings of 5,000 rows each.
 */
export function flagDuplicateSerials(assets: Asset[]): Asset[] {
  const serialOf = (asset: Asset) =>
    String(asset.fields.serialNumber?.value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const bySerial = new Map<string, Asset[]>();
  for (const asset of assets) {
    const serial = serialOf(asset);
    if (serial === "") continue;
    const group = bySerial.get(serial);
    if (group) group.push(asset);
    else bySerial.set(serial, [asset]);
  }
  return assets.map((asset) => {
    const group = bySerial.get(serialOf(asset));
    if (!group || group.length < 2) return asset;

    // The first few other rows of the group; the asset itself may be among the first.
    const listed = group.slice(0, MAX_ROWS_LISTED + 1).filter((other) => other !== asset).slice(0, MAX_ROWS_LISTED);
    const where = listed.map((other) => `${other.sheet} row ${other.rowNumber}`).join(", ");
    const unlisted = group.length - 1 - listed.length;
    const more = unlisted > 0 ? ` and ${unlisted} more row${unlisted === 1 ? "" : "s"}` : "";
    return { ...asset, warnings: [...asset.warnings, `${DUPLICATE_SERIAL_PREFIX} ${where}${more}`] };
  });
}
