import { describe, expect, it } from "vitest";
import { applyEdits, setColumnTarget } from "./edits";
import { needsReview } from "./exportAssets";
import { extractAll, extractSheet, planSheet } from "./pipeline";
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

describe("applyEdits: warnings about serial numbers follow the edited values", () => {
  const serials: RawSheet = {
    name: "S",
    hidden: false,
    rows: [
      ["Model", "Serial", "RAM"],
      ["Dell Latitude 5420", "ABC1234", "16GB"],
      ["HP ProDesk 400 G7", "", "8GB"],
      ["Lenovo ThinkPad T14", "ABC1234", "16GB"],
      ["Dell OptiPlex 7090", "9JZL5N2", "32GB"],
    ],
  };
  const { assets } = extractAll([planSheet(serials)]);
  const [row2, row3, row4, row5] = assets;
  const edit = (values: Record<string, { serialNumber: string }>) => applyEdits(assets, { values, kinds: {} });

  it("starts from the warnings of the extraction", () => {
    expect(assets.map((asset) => asset.warnings)).toEqual([
      ["Same serial number as S row 4"],
      ["No serial number"],
      ["Same serial number as S row 2"],
      [],
    ]);
  });

  it("drops 'No serial number' once the user types one, so the row no longer needs review", () => {
    const edited = edit({ [row3.id]: { serialNumber: "ZZZ9999" } });
    expect(edited[1].fields.serialNumber).toMatchObject({ value: "ZZZ9999", source: "manual" });
    expect(edited[1].warnings).toEqual([]);
    expect(needsReview(edited[1])).toBe(false);
  });

  it("drops the duplicate warning from both rows when one of them is corrected", () => {
    const edited = edit({ [row4.id]: { serialNumber: "QQQ1111" } });
    expect(edited[0].warnings).toEqual([]);
    expect(edited[2].warnings).toEqual([]);
  });

  it("warns about a duplicate the edit creates", () => {
    const edited = edit({ [row3.id]: { serialNumber: "9JZL5N2" } });
    expect(edited[1].warnings).toEqual(["Same serial number as S row 5"]);
    expect(edited[3].warnings).toEqual(["Same serial number as S row 3"]);
    expect(edited[0].warnings).toEqual(["Same serial number as S row 4"]); // the old pair is still a pair
  });

  it("warns when the user clears the serial number of a computer", () => {
    const edited = edit({ [row5.id]: { serialNumber: "" } });
    expect(edited[3].warnings).toEqual(["No serial number"]);
  });

  it("keeps the other warnings of a row", () => {
    const counted = assets.map((asset) => (asset === row3 ? { ...asset, warnings: ["This row stands for 12 devices", ...asset.warnings] } : asset));
    const edited = applyEdits(counted, { values: { [row3.id]: { serialNumber: "ZZZ9999" } }, kinds: {} });
    expect(edited[1].warnings).toEqual(["This row stands for 12 devices"]);
  });

  it("drops 'No serial number' when the user says the row is not a computer", () => {
    const edited = applyEdits(assets, { values: {}, kinds: { [row3.id]: "not-a-computer" } });
    expect(edited[1].kind).toBe("not-a-computer");
    expect(edited[1].warnings).toEqual([]);
    // The edits are laid over the extraction each time, so undoing the edit brings it back.
    expect(applyEdits(assets, { values: {}, kinds: {} })[1].warnings).toEqual(["No serial number"]);
  });

  it("keeps the other warnings of a row that is marked as not a computer", () => {
    const counted = assets.map((asset) => (asset === row3 ? { ...asset, warnings: ["This row stands for 12 devices", ...asset.warnings] } : asset));
    const edited = applyEdits(counted, { values: {}, kinds: { [row3.id]: "not-a-computer" } });
    expect(edited[1].warnings).toEqual(["This row stands for 12 devices"]);
  });

  it("does not touch the warnings when the edit is about another field", () => {
    const edited = applyEdits(assets, { values: { [row2.id]: { ramGB: "32" } }, kinds: {} });
    expect(edited.map((asset) => asset.warnings)).toEqual(assets.map((asset) => asset.warnings));
    expect(edited[2]).toBe(assets[2]);
  });
});
