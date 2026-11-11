import { describe, expect, it } from "vitest";
import { parseFreeText, type ParsedText } from "./parseFreeText";

/** The plain values of a parse result, without confidence and notes, for compact comparison. */
function values(parsed: ParsedText) {
  return {
    manufacturer: parsed.manufacturer?.value,
    model: parsed.model?.value,
    assetType: parsed.assetType?.value,
    cpu: parsed.cpu?.value,
    ramGB: parsed.ramGB?.value,
    storageGB: parsed.storageGB?.value,
    screenInches: parsed.screenInches?.value,
    nonComputer: parsed.nonComputer,
  };
}

const nothing = {
  manufacturer: undefined,
  model: undefined,
  assetType: undefined,
  cpu: undefined,
  ramGB: undefined,
  storageGB: undefined,
  screenInches: undefined,
  nonComputer: undefined,
};

describe("parseFreeText: every description in sample_assets_2.csv", () => {
  it.each([
    [
      "HP EliteBook 850 G7 - i7-10610U / 16GB / 512GB SSD / 15.6in",
      { manufacturer: "HP", model: "EliteBook 850 G7", assetType: "laptop", cpu: "Intel Core i7-10610U", ramGB: 16, storageGB: 512, screenInches: 15.6 },
    ],
    [
      "Lenovo ThinkPad X1 Carbon Gen 9, Core i7-1165G7, 16 GB RAM, 1TB SSD, 14 inch",
      { manufacturer: "Lenovo", model: "ThinkPad X1 Carbon Gen 9", assetType: "laptop", cpu: "Intel Core i7-1165G7", ramGB: 16, storageGB: 1000, screenInches: 14 },
    ],
    [
      "Apple MacBook Pro 16in M1 Max 64GB 2TB",
      { manufacturer: "Apple", model: "MacBook Pro", assetType: "laptop", cpu: "Apple M1 Max", ramGB: 64, storageGB: 2000, screenInches: 16 },
    ],
    [
      "Dell OptiPlex 3080 Micro i5-10500T 8GB 256GB",
      { manufacturer: "Dell", model: "OptiPlex 3080 Micro", assetType: "desktop", cpu: "Intel Core i5-10500T", ramGB: 8, storageGB: 256 },
    ],
    [
      "Dell P2422H 24in Monitor",
      { manufacturer: "Dell", model: "P2422H", screenInches: 24, nonComputer: "monitor" },
    ],
    [
      "Dell Precision 3660 Tower | i9-12900K | 64GB | 2TB NVMe",
      { manufacturer: "Dell", model: "Precision 3660 Tower", assetType: "workstation", cpu: "Intel Core i9-12900K", ramGB: 64, storageGB: 2000 },
    ],
    [
      'ASUS ExpertBook B9 i7-1255U/32GB/1TB 14"',
      { manufacturer: "ASUS", model: "ExpertBook B9", assetType: "laptop", cpu: "Intel Core i7-1255U", ramGB: 32, storageGB: 1000, screenInches: 14 },
    ],
    [
      "Dell PowerEdge R650 (2x Xeon Gold 5318Y, 512GB, 6x 3.84TB SSD)",
      { manufacturer: "Dell", model: "PowerEdge R650", assetType: "server", cpu: "2x Intel Xeon Gold 5318Y", ramGB: 512, storageGB: 23040 },
    ],
    [
      "HPE ProLiant DL360 Gen10 Plus - 2 x Xeon Silver 4310 - 128 GB - 2 x 960GB SSD",
      { manufacturer: "HPE", model: "ProLiant DL360 Gen10 Plus", assetType: "server", cpu: "2x Intel Xeon Silver 4310", ramGB: 128, storageGB: 1920 },
    ],
    [
      "Microsoft Surface Pro 9 i5 8GB 256GB 13in",
      { manufacturer: "Microsoft", model: "Surface Pro 9", assetType: "tablet", cpu: "Intel Core i5", ramGB: 8, storageGB: 256, screenInches: 13 },
    ],
    ["Logitech MX Keys keyboard", { manufacturer: "Logitech", model: "MX Keys", nonComputer: "keyboard" }],
    [
      "Acer Veriton X2680G i3-10105 8 GB 1 TB HDD",
      { manufacturer: "Acer", model: "Veriton X2680G", assetType: "desktop", cpu: "Intel Core i3-10105", ramGB: 8, storageGB: 1000 },
    ],
    [
      'Lenovo ThinkPad E14 Gen 4 AMD Ryzen 5 5625U 16GB 512GB 14"',
      { manufacturer: "Lenovo", model: "ThinkPad E14 Gen 4", assetType: "laptop", cpu: "AMD Ryzen 5 5625U", ramGB: 16, storageGB: 512, screenInches: 14 },
    ],
    [
      "Synology RS1221+ NAS (Ryzen V1500B, 4GB, 8x 8TB)",
      { manufacturer: "Synology", model: "RS1221+", assetType: "nas", cpu: "AMD Ryzen V1500B", ramGB: 4, storageGB: 64000 },
    ],
    [
      "Apple Mac mini M2 Pro 32GB 1TB",
      { manufacturer: "Apple", model: "Mac mini", assetType: "mini-pc", cpu: "Apple M2 Pro", ramGB: 32, storageGB: 1000 },
    ],
    [
      "Dell Latitude 3420 i5-1135G7 8GB 256GB SSD 14in",
      { manufacturer: "Dell", model: "Latitude 3420", assetType: "laptop", cpu: "Intel Core i5-1135G7", ramGB: 8, storageGB: 256, screenInches: 14 },
    ],
  ])("%s", (text, expected) => {
    expect(values(parseFreeText(text))).toEqual({ ...nothing, ...expected });
  });
});

