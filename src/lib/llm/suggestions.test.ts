import { describe, expect, it } from "vitest";
import { planSheet } from "@/lib/extraction/pipeline";
import type { RawSheet } from "@/lib/extraction/types";
import { applySuggestions, buildSuggestRequest, unclearColumns } from "./suggestions";

const sheet: RawSheet = {
  name: "S",
  hidden: false,
  rows: [
    ["Type", "Brand", "Kit", "Ref", "Keeper", "Building", "Bin"],
    ["Laptop", "Dell", "Latitude 5420 i7-1185G7 16GB", "7HKQ2M3", "Sarah Lee", "HQ-2", "A1B2C3D"],
    ["Desktop", "HP", "ProDesk 400 G7 i5-10500 8GB", "4CE0471ABC", "Tom Nguyen", "HQ-1", "E4F5G6H"],
  ],
};
const plan = planSheet(sheet);
const headers = (columns: { header: string }[]) => columns.map((column) => column.header);

describe("unclearColumns", () => {
  it("lists the columns the rules left unused or unsure about", () => {
    // "Ref" is read as a serial number from its values, with a flag; nothing says what
    // "Keeper" and "Bin" are.
    expect(headers(unclearColumns(plan))).toEqual(["Ref", "Keeper", "Bin"]);
  });

  it("never lists a column the user mapped by hand", () => {
    const columns = plan.columns.map((column) => (column.header === "Bin" ? { ...column, source: "you" as const } : column));
    expect(headers(unclearColumns({ ...plan, columns }))).toEqual(["Ref", "Keeper"]);
  });
});

describe("buildSuggestRequest", () => {
  const request = buildSuggestRequest(plan);

  it("sends every header, so the model knows which fields are already taken", () => {
    expect(request.columns.map((column) => [column.header, column.mappedTo])).toEqual([
      ["Type", "assetType"],
      ["Brand", "manufacturer"],
      ["Kit", "combined"],
      ["Ref", null],
      ["Keeper", null],
      ["Building", "location"],
      ["Bin", null],
    ]);
  });

  it("sends sample values only for the unclear columns", () => {
    const withSamples = request.columns.filter((column) => column.samples.length > 0);
    expect(headers(withSamples)).toEqual(["Ref", "Keeper", "Bin"]);
    expect(JSON.stringify(request)).not.toContain("Latitude"); // settled columns send no values
  });

  it("masks identifiers, keeping only their shape", () => {
    const samplesOf = (header: string) => request.columns.find((column) => column.header === header)?.samples;
    expect(samplesOf("Ref")).toEqual(["9AAA9A9", "9AA9999AAA"]);
    expect(samplesOf("Bin")).toEqual(["A9A9A9A", "A9A9A9A"]);
    expect(samplesOf("Keeper")).toEqual(["Sarah Lee", "Tom Nguyen"]); // free text cannot be masked without losing its meaning
  });

  it("sends at most five short samples per column", () => {
    const long: RawSheet = { name: "L", hidden: false, rows: [["Mystery"], ...Array.from({ length: 9 }, (_, i) => [`${"x".repeat(200)} ${i}`])] };
    const [column] = buildSuggestRequest(planSheet(long)).columns;
    expect(column.samples.length).toBeLessThanOrEqual(5);
    expect(column.samples.every((sample) => sample.length <= 80)).toBe(true);
  });
});

describe("applySuggestions", () => {
  const index = (header: string) => plan.columns.find((column) => column.header === header)?.index ?? -1;
  const target = (result: typeof plan, header: string) => result.columns.find((column) => column.header === header);

  it("maps an unclear column and marks the mapping as coming from AI", () => {
    const result = applySuggestions(plan, [{ index: index("Keeper"), target: "assignedTo", confidence: 0.95, reason: "A keeper is the person holding the asset" }]);
    expect(target(result, "Keeper")).toMatchObject({
      target: "assignedTo",
      source: "ai",
      confidence: 0.8, // capped: an AI suggestion is never shown as "High"
      reason: "AI suggestion: A keeper is the person holding the asset",
    });
  });

  it("ignores a suggestion for a column the rules already settled", () => {
    const result = applySuggestions(plan, [{ index: index("Brand"), target: "notes", confidence: 1, reason: "x" }]);
    expect(target(result, "Brand")?.target).toBe("manufacturer");
  });

  it("ignores a suggestion for a field another column already holds", () => {
    const result = applySuggestions(plan, [{ index: index("Bin"), target: "location", confidence: 0.9, reason: "x" }]);
    expect(target(result, "Bin")?.target).toBe("ignore");
    expect(target(result, "Building")?.target).toBe("location");
  });

  it("ignores 'unmapped', unknown fields and columns that do not exist", () => {
    const result = applySuggestions(plan, [
      { index: index("Bin"), target: "unmapped", confidence: 0.9, reason: "x" },
      { index: index("Keeper"), target: "favouriteColour", confidence: 0.9, reason: "x" },
      { index: 99, target: "notes", confidence: 0.9, reason: "x" },
    ]);
    expect(result.columns).toEqual(plan.columns);
  });

  it("accepts field names whatever their capitalisation and clamps odd confidences", () => {
    const result = applySuggestions(plan, [{ index: index("Keeper"), target: "ASSIGNEDTO", confidence: -3, reason: "x" }]);
    expect(target(result, "Keeper")).toMatchObject({ target: "assignedTo", confidence: 0 });
  });

  it("gives a field to the first of two columns suggested for it", () => {
    const result = applySuggestions(plan, [
      { index: index("Keeper"), target: "notes", confidence: 0.7, reason: "x" },
      { index: index("Bin"), target: "notes", confidence: 0.7, reason: "x" },
    ]);
    expect([target(result, "Keeper")?.target, target(result, "Bin")?.target]).toEqual(["notes", "ignore"]);

    // A flagged column can be re-read, which frees its field for another column.
    const swapped = applySuggestions(plan, [
      { index: index("Ref"), target: "assetTag", confidence: 0.7, reason: "x" },
      { index: index("Bin"), target: "serialNumber", confidence: 0.7, reason: "x" },
    ]);
    expect([target(swapped, "Ref")?.target, target(swapped, "Bin")?.target]).toEqual(["assetTag", "serialNumber"]);
  });
});
