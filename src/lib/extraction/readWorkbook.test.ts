import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { LIMITS, readWorkbook, UnreadableFileError } from "./readWorkbook";

const sample = (name: string) => new Uint8Array(readFileSync(`public/samples/${name}`));
const text = (content: string) => new TextEncoder().encode(content);
const toBytes = (book: XLSX.WorkBook) => new Uint8Array(XLSX.write(book, { type: "array", bookType: "xlsx" }));

describe("readWorkbook: the client's samples", () => {
  it("reads both sheets of sample 1 with spreadsheet row numbers intact", () => {
    const sheets = readWorkbook(sample("sample_assets_1.xlsx"), "sample_assets_1.xlsx");
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Assets", "Sheet1 (2)"]);

    const [assets, old] = sheets;
    expect(assets.rows).toHaveLength(21); // rows 1–21, the blank rows 3 and 20 included
    expect(assets.rows[0][0]).toBe("Acme Logistics Pty Ltd - IT Asset Register");
    expect(assets.rows[2].every((cell) => cell === "")).toBe(true);
    expect(assets.rows[3].slice(0, 4)).toEqual(["Device Type", "Make", "Model Name", "S/N"]);
    expect(assets.rows[20][0]).toBe("TOTAL");
    expect(old.rows[2]).toEqual(["Serial", "Equipment", "CPU / RAM / Disk", "Screen"]);
    expect(assets.hidden).toBe(false);
  });

  it("reads sample 2 as text, so dates and quoted commas survive", () => {
    const [sheet] = readWorkbook(sample("sample_assets_2.csv"), "sample_assets_2.csv");
    expect(sheet.name).toBe("sample_assets_2.csv");
    expect(sheet.rows).toHaveLength(17);
    expect(sheet.rows[1][4]).toBe("12/03/2021"); // not turned into a date the American way
    expect(sheet.rows[2][1]).toBe("Lenovo ThinkPad X1 Carbon Gen 9, Core i7-1165G7, 16 GB RAM, 1TB SSD, 14 inch");
    expect(sheet.rows[7][1]).toBe('ASUS ExpertBook B9 i7-1255U/32GB/1TB 14"');
  });
});

describe("readWorkbook: text files", () => {
  it("finds the delimiter even when a title line uses another one", () => {
    const [sheet] = readWorkbook(sample("semicolon_abbrev.csv"), "semicolon_abbrev.csv");
    expect(sheet.rows[0]).toEqual(["Inventory export, generated 2026-10-01, do not edit", "", "", "", "", "", "", "", ""]);
    expect(sheet.rows[2]).toEqual(["Mfr", "Mdl", "SN", "Proc", "Mem", "Stor", "Scr", "Dept", "Bought"]);
    expect(sheet.rows[5][1]).toBe("ThinkPad P1 Gen 4; touch"); // a quoted cell holding the delimiter
    expect(sheet.rows[3][6]).toBe('14,0"');
  });

  it("reads tab- and pipe-separated files", () => {
    expect(readWorkbook(sample("no_header.tsv"), "no_header.tsv")[0].rows[0]).toHaveLength(7);
    expect(readWorkbook(text("a|b|c\n1|2|3\n"), "x.txt")[0].rows).toEqual([["a", "b", "c"], ["1", "2", "3"]]);
  });

  it("keeps identifiers exactly as written", () => {
    const [sheet] = readWorkbook(text("Serial,Tag\n0012345,1E5\n123456789012345678,00-1\n"), "ids.csv");
    expect(sheet.rows[1]).toEqual(["0012345", "1E5"]);
    expect(sheet.rows[2]).toEqual(["123456789012345678", "00-1"]);
  });

  it("decodes UTF-8 with a BOM, UTF-16 and old Windows files", () => {
    expect(readWorkbook(text("﻿Số sê-ri,Hãng\nA1B2C3,Dell\n"), "vn.csv")[0].rows[0]).toEqual(["Số sê-ri", "Hãng"]);

    const utf16 = new Uint8Array([0xff, 0xfe, ...[..."Serial,Café\nA1,x\n"].flatMap((char) => [char.charCodeAt(0) & 0xff, char.charCodeAt(0) >> 8])]);
    expect(readWorkbook(utf16, "utf16.csv")[0].rows[0]).toEqual(["Serial", "Café"]);

    const windows1252 = new Uint8Array([...text("Serial,Caf"), 0xe9, ...text("\nA1,x\n")]); // é as one byte
    expect(readWorkbook(windows1252, "old.csv")[0].rows[0]).toEqual(["Serial", "Café"]);
  });
});

