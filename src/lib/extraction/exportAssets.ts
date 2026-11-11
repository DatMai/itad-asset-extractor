/**
 * The clean output: one flat record per asset, as JSON or CSV.
 * The Zod schema is the contract of the export; every row is checked against it before it
 * leaves the app.
 */
import { z } from "zod";
import { ASSET_TYPES, LOW_CONFIDENCE, type Asset, type AssetType, type FieldKey } from "./types";

export const ExportedAssetSchema = z.object({
  assetType: z.enum(ASSET_TYPES).nullable(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  cpu: z.string().nullable(),
  ramGB: z.number().positive().nullable(),
  storageGB: z.number().positive().nullable(),
  /** Storage exactly as written in the file, e.g. "4 x 1.92TB SSD (RAID 5)". */
  storageRaw: z.string().nullable(),
  screenInches: z.number().positive().nullable(),
  assetTag: z.string().nullable(),
  assignedTo: z.string().nullable(),
  location: z.string().nullable(),
  costCentre: z.string().nullable(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().nullable(),
  sourceSheet: z.string(),
  /** Row in the source sheet, as a spreadsheet app numbers it. */
  sourceRow: z.number().int().positive(),
  /** The lowest confidence among the row's extracted values, 0–1. */
  confidence: z.number().min(0).max(1),
  needsReview: z.boolean(),
});
export type ExportedAsset = z.infer<typeof ExportedAssetSchema>;

/** True when a person should look at the row: a doubtful or unreadable value, or a warning. */
export function needsReview(asset: Asset): boolean {
  return asset.warnings.length > 0 || Object.values(asset.fields).some((field) => field.confidence < LOW_CONFIDENCE);
}

export function toExportRows(assets: Asset[]): ExportedAsset[] {
  return assets.map((asset) => {
    // A value of the wrong type (possible after a manual edit) is exported as null, not as is.
    const textOf = (key: FieldKey) => {
      const value = asset.fields[key]?.value;
      return typeof value === "string" && value !== "" ? value : null;
    };
    const numberOf = (key: FieldKey) => {
      const value = asset.fields[key]?.value;
      return typeof value === "number" && value > 0 ? value : null;
    };
    const type = textOf("assetType");
    const confidences = Object.values(asset.fields).map((field) => field.confidence);

    return ExportedAssetSchema.parse({
      assetType: ASSET_TYPES.includes(type as AssetType) ? type : null,
      manufacturer: textOf("manufacturer"),
      model: textOf("model"),
      serialNumber: textOf("serialNumber"),
      cpu: textOf("cpu"),
      ramGB: numberOf("ramGB"),
      storageGB: numberOf("storageGB"),
      storageRaw: asset.fields.storageGB?.raw ?? null,
      screenInches: numberOf("screenInches"),
      assetTag: textOf("assetTag"),
      assignedTo: textOf("assignedTo"),
      location: textOf("location"),
      costCentre: textOf("costCentre"),
      purchaseDate: textOf("purchaseDate"),
      notes: textOf("notes"),
      sourceSheet: asset.sheet,
      sourceRow: asset.rowNumber,
      confidence: confidences.length > 0 ? Math.min(...confidences) : 1,
      needsReview: needsReview(asset),
    });
  });
}

export function toJson(rows: ExportedAsset[]): string {
  return JSON.stringify(rows, null, 2);
}

/** CSV as RFC 4180 describes it: comma-separated, CRLF line ends, quotes doubled inside quotes. */
export function toCsv(rows: ExportedAsset[]): string {
  const columns = Object.keys(ExportedAssetSchema.shape) as (keyof ExportedAsset)[];
  const lines = [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))];
  return lines.join("\r\n") + "\r\n";
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  if (typeof value !== "string") return String(value);
  // A cell starting with = + - @ is run as a formula by Excel and Sheets ("CSV injection").
  // A leading apostrophe makes the spreadsheet treat it as text.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
