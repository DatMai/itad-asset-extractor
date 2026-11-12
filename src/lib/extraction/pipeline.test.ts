/**
 * The whole pipeline on real files: the client's two samples and the self-made fixtures.
 * These tests are the acceptance criteria of the spec (docs/superpowers/specs) (AC1–AC4, AC7) in executable form.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractAll, extractSheet, planSheet } from "./pipeline";
import { readWorkbook } from "./readWorkbook";
import { LOW_CONFIDENCE, type Asset, type FieldKey } from "./types";

function run(fileName: string) {
  const sheets = readWorkbook(new Uint8Array(readFileSync(`public/samples/${fileName}`)), fileName);
  const plans = sheets.map((sheet) => planSheet(sheet));
  return { plans, ...extractAll(plans) };
}

/** The clean values of an asset, without confidence and notes. */
const values = (asset: Asset) =>
  Object.fromEntries(Object.entries(asset.fields).map(([key, field]) => [key, field.value]));

const at = (assets: Asset[], sheet: string, rowNumber: number) => {
  const asset = assets.find((item) => item.sheet === sheet && item.rowNumber === rowNumber);
  if (!asset) throw new Error(`No asset at ${sheet} row ${rowNumber}`);
  return asset;
};

describe("sample_assets_1.xlsx", () => {
  const { plans, assets, skipped } = run("sample_assets_1.xlsx");

  it("AC1: finds the header on row 4 of Assets and extracts exactly 15 assets", () => {
    expect(plans[0].header.rowIndex).toBe(3);
    expect(assets.filter((asset) => asset.sheet === "Assets")).toHaveLength(15);
  });

  it("AC1: skips the TOTAL row and says why", () => {
    expect(skipped).toEqual([
      { sheet: "Assets", rowNumber: 21, reason: "Summary row, not an asset", preview: "TOTAL · 15" },
    ]);
  });

  it("AC2: finds the header on row 3 of Sheet1 (2) and extracts 4 more assets, 19 in total", () => {
    expect(plans[1].header.rowIndex).toBe(2);
    expect(assets.filter((asset) => asset.sheet === "Sheet1 (2)")).toHaveLength(4);
    expect(assets).toHaveLength(19);
    expect(assets.every((asset) => asset.kind === "computer")).toBe(true);
  });

  it("normalises a desktop row exactly as the spec example", () => {
    const desktop = at(assets, "Assets", 9);
    expect(values(desktop)).toEqual({
      assetType: "desktop",
      manufacturer: "Dell",
      model: "OptiPlex 7090",
      serialNumber: "9JZL5N2",
      cpu: "Intel Core i7-10700",
      ramGB: 32,
      storageGB: 1000,
      screenInches: null,
      assignedTo: "Reception",
      location: "Sydney",
    });
    // The original text is never thrown away.
    expect(desktop.fields.ramGB?.raw).toBe("32768 MB");
    expect(desktop.fields.storageGB?.raw).toBe("1 TB HDD");
    expect(desktop.fields.cpu?.raw).toBe("Intel i7-10700");
    expect(desktop.fields.screenInches?.raw).toBe("N/A");
  });

  it("normalises the other rows called out in the spec", () => {
    expect(values(at(assets, "Assets", 7))).toMatchObject({ assetType: "laptop", ramGB: 32, storageGB: 1000, screenInches: 14.2 });
    expect(values(at(assets, "Assets", 13))).toMatchObject({ assetType: "server", cpu: "2x Intel Xeon Gold 6230", ramGB: 384, storageGB: 19200 });
    expect(values(at(assets, "Assets", 11))).toMatchObject({ assetType: "workstation", storageGB: 2000, screenInches: null });
    expect(values(at(assets, "Assets", 12))).toMatchObject({ cpu: "2x Intel Xeon Silver 4210", storageGB: 7680 });
    expect(values(at(assets, "Assets", 17))).toMatchObject({ assetType: "mini-pc", manufacturer: "Intel", model: "NUC 11 Pro" });
    expect(values(at(assets, "Assets", 19))).toMatchObject({ assetType: "desktop", model: "iMac 24-inch", screenInches: 24 });
  });

  it("leaves an empty cell empty instead of inventing a value", () => {
    const server = at(assets, "Assets", 13);
    expect(server.fields.screenInches).toBeUndefined();
    expect(server.fields.assignedTo).toBeUndefined();
  });

  it("flags the one CPU that has no model number", () => {
    const cpu = at(assets, "Assets", 8).fields.cpu;
    expect(cpu).toMatchObject({ value: "Intel Core i5 11th gen", raw: "Core i5 11th gen" });
    expect(cpu?.confidence).toBeLessThan(LOW_CONFIDENCE);
  });

  it("AC2: splits the 'CPU / RAM / Disk' column and reads the 'Equipment' description", () => {
    const laptop = at(assets, "Sheet1 (2)", 4);
    expect(values(laptop)).toEqual({
      serialNumber: "8RTQ3L2",
      manufacturer: "Dell",
      model: "Latitude 7400",
      assetType: "laptop",
      cpu: "Intel Core i5-8365U",
      ramGB: 8,
      storageGB: 256,
      screenInches: 14,
    });
    expect(laptop.fields.cpu).toMatchObject({ source: "parsed", raw: "i5-8365U" });

    expect(values(at(assets, "Sheet1 (2)", 5))).toMatchObject({ manufacturer: "Lenovo", model: "ThinkCentre M720q", assetType: "desktop", ramGB: 16, storageGB: 512 });
    expect(values(at(assets, "Sheet1 (2)", 6))).toMatchObject({ manufacturer: "HP", model: "Z2 G5 Tower", assetType: "workstation", cpu: "Intel Xeon W-1270", storageGB: 1000 });
    expect(values(at(assets, "Sheet1 (2)", 7))).toMatchObject({ assetType: "server", cpu: "Intel Xeon E-2224", ramGB: 32, storageGB: 8000 });
    // "desktop" is not written in the cell: it follows from "ThinkCentre", and is marked so.
    expect(at(assets, "Sheet1 (2)", 5).fields.assetType?.source).toBe("inferred");
  });
});

