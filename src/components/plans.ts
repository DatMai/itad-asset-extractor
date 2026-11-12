/**
 * Two questions the screen asks about a sheet's plan when something changes under it.
 * Plain functions of plans, so they are tested without a browser.
 */
import type { SheetPlan } from "@/lib/extraction/types";

/**
 * An AI answer names columns by position, so it is only valid for the sheet and header row it
 * was asked about. Returns the plan as it is now, or why the answer no longer applies.
 *
 * The sheet is compared by object, not by name: every opened file creates new sheet objects, so
 * "Sheet1" of another file is never mistaken for the "Sheet1" that was sent.
 */
export function findCurrentPlan(plans: SheetPlan[] | undefined, asked: SheetPlan): SheetPlan | "file-changed" | "header-changed" {
  const now = plans?.find((plan) => plan.sheet === asked.sheet);
  if (!now) return "file-changed";
  return now.header.rowIndex === asked.header.rowIndex ? now : "header-changed";
}

/**
 * After a sheet is planned again: when the header row is still the same row, keep the columns
 * the user or the AI decided, so "Detect again" does not silently undo them. When the header
 * row moved, the columns mean something else and the new plan stands as it is.
 */
export function keepChosenColumns(previous: SheetPlan, next: SheetPlan): SheetPlan {
  if (next.header.rowIndex !== previous.header.rowIndex) return next;
  const columns = next.columns.map((column, position) => {
    const old = previous.columns[position];
    return old && old.source !== "rules" && old.header === column.header ? old : column;
  });
  return { ...next, columns };
}
