/**
 * The entry points the UI uses:
 *   splitTables() cut a sheet that holds several tables into one sheet per table
 *   planSheet()   guess how to read a sheet (header row + column mapping); the user may correct it
 *   extractAll()  apply the plans and return the assets
 * All are pure, so a change to a plan is applied by simply calling extractAll() again.
 */
import { detectHeader } from "./detectHeader";
import { extractSheet, flagDuplicateSerials } from "./extractAssets";
import { mapColumns } from "./mapColumns";
import { splitTables } from "./splitTables";
import type { Asset, HeaderGuess, RawSheet, SheetPlan, SkippedRow } from "./types";

export { extractSheet, splitTables };

/**
 * Plan how to read a sheet. Leave `headerRow` out to detect it; pass a 0-based row index, or
 * null for "this sheet has no header row", when the user has chosen it.
 */
export function planSheet(sheet: RawSheet, headerRow?: number | null): SheetPlan {
  const header: HeaderGuess =
    headerRow === undefined
      ? detectHeader(sheet.rows, sheet.rowOffset)
      : { rowIndex: headerRow, confidence: 1, reason: headerRow === null ? "Set by you: no header row" : `Set by you: row ${headerRow + 1 + (sheet.rowOffset ?? 0)}` };

  const headers = header.rowIndex === null ? [] : (sheet.rows[header.rowIndex] ?? []);
  const dataRows = sheet.rows.slice(header.rowIndex === null ? 0 : header.rowIndex + 1);
  return { sheet, header, columns: mapColumns(headers, dataRows) };
}

/** Extract every planned sheet and cross-check serial numbers between them. */
export function extractAll(plans: SheetPlan[]): { assets: Asset[]; skipped: SkippedRow[] } {
  const results = plans.map(extractSheet);
  return {
    assets: flagDuplicateSerials(results.flatMap((result) => result.assets)),
    skipped: results.flatMap((result) => result.skipped),
  };
}