describe("parseFreeText: the cells of sample_assets_1.xlsx / Sheet1 (2)", () => {
  it.each([
    ["Dell Latitude 7400 laptop", { manufacturer: "Dell", model: "Latitude 7400", assetType: "laptop" }],
    ["Lenovo ThinkCentre M720q", { manufacturer: "Lenovo", model: "ThinkCentre M720q", assetType: "desktop" }],
    ["HP Z2 G5 Tower Workstation", { manufacturer: "HP", model: "Z2 G5 Tower", assetType: "workstation" }],
    ["Dell PowerEdge T340 server", { manufacturer: "Dell", model: "PowerEdge T340", assetType: "server" }],
    ["i5-8365U / 8GB / 256GB", { cpu: "Intel Core i5-8365U", ramGB: 8, storageGB: 256 }],
    ["i5-9500T / 16GB / 512GB SSD", { cpu: "Intel Core i5-9500T", ramGB: 16, storageGB: 512 }],
    ["Xeon W-1270 / 64GB / 1TB", { cpu: "Intel Xeon W-1270", ramGB: 64, storageGB: 1000 }],
    ["Xeon E-2224 / 32GB / 2x 4TB HDD", { cpu: "Intel Xeon E-2224", ramGB: 32, storageGB: 8000 }],
  ])("%s", (text, expected) => {
    expect(values(parseFreeText(text))).toEqual({ ...nothing, ...expected });
  });
});

describe("parseFreeText: the examples quoted in the brief", () => {
  it("reads 'Dell Lat 5420 i7 16GB' and flags what is uncertain", () => {
    const parsed = parseFreeText("Dell Lat 5420 i7 16GB");
    expect(values(parsed)).toEqual({
      ...nothing,
      manufacturer: "Dell",
      model: "Latitude 5420",
      assetType: "laptop",
      cpu: "Intel Core i7",
      ramGB: 16,
    });
    expect(parsed.model?.raw).toBe("Lat 5420"); // what was typed is kept
    expect(parsed.cpu?.confidence).toBeLessThan(0.7); // "i7" alone is not a model
    expect(parsed.ramGB?.confidence).toBeLessThan(0.7); // a lone "16GB" is probably RAM, not certainly
  });

  it("reads 'HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in'", () => {
    expect(values(parseFreeText("HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in"))).toEqual({
      ...nothing,
      manufacturer: "HP",
      model: "EliteBook 840 G8",
      assetType: "laptop",
      cpu: "Intel Core i5",
      ramGB: 16,
      storageGB: 256,
      screenInches: 14,
    });
  });
});

