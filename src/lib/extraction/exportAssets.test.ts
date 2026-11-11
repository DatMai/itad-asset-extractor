import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ExportedAssetSchema, needsReview, toCsv, toExportRows, toJson } from "./exportAssets";
import { extractAll, planSheet } from "./pipeline";
import { readWorkbook } from "./readWorkbook";
import type { Asset } from "./types";

const fileName = "sample_assets_1.xlsx";
const sheets = readWorkbook(new Uint8Array(readFileSync(`public/samples/${fileName}`)), fileName);
const { assets } = extractAll(sheets.map((sheet) => planSheet(sheet)));

/** A minimal asset for the escaping tests. */
const assetWith = (fields: Asset["fields"]): Asset => ({
  id: "S#2",
  sheet: "S",
  rowNumber: 2,
  kind: "computer",
  fields,
  warnings: [],
  extras: {},
});
const text = (value: string) => ({ value, raw: value, confidence: 1, source: "column" as const });

describe("toExportRows (AC8)", () => {
  const rows = toExportRows(assets);

  it("produces one row per asset that satisfies the export schema", () => {
    expect(rows).toHaveLength(19);
    for (const row of rows) expect(() => ExportedAssetSchema.parse(row)).not.toThrow();
  });

  it("exports the clean values, the original storage text and where the row came from", () => {
    expect(rows[4]).toEqual({
      assetType: "desktop",
      manufacturer: "Dell",
      model: "OptiPlex 7090",
      serialNumber: "9JZL5N2",
      cpu: "Intel Core i7-10700",
      ramGB: 32,
      storageGB: 1000,
      storageRaw: "1 TB HDD",
      screenInches: null,
      assetTag: null,
      assignedTo: "Reception",
      location: "Sydney",
      costCentre: null,
      purchaseDate: null,
      notes: null,
      sourceSheet: "Assets",
      sourceRow: 9,
      confidence: 1,
      needsReview: false,
    });
  });

  it("carries the lowest confidence of the row and the review flag", () => {
    const partialCpu = rows.find((row) => row.sourceSheet === "Assets" && row.sourceRow === 8);
    expect(partialCpu).toMatchObject({ cpu: "Intel Core i5 11th gen", confidence: 0.6, needsReview: true });
  });

  it("exports null instead of a value of the wrong type", () => {
    const edited = assetWith({
      ramGB: { value: "lots", raw: "lots", confidence: 1, source: "manual" },
      assetType: { value: "toaster", raw: "toaster", confidence: 1, source: "manual" },
      model: text("Latitude 5420"),
    });
    expect(toExportRows([edited])[0]).toMatchObject({ ramGB: null, assetType: null, model: "Latitude 5420" });
  });
});

describe("needsReview", () => {
  it("is true for a low-confidence value, an unreadable value or a warning", () => {
    expect(needsReview(assetWith({ model: text("X") }))).toBe(false);
    expect(needsReview(assetWith({ model: { ...text("X"), confidence: 0.6 } }))).toBe(true);
    expect(needsReview(assetWith({ ramGB: { value: null, raw: "plenty", confidence: 0, source: "column" } }))).toBe(true);
    expect(needsReview({ ...assetWith({ model: text("X") }), warnings: ["No serial number"] })).toBe(true);
  });
});

describe("toCsv (AC8)", () => {
  it("writes a header line and one line per asset", () => {
    const lines = toCsv(toExportRows(assets)).trimEnd().split("\r\n");
    expect(lines).toHaveLength(20);
    expect(lines[0]).toBe(
      "assetType,manufacturer,model,serialNumber,cpu,ramGB,storageGB,storageRaw,screenInches,assetTag,assignedTo,location,costCentre,purchaseDate,notes,sourceSheet,sourceRow,confidence,needsReview",
    );
    expect(lines[5]).toBe("desktop,Dell,OptiPlex 7090,9JZL5N2,Intel Core i7-10700,32,1000,1 TB HDD,,,Reception,Sydney,,,,Assets,9,1,false");
  });

  it("quotes commas, quotes and line breaks", () => {
    const [, line] = toCsv(toExportRows([assetWith({ model: text('ExpertBook B9, 14" touch'), notes: text("line one\nline two") })])).split("\r\n");
    expect(line).toContain('"ExpertBook B9, 14"" touch"');
    expect(line).toContain('"line one');
  });

  it("stops a cell from being run as a formula when the file is opened", () => {
    const row = toExportRows([assetWith({ notes: text('=HYPERLINK("http://evil.example","click")'), assignedTo: text("@admin"), location: text("+61 2 0000") })]);
    const csv = toCsv(row);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""click"")"`);
    expect(csv).toContain("'@admin");
    expect(csv).toContain("'+61 2 0000");
  });
});

describe("toJson (AC8)", () => {
  it("is plain JSON of the same rows", () => {
    const rows = toExportRows(assets);
    expect(JSON.parse(toJson(rows))).toEqual(rows);
  });
});
