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
import type { Asset, ColumnMapping, FieldKey, FieldValue, Normalised, SheetPlan, SkippedRow } from "./types";

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

export function extractSheet(plan: SheetPlan): { assets: Asset[]; skipped: SkippedRow[] } {
  const { sheet, header, columns } = plan;
  const headerRow = header.rowIndex === null ? null : sheet.rows[header.rowIndex];
  const firstDataRow = header.rowIndex === null ? 0 : header.rowIndex + 1;
  const hasSerialColumn = columns.some((column) => column.target === "serialNumber");
  const quantityColumn = columns.find((column) => column.target === "ignore" && QUANTITY_NAMES.includes(normaliseText(column.header)));
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
    if (filled.length <= 3 && SUMMARY_WORD.test(normaliseText(filled[0]))) {
      skip("Summary row, not an asset");
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
      asset.warnings.push("No serial number");
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
  let accessory: string | undefined; // set when the row is not a computer, e.g. "monitor"

  // Pass 1: one column, one field.
  for (const column of columns) {
    const cell = row[column.index] ?? "";
    if (cell === "" || column.target === "combined") continue;
    if (column.target === "ignore") {
      extras[column.header] = cell; // kept, so nothing in the file is lost
      continue;
    }
    const result = NORMALISERS[column.target](cell, column.header);
    fields[column.target] = {
      value: result.value,
      raw: cell,
      confidence: round(result.confidence * column.confidence, 2),
      source: "column",
      note: result.note,
    };
    accessory ??= result.nonComputer;
  }
  // A type column that names a computer type settles the question; a description cannot overrule it.
  const typeIsSettled = fields.assetType?.value != null;

  // Pass 2: fill the gaps from cells that hold several facts.
  const fill = (key: FieldKey, value: FieldValue | undefined) => {
    if (value && fields[key]?.value == null) fields[key] = value;
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
    if (parsed.nonComputer && !typeIsSettled) accessory ??= parsed.nonComputer;
    const fromText = (found: Found<string | number> | undefined): FieldValue | undefined =>
      found && {
        value: found.value,
        raw: found.raw,
        confidence: round(found.confidence * column.confidence, 2),
        source: found.inferred ? "inferred" : "parsed",
        note: found.note ?? `Read from "${column.header}"`,
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
    warnings: [],
    extras,
  };
}

/** Split a cell by the parts its header lists, or null when the cell has a different number of parts. */
function splitByParts(cell: string, column: ColumnMapping): Partial<Record<FieldKey, FieldValue>> | null {
  const pieces = cell.split(/\s*[/|,;]\s*|\s+-\s+/).map((piece) => piece.trim());
  if (!column.parts || pieces.length !== column.parts.length) return null;

  const values: Partial<Record<FieldKey, FieldValue>> = {};
  column.parts.forEach((part, position) => {
    if (!part || pieces[position] === "") return;
    const result = NORMALISERS[part](pieces[position], "");
    values[part] = {
      value: result.value,
      raw: pieces[position],
      confidence: round(result.confidence * column.confidence, 2),
      source: "parsed",
      note: result.note ?? `Part ${position + 1} of "${column.header}"`,
    };
  });
  return values;
}

/** True when a row has the same cells as the header row (a header repeated inside the data). */
function sameText(filled: string[], headerRow: string[]): boolean {
  const header = headerRow.filter((cell) => cell !== "").map(normaliseText);
  return filled.length === header.length && filled.every((cell, position) => normaliseText(cell) === header[position]);
}

/** Add a warning to every asset whose serial number also appears on another row. */
export function flagDuplicateSerials(assets: Asset[]): Asset[] {
  const serialOf = (asset: Asset) =>
    String(asset.fields.serialNumber?.value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

  const bySerial = new Map<string, Asset[]>();
  for (const asset of assets) {
    const serial = serialOf(asset);
    if (serial !== "") bySerial.set(serial, [...(bySerial.get(serial) ?? []), asset]);
  }
  return assets.map((asset) => {
    const others = (bySerial.get(serialOf(asset)) ?? []).filter((other) => other !== asset);
    if (others.length === 0) return asset;
    const where = others.map((other) => `${other.sheet} row ${other.rowNumber}`).join(", ");
    return { ...asset, warnings: [...asset.warnings, `Same serial number as ${where}`] };
  });
}