describe("sample_assets_2.csv", () => {
  const { plans, assets, skipped } = run("sample_assets_2.csv");
  const tagged = (tag: string) => {
    const asset = assets.find((item) => item.fields.assetTag?.value === tag);
    if (!asset) throw new Error(`No asset ${tag}`);
    return asset;
  };

  it("reads all 16 rows under a header on row 1", () => {
    expect(plans[0].header.rowIndex).toBe(0);
    expect(assets).toHaveLength(16);
    expect(skipped).toEqual([]);
  });

  it("AC3: gets at least 4 fields exactly right for every one of the 14 computers", () => {
    // tag -> [manufacturer, model, cpu, ramGB, storageGB, screenInches]
    const expected: Record<string, [string, string, string, number, number, number | undefined]> = {
      "IT-0001": ["HP", "EliteBook 850 G7", "Intel Core i7-10610U", 16, 512, 15.6],
      "IT-0002": ["Lenovo", "ThinkPad X1 Carbon Gen 9", "Intel Core i7-1165G7", 16, 1000, 14],
      "IT-0003": ["Apple", "MacBook Pro", "Apple M1 Max", 64, 2000, 16],
      "IT-0004": ["Dell", "OptiPlex 3080 Micro", "Intel Core i5-10500T", 8, 256, undefined],
      "IT-0006": ["Dell", "Precision 3660 Tower", "Intel Core i9-12900K", 64, 2000, undefined],
      "IT-0007": ["ASUS", "ExpertBook B9", "Intel Core i7-1255U", 32, 1000, 14],
      "IT-0008": ["Dell", "PowerEdge R650", "2x Intel Xeon Gold 5318Y", 512, 23040, undefined],
      "IT-0009": ["HPE", "ProLiant DL360 Gen10 Plus", "2x Intel Xeon Silver 4310", 128, 1920, undefined],
      "IT-0010": ["Microsoft", "Surface Pro 9", "Intel Core i5", 8, 256, 13],
      "IT-0012": ["Acer", "Veriton X2680G", "Intel Core i3-10105", 8, 1000, undefined],
      "IT-0013": ["Lenovo", "ThinkPad E14 Gen 4", "AMD Ryzen 5 5625U", 16, 512, 14],
      "IT-0014": ["Synology", "RS1221+", "AMD Ryzen V1500B", 4, 64000, undefined],
      "IT-0015": ["Apple", "Mac mini", "Apple M2 Pro", 32, 1000, undefined],
      "IT-0016": ["Dell", "Latitude 3420", "Intel Core i5-1135G7", 8, 256, 14],
    };
    const keys: FieldKey[] = ["manufacturer", "model", "cpu", "ramGB", "storageGB", "screenInches"];

    const computers = assets.filter((asset) => asset.kind === "computer");
    expect(computers).toHaveLength(14);
    for (const [tag, want] of Object.entries(expected)) {
      const got = keys.map((key) => tagged(tag).fields[key]?.value);
      expect(got, tag).toEqual(want); // all six, not just four
    }
  });

  it("AC4: marks the monitor and the keyboard as not computers", () => {
    expect(assets.filter((asset) => asset.kind === "not-a-computer").map((asset) => [asset.fields.assetTag?.value, asset.kindReason])).toEqual([
      ["IT-0005", "monitor"],
      ["IT-0011", "keyboard"],
    ]);
  });

  it("AC4: types the Synology unit as a NAS", () => {
    expect(tagged("IT-0014").fields.assetType?.value).toBe("nas");
  });

  it("infers types from product lines", () => {
    const types = Object.fromEntries(assets.map((asset) => [asset.fields.assetTag?.value, asset.fields.assetType?.value]));
    expect(types).toMatchObject({
      "IT-0001": "laptop",
      "IT-0004": "desktop",
      "IT-0006": "workstation",
      "IT-0008": "server",
      "IT-0010": "tablet",
      "IT-0015": "mini-pc",
    });
  });

  it("reads both date formats, day first, and flags the ambiguous one", () => {
    expect(tagged("IT-0001").fields.purchaseDate).toMatchObject({ value: "2021-03-12", raw: "12/03/2021", confidence: 0.8 });
    expect(tagged("IT-0002").fields.purchaseDate).toMatchObject({ value: "2021-08-19", confidence: 1 });
    expect(tagged("IT-0003").fields.purchaseDate?.value).toBe("2021-11-05");
  });

  it("keeps the bonus fields", () => {
    expect(values(tagged("IT-0002"))).toMatchObject({ serialNumber: "PF2ABCD9", costCentre: "EXEC", notes: "CEO" });
  });

  it("warns about a computer without a serial number, but not about a keyboard", () => {
    expect(tagged("IT-0011").warnings).toEqual([]);
    expect(assets.filter((asset) => asset.warnings.length > 0)).toEqual([]);
  });
});

