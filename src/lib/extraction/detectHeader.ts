/**
 * Find the row that holds the column names. It is often not row 1: exports start with a title,
 * a date, a blank row. Sometimes there is no header at all.
 *
 * Each of the first rows gets a score from what its cells look like:
 *   +3 for a cell that is a column name we know ("S/N", "Memory", "CPU / RAM / Disk")
 *   +1 for a cell that could be a label (short text that is not data)
 *   -2 for a cell that is clearly data (a CPU, a capacity, a date, a number)
 * A candidate must also have a table under it. The best positive score wins; on a tie the
 * higher row wins. Asset lists are mostly text, so
 * "the row where types change from text to numbers" would not work here; names do.
 */
import { isKnownColumnName, kindOfValue } from "./mapColumns";
import type { HeaderGuess } from "./types";

/** Headers sit near the top. Further down we would find notes, not headers. */
const ROWS_TO_SCAN = 30;

export function detectHeader(rows: string[][]): HeaderGuess {
  let best: { rowIndex: number; score: number; named: number; cells: number } | null = null;
  const top = rows.slice(0, ROWS_TO_SCAN).map((row) => row.filter((cell) => cell.trim() !== ""));
  // A sheet that is one column wide (one description per row) has a one-cell header.
  const isSingleColumn = top.every((cells) => cells.length <= 1);

  for (const [rowIndex, cells] of top.entries()) {
    const named = cells.filter(isKnownColumnName).length;
    // Otherwise one cell alone is a title or a note, never a header.
    if (cells.length < 2 && !(isSingleColumn && named === 1)) continue;

    const data = cells.filter((cell) => !isKnownColumnName(cell) && looksLikeData(cell)).length;
    const labels = cells.length - named - data;

    // A header is made of names. A row with data in it only qualifies if it also has two
    // names we know; otherwise "Sarah Lee | Sydney | 16GB" could pass for one.
    if (data > 0 && named < 2) continue;

    // A header has a table under it. A footer has nothing below; a title such as
    // "Location: | Sydney" is much narrower than the rows it sits on.
    const below = rows.slice(rowIndex + 1).map(filled).filter((count) => count > 0).slice(0, 5);
    const typicalWidth = below.sort((a, b) => a - b)[Math.floor(below.length / 2)];
    if (below.length === 0 || typicalWidth >= cells.length * 2) continue;

    const score = named * 3 + labels - data * 2;
    if (score > 0 && (!best || score > best.score)) best = { rowIndex, score, named, cells: cells.length };
  }

  if (!best) {
    return {
      rowIndex: null,
      confidence: 0.5,
      reason: "No row looks like column titles; columns are identified from their values",
    };
  }
  const rowNumber = best.rowIndex + 1;
  if (best.named === 0) {
    return {
      rowIndex: best.rowIndex,
      confidence: 0.5,
      reason: `Row ${rowNumber}: none of its cells is a column name we know, but it is the first row made only of labels`,
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

/** A cell that holds a value, not a title: something recognisable, a bare number, or a long text. */
function looksLikeData(cell: string): boolean {
  return kindOfValue(cell) !== null || /^[\d\s.,-]+$/.test(cell) || cell.length > 60;
}
