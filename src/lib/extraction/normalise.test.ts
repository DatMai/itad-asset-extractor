import { describe, expect, it } from "vitest";
import {
  normaliseAssetType,
  normaliseCpu,
  normaliseDate,
  normaliseManufacturer,
  normaliseRam,
  normaliseScreen,
  normaliseSerial,
  normaliseStorage,
  unitFromHeader,
} from "./normalise";

describe("normaliseRam (binary: 1024 MB = 1 GB)", () => {
  it.each([
    ["32768 MB", 32],
    ["16384 MB", 16],
    ["8gb", 8],
    ["16 GB RAM", 16],
    ["16 gig", 16],
    ["16GB", 16],
    ["256 GB", 256],
    ["8G", 8],
    ["1,024 MB", 1],
    ["16 GB (2 x 8 GB) DDR4", 16],
    ["2x8GB", 16],
    ["32,768 MB", 32],
  ])("%j -> %d GB", (raw, expected) => {
    const result = normaliseRam(raw);
    expect(result.value).toBe(expected);
    expect(result.confidence).toBe(1);
  });

  it("assumes a unit for a bare number and says so", () => {
    expect(normaliseRam("16")).toMatchObject({ value: 16, confidence: 0.7 });
    expect(normaliseRam("16384")).toMatchObject({ value: 16, confidence: 0.7 });
    expect(normaliseRam("16").note).toMatch(/assumed/i);
  });

  it("trusts a bare number when the header gives the unit", () => {
    expect(normaliseRam("16", "GB")).toMatchObject({ value: 16, confidence: 1 });
    expect(normaliseRam("8192", "MB")).toMatchObject({ value: 8, confidence: 1 });
  });

  it("returns nothing rather than a guess", () => {
    expect(normaliseRam("N/A")).toMatchObject({ value: null, confidence: 1 });
    expect(normaliseRam("plenty")).toMatchObject({ value: null, confidence: 0 });
  });
});

describe("normaliseStorage (decimal: 1 TB = 1000 GB, raw capacity)", () => {
  it.each([
    ["1 TB HDD", 1000],
    ["1TB", 1000],
    ["2 TB", 2000],
    ["512GB SSD", 512],
    ["256 GB NVMe", 256],
    ["2x 1TB SSD", 2000],
    ["4 x 1.92TB SSD (RAID 5)", 7680],
    ["8x 2.4TB SAS", 19200],
    ["6x 3.84TB SSD", 23040],
    ["2 x 960GB SSD", 1920],
    ["256GB SSD + 1TB HDD", 1256],
    ["500GB HDD 7200rpm", 500],
    ["512GB SSD (476GB usable)", 512],
    ["1,5 TB", 1500],
    ["1,92TB", 1920],
    ["256GB SSD,1TB HDD", 1256],
    ["256GB SSD, 1TB HDD", 1256],
    ["1,024,000 MB", 1024],
  ])("%j -> %d GB", (raw, expected) => {
    const result = normaliseStorage(raw);
    expect(result.value).toBe(expected);
    expect(result.confidence).toBe(1);
  });

  it("assumes a unit for a bare number and says so", () => {
    expect(normaliseStorage("512")).toMatchObject({ value: 512, confidence: 0.7 });
    expect(normaliseStorage("2")).toMatchObject({ value: 2000, confidence: 0.5 });
    expect(normaliseStorage("2", "TB")).toMatchObject({ value: 2000, confidence: 1 });
  });

  it("returns nothing for placeholders and unreadable text", () => {
    expect(normaliseStorage("-").value).toBeNull();
    expect(normaliseStorage("SSD")).toMatchObject({ value: null, confidence: 0 });
  });
});

describe("normaliseScreen", () => {
  it.each([
    ['14"', 14],
    ["14 inch", 14],
    ["14in", 14],
    ["14.2in", 14.2],
    ["15.6 inch", 15.6],
    ['13.5"', 13.5],
    ["24-inch", 24],
    ["15,6", 15.6],
    ['FHD 15.6" IPS', 15.6],
    ["35.6 cm", 14],
  ])("%j -> %d", (raw, expected) => {
    expect(normaliseScreen(raw).value).toBe(expected);
  });

  it("accepts a bare number in a screen column, a little less surely", () => {
    expect(normaliseScreen("14")).toMatchObject({ value: 14, confidence: 0.9 });
  });

  it.each(["N/A", "-", "n/a", ""])("%j -> no screen", (raw) => {
    expect(normaliseScreen(raw)).toMatchObject({ value: null, confidence: 1 });
  });

  it("rejects sizes no screen has", () => {
    expect(normaliseScreen("300")).toMatchObject({ value: null, confidence: 0 });
  });
});

