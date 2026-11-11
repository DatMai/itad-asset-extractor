// Generates the self-made sample files in public/samples/.
//
// Usage:  pnpm fixtures
//
// The client's two samples are not enough to prove the extractor copes with files it has never
// seen, so these are deliberately unlike them: other languages, other delimiters, no header,
// real date cells, merged cells, hidden sheets. They are generated, not hand-edited, so that
// what each file contains is written down here and can be reviewed.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const outDir = fileURLToPath(new URL("../public/samples/", import.meta.url));
mkdirSync(outDir, { recursive: true });

/** An Excel date cell: the day count since 30 Dec 1899, shown with a date format. */
function dateCell(year, month, day) {
  const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86_400_000);
  return { t: "n", v: days, z: "dd/mm/yyyy" };
}

function saveWorkbook(name, sheets, bookType = "xlsx") {
  const workbook = XLSX.utils.book_new();
  for (const { title, rows, merges } of sheets) {
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    if (merges) sheet["!merges"] = merges.map(XLSX.utils.decode_range);
    XLSX.utils.book_append_sheet(workbook, sheet, title);
  }
  workbook.Workbook = { Sheets: sheets.map(({ hidden }) => ({ Hidden: hidden ? 1 : 0 })) };
  writeFileSync(outDir + name, XLSX.write(workbook, { type: "buffer", bookType }));
  console.log("wrote", name);
}

// 1. Vietnamese and abbreviated headers on row 7, blank rows between assets, a merged title,
//    real date cells, bare numbers under a header that carries the unit, a total row, a sheet
//    with only instructions, and a hidden sheet holding a stale copy of one asset.
saveWorkbook("vn_headers_row7.xlsx", [
  {
    title: "Danh sách",
    merges: ["A1:N1"],
    rows: [
      ["CÔNG TY TNHH ABC - DANH SÁCH TÀI SẢN CNTT"],
      ["Ngày xuất:", "03/09/2026", "", "Người lập:", "Nguyễn Văn A"],
      [],
      ["Ghi chú: máy đánh dấu * cần thay pin"],
      [],
      [],
      ["STT", "Mã TS", "Loại TB", "Hãng SX", "Dòng máy", "Số serial", "Vi xử lý", "Bộ nhớ (GB)", "Ổ cứng", "Màn hình", "Người dùng", "Phòng ban", "Ngày mua", "Ghi chú"],
      [1, "TS-001", "Máy tính xách tay", "Dell", "Latitude 5430", "8KLM2N3", "Intel Core i5-1235U", 16, "256GB SSD", "14 inch", "Trần Thị B", "Kế toán", dateCell(2022, 5, 17), ""],
      [2, "TS-002", "Máy tính xách tay", "Lenovo", "ThinkPad E14 Gen 4", "PF3ZX9Q1", "AMD Ryzen 5 5625U", 8, "512GB SSD", 14, "Lê Văn C", "Kinh doanh", dateCell(2022, 11, 3), "pin yếu *"],
      [],
      [3, "TS-003", "Máy bàn", "HP", "ProDesk 400 G7", "4CE1234XYZ", "i5-10500", 8, "1TB HDD", "", "Lễ tân", "Hành chính", dateCell(2021, 1, 25), ""],
      [4, "TS-004", "Máy chủ", "Dell", "PowerEdge R740", "GTR5X94", "2 x Xeon Silver 4210", 128, "4 x 1.2TB SAS", "", "", "IT", dateCell(2020, 7, 9), "phòng máy chủ"],
      [],
      [5, "TS-005", "Màn hình", "Dell", "P2422H", "CN0XYZ9876", "", "", "", "24 inch", "Lễ tân", "Hành chính", dateCell(2021, 1, 25), ""],
      [6, "TS-006", "Máy trạm", "HP", "Z4 G4", "MXL0123ABC", "Xeon W-2245", 64, "1TB SSD + 2TB HDD", "", "Thiết kế", "Thiết kế", "15/03/2023", ""],
      [],
      ["Tổng cộng", "", "", "", "", "", "", "", "", "", "", "", "", 6],
    ],
  },
  {
    title: "Hướng dẫn",
    rows: [["Hướng dẫn điền biểu mẫu"], ["1. Mỗi dòng là một thiết bị"], ["2. Không xoá dòng tiêu đề"]],
  },
  {
    title: "cũ",
    hidden: true,
    rows: [
      ["Số serial", "Dòng máy"],
      ["8KLM2N3", "Latitude 5430"],
    ],
  },
]);

// 2. Semicolon-separated, UTF-8 BOM, Windows line endings, a title line that contains commas,
//    consonant-only abbreviations as headers, decimal commas, a quoted cell holding a semicolon,
//    day-month-year dates, and a blank line in the middle.
writeFileSync(
  outDir + "semicolon_abbrev.csv",
  "﻿" +
    [
      "Inventory export, generated 2026-10-01, do not edit",
      "",
      "Mfr;Mdl;SN;Proc;Mem;Stor;Scr;Dept;Bought",
      'Dell;Latitude 7420;4ABC123;i7-1185G7;16 GB;512 GB SSD;14,0";Finance;17-05-2022',
      'HP;EliteBook 840 G8;5CG9876ABC;i5-1145G7;8 GB;256 GB SSD;14,0";Sales;03-11-2021',
      'Lenovo;"ThinkPad P1 Gen 4; touch";PF4MNO12;i7-11800H;32 GB;1 TB SSD;15,6";Engineering;21-01-2022',
      'Apple;MacBook Air M2;FVFJK3L4M5N6;Apple M2;8 GB;256 GB SSD;13,6";Design;09-09-2022',
      "",
      "Dell;OptiPlex 7090;9XYZ5N2;i7-10700;16384 MB;1 TB HDD;;Reception;25-01-2021",
    ].join("\r\n") +
    "\r\n",
);
console.log("wrote semicolon_abbrev.csv");

// 3. Tab-separated with no header row at all: columns must be recognised from their values.
writeFileSync(
  outDir + "no_header.tsv",
  [
    ["Dell Latitude 5420", "7HKQ2M3", "i7-1185G7", "16GB", "512GB SSD", '14"', "Sydney"],
    ["HP ProDesk 400 G7", "4CE0471ABC", "i5-10500", "8GB", "1TB HDD", "", "Brisbane"],
    ["Lenovo ThinkSystem SR650", "J30091AB", "Xeon Silver 4314", "128GB", "2x 2TB SSD", "", "Melbourne"],
    ["Apple MacBook Pro 14", "C02FK8ZTMD6R", "Apple M2 Pro", "32GB", "1TB", '14.2"', "Melbourne"],
  ]
    .map((row) => row.join("\t"))
    .join("\n") + "\n",
);
console.log("wrote no_header.tsv");

// 4. One free-text cell per asset, in the old .xls format. Includes the two cells quoted in the
//    brief, two things that are not computers, and a note that is not an asset.
saveWorkbook(
  "one_cell_per_asset.xls",
  [
    {
      title: "Devices",
      rows: [
        ["Devices for collection - March"],
        ["Device"],
        ["Dell Lat 5420 i7 16GB"],
        ["HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in"],
        ["Lenovo ThinkCentre M720q Tiny, i5-9500T, 8GB RAM, 256GB SSD"],
        ["Apple iMac 24in M1 16GB 512GB"],
        ["Dell UltraSharp U2720Q 27in monitor"],
        ["Cisco Catalyst 2960 switch"],
        ["to be collected Friday"],
        ["Dell PowerEdge R740 2x Xeon Gold 6248 384GB RAM 8x 1.2TB SAS"],
      ],
    },
  ],
  "biff8",
);
