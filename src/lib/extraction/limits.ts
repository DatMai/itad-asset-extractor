/**
 * Hard limits on what we read. They keep a huge or hostile file from freezing the browser tab.
 * Kept apart from readWorkbook.ts so the UI can show them without loading the spreadsheet parser.
 */
export const LIMITS = {
  fileBytes: 5 * 1024 * 1024,
  rows: 5000,
  columns: 60,
  sheets: 20,
};
