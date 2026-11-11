/**
 * The browser side of the optional AI suggestion: decide which columns to ask about, build a
 * request that sends as little as possible, and apply the answer without trusting it.
 */
import { kindOfValue } from "@/lib/extraction/mapColumns";
import { isPlaceholder, round } from "@/lib/extraction/text";
import { FIELD_KEYS, LOW_CONFIDENCE, type ColumnMapping, type ColumnTarget, type SheetPlan } from "@/lib/extraction/types";
import type { SuggestRequest } from "./schema";

/** An AI suggestion is shown as "Medium" at most, so the user still looks at it. */
const AI_CONFIDENCE_LIMIT = 0.8;
const TARGETS: ColumnTarget[] = [...FIELD_KEYS, "combined"];

/** The columns worth asking about: unused or flagged by the rules, and not decided by the user. */
export function unclearColumns(plan: SheetPlan): ColumnMapping[] {
  return plan.columns.filter(
    (column) => column.source !== "you" && (column.target === "ignore" || column.confidence < LOW_CONFIDENCE),
  );
}

/**
 * What leaves the browser: the name of every column (so the model knows which fields are taken)
 * and up to five sample values of the unclear columns only. Values of settled columns, such as
 * serial numbers and people, are never sent.
 */
export function buildSuggestRequest(plan: SheetPlan): SuggestRequest {
  const unclear = new Set(unclearColumns(plan).map((column) => column.index));
  const dataRows = plan.sheet.rows.slice(plan.header.rowIndex === null ? 0 : plan.header.rowIndex + 1);

  return {
    columns: plan.columns.map((column) => {
      const isUnclear = unclear.has(column.index);
      const values = dataRows.map((row) => row[column.index] ?? "").filter((cell) => !isPlaceholder(cell));
      return {
        index: column.index,
        header: column.header.slice(0, 120),
        mappedTo: isUnclear ? null : column.target,
        samples: isUnclear ? [...new Set(values)].slice(0, 5).map((value) => maskIdentifier(value).slice(0, 80)) : [],
      };
    }),
  };
}

/**
 * An identifier (serial number, asset tag) is sent as its shape only: "7HKQ2M3" -> "9AAA9A9".
 * The shape is enough to recognise the column, and the real identifier stays in the browser.
 */
function maskIdentifier(value: string): string {
  const kind = kindOfValue(value);
  if (kind !== "serialNumber" && kind !== "assetTag") return value;
  return value.replace(/[a-z]/gi, "A").replace(/\d/g, "9");
}

/**
 * Apply the model's suggestions to a plan. The answer is treated as untrusted input:
 * only unclear columns can change, the field must be one we know, a field already read from
 * another column is not taken away, and the confidence is clamped.
 */
export function applySuggestions(
  plan: SheetPlan,
  suggestions: { index: number; target: string; confidence: number; reason: string }[],
): SheetPlan {
  const askedAbout = new Set(unclearColumns(plan).map((column) => column.index));
  let columns = plan.columns;

  for (const suggestion of suggestions) {
    const target = TARGETS.find((known) => known.toLowerCase() === suggestion.target.toLowerCase());
    if (!target || !askedAbout.has(suggestion.index)) continue; // includes "unmapped"

    const isTaken = target !== "combined" && columns.some((column) => column.index !== suggestion.index && column.target === target);
    if (isTaken) continue;

    columns = columns.map((column) =>
      column.index === suggestion.index
        ? {
            ...column,
            target,
            parts: undefined,
            confidence: round(Math.min(Math.max(suggestion.confidence, 0), AI_CONFIDENCE_LIMIT), 2),
            reason: `AI suggestion: ${suggestion.reason}`,
            source: "ai" as const,
          }
        : column,
    );
  }
  return { ...plan, columns };
}
