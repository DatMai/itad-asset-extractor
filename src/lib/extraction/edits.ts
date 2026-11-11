/**
 * What the user changes by hand: which field a column holds, and the value of a cell.
 * Both are pure functions that return a new plan or new assets, so the UI can keep the edits in
 * state and re-apply them after every re-extraction.
 */
import { NORMALISERS } from "./extractAssets";
import { targetLabel } from "./fields";
import { ASSET_TYPES, type Asset, type AssetType, type ColumnTarget, type FieldKey, type FieldValue, type SheetPlan } from "./types";

/**
 * Map a column to a field by hand. A field can be read from one column only, so a column that
 * had it is released ("combined" and "ignore" can be used by any number of columns).
 */
export function setColumnTarget(plan: SheetPlan, columnIndex: number, target: ColumnTarget): SheetPlan {
  const chosen = plan.columns.find((column) => column.index === columnIndex);
  const isExclusive = target !== "combined" && target !== "ignore";

  const columns = plan.columns.map((column) => {
    if (column.index === columnIndex) {
      return { ...column, target, parts: undefined, confidence: 1, reason: "Set by you", source: "you" as const };
    }
    if (isExclusive && column.target === target) {
      const reason = `${targetLabel(target)} is now read from "${chosen?.header}"`;
      return { ...column, target: "ignore" as const, parts: undefined, confidence: 0, reason, source: "you" as const };
    }
    return column;
  });
  return { ...plan, columns };
}

/** Manual corrections to the extracted assets, kept apart from the extraction itself. */
export interface Edits {
  /** asset id -> field -> the text the user typed ("" clears the value). */
  values: Record<string, Partial<Record<FieldKey, string>>>;
  /** asset id -> whether the user says it is a computer. */
  kinds: Record<string, Asset["kind"]>;
}

export const NO_EDITS: Edits = { values: {}, kinds: {} };

export function applyEdits(assets: Asset[], edits: Edits): Asset[] {
  return assets.map((asset) => {
    const typed = edits.values[asset.id];
    const kind = edits.kinds[asset.id];
    if (!typed && !kind) return asset;

    const fields = { ...asset.fields };
    for (const [key, text] of Object.entries(typed ?? {}) as [FieldKey, string][]) {
      fields[key] = editedValue(key, text, asset.fields[key]);
    }
    return kind ? { ...asset, fields, kind, kindReason: kind === "computer" ? undefined : "marked by you" } : { ...asset, fields };
  });
}

/** Typed text goes through the same normaliser as file text, so "32" becomes 32 and "i7-1185G7" a full CPU name. */
function editedValue(key: FieldKey, typed: string, previous: FieldValue | undefined): FieldValue {
  const raw = previous?.raw ?? null; // keep what the file said
  if (typed.trim() === "") return { value: null, raw, confidence: 1, source: "manual", note: "Cleared by you" };

  if (key === "assetType" && ASSET_TYPES.includes(typed as AssetType)) {
    return { value: typed, raw, confidence: 1, source: "manual", note: "Edited by you" };
  }
  // "GB" stands in for the header: a bare number typed into RAM or storage means gigabytes.
  const result = NORMALISERS[key](typed, "GB");
  if (result.value === null) return { value: null, raw: typed, confidence: 0, source: "manual", note: result.note };
  return { value: result.value, raw, confidence: 1, source: "manual", note: "Edited by you" };
}