describe("normaliseAssetType", () => {
  it.each([
    ["Laptop", "laptop"],
    ["laptop", "laptop"],
    ["Notebook", "laptop"],
    ["Desktop PC", "desktop"],
    ["Desktop", "desktop"],
    ["Rack Server", "server"],
    ["server", "server"],
    ["Workstation", "workstation"],
    ["Mini PC", "mini-pc"],
    ["Tablet", "tablet"],
    ["NAS", "nas"],
    ["Tower", "desktop"],
    ["MacBook", "laptop"],
    ["Máy tính xách tay", "laptop"],
    ["Máy chủ", "server"],
  ])("%j -> %s", (raw, expected) => {
    expect(normaliseAssetType(raw).value).toBe(expected);
  });

  it("flags things that are not computers", () => {
    expect(normaliseAssetType("Monitor")).toMatchObject({ value: null, nonComputer: "monitor" });
    expect(normaliseAssetType("Display")).toMatchObject({ value: null, nonComputer: "monitor" });
    expect(normaliseAssetType("Keyboard")).toMatchObject({ nonComputer: "keyboard" });
  });

  it("keeps an unknown type as 'other' with low confidence", () => {
    const result = normaliseAssetType("Kiosk");
    expect(result.value).toBe("other");
    expect(result.confidence).toBeLessThan(0.7);
  });
});

describe("normaliseManufacturer", () => {
  it.each([
    ["Dell", "Dell"],
    ["dell inc.", "Dell"],
    ["HEWLETT-PACKARD", "HP"],
    ["Hewlett Packard Enterprise", "HPE"],
    ["LENOVO", "Lenovo"],
    ["Acme Corp", "Acme Corp"],
  ])("%j -> %s", (raw, expected) => {
    expect(normaliseManufacturer(raw).value).toBe(expected);
  });
});

describe("normaliseCpu", () => {
  it.each([
    ["Intel i7-10700", "Intel Core i7-10700"],
    ["Intel Core i7-1185G7", "Intel Core i7-1185G7"],
    ["i5-1245U", "Intel Core i5-1245U"],
    ["i9-12900HK", "Intel Core i9-12900HK"],
    ["Apple M2 Pro", "Apple M2 Pro"],
    ["Apple M1", "Apple M1"],
    ["Intel Xeon W-1350", "Intel Xeon W-1350"],
    ["Xeon Silver 4314", "Intel Xeon Silver 4314"],
    ["2 x Xeon Silver 4210", "2x Intel Xeon Silver 4210"],
    ["2x Intel Xeon Gold 6230", "2x Intel Xeon Gold 6230"],
    ["Xeon E5-2680 v4", "Intel Xeon E5-2680 v4"],
    ["Core Ultra 7 155H", "Intel Core Ultra 7 155H"],
    ["Ryzen V1500B", "AMD Ryzen V1500B"],
    ["AMD Ryzen 5 PRO 5650U with Radeon Graphics", "AMD Ryzen 5 PRO 5650U"],
    ["Intel(R) Core(TM) i7-10700 CPU @ 2.90GHz", "Intel Core i7-10700"],
    ["11th Gen Intel(R) Core(TM) i5-1145G7 @ 2.60GHz", "Intel Core i5-1145G7"],
    ["Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz", "Intel Xeon E5-2680 v4"],
    ["Intel(R) Xeon(R) Gold 6230 CPU @ 2.10GHz", "Intel Xeon Gold 6230"],
    ["Intel Core i7-1185G7 Processor", "Intel Core i7-1185G7"],
    ["Intel Core m3-7Y30", "Intel Core m3-7Y30"],
    ["Core m5-6Y54", "Intel Core m5-6Y54"],
    ["Intel(R) Core(TM) m3-8100Y CPU @ 1.10GHz", "Intel Core m3-8100Y"],
    ["2x E5-2680 v4", "2x Intel Xeon E5-2680 v4"],
    ["M1 Pro", "Apple M1 Pro"],
    ["M2", "Apple M2"], // the whole cell of a CPU column: nothing else it could be
  ])("%j -> %s", (raw, expected) => {
    const result = normaliseCpu(raw);
    expect(result.value).toBe(expected);
    expect(result.confidence).toBe(1);
  });

  it("keeps a family without a model number, flagged for checking", () => {
    expect(normaliseCpu("Core i5 11th gen")).toMatchObject({
      value: "Intel Core i5 11th gen",
      confidence: 0.6,
    });
    expect(normaliseCpu("i7")).toMatchObject({ value: "Intel Core i7", confidence: 0.6 });
    expect(normaliseCpu("11th Gen Intel Core i5")).toMatchObject({ value: "Intel Core i5 11th gen", confidence: 0.6 });
  });

  it("flags a Core m chip that has no model number", () => {
    expect(normaliseCpu("Core m3")).toMatchObject({ value: "Intel Core m3", confidence: 0.6 });
  });

  it("flags a bare M chip that sits among other words, where it may be an M.2 drive", () => {
    const result = normaliseCpu("8GB 256GB M2");
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.note).toMatch(/M\.2 drive/);
    expect(normaliseCpu("M2 2280 NVMe").value).toBe("M2 2280 NVMe"); // not a CPU we know: kept as written
  });

  it("keeps an unknown CPU as written, flagged", () => {
    const result = normaliseCpu("Loongson 3A6000");
    expect(result.value).toBe("Loongson 3A6000");
    expect(result.confidence).toBeLessThan(0.7);
  });
});