describe("AC7: files unlike the samples", () => {
  it("Vietnamese headers on row 7, blank rows, date cells, a total row", () => {
    const { plans, assets, skipped } = run("vn_headers_row7.xlsx");
    expect(plans.map((plan) => [plan.sheet.name, plan.header.rowIndex])).toEqual([
      ["Danh sách", 6],
      ["Hướng dẫn", null],
      ["cũ", 0],
    ]);

    const list = assets.filter((asset) => asset.sheet === "Danh sách");
    expect(list.filter((asset) => asset.kind === "computer").map((asset) => asset.fields.assetType?.value)).toEqual([
      "laptop", "laptop", "desktop", "server", "workstation",
    ]);
    expect(list.find((asset) => asset.kind === "not-a-computer")?.kindReason).toBe("monitor");

    expect(values(at(assets, "Danh sách", 8))).toEqual({
      assetTag: "TS-001",
      assetType: "laptop",
      manufacturer: "Dell",
      model: "Latitude 5430",
      serialNumber: "8KLM2N3",
      cpu: "Intel Core i5-1235U",
      ramGB: 16,
      storageGB: 256,
      screenInches: 14,
      assignedTo: "Trần Thị B",
      costCentre: "Kế toán",
      purchaseDate: "2022-05-17",
    });
    // "16" has no unit, but the header says "(GB)", so there is nothing to doubt.
    expect(at(assets, "Danh sách", 8).fields.ramGB?.confidence).toBe(1);
    expect(values(at(assets, "Danh sách", 15))).toMatchObject({ storageGB: 3000, purchaseDate: "2023-03-15" });
    expect(at(assets, "Danh sách", 8).extras).toEqual({ STT: "1" });

    expect(skipped.find((row) => row.sheet === "Danh sách")).toMatchObject({ rowNumber: 17, reason: "Summary row, not an asset" });
    expect(assets.filter((asset) => asset.sheet === "Hướng dẫn")).toEqual([]);
  });

  it("flags a serial number that appears twice, across sheets", () => {
    const { plans, assets } = run("vn_headers_row7.xlsx");
    expect(plans[2].sheet.hidden).toBe(true);
    expect(at(assets, "Danh sách", 8).warnings).toEqual(["Same serial number as cũ row 2"]);
    expect(at(assets, "cũ", 2).warnings).toEqual(["Same serial number as Danh sách row 8"]);
  });

  it("a semicolon CSV with abbreviated headers, decimal commas and a title line", () => {
    const { plans, assets } = run("semicolon_abbrev.csv");
    expect(plans[0].header.rowIndex).toBe(2);
    expect(Object.fromEntries(plans[0].columns.map((column) => [column.header, column.target]))).toEqual({
      Mfr: "manufacturer",
      Mdl: "model",
      SN: "serialNumber",
      Proc: "cpu",
      Mem: "ramGB",
      Stor: "storageGB",
      Scr: "screenInches",
      Dept: "costCentre",
      Bought: "purchaseDate",
    });
    expect(assets).toHaveLength(5);
    expect(assets.map((asset) => asset.fields.screenInches?.value)).toEqual([14, 14, 15.6, 13.6, undefined]);
    expect(assets.map((asset) => asset.fields.ramGB?.value)).toEqual([16, 8, 32, 8, 16]);
    expect(assets.map((asset) => asset.fields.purchaseDate?.value)).toEqual(["2022-05-17", "2021-11-03", "2022-01-21", "2022-09-09", "2021-01-25"]);
    expect(assets[2].fields.model?.value).toBe("ThinkPad P1 Gen 4; touch");
    // No type column: the type follows from the model line.
    expect(assets.map((asset) => asset.fields.assetType?.value)).toEqual(["laptop", "laptop", "laptop", "laptop", "desktop"]);
  });

  it("a file with no header row", () => {
    const { plans, assets } = run("no_header.tsv");
    expect(plans[0].header.rowIndex).toBeNull();
    expect(plans[0].columns.map((column) => column.target)).toEqual(["combined", "serialNumber", "cpu", "ramGB", "storageGB", "screenInches", "ignore"]);
    expect(assets.map(values)).toEqual([
      { manufacturer: "Dell", model: "Latitude 5420", assetType: "laptop", serialNumber: "7HKQ2M3", cpu: "Intel Core i7-1185G7", ramGB: 16, storageGB: 512, screenInches: 14 },
      { manufacturer: "HP", model: "ProDesk 400 G7", assetType: "desktop", serialNumber: "4CE0471ABC", cpu: "Intel Core i5-10500", ramGB: 8, storageGB: 1000 },
      { manufacturer: "Lenovo", model: "ThinkSystem SR650", assetType: "server", serialNumber: "J30091AB", cpu: "Intel Xeon Silver 4314", ramGB: 128, storageGB: 4000 },
      { manufacturer: "Apple", model: "MacBook Pro 14", assetType: "laptop", serialNumber: "C02FK8ZTMD6R", cpu: "Apple M2 Pro", ramGB: 32, storageGB: 1000, screenInches: 14.2 },
    ]);
    expect(assets[0].extras).toEqual({ "Column G": "Sydney" });
    // Nothing in the file says which column is the serial number, so every one is flagged.
    expect(assets.every((asset) => (asset.fields.serialNumber?.confidence ?? 1) < LOW_CONFIDENCE)).toBe(true);
  });

  it("one free-text cell per asset, in an .xls file", () => {
    const { plans, assets, skipped } = run("one_cell_per_asset.xls");
    expect(plans[0].header.rowIndex).toBe(1);
    expect(assets.map((asset) => [asset.kind, asset.kindReason ?? asset.fields.model?.value])).toEqual([
      ["computer", "Latitude 5420"],
      ["computer", "EliteBook 840 G8"],
      ["computer", "ThinkCentre M720q Tiny"],
      ["computer", "iMac"],
      ["not-a-computer", "monitor"],
      ["not-a-computer", "network device"],
      ["computer", "PowerEdge R740"],
    ]);
    expect(values(assets[6])).toEqual({ manufacturer: "Dell", model: "PowerEdge R740", assetType: "server", cpu: "2x Intel Xeon Gold 6248", ramGB: 384, storageGB: 9600 });
    expect(skipped).toEqual([{ sheet: "Devices", rowNumber: 9, reason: "No asset details recognised in this row", preview: "to be collected Friday" }]);
  });
});

