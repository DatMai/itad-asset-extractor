/**
 * Hard limits on what we read, so that a huge file costs a bounded amount of work.
 *
 * What each one does:
 *  - fileBytes and unpackedBytes are checked before the file is parsed;
 *  - rows stops the parser itself after that many rows of a sheet;
 *  - columns and sheets are applied after parsing, to what is kept.
 * They are a filter, not a guarantee: parsing runs on the main thread of the tab, and a file
 * built on purpose to be slow can still make it wait for some seconds.
 *
 * Kept apart from readWorkbook.ts so the UI can show them without loading the spreadsheet parser.
 */
export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  /** An .xlsx is a zip. This is the most its files may add up to once unpacked. */
  unpackedBytes: 100 * 1024 * 1024,
  rows: 5000,
  columns: 60,
  sheets: 20,
};
