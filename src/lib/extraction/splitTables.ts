/**
 * One sheet can hold several tables: a manifest per customer, stacked one under the other, each
 * with its own title, its own column names and its own column order. Reading such a sheet with
 * one header loses the tables above that header and misreads the ones below it.
 *
 * splitTables() cuts the sheet into one RawSheet per table, so the rest of the pipeline (and the
 * user, on the mapping screen) handles each table like a sheet of its own.
 *
 * A new table starts at a row that
 *   - comes after a blank row or a one-cell row (a title), or is the first row;
 *   - reads like a header on its own: at least three cells, at least half of them column names
 *     we know, none of them data, and a table under it;
 *   - is not the header of the table above written again (a page break repeats a header).
 * With fewer than two such rows the sheet is returned as it is.
 */
import { scoreHeaderRow } from "./detectHeader";
import { normaliseText } from "./text";
import type { RawSheet } from "./types";

const filledCells = (row: string[]) => row.filter((cell) => cell.trim() !== "");

/** The header as one string, to tell a repeated header from a new one. */
const headerKey = (row: string[]) => filledCells(row).map(normaliseText).join("|");

export function splitTables(sheet: RawSheet): RawSheet[] {
  const { rows } = sheet;
  const headers: number[] = [];
  for (let index = 0; index < rows.length; index++) {
    // Cheap test first: looking every cell of a long sheet up in the list of names is not.
    if (index > 0 && filledCells(rows[index - 1]).length > 1) continue;
    const scored = scoreHeaderRow(rows, index);
    if (!scored || scored.cells < 3 || scored.data > 0 || scored.named * 2 < scored.cells) continue;
    const previous = headers.at(-1);
    if (previous !== undefined && headerKey(rows[previous]) === headerKey(rows[index])) continue;
    headers.push(index);
  }
  if (headers.length < 2) return [sheet];

  // A table starts at its title rows: the one-cell rows directly above its header.
  const starts = headers.map((header, position) => {
    if (position === 0) return 0;
    let start = header;
    while (start > headers[position - 1] + 1 && filledCells(rows[start - 1]).length === 1) start--;
    return start;
  });

  const names = new Set<string>();
  return headers.map((header, position) => {
    const start = starts[position];
    let end = starts[position + 1] ?? rows.length;
    while (end > header + 1 && filledCells(rows[end - 1]).length === 0) end--;

    const title = header > start && filledCells(rows[header - 1]).length === 1 ? filledCells(rows[header - 1])[0] : `table ${position + 1}`;
    let name = `${sheet.name} · ${title}`;
    for (let copy = 2; names.has(name); copy++) name = `${sheet.name} · ${title} (${copy})`;
    names.add(name);

    return { ...sheet, name, rows: rows.slice(start, end), rowOffset: start };
  });
}