describe("fixing the plan by hand", () => {
  const [sheet] = readWorkbook(new Uint8Array(readFileSync("public/samples/sample_assets_1.xlsx")), "sample_assets_1.xlsx");

  it("re-extracts with a column mapped differently", () => {
    const plan = planSheet(sheet);
    const columns = plan.columns.map((column) => (column.header === "Assigned To" ? { ...column, target: "ignore" as const } : column));
    const { assets } = extractSheet({ ...plan, columns });
    expect(assets[0].fields.assignedTo).toBeUndefined();
    expect(assets[0].extras).toEqual({ "Assigned To": "Sarah Lee" });
  });

  it("re-plans with a header row chosen by the user", () => {
    const wrong = planSheet(sheet, 0); // the title row
    expect(wrong.header).toMatchObject({ rowIndex: 0, confidence: 1 });
    expect(wrong.columns.every((column) => column.header !== "Device Type")).toBe(true);

    const none = planSheet(sheet, null);
    expect(none.header.rowIndex).toBeNull();
    expect(none.columns[0].header).toBe("Column A");
  });

  it("skips a header row that is repeated inside the data", () => {
    const repeated = { ...sheet, rows: [...sheet.rows.slice(0, 6), sheet.rows[3], ...sheet.rows.slice(6)] };
    const { assets, skipped } = extractSheet(planSheet(repeated));
    expect(assets).toHaveLength(15);
    expect(skipped.map((row) => row.reason)).toContain("Repeats the header row");
  });
});

