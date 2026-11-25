import { describe, expect, it } from "vitest";
import { extractAll, planSheet } from "./pipeline";
import { splitTables } from "./splitTables";
import type { RawSheet } from "./types";

const sheet = (rows: string[][]): RawSheet => {
  const width = Math.max(...rows.map((row) => row.length));
  return { name: "Manifests", hidden: false, rows: rows.map((row) => [...row, ...Array<string>(width - row.length).fill("")]) };
};

/** Three customers in one sheet, each with its own title, column names and column order. */
const STACKED = sheet([
  ["Customer 1 — Northwind"],
  ["S/N", "Make", "Device Cat.", "Model #", "CPU Spec", "Disp. (in)", "Mem.", "HDD/SSD"],
  ["SN-NW-001", "Dell", "Laptop", "Latitude 5520", "Intel Core i5-1135G7", "15.6 in", "16 GB", "512 GB"],
  ["SN-NW-002", "Lenovo", "Notebook", "ThinkPad X1 Carbon Gen 10", "Intel Core i7-1265U", "14", "32 gig", "1 TB"],
  [],
  [],
  ["Customer 2 — Contoso Leasing"],
  ["Asset Identifier", "Serial No.", "Brand", "Full Model Name", "Form Factor", "Processor Description", "Screen Diagonal", "Installed RAM", "Primary Storage Capacity", "Purchase Date"],
  ["CL-2024-0001", "AB12CD34", "HP", "ZBook Fury 16 G9", "Mobile Workstation", "Intel Core i9-12950HX", "16 in", "16384MB", "4TB", "2024-04-02"],
  ["CL-2024-0002", "EF56GH78", "Dell", "OptiPlex 7010", "Tower Desktop", "Intel Core i7-13700", "", "16 GB", "512 GB", "2024-05-01"],
  [],
  ["Customer 3 — Fabrikam"],
  ["tag", "sn", "mfr", "type", "mdl", "proc", "screen", "ram", "drive", "cond"],
  ["FB-7741", "X9W2HKLM", "Dell", "laptop", "XPS 15 9520", "i7-12700H", "15.6", "16", "512gb", "A"],
  ["FB-7742", "PB3FRTQV", "Apple", "macbook", "MacBook Pro 13 M2", "M2", "13.3", "8", "256GB", "A"],
  ["FB-7743", "JMTQ6617", "Microsoft", "2in1", "Surface Pro 8", "i7-1185G7", "13", "16", "500 gig", "B"],
]);

describe("splitTables", () => {
  it("returns a sheet with one table as it is", () => {
    const one = sheet([["Asset register"], [], ["Serial", "Brand", "Model"], ["A1B2C3D4", "Dell", "Latitude 5520"]]);
    expect(splitTables(one)).toEqual([one]);
  });

  it("splits tables stacked in one sheet and names each after its title row", () => {
    const tables = splitTables(STACKED);
    expect(tables.map((table) => table.name)).toEqual([
      "Manifests · Customer 1 — Northwind",
      "Manifests · Customer 2 — Contoso Leasing",
      "Manifests · Customer 3 — Fabrikam",
    ]);
    expect(tables.map((table) => table.rowOffset)).toEqual([0, 6, 11]);
    expect(tables.map((table) => table.rows.length)).toEqual([4, 4, 5]);
  });

  it("splits when only a title row stands between two tables", () => {
    const tables = splitTables(
      sheet([
        ["Serial", "Brand", "Model"],
        ["A1B2C3D4", "Dell", "Latitude 5520"],
        ["Second batch"],
        ["Asset Tag", "Manufacturer", "Model Name", "RAM"],
        ["AT-001", "HP", "EliteBook 840 G9", "16 GB"],
      ]),
    );
    expect(tables.map((table) => [table.name, table.rowOffset])).toEqual([
      ["Manifests · table 1", 0],
      ["Manifests · Second batch", 2],
    ]);
  });

  it("does not split where the same header is repeated", () => {
    const repeated = sheet([
      ["Serial", "Brand", "Model"],
      ["A1B2C3D4", "Dell", "Latitude 5520"],
      [],
      ["Serial", "Brand", "Model"],
      ["E5F6G7H8", "HP", "EliteBook 840 G9"],
    ]);
    expect(splitTables(repeated)).toEqual([repeated]);
  });

  it("does not split at a block of notes under the table", () => {
    const withNotes = sheet([
      ["Serial", "Brand", "Model"],
      ["A1B2C3D4", "Dell", "Latitude 5520"],
      [],
      ["Prepared by", "John Smith"],
      ["Location", "Sydney", "Level 3"],
    ]);
    expect(splitTables(withNotes)).toEqual([withNotes]);
  });

  it("keeps the row numbers of the original sheet", () => {
    const plans = splitTables(STACKED).map((table) => planSheet(table));
    expect(plans.map((plan) => plan.header.reason.slice(0, 7))).toEqual(["Row 2: ", "Row 8: ", "Row 13:"]);
    const { assets } = extractAll(plans);
    expect(assets.map((asset) => asset.rowNumber)).toEqual([3, 4, 9, 10, 14, 15, 16]);
  });
});

describe("three stacked tables, end to end", () => {
  const { assets, skipped } = extractAll(splitTables(STACKED).map((table) => planSheet(table)));
  const row = (rowNumber: number) => {
    const asset = assets.find((item) => item.rowNumber === rowNumber);
    if (!asset) throw new Error(`No asset at row ${rowNumber}`);
    return Object.fromEntries(Object.entries(asset.fields).map(([key, field]) => [key, field.value]));
  };

  it("skips nothing: the title rows are names, not rows that failed", () => {
    expect(skipped).toEqual([]);
  });

  it("reads the first table (S/N, Make, Device Cat., Model #, CPU Spec, Disp. (in), Mem., HDD/SSD)", () => {
    expect(row(3)).toEqual({ serialNumber: "SN-NW-001", manufacturer: "Dell", assetType: "laptop", model: "Latitude 5520", cpu: "Intel Core i5-1135G7", screenInches: 15.6, ramGB: 16, storageGB: 512 });
    expect(row(4)).toMatchObject({ assetType: "laptop", screenInches: 14, ramGB: 32, storageGB: 1000 });
  });

  it("reads the second table: Asset Identifier is the tag, Serial No. the serial", () => {
    expect(row(9)).toEqual({ assetTag: "CL-2024-0001", serialNumber: "AB12CD34", manufacturer: "HP", model: "ZBook Fury 16 G9", assetType: "laptop", cpu: "Intel Core i9-12950HX", screenInches: 16, ramGB: 16, storageGB: 4000, purchaseDate: "2024-04-02" });
    expect(row(10)).toMatchObject({ assetTag: "CL-2024-0002", assetType: "desktop", ramGB: 16, storageGB: 512 });
  });

  it("reads the third table: short names and bare numbers", () => {
    expect(row(14)).toMatchObject({ assetTag: "FB-7741", serialNumber: "X9W2HKLM", manufacturer: "Dell", assetType: "laptop", model: "XPS 15 9520", cpu: "Intel Core i7-12700H", screenInches: 15.6, ramGB: 16, storageGB: 512 });
    expect(row(15)).toMatchObject({ assetType: "laptop", model: "MacBook Pro 13 M2", cpu: "Apple M2", ramGB: 8, storageGB: 256 });
    expect(row(16)).toMatchObject({ assetType: "laptop", model: "Surface Pro 8", ramGB: 16, storageGB: 500 });
  });
});