describe("normaliseDate (day first, the Australian default)", () => {
  it("keeps ISO dates", () => {
    expect(normaliseDate("2021-08-19")).toMatchObject({ value: "2021-08-19", confidence: 1 });
    expect(normaliseDate("2021-08-19T00:00:00")).toMatchObject({ value: "2021-08-19" });
    expect(normaliseDate("2021/08/19")).toMatchObject({ value: "2021-08-19" });
  });

  it("reads an ambiguous date as day/month and lowers confidence", () => {
    expect(normaliseDate("12/03/2021")).toMatchObject({ value: "2021-03-12", confidence: 0.8 });
    expect(normaliseDate("05/11/2021")).toMatchObject({ value: "2021-11-05", confidence: 0.8 });
    expect(normaliseDate("12-03-21")).toMatchObject({ value: "2021-03-12" });
  });

  it("is sure when only one reading is possible", () => {
    expect(normaliseDate("25/03/2021")).toMatchObject({ value: "2021-03-25", confidence: 1 });
    expect(normaliseDate("03/25/2021")).toMatchObject({ value: "2021-03-25", confidence: 0.7 });
  });

  it("reads month names", () => {
    expect(normaliseDate("12 Mar 2021").value).toBe("2021-03-12");
    expect(normaliseDate("March 12, 2021").value).toBe("2021-03-12");
    expect(normaliseDate("12-Mar-21").value).toBe("2021-03-12");
  });

  it("reads a bare Excel day number, flagged", () => {
    expect(normaliseDate("44267")).toMatchObject({ value: "2021-03-12", confidence: 0.6 });
  });

  it("refuses dates that do not exist", () => {
    expect(normaliseDate("31/02/2021")).toMatchObject({ value: null, confidence: 0 });
    expect(normaliseDate("soon")).toMatchObject({ value: null, confidence: 0 });
    expect(normaliseDate("")).toMatchObject({ value: null, confidence: 1 });
  });
});

describe("normaliseSerial", () => {
  it("trims and keeps the serial as written", () => {
    expect(normaliseSerial("  7HKQ2M3 ")).toMatchObject({ value: "7HKQ2M3", confidence: 1 });
  });

  it("treats placeholders as empty", () => {
    expect(normaliseSerial("N/A").value).toBeNull();
  });

  it("flags a serial that a spreadsheet turned into a rounded number", () => {
    const result = normaliseSerial("1.23457E+11");
    expect(result.confidence).toBeLessThan(0.5);
    expect(result.note).toMatch(/rounded/i);
  });
});

describe("unitFromHeader", () => {
  it("reads the unit a header declares", () => {
    expect(unitFromHeader("RAM (GB)")).toBe("GB");
    expect(unitFromHeader("Memory MB")).toBe("MB");
    expect(unitFromHeader("Storage (TB)")).toBe("TB");
    expect(unitFromHeader("Memory")).toBeUndefined();
  });
});
