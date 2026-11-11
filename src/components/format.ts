/** How values and confidence are shown. Display only: nothing here changes the data. */
import { LOW_CONFIDENCE, type FieldKey, type FieldValue } from "@/lib/extraction/types";

/** A value as text for the table: 16 -> "16 GB", 7680 -> "7.68 TB", 14 -> 14″. */
export function formatValue(key: FieldKey, value: string | number): string {
  if (typeof value !== "number") return value;
  if (key === "ramGB") return `${value} GB`;
  if (key === "storageGB") return value >= 1000 ? `${Math.round(value / 10) / 100} TB` : `${value} GB`;
  if (key === "screenInches") return `${value}″`;
  return String(value);
}

/** Doubt is shown as a named level first; the number is secondary. */
export type Level = "high" | "medium" | "check";

export function levelOf(confidence: number): Level {
  if (confidence < LOW_CONFIDENCE) return "check";
  return confidence >= 0.85 ? "high" : "medium";
}

export const LEVEL_LABEL: Record<Level, string> = { high: "High", medium: "Medium", check: "Check" };

export const LEVEL_STYLE: Record<Level, string> = {
  high: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  medium: "bg-sky-50 text-sky-800 ring-sky-200",
  check: "bg-amber-100 text-amber-900 ring-amber-300",
};

const SOURCE_TEXT: Record<FieldValue["source"], string> = {
  column: "Read from its own column",
  parsed: "Pulled out of a combined cell",
  inferred: "Not written in the file; inferred",
  manual: "Entered by you",
};

/** The explanation shown when hovering a cell: where the value came from and how sure we are. */
export function explain(field: FieldValue): string {
  const lines = [
    field.raw !== null && String(field.value) !== field.raw ? `In the file: "${field.raw}"` : null,
    field.note ?? null,
    SOURCE_TEXT[field.source],
    `Confidence: ${LEVEL_LABEL[levelOf(field.confidence)]} (${Math.round(field.confidence * 100)}%)`,
  ];
  return lines.filter((line) => line !== null).join("\n");
}