describe("a Model column that holds more than the model", () => {
  const sheet = {
    name: "S",
    hidden: false,
    rows: [
      ["Model", "S/N"],
      ["Dell Lat 5420 i7 16GB", "7HKQ2M3"],
      ["iMac 24-inch", "C02DW1ABQ6X4"],
    ],
  };
  const { assets } = extractSheet(planSheet(sheet));

  it("pulls the brand and the specs out of the cell quoted in the brief", () => {
    expect(values(assets[0])).toEqual({
      model: "Latitude 5420",
      serialNumber: "7HKQ2M3",
      manufacturer: "Dell",
      assetType: "laptop",
      cpu: "Intel Core i7",
      ramGB: 16,
    });
    expect(assets[0].fields.model?.raw).toBe("Lat 5420");
  });

  it("leaves a clean model cell exactly as written, and still learns from it", () => {
    expect(values(assets[1])).toEqual({
      model: "iMac 24-inch",
      serialNumber: "C02DW1ABQ6X4",
      manufacturer: "Apple",
      assetType: "desktop",
      screenInches: 24,
    });
    expect(assets[1].fields.manufacturer?.source).toBe("inferred");
  });
});

describe("a quantity column", () => {
  it("warns when one row stands for several devices", () => {
    const sheet = {
      name: "S",
      hidden: false,
      rows: [
        ["Model", "Qty", "RAM"],
        ["Dell Latitude 5420", "12", "16GB"],
        ["HP ProDesk 400 G7", "1", "8GB"],
        ["Lenovo ThinkPad T14", "", "16GB"],
      ],
    };
    const { assets } = extractSheet(planSheet(sheet));
    expect(assets.map((asset) => asset.warnings)).toEqual([["This row stands for 12 devices"], [], []]);
  });
});

describe("AC6: a doubtful value explains itself", () => {
  const files = ["sample_assets_1.xlsx", "sample_assets_2.csv", "vn_headers_row7.xlsx", "semicolon_abbrev.csv", "no_header.tsv", "one_cell_per_asset.xls"];

  it.each(files)("%s: every value below the 'check' threshold carries a note", (fileName) => {
    const { assets } = run(fileName);
    const silent = assets.flatMap((asset) =>
      Object.entries(asset.fields)
        .filter(([, field]) => field.confidence < LOW_CONFIDENCE && !field.note)
        .map(([key, field]) => `${asset.id} ${key} ${field.raw} @${field.confidence}`),
    );
    expect(silent).toEqual([]);
  });
});
