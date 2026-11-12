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

  it("cuts a text file that is longer than the limit and says so", () => {
    const lines = Array.from({ length: LIMITS.rows + 100 }, (_, i) => `S${i},x`).join("\n");
    const [read] = readWorkbook(text(lines), "big.csv");
    expect(read.rows).toHaveLength(LIMITS.rows);
    expect(read.rows[LIMITS.rows - 1]).toEqual([`S${LIMITS.rows - 1}`, "x"]);
    expect(read.truncated).toMatch(/first 5,?000 rows/);
  });

  it("does not say a sheet was cut when it has exactly as many rows as the limit", () => {
    const rows = Array.from({ length: LIMITS.rows }, (_, i) => [`S${i}`]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Full");
    const [read] = readWorkbook(toBytes(book), "full.xlsx");
    expect(read.rows).toHaveLength(LIMITS.rows);
    expect(read.truncated).toBeUndefined();
  });

  it("reads every cell even when the sheet declares a smaller size than it has", () => {
    // Some exporters write a wrong <dimension>. The cells are what counts.
    const rows = Array.from({ length: 10 }, (_, i) => [`S${i}`, `Model ${i}`, `Note ${i}`]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), "Stale");
    const bytes = rewriteZipEntry(toBytes(book), "/xl/worksheets/sheet1.xml", (xml) => {
      expect(xml).toContain('<dimension ref="A1:C10"/>');
      return xml.replace('<dimension ref="A1:C10"/>', '<dimension ref="A1:B2"/>');
    });
    const [read] = readWorkbook(bytes, "stale.xlsx");
    expect(read.rows).toHaveLength(10);
    expect(read.rows[9]).toEqual(["S9", "Model 9", "Note 9"]);
    expect(read.truncated).toBeUndefined();
  });
});

/** Change one file inside an .xlsx (which is a zip) and pack it again. */
function rewriteZipEntry(bytes: Uint8Array, path: string, change: (content: string) => string): Uint8Array {
  const zip = XLSX.CFB.read(bytes, { type: "array" });
  const entry = XLSX.CFB.find(zip, path);
  if (!entry) throw new Error(`No ${path} in the workbook`);
  const content = change(new TextDecoder().decode(new Uint8Array(entry.content as ArrayLike<number>)));
  entry.content = new TextEncoder().encode(content) as never;
  entry.size = entry.content.length;
  return new Uint8Array(XLSX.CFB.write(zip, { type: "array", fileType: "zip" }) as ArrayLike<number>);
}

/**
 * Make a zip claim that its first file unpacks to `size` bytes, by overwriting the size field of
 * that file's entry in the central directory (signature PK 01 02, size at offset 24).
 */
function declareUnpackedSize(bytes: Uint8Array, size: number): Uint8Array {
  const copy = bytes.slice();
  const view = new DataView(copy.buffer);
  for (let at = 0; at + 28 <= copy.length; at++) {
    if (view.getUint32(at, true) === 0x02014b50) {
      view.setUint32(at + 24, size, true);
      return copy;
    }
  }
  throw new Error("No central directory entry found");
}

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

  it("a workbook that would unpack to far more than its file size", () => {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Serial"], ["A1B2C3D"]]), "S");
    const honest = toBytes(book);
    expect(readWorkbook(honest, "ok.xlsx")[0].rows).toHaveLength(2);

    const error = failure(declareUnpackedSize(honest, LIMITS.unpackedBytes + 1), "bomb.xlsx");
    expect(error.message).toMatch(/too large once unpacked/);
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
