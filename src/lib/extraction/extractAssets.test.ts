/**
 * Row-level rules of extractSheet: which rows are assets, which are computers, and what a
 * doubtful value says about itself. The inputs are the rows that went wrong in review.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { flagDuplicateSerials } from "./extractAssets";
import { extractAll, extractSheet, planSheet } from "./pipeline";
import { readWorkbook } from "./readWorkbook";
import { LOW_CONFIDENCE, type Asset, type RawSheet } from "./types";

const sheetOf = (rows: string[][]): RawSheet => ({ name: "S", hidden: false, rows });
const extract = (rows: string[][]) => extractSheet(planSheet(sheetOf(rows)));

describe("a computer whose description mentions an accessory", () => {
  const { assets } = extract([
    ["Description", "Serial", "CPU", "RAM"],
    ["HP EliteBook 840 G5 with charger", "5CG8123ABC", "i5-8350U", "8GB"],
    ["Lenovo ThinkPad T480 + dock", "PF1ABCDE", "i5-8250U", "16GB"],
    ["Dell Latitude 5490 no charger", "7HKQ2M3", "i5-8350U", "8GB"],
    ["Dell OptiPlex 7060 with keyboard and mouse", "9JZL5N2", "i7-8700", "16GB"],
    ["Dell Latitude 5490", "8XYZ1A2", "i5-8350U", "8GB"],
    ["Dell WD19 dock", "DOCK0001", "", ""],
    ["Lenovo ThinkPad USB-C Dock", "PF2ABCDE", "i5-8250U", "8GB"],
  ]);

  it("stays a computer when the row's own columns give a CPU or RAM", () => {
    expect(assets.slice(0, 5).map((asset) => asset.kind)).toEqual(["computer", "computer", "computer", "computer", "computer"]);
    expect(assets[0].fields.cpu?.value).toBe("Intel Core i5-8350U");
    expect(assets[0].fields.ramGB?.value).toBe(8);
  });

  it("still hides a real accessory row, which has no CPU and no RAM", () => {
    expect(assets[5]).toMatchObject({ kind: "not-a-computer", kindReason: "dock" });
  });

  it("says what the description mentioned instead of reclassifying the row", () => {
    // The description alone reads as a dock; the CPU and RAM columns say it is a computer.
    expect(assets[6].kind).toBe("computer");
    expect(assets[6].warnings).toContain("Mentions: dock");
    expect(assets[4].warnings).toEqual([]);
  });
});

describe("rows that are not assets", () => {
  const { assets, skipped } = extract([
    ["Asset Tag", "Type", "Make", "Model", "Serial Number", "Purchase Date"],
    ["Laptops", "", "", "", "", ""],
    ["AT-001", "Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "2022-05-17"],
    ["AT-002", "Laptop", "HP", "EliteBook 840 G8", "5CG1234XYZ", "2022-06-01"],
    ["Desktops", "", "", "", "", ""],
    ["AT-003", "Desktop", "HP", "ProDesk 400 G7", "4CE0471ABC", "2021-03-09"],
    ["Prepared by John Smith", "", "", "", "", ""],
    ["Notes: all drives to be wiped", "", "", "", "", ""],
    ["Total units", "3", "", "", "Total weight", "12kg"],
    ["Total", "3", "", "", "", ""],
    ["AT-009", "", "", "", "", ""],
    ["", "", "", "", "C02FK8ZTMD6R", ""],
  ]);
  const reasonOf = (rowNumber: number) => skipped.find((row) => row.rowNumber === rowNumber)?.reason;

  it("skips a section heading and a footer note, and says why", () => {
    for (const rowNumber of [2, 5, 7, 8]) expect(reasonOf(rowNumber)).toBe("Section heading or note, not an asset");
  });

  it("skips a total row however many cells it fills", () => {
    expect(reasonOf(9)).toBe("Summary row, not an asset");
    expect(reasonOf(10)).toBe("Summary row, not an asset");
  });

  it("keeps the real assets, and a sparse row that holds only a tag or a serial number", () => {
    expect(assets.map((asset) => asset.rowNumber)).toEqual([3, 4, 6, 11, 12]);
    expect(assets[3].fields.assetTag?.value).toBe("AT-009");
    expect(assets[4].fields.serialNumber?.value).toBe("C02FK8ZTMD6R");
  });

  it("does not take a full row for a summary because its first cell starts with a short summary word", () => {
    // "Tong" is also a family name, "Count" and "Sum" also start ordinary text.
    const people = extract([
      ["Assigned To", "Model", "Serial", "RAM", "Location"],
      ["Tống Văn A", "Dell Latitude 5420", "7HKQ2M3", "16GB", "Hà Nội"],
    ]);
    expect(people.assets).toHaveLength(1);
    expect(people.skipped).toEqual([]);
  });
});

describe("a row whose only cell names a device without a digit", () => {
  const { assets, skipped } = extract([
    ["Description", "Location", "Assigned To", "Notes"],
    ["Apple MacBook Air", "", "", ""],
    ["Apple iMac", "", "", ""],
    ["Microsoft Surface Laptop", "", "", ""],
    ["HP EliteBook 840 G5", "", "", ""],
    ["Laptops", "", "", ""],
    ["Prepared by John Smith", "", "", ""],
    ["Dell", "", "", ""],
  ]);

  it("keeps the row when the cell names a known product line", () => {
    expect(assets.map((asset) => asset.rowNumber)).toEqual([2, 3, 4, 5]);
    expect(assets.map((asset) => asset.fields.model?.value)).toEqual(["MacBook Air", "iMac", "Surface Laptop", "EliteBook 840 G5"]);
    expect(assets.map((asset) => asset.kind)).toEqual(["computer", "computer", "computer", "computer"]);
  });

  it("still skips a heading, a note and a lone brand", () => {
    expect(skipped.map((row) => [row.rowNumber, row.reason])).toEqual([
      [6, "Section heading or note, not an asset"],
      [7, "Section heading or note, not an asset"],
      [8, "Section heading or note, not an asset"],
    ]);
  });
});

describe("a one-cell heading that names a product line", () => {
  const { assets, skipped } = extract([
    ["Description", "Location", "Assigned To", "Notes"],
    ["Latitude laptops", "", "", ""],
    ["Precision workstations", "", "", ""],
    ["Latitude", "", "", ""],
    ["MacBook", "", "", ""],
    ["OptiPlex desktops", "", "", ""],
    ["OptiPlex PCs", "", "", ""],
    ["Apple MacBook Air", "", "", ""],
    ["Apple iMac", "", "", ""],
    ["Microsoft Surface Laptop", "", "", ""],
  ]);

  it("skips the line word alone and the line with a plural type word", () => {
    expect(skipped.map((row) => [row.rowNumber, row.reason])).toEqual(
      [2, 3, 4, 5, 6, 7].map((rowNumber) => [rowNumber, "Section heading or note, not an asset"]),
    );
  });

  it("keeps a device whose name has no digit", () => {
    expect(assets.map((asset) => asset.fields.model?.value)).toEqual(["MacBook Air", "iMac", "Surface Laptop"]);
  });
});

describe("a type column that only says the row is a computer", () => {
  const { assets } = extract([
    ["Asset No", "Category", "Brand", "Model", "Serial", "RAM"],
    ["1001", "Computer", "Dell", "Latitude 5490", "7HKQ2M3", "8GB"],
    ["1002", "PC", "HP", "EliteBook 840 G5", "5CG8123ABC", "8GB"],
    ["1003", "Computer", "Dell", "OptiPlex 7060", "9JZL5N2", "16GB"],
    ["1004", "PC", "", "", "8XYZ1A2", "8GB"],
    ["1005", "Desktop PC", "HP", "EliteBook 840 G5", "5CG8123ABD", "8GB"],
  ]);
  const typeOf = (index: number) => assets[index].fields.assetType;

  it("takes the type from the model's product line", () => {
    expect(assets.slice(0, 3).map((asset) => asset.fields.assetType?.value)).toEqual(["laptop", "laptop", "desktop"]);
  });

  it("keeps the column text and names both sources, at the confidence of an inference", () => {
    expect(typeOf(1)).toMatchObject({ raw: "PC", source: "inferred" });
    expect(typeOf(1)?.note).toMatch(/^Type column said "PC"; type inferred from "elitebook"$/i);
    expect(typeOf(1)?.confidence).toBeLessThan(1);
  });

  it("leaves the type as 'other', to be checked, when nothing else in the row says more", () => {
    expect(typeOf(3)).toMatchObject({ value: "other", raw: "PC", confidence: 0.5 });
    expect(typeOf(3)?.note).toBeTruthy();
  });

  it("does not overrule a type column that names a real type", () => {
    expect(typeOf(4)).toMatchObject({ value: "desktop", confidence: 1, source: "column" });
  });
});

describe("a value that is doubtful only because of its column", () => {
  const fileName = "no_header.tsv";
  const sheets = readWorkbook(new Uint8Array(readFileSync(`public/samples/${fileName}`)), fileName);
  const { assets } = extractAll(sheets.map((sheet) => planSheet(sheet)));

  it("says that the column was a guess, and on what evidence", () => {
    const serial = assets[0].fields.serialNumber;
    expect(serial?.confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(serial?.note).toBe('Column "Column B" is a guess: 4 of 4 values look like Serial number');
  });

  it("adds nothing to a value from a column we are sure of", () => {
    const sure = extract([
      ["Model", "Serial", "RAM"],
      ["Dell Latitude 5420", "7HKQ2M3", "16GB"],
    ]);
    expect(sure.assets[0].fields.serialNumber?.note).toBeUndefined();
    expect(sure.assets[0].fields.ramGB?.note).toBeUndefined();
  });
});

describe("flagDuplicateSerials", () => {
  const withSerial = (rowNumber: number, serial: string): Asset => ({
    id: `S#${rowNumber}`,
    sheet: "S",
    rowNumber,
    kind: "computer",
    fields: { serialNumber: { value: serial, raw: serial, confidence: 1, source: "column" } },
    warnings: [],
    extras: {},
  });

  it("names the other row when a serial number appears twice", () => {
    const flagged = flagDuplicateSerials([withSerial(2, "ABC1234"), withSerial(3, "abc-1234"), withSerial(4, "ZZZ9999")]);
    expect(flagged.map((asset) => asset.warnings)).toEqual([["Same serial number as S row 3"], ["Same serial number as S row 2"], []]);
  });

  it("lists three other rows at most and counts the rest", () => {
    const flagged = flagDuplicateSerials([2, 3, 4, 5, 6].map((rowNumber) => withSerial(rowNumber, "PENDING1")));
    expect(flagged[0].warnings).toEqual(["Same serial number as S row 3, S row 4, S row 5 and 1 more row"]);
    expect(flagged[4].warnings).toEqual(["Same serial number as S row 2, S row 3, S row 4 and 1 more row"]);
  });

  it("keeps the warnings short when thousands of rows share one serial number", () => {
    const flagged = flagDuplicateSerials(Array.from({ length: 5000 }, (_, index) => withSerial(index + 2, "See label")));
    expect(flagged[0].warnings).toEqual(["Same serial number as S row 3, S row 4, S row 5 and 4996 more rows"]);
    expect(flagged.every((asset) => asset.warnings[0].length < 100)).toBe(true);
  });
});
