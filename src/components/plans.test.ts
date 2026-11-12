import { describe, expect, it } from "vitest";
import { setColumnTarget } from "@/lib/extraction/edits";
import { planSheet } from "@/lib/extraction/pipeline";
import type { RawSheet } from "@/lib/extraction/types";
import { applySuggestions } from "@/lib/llm/suggestions";
import { findCurrentPlan, keepChosenColumns } from "./plans";

const rows = [
  ["Asset list 2024", "", "", ""],
  ["Type", "Brand", "Keeper", "Bin"],
  ["Laptop", "Dell", "Sarah Lee", "A1B2C3D"],
  ["Desktop", "HP", "Tom Nguyen", "E4F5G6H"],
];
const sheet: RawSheet = { name: "Sheet1", hidden: false, rows };
const plan = planSheet(sheet);
const indexOf = (header: string) => plan.columns.findIndex((column) => column.header === header);

describe("findCurrentPlan: is a late AI answer still about what is on screen?", () => {
  it("finds the plan when nothing changed", () => {
    expect(findCurrentPlan([plan], plan)).toBe(plan);
  });

  it("still finds it after a column was remapped by hand: the column positions are the same", () => {
    const remapped = setColumnTarget(plan, indexOf("Bin"), "assetTag");
    expect(findCurrentPlan([remapped], plan)).toBe(remapped);
  });

  it("says the header changed when another header row was chosen while waiting", () => {
    expect(findCurrentPlan([planSheet(sheet, 2)], plan)).toBe("header-changed");
  });

  it("says the file changed when another file with the same sheet name was opened", () => {
    const otherFile: RawSheet = { name: "Sheet1", hidden: false, rows };
    expect(findCurrentPlan([planSheet(otherFile)], plan)).toBe("file-changed");
    expect(findCurrentPlan(undefined, plan)).toBe("file-changed");
  });
});

describe("keepChosenColumns: 'Detect again' on the same header row", () => {
  const byHand = setColumnTarget(plan, indexOf("Bin"), "assetTag");
  const withAi = applySuggestions(byHand, [{ index: indexOf("Keeper"), target: "assignedTo", confidence: 0.9, reason: "Names of people" }]);

  it("keeps what the user and the AI chose when the header row is the same", () => {
    const again = keepChosenColumns(withAi, planSheet(sheet));
    expect(again.header.rowIndex).toBe(plan.header.rowIndex);
    expect(again.columns[indexOf("Bin")]).toMatchObject({ target: "assetTag", source: "you" });
    expect(again.columns[indexOf("Keeper")]).toMatchObject({ target: "assignedTo", source: "ai" });
    expect(again.columns[indexOf("Brand")]).toEqual(plan.columns[indexOf("Brand")]); // rule columns are re-read
  });

  it("drops them when the header row really changed: the columns mean something else now", () => {
    const moved = planSheet(sheet, 2);
    expect(keepChosenColumns(withAi, moved)).toBe(moved);
  });
});