describe("parseFreeText: telling RAM from storage", () => {
  it("trusts labels over position", () => {
    const parsed = parseFreeText("256GB SSD, 8GB RAM");
    expect(parsed.ramGB).toMatchObject({ value: 8 });
    expect(parsed.storageGB).toMatchObject({ value: 256 });
    expect(parsed.ramGB?.confidence).toBeGreaterThan(0.9);
  });

  it("reads a label that comes before the number", () => {
    const parsed = parseFreeText("RAM: 16GB, SSD: 512GB");
    expect(parsed.ramGB?.value).toBe(16);
    expect(parsed.storageGB?.value).toBe(512);
  });

  it("uses the usual order (RAM, then storage) for two unlabelled sizes", () => {
    const parsed = parseFreeText("i5-8365U 8GB 256GB");
    expect(parsed.ramGB).toMatchObject({ value: 8, confidence: 0.8 });
    expect(parsed.storageGB).toMatchObject({ value: 256, confidence: 0.8 });
  });

  it("swaps two unlabelled sizes written big-first, and trusts them less", () => {
    const parsed = parseFreeText("i5-8365U 512GB 16GB");
    expect(parsed.ramGB).toMatchObject({ value: 16, confidence: 0.7 });
    expect(parsed.storageGB).toMatchObject({ value: 512, confidence: 0.7 });
  });

  it("decides a single unlabelled size by its magnitude, with low confidence", () => {
    expect(parseFreeText("Dell Latitude 5420 256GB").storageGB).toMatchObject({ value: 256, confidence: 0.6 });
    expect(parseFreeText("Dell Latitude 5420 256GB").ramGB).toBeUndefined();
    expect(parseFreeText("Dell Latitude 5420 8GB").ramGB).toMatchObject({ value: 8, confidence: 0.6 });
  });

  it("adds up several drives", () => {
    expect(parseFreeText("i7-10700 16GB RAM 256GB SSD + 1TB HDD").storageGB?.value).toBe(1256);
  });

  it("treats two small identical parts as RAM modules, not drives", () => {
    expect(parseFreeText("Dell OptiPlex 7090 i7-10700 2x 8GB 512GB SSD").ramGB?.value).toBe(16);
  });
});

describe("parseFreeText: things that look like specs but are not", () => {
  it("does not read model numbers as capacities or CPUs", () => {
    const parsed = parseFreeText("Acer Veriton X2680G");
    expect(parsed.ramGB).toBeUndefined();
    expect(parsed.storageGB).toBeUndefined();
    expect(parseFreeText("Lenovo ThinkCentre M720q").cpu).toBeUndefined();
    expect(parseFreeText("HP EliteBook 840 G8").storageGB).toBeUndefined();
  });

  it("does not read an M.2 drive as an Apple chip", () => {
    const parsed = parseFreeText("Dell XPS 15 i7-12700H 16GB 1TB M.2 NVMe");
    expect(parsed.cpu?.value).toBe("Intel Core i7-12700H");
    expect(parsed.storageGB?.value).toBe(1000);
  });

  it("does not read '2-in-1' as a screen size", () => {
    expect(parseFreeText("HP Spectre x360 2-in-1 i7-1355U 16GB 512GB SSD").screenInches).toBeUndefined();
  });
});

describe("parseFreeText: inference from product lines", () => {
  it("infers the manufacturer and type from the line, and marks them as inferred", () => {
    const parsed = parseFreeText("ThinkPad T480 i5-8350U 8GB 256GB SSD");
    expect(parsed.manufacturer).toMatchObject({ value: "Lenovo", inferred: true });
    expect(parsed.assetType).toMatchObject({ value: "laptop", inferred: true });
    expect(parsed.model?.value).toBe("ThinkPad T480");
  });

  it("lets an explicit type word beat the product line", () => {
    expect(parseFreeText("Dell Precision 5570 laptop").assetType).toMatchObject({ value: "laptop" });
    expect(parseFreeText("Dell Precision 5570 laptop").assetType?.inferred).toBeUndefined();
  });
});

describe("parseFreeText: non-computers", () => {
  it("flags accessories even when they carry a computer brand line", () => {
    expect(parseFreeText("Lenovo ThinkPad USB-C Dock").nonComputer).toBe("dock");
    expect(parseFreeText("Lenovo ThinkPad USB-C Dock").assetType).toBeUndefined();
  });

  it("keeps a computer a computer when an accessory is only mentioned", () => {
    const parsed = parseFreeText("Dell Latitude 5420 i5-1145G7 16GB 256GB SSD with charger");
    expect(parsed.nonComputer).toBeUndefined();
    expect(parsed.assetType?.value).toBe("laptop");
  });
});

describe("parseFreeText: text with nothing to find", () => {
  it.each(["", "returned - spare", "see notes", "Sarah Lee"])("%j yields nothing", (text) => {
    expect(values(parseFreeText(text))).toEqual(nothing);
  });
});
