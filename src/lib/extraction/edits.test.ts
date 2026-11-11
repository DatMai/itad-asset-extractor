import { describe, expect, it } from "vitest";
import { applyEdits, setColumnTarget } from "./edits";
import { extractSheet, planSheet } from "./pipeline";
import type { RawSheet } from "./types";

const sheet: RawSheet = {
  name: "S",
  hidden: false,
  rows: [
    ["Type", "Brand", "Model", "Serial", "RAM", "Old serial", "Where"],
    ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "16GB", "OLD-1", "Sydney"],
    ["Desktop", "HP", "ProDesk 400 G7", "4CE0471ABC", "8GB", "OLD-2", "Perth"],
  ],
};
const plan = planSheet(sheet);
const column = (current: typeof plan, header: string) => {
  const found = current.columns.find((item) => item.header === header);
  if (!found) throw new Error(`No column ${header}`);
  return found;
};

describe("setColumnTarget", () => {
  it("maps a column by hand, with full confidence and a clear origin", () => {
    const where = column(plan, "Where");
    expect(where.target).toBe("ignore");

    const fixed = setColumnTarget(plan, where.index, "location");
    expect(column(fixed, "Where")).toMatchObject({ target: "location", confidence: 1, reason: "Set by you", source: "you" });
    expect(extractSheet(fixed).assets[0].fields.location).toMatchObject({ value: "Sydney", confidence: 1 });
  });

  it("does not change the plan it was given", () => {
    setColumnTarget(plan, column(plan, "Where").index, "location");
    expect(column(plan, "Where").target).toBe("ignore");
  });

  it("frees the column that had the field, and says so", () => {
    const moved = setColumnTarget(plan, column(plan, "Old serial").index, "serialNumber");
    expect(column(moved, "Old serial").target).toBe("serialNumber");
    expect(column(moved, "Serial")).toMatchObject({ target: "ignore", reason: 'Serial number is now read from "Old serial"' });
    expect(extractSheet(moved).assets[0].fields.serialNumber?.value).toBe("OLD-1");
  });

  it("lets several columns be combined or unused", () => {
    const combined = setColumnTarget(setColumnTarget(plan, 0, "combined"), 1, "combined");
    expect(combined.columns.slice(0, 2).map((item) => item.target)).toEqual(["combined", "combined"]);
    const unused = setColumnTarget(setColumnTarget(plan, 0, "ignore"), 1, "ignore");
    expect(unused.columns.slice(0, 2).map((item) => item.target)).toEqual(["ignore", "ignore"]);
  });
});

describe("applyEdits", () => {
  const { assets } = extractSheet(plan);
  const [first] = assets;

  it("replaces a value with what the user typed, read the same way as file values", () => {
    const [edited] = applyEdits(assets, { values: { [first.id]: { ramGB: "32", cpu: "i7-1185G7", model: " Latitude 5430 " } }, kinds: {} });
    expect(edited.fields.ramGB).toMatchObject({ value: 32, confidence: 1, source: "manual", raw: "16GB" });
    expect(edited.fields.cpu).toMatchObject({ value: "Intel Core i7-1185G7", source: "manual" });
    expect(edited.fields.model).toMatchObject({ value: "Latitude 5430", note: "Edited by you" });
  });

  it("accepts every asset type from the list", () => {
    const [edited] = applyEdits(assets, { values: { [first.id]: { assetType: "other" } }, kinds: {} });
    expect(edited.fields.assetType).toMatchObject({ value: "other", confidence: 1 });
  });

  it("clears a value when the user empties the cell", () => {
    const [edited] = applyEdits(assets, { values: { [first.id]: { manufacturer: "" } }, kinds: {} });
    expect(edited.fields.manufacturer).toMatchObject({ value: null, confidence: 1, note: "Cleared by you" });
  });

  it("flags typed text it cannot read instead of storing it as a number", () => {
    const [edited] = applyEdits(assets, { values: { [first.id]: { ramGB: "plenty" } }, kinds: {} });
    expect(edited.fields.ramGB).toMatchObject({ value: null, confidence: 0 });
    expect(edited.fields.ramGB?.note).toMatch(/Could not read/);
  });

  it("moves an asset between computers and non-computers", () => {
    const [edited] = applyEdits(assets, { values: {}, kinds: { [first.id]: "not-a-computer" } });
    expect(edited).toMatchObject({ kind: "not-a-computer", kindReason: "marked by you" });
  });

  it("leaves untouched assets as they are", () => {
    const result = applyEdits(assets, { values: { [first.id]: { ramGB: "32" } }, kinds: {} });
    expect(result[1]).toBe(assets[1]);
  });
});