describe("readWorkbook: workbooks", () => {
  const vietnamese = () => readWorkbook(sample("vn_headers_row7.xlsx"), "vn_headers_row7.xlsx");

  it("turns date cells into ISO dates without involving a time zone", () => {
    const [sheet] = vietnamese();
    expect(sheet.rows[7][12]).toBe("2022-05-17");
    expect(sheet.rows[8][12]).toBe("2022-11-03");
    expect(sheet.rows[14][12]).toBe("15/03/2023"); // typed as text: left for the date normaliser
  });

  it("reads numbers as plain digits", () => {
    const [sheet] = vietnamese();
    expect(sheet.rows[7][7]).toBe("16");
    expect(sheet.rows[7][0]).toBe("1");
  });

  it("reports hidden sheets and drops nothing silently", () => {
    const sheets = vietnamese();
    expect(sheets.map((sheet) => [sheet.name, sheet.hidden])).toEqual([
      ["Danh sách", false],
      ["Hướng dẫn", false],
      ["cũ", true],
    ]);
  });

  it("copies a vertically merged cell into the rows it covers", () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Location", "Serial"],
      ["Sydney", "A1B2C3D"],
      ["", "E4F5G6H"],
      ["Perth", "J7K8L9M"],
    ]);
    sheet["!merges"] = [XLSX.utils.decode_range("A2:A3")];
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "S");
    const [read] = readWorkbook(toBytes(book), "merged.xlsx");
    expect(read.rows.map((row) => row[0])).toEqual(["Location", "Sydney", "Sydney", "Perth"]);
  });

  it("reads the old .xls format", () => {
    const [sheet] = readWorkbook(sample("one_cell_per_asset.xls"), "one_cell_per_asset.xls");
    expect(sheet.rows[1]).toEqual(["Device"]);
    expect(sheet.rows[2]).toEqual(["Dell Lat 5420 i7 16GB"]);
  });

  it("cuts a sheet that is larger than the limits and says so", () => {
    const rows = Array.from({ length: LIMITS.rows + 100 }, (_, i) => [`S${i}`]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Big");
    const [read] = readWorkbook(toBytes(book), "big.xlsx");
    expect(read.rows).toHaveLength(LIMITS.rows);
    expect(read.truncated).toMatch(/first 5,?000 rows/);
  });
});

describe("readWorkbook: files it must refuse, each with its own message", () => {
  const failure = (bytes: Uint8Array, name: string) => {
    try {
      readWorkbook(bytes, name);
    } catch (error) {
      if (error instanceof UnreadableFileError) return error;
      throw error;
    }
    throw new Error("Expected readWorkbook to fail");
  };

  it("an empty file", () => {
    expect(failure(new Uint8Array(), "empty.csv").message).toMatch(/empty/);
    expect(failure(text("\n\n  \n"), "blank.csv").message).toMatch(/no data/);
  });

  it("a file that is not a spreadsheet", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
    expect(failure(png, "photo.xlsx").message).toMatch(/not a spreadsheet/);
    expect(failure(text("%PDF-1.7\n1 0 obj\n"), "report.csv").message).toMatch(/not a spreadsheet/);
  });

  it("a file over the size limit", () => {
    const error = failure(new Uint8Array(LIMITS.fileBytes + 1), "huge.csv");
    expect(error.message).toMatch(/larger than 5 MB/);
    expect(error.hint).not.toBe("");
  });

  it("a corrupt workbook", () => {
    const zipHeaderOnly = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new Array(26).fill(0)]);
    expect(failure(zipHeaderOnly, "broken.xlsx").message).toMatch(/could not be read/);
    const oldExcelHeaderOnly = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(failure(oldExcelHeaderOnly, "broken.xls").message).toMatch(/could not be read/);
  });

  it("an encrypted workbook", () => {
    // A zip header whose flags say the content is encrypted. (A real password-protected .xlsx
    // is reported by SheetJS in the same words; we have no such file to test with.)
    const encryptedZip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);
    const error = failure(encryptedZip, "secret.xlsx");
    expect(error.message).toMatch(/password-protected/);
    expect(error.hint).toMatch(/Remove the password/);
  });
});
