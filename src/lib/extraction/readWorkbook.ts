/**
 * Turn the bytes of a file into sheets of plain text cells.
 *
 * This is the only file that knows about SheetJS. Everything after it works on string[][],
 * so the parser library can be replaced here without touching the rest of the pipeline.
 */
import * as XLSX from "xlsx";
import { LIMITS } from "./limits";
import { cleanText } from "./text";
import type { RawSheet } from "./types";

export { LIMITS };

/** A file we refuse, with what is wrong and what the user can do about it. */
export class UnreadableFileError extends Error {
  constructor(
    message: string,
    readonly hint: string,
  ) {
    super(message);
    this.name = "UnreadableFileError";
  }
}

export function readWorkbook(bytes: Uint8Array, fileName: string): RawSheet[] {
  if (bytes.length === 0) {
    throw new UnreadableFileError("This file is empty.", "Export the asset list again and check that the file has a size.");
  }
  if (bytes.length > LIMITS.fileBytes) {
    throw new UnreadableFileError(
      "This file is larger than 5 MB.",
      "Split it into smaller files, or remove sheets that are not asset lists.",
    );
  }

  // Decide by content, not by extension: a CSV saved as ".xls" is common.
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // .xlsx, .xlsm, .ods
  const isOldExcel = bytes[0] === 0xd0 && bytes[1] === 0xcf; // .xls
  const isBinary = isZip || isOldExcel;
  if (!isBinary && !looksLikeText(bytes)) {
    throw new UnreadableFileError("This file is not a spreadsheet.", "Upload an .xlsx, .xls or .csv file.");
  }

  // A small zip can unpack to hundreds of megabytes. Refuse it before the parser inflates it.
  if (isZip && declaredUnpackedSize(bytes) > LIMITS.unpackedBytes) {
    throw new UnreadableFileError(
      "This workbook is too large once unpacked.",
      "Split it into smaller files, or remove sheets that are not asset lists.",
    );
  }

  // One row more than we keep, so that readSheet can tell "exactly at the limit" from "cut".
  const sheetRows = LIMITS.rows + 1;
  let workbook: XLSX.WorkBook;
  try {
    if (isBinary) {
      // cellNF keeps each cell's number format, which is how we recognise dates.
      // sheetRows makes the parser stop building cells after that many rows of a sheet.
      // nodim: measure the sheet from its cells. The size a file declares for a sheet can be
      // wrong, and cells outside it would be dropped without a word.
      workbook = XLSX.read(bytes, { type: "array", cellNF: true, sheetRows, nodim: true });
    } else {
      // raw: keep every cell as the text that was typed. Otherwise "0012" becomes 12 and
      // "12/03/2021" becomes a date read the American way.
      const content = decodeText(bytes);
      workbook = XLSX.read(content, { type: "string", raw: true, FS: findDelimiter(content), sheetRows });
    }
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    if (/password|encrypt/i.test(detail)) {
      throw new UnreadableFileError(
        "This workbook is password-protected.",
        "Remove the password in Excel (File › Info › Protect Workbook) and upload it again.",
      );
    }
    throw new UnreadableFileError(
      "This file could not be read as a spreadsheet.",
      `Open it in a spreadsheet app and save it again as .xlsx or .csv. (${detail})`,
    );
  }

  const usesDate1904 = Boolean(workbook.Workbook?.WBProps?.date1904);
  const sheets: RawSheet[] = workbook.SheetNames.slice(0, LIMITS.sheets).map((name, position) => ({
    // A text file has one unnamed table; the file name is a better label than "Sheet1".
    name: isBinary ? name : fileName,
    hidden: Boolean(workbook.Workbook?.Sheets?.[position]?.Hidden),
    ...readSheet(workbook.Sheets[name], usesDate1904),
  }));

  const withData = sheets.filter((sheet) => sheet.rows.length > 0);
  if (withData.length === 0) {
    throw new UnreadableFileError("This file has no data.", "Check that the asset list was saved into the file.");
  }
  return withData;
}

/** Every cell of a sheet as text. rows[0] is spreadsheet row 1, whatever the used range is. */
function readSheet(sheet: XLSX.WorkSheet | undefined, usesDate1904: boolean): Pick<RawSheet, "rows" | "truncated"> {
  // A sheet the parser listed but could not build is treated as an empty one.
  if (!sheet || !sheet["!ref"]) return { rows: [] };
  const used = XLSX.utils.decode_range(sheet["!ref"]);
  const lastRow = Math.min(used.e.r, LIMITS.rows - 1);
  const lastColumn = Math.min(used.e.c, LIMITS.columns - 1);

  const rows: string[][] = [];
  for (let r = 0; r <= lastRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= lastColumn; c++) {
      row.push(cellText(sheet[XLSX.utils.encode_cell({ r, c })], usesDate1904));
    }
    rows.push(row);
  }

  // Only the top cell of a merged range holds the value. People merge a location or a category
  // down several rows, so copy it into each row the merge covers.
  for (const merge of sheet["!merges"] ?? []) {
    if (merge.s.c > lastColumn) continue;
    for (let r = merge.s.r + 1; r <= Math.min(merge.e.r, lastRow); r++) {
      rows[r][merge.s.c] = rows[merge.s.r][merge.s.c];
    }
  }

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell === "")) rows.pop();

  const wasCut = used.e.r > lastRow || used.e.c > lastColumn;
  return {
    rows,
    truncated: wasCut
      ? `Only the first ${LIMITS.rows.toLocaleString("en")} rows and ${LIMITS.columns} columns of this sheet were read.`
      : undefined,
  };
}

