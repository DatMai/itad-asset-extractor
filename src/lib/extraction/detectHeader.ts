/**
 * Find the row that holds the column names. It is often not row 1: exports start with a title,
 * a date, a blank row. Sometimes there is no header at all.
 *
 * Each of the first rows gets a score from what its cells look like:
 *   +3 for a cell that is a column name we know ("S/N", "Memory", "CPU / RAM / Disk")
 *   +1 for a cell that could be a label (short text that is not data)
 *   -2 for a cell that is clearly data (a CPU, a capacity, a date, a number)
 * A candidate must also have a table under it. The best positive score wins; on a tie the
 * row nearer the top wins. Asset lists are mostly text, so
 * "the row where types change from text to numbers" would not work here; names do.
 */
import { isKnownColumnName, kindOfValue } from "./mapColumns";
import type { HeaderGuess } from "./types";

/** Headers sit near the top. Further down we would find notes, not headers. */
const ROWS_TO_SCAN = 30;

/** What a row scores as a header, or null when it cannot be one. */
export interface HeaderScore {
  score: number;
  /** Cells that are column names we know. */
  named: number;
  /** Cells that are clearly data. */
  data: number;
  cells: number;
}

/**
 * Score one row as a header. `isSingleColumn` says the table is one column wide, where a
 * one-cell header is allowed.
 */
export function scoreHeaderRow(rows: string[][], rowIndex: number, isSingleColumn = false): HeaderScore | null {
  const cells = rows[rowIndex].filter((cell) => cell.trim() !== "");
  // Classify each cell once: comparing a cell with every known name is the costly step.
  const isName = cells.map(isKnownColumnName);
  const named = isName.filter(Boolean).length;
  // Otherwise one cell alone is a title or a note, never a header.
  if (cells.length < 2 && !(isSingleColumn && named === 1)) return null;

  const data = cells.filter((cell, position) => !isName[position] && looksLikeData(cell)).length;
  const labels = cells.length - named - data;

  // A header is made of names. A row with data in it only qualifies if it also has two
  // names we know; otherwise "Sarah Lee | Sydney | 16GB" could pass for one.
  if (data > 0 && named < 2) return null;

  // A header has a table under it. A footer has nothing below; a title such as
  // "Location: | Sydney" is much narrower than the rows it sits on.
  const below = widthsBelow(rows, rowIndex);
  const typicalWidth = below.sort((a, b) => a - b)[Math.floor(below.length / 2)];
  if (below.length === 0 || typicalWidth >= cells.length * 2) return null;

  const score = named * 3 + labels - data * 2;
  return score > 0 ? { score, named, data, cells: cells.length } : null;
}

/**
 * `rowOffset` is where rows[0] sits in the original sheet (see splitTables), so that the reason
 * names the row the user sees in their spreadsheet.
 */
export function detectHeader(rows: string[][], rowOffset = 0): HeaderGuess {
  let best: (HeaderScore & { rowIndex: number }) | null = null;
  const top = rows.slice(0, ROWS_TO_SCAN);
  // A sheet that is one column wide (one description per row) has a one-cell header.
  const isSingleColumn = top.every((row) => filled(row) <= 1);

  for (const rowIndex of top.keys()) {
    const scored = scoreHeaderRow(rows, rowIndex, isSingleColumn);
    if (scored && (!best || scored.score > best.score)) best = { ...scored, rowIndex };
  }

  if (!best) {
    return {
      rowIndex: null,
      confidence: 0.5,
      reason: "No row looks like column titles; columns are identified from their values",
    };
  }
  const rowNumber = best.rowIndex + 1 + rowOffset;
  if (best.named === 0) {
    return {
      rowIndex: best.rowIndex,
      confidence: 0.5,
      reason: `Row ${rowNumber}: none of its cells is a column name we know, but it has the most cells that read like labels and a table under it`,
    };
  }
  return {
    rowIndex: best.rowIndex,
    confidence: 0.6 + 0.4 * (best.named / best.cells),
    reason: `Row ${rowNumber}: ${best.named} of ${best.cells} cells are column names we know`,
  };
}

/** How many cells of a row hold something. */
const filled = (row: string[]) => row.filter((cell) => cell.trim() !== "").length;

/** The widths of the first five non-empty rows under a row. Stops there: the sheet can be long. */
function widthsBelow(rows: string[][], rowIndex: number): number[] {
  const widths: number[] = [];
  for (let i = rowIndex + 1; i < rows.length && widths.length < 5; i++) {
    const count = filled(rows[i]);
    if (count > 0) widths.push(count);
  }
  return widths;
}

/** A cell that holds a value, not a title: something recognisable, a bare number, or a long text. */
function looksLikeData(cell: string): boolean {
  return kindOfValue(cell) !== null || /^[\d\s.,-]+$/.test(cell) || cell.length > 60;
}