function cellText(cell: XLSX.CellObject | undefined, usesDate1904: boolean): string {
  if (!cell || cell.v === undefined || cell.v === null || cell.t === "e") return ""; // "e" is #N/A, #REF!
  if (typeof cell.v === "number") {
    const isDate = cell.z !== undefined && XLSX.SSF.is_date(String(cell.z)) && cell.v >= 1;
    if (isDate) return dayNumberToIso(cell.v, usesDate1904);
    // The stored number, not the formatted text: formatting turns long numbers into 1.2E+11.
    // toPrecision(15) removes float noise such as 15.600000000000001.
    return String(Number(cell.v.toPrecision(15)));
  }
  if (typeof cell.v === "boolean") return cell.v ? "TRUE" : "FALSE";
  return cleanText(String(cell.v));
}

/**
 * A spreadsheet stores a date as a count of days. Converting the count straight to
 * year-month-day keeps time zones out of it; going through a JavaScript Date would shift the
 * day for anyone east of Greenwich.
 */
function dayNumberToIso(days: number, usesDate1904: boolean): string {
  const date: { y: number; m: number; d: number } = XLSX.SSF.parse_date_code(days, { date1904: usesDate1904 });
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.y}-${pad(date.m)}-${pad(date.d)}`;
}

// --- Zip files ---------------------------------------------------------------------------------

/**
 * The size a zip says its files have once unpacked, read from its table of contents (the
 * "central directory" at the end of the file) without unpacking anything.
 *
 * The sizes are what the file declares, and a file made to deceive can declare less. This stops
 * honest exports that are simply huge, and the usual "zip bomb"; it is not a proof.
 * A zip we cannot follow returns 0 and is left to the parser, which reports it as unreadable.
 */
function declaredUnpackedSize(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const END_RECORD = 0x06054b50; // "PK 05 06": closes the file, 22 bytes plus an optional comment
  const FILE_ENTRY = 0x02014b50; // "PK 01 02": one per file, 46 bytes plus three variable parts

  let end = bytes.length - 22;
  while (end >= 0 && view.getUint32(end, true) !== END_RECORD) end--;
  if (end < 0) return 0;

  const entries = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true); // where the table of contents starts
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > bytes.length || view.getUint32(at, true) !== FILE_ENTRY) return total;
    // Offset 24: unpacked size. A file over 4 GB stores 0xFFFFFFFF here, which is over any limit.
    total += view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    at += 46 + nameLength + extraLength + commentLength;
  }
  return total;
}

// --- Text files --------------------------------------------------------------------------------

/** Text has no NUL bytes (unless it is UTF-16) and is not a PDF. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (isUtf16(bytes)) return true;
  const start = bytes.subarray(0, 1024);
  const isPdf = start[0] === 0x25 && start[1] === 0x50 && start[2] === 0x44 && start[3] === 0x46; // "%PDF"
  return !isPdf && !start.includes(0);
}

const isUtf16 = (bytes: Uint8Array) =>
  (bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff);

function decodeText(bytes: Uint8Array): string {
  if (isUtf16(bytes)) return new TextDecoder(bytes[0] === 0xff ? "utf-16le" : "utf-16be").decode(bytes);
  const utf8 = new TextDecoder("utf-8").decode(bytes); // also drops a UTF-8 byte-order mark
  // U+FFFD marks bytes that are not valid UTF-8: the file comes from an old Windows program.
  return utf8.includes("�") ? new TextDecoder("windows-1252").decode(bytes) : utf8;
}

/**
 * The delimiter used most in the first lines, counted outside quotes. SheetJS only looks at the
 * first 1,024 characters, which is where title lines with stray commas sit.
 */
function findDelimiter(content: string): string {
  const lines = content
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 30)
    .map((line) => line.replace(/"[^"]*"/g, ""));
  const count = (delimiter: string) => lines.reduce((sum, line) => sum + line.split(delimiter).length - 1, 0);
  return [",", ";", "\t", "|"].reduce((best, delimiter) => (count(delimiter) > count(best) ? delimiter : best));
}
