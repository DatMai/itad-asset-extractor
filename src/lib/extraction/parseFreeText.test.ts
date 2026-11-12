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

describe("parseFreeText: generation words", () => {
  it("keeps a generation that belongs to the model", () => {
    const parsed = parseFreeText("Lenovo ThinkPad X1 Carbon 7th Gen i7-8565U 16GB 512GB SSD");
    expect(parsed.model?.value).toBe("ThinkPad X1 Carbon 7th Gen");
    expect(parsed.cpu?.value).toBe("Intel Core i7-8565U");
  });

  it("uses a generation written next to a CPU that has no model number", () => {
    const parsed = parseFreeText("HP EliteBook 840 G8 Core i5 11th gen 8GB 256GB");
    expect(parsed.cpu?.value).toBe("Intel Core i5 11th gen");
    expect(parsed.model?.value).toBe("EliteBook 840 G8");
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

// --- Review findings, each reproduced with the input that went wrong ------------------------

describe("parseFreeText: CPUs that only look like an Apple chip", () => {
  it("reads an Intel Core m3 as Intel, not as Apple M3", () => {
    const parsed = parseFreeText("Dell Latitude 7280 Core m3-7Y30 8GB 256GB");
    expect(parsed.cpu).toMatchObject({ value: "Intel Core m3-7Y30", confidence: 0.95 });
    expect(parsed.model?.value).toBe("Latitude 7280");
  });

  it("does not read the M.2 form factor 'M2 2280' as a CPU", () => {
    const parsed = parseFreeText("HP EliteDesk 800 G3 SFF 8GB 256GB M2 2280");
    expect(parsed.cpu).toBeUndefined();
  });

  it("flags a bare M2 on a machine that is not a Mac instead of trusting it", () => {
    const parsed = parseFreeText("Grade A: HP EliteBook 840 G5 8GB 256GB M2");
    expect(parsed.cpu?.confidence).toBeLessThan(0.7);
    expect(parsed.cpu?.note).toMatch(/M\.2 drive/);
  });

  it("still trusts an M chip when the text says Apple or Mac", () => {
    expect(parseFreeText("MacBook Air M2 8GB 256GB").cpu).toMatchObject({ value: "Apple M2", confidence: 0.95 });
    expect(parseFreeText("MBA M1 8GB 256GB").cpu).toMatchObject({ value: "Apple M1", confidence: 0.95 });
  });

  it("reads a server CPU written without the word Xeon", () => {
    const parsed = parseFreeText("Dell PowerEdge R730 2x E5-2680 v4 256GB RAM");
    expect(parsed.cpu).toMatchObject({ value: "2x Intel Xeon E5-2680 v4", confidence: 0.95 });
    expect(parsed.model?.value).toBe("PowerEdge R730");
    expect(parsed.ramGB?.value).toBe(256);
  });
});

describe("parseFreeText: sizes written loosely", () => {
  it("does not count a module breakdown in brackets as a second size", () => {
    const parsed = parseFreeText("Dell Latitude 5490 i5-8350U 16GB (2x8GB) 256GB");
    expect(parsed.ramGB).toMatchObject({ value: 16, raw: "16GB" });
    expect(parsed.storageGB).toMatchObject({ value: 256, raw: "256GB" });
    expect(parsed.model?.value).toBe("Latitude 5490");
  });

  it("lets a labelled breakdown say what the total before it is", () => {
    const parsed = parseFreeText("Dell Latitude 5490 16GB (2x8GB DDR4) 256GB");
    expect(parsed.ramGB).toMatchObject({ value: 16, confidence: 0.95 });
    expect(parsed.storageGB?.value).toBe(256);
  });

  it("never drops a third unlabelled size without saying so", () => {
    const parsed = parseFreeText("Dell Latitude 16GB 256GB 500GB");
    expect(parsed.ramGB).toMatchObject({ value: 16, confidence: 0.6 });
    expect(parsed.storageGB).toMatchObject({ value: 756, raw: "256GB + 500GB", confidence: 0.6 });
    expect(parsed.storageGB?.note).toMatch(/3 unlabelled sizes/);
  });

  it("reads 'G' as GB when the cell holds more than one size", () => {
    const parsed = parseFreeText("Dell OptiPlex 7060 Micro i5-8500T 8G 256G");
    expect(parsed.ramGB?.value).toBe(8);
    expect(parsed.storageGB?.value).toBe(256);
    expect(parsed.model?.value).toBe("OptiPlex 7060 Micro");
  });

  it("does not read a mobile network (4G, 5G) or a lone 'G' as a size", () => {
    expect(parseFreeText("Lenovo ThinkPad X13 5G 16GB 512GB").ramGB?.value).toBe(16);
    expect(parseFreeText("Lenovo ThinkPad X13 5G 16GB 512GB").storageGB?.value).toBe(512);
    expect(parseFreeText("Dell Latitude 7400 4G LTE").ramGB).toBeUndefined();
    expect(parseFreeText("HP EliteBook 840 G5 8G").ramGB).toBeUndefined();
  });

  it("reads a drive size whose unit is missing, and says the unit was assumed", () => {
    const spaced = parseFreeText('HP EliteBook 840 G5 i5-8350U 16GB 512 SSD 14"');
    expect(spaced.storageGB).toMatchObject({ value: 512, raw: "512 SSD", confidence: 0.6 });
    expect(spaced.storageGB?.note).toMatch(/GB assumed/);
    expect(spaced.ramGB?.value).toBe(16);
    expect(spaced.model?.value).toBe("EliteBook 840 G5");

    expect(parseFreeText("Dell Latitude 5490 i5-8350U 8GB 256SSD").storageGB).toMatchObject({ value: 256, confidence: 0.6 });
  });

  it("does not read a model number in front of a drive word as a size", () => {
    expect(parseFreeText("Dell Latitude 5490 SSD").storageGB).toBeUndefined();
    expect(parseFreeText("HP EliteDesk 800 SSD").storageGB).toBeUndefined();
  });
});

describe("parseFreeText: numbers written with a comma", () => {
  it.each([
    ["HP ZBook Fury 15; i7-11800H; 32GB; 1,92TB SSD", 32, 1920],
    ["Dell PowerEdge R740 2x Xeon Silver 4210 128GB 4 x 1,2TB SAS", 128, 4800],
    ["Dell OptiPlex 7090 i7-10700 32,768 MB RAM 1 TB HDD", 32, 1000],
    ["T14,i5-1135G7,16GB,512GB", 16, 512],
    ["Latitude 5420,16GB,256GB", 16, 256],
    ["DDR4,16GB", 16, undefined],
  ])("%s", (text, ram, storage) => {
    const parsed = parseFreeText(text);
    expect(parsed.ramGB?.value).toBe(ram);
    expect(parsed.storageGB?.value).toBe(storage);
  });

  it("flags a comma that could separate two values rather than thousands", () => {
    // "8,256GB" may be 8 (GB RAM) and 256GB, or 8,256 GB. We cannot know, so it is flagged.
    const parsed = parseFreeText("i5,8,256GB SSD");
    expect(parsed.storageGB?.confidence).toBeLessThan(0.7);
    expect(parsed.storageGB?.note).toMatch(/comma/i);
  });
});

describe("parseFreeText: where the model starts and ends", () => {
  it("takes the piece that names the device, not a status in front of it", () => {
    const parsed = parseFreeText("Faulty - no power - Dell Latitude 5400");
    expect(parsed.model?.value).toBe("Latitude 5400");
    expect(parsed.model?.confidence).toBeLessThan(0.7);
    expect(parsed.model?.note).toContain("Faulty");
  });

  it("finds the model after a piece that is only a type word", () => {
    const parsed = parseFreeText("Laptop - Dell Latitude 5490");
    expect(parsed.model).toMatchObject({ value: "Latitude 5490", confidence: 0.9 });
  });

  it.each([
    ["1x Dell Latitude 5490 i5-8350U 8GB 256GB SSD", "Latitude 5490", "1x"],
    ["Grade A: HP EliteBook 840 G5 i5 8GB 256GB", "EliteBook 840 G5", "Grade A"],
  ])("%s: drops what is written before the brand, and says so", (text, model, leftOut) => {
    const parsed = parseFreeText(text);
    expect(parsed.model?.value).toBe(model);
    expect(parsed.model?.confidence).toBeLessThan(0.7);
    expect(parsed.model?.note).toContain(leftOut);
  });

  it("does not doubt a model that only has a type word in front of it", () => {
    expect(parseFreeText("Laptop Dell Latitude 5490").model).toMatchObject({ value: "Latitude 5490", confidence: 0.9 });
  });

  it("stops the model at a trailing note", () => {
    expect(parseFreeText("HP EliteBook 840 G5 no HDD no RAM").model?.value).toBe("EliteBook 840 G5");
    expect(parseFreeText("HP 840 G5 w/ bag").model?.value).toBe("840 G5");
  });

  it("keeps words such as Plus and a '+' that belong to the model", () => {
    expect(parseFreeText("HPE ProLiant DL360 Gen10 Plus").model?.value).toBe("ProLiant DL360 Gen10 Plus");
    expect(parseFreeText("Synology RS1221+ NAS").model?.value).toBe("RS1221+");
  });

  it("still finds no model when only specs and a remark are written", () => {
    expect(parseFreeText("i5-8365U / 8GB / 256GB / spare").model).toBeUndefined();
  });
});

describe("parseFreeText: a computer that mentions an accessory", () => {
  it.each([
    ["HP EliteBook 840 G5 with charger", "EliteBook 840 G5", "laptop"],
    ["Lenovo ThinkPad T480 + dock", "ThinkPad T480", "laptop"],
    ["Dell Latitude 5490 no charger", "Latitude 5490", "laptop"],
    ["Dell OptiPlex 7060 with keyboard and mouse", "OptiPlex 7060", "desktop"],
  ])("%s is a computer", (text, model, type) => {
    const parsed = parseFreeText(text);
    expect(parsed.nonComputer).toBeUndefined();
    expect(parsed.model?.value).toBe(model);
    expect(parsed.assetType?.value).toBe(type);
  });

  it.each([
    ["Dock for ThinkPad T480", "dock"],
    ["Lenovo ThinkPad USB-C Dock with cable", "dock"],
    ["Dell WD19 dock", "dock"],
    ["HP 65W charger with cable", "accessory"],
  ])("%s is still an accessory", (text, label) => {
    expect(parseFreeText(text).nonComputer).toBe(label);
  });

  it("does not let one unlabelled size turn a phone into a computer", () => {
    const parsed = parseFreeText("iPhone 12 64GB");
    expect(parsed.nonComputer).toBe("phone");
    expect(parsed.ramGB).toBeUndefined(); // 64GB of a phone is its storage; we do not claim RAM
  });
});

// --- Second review: regressions in the fixes above, each with the string the reviewer ran ------

describe("parseFreeText: a decimal comma inside a comma list", () => {
  it.each([
    ["Dell Latitude 5490,i5-8350U,8,1TB SSD"],
    ["HP 840 G5,i5,8,2TB HDD"],
    ["Lenovo T14,i5,16,1TB"],
  ])("%s: the size may be two values, so it is flagged", (text) => {
    // "8,1TB" is 8.1 TB or "8" (GB of RAM) followed by "1TB". The other commas in the cell are
    // separators, so this one may be a separator too.
    const parsed = parseFreeText(text);
    expect(parsed.storageGB?.confidence).toBe(0.6);
    expect(parsed.storageGB?.note).toMatch(/comma/i);
  });

  it.each([
    ["HP ZBook Fury 15; i7-11800H; 32GB; 1,92TB SSD", 1920],
    ["Dell PowerEdge R740 2x Xeon Silver 4210 128GB 4 x 1,2TB SAS", 4800],
  ])("%s: still trusted when no other comma is in the cell", (text, storage) => {
    expect(parseFreeText(text).storageGB).toMatchObject({ value: storage, confidence: 0.95 });
  });

  it("flags labelled RAM that is not a size RAM comes in", () => {
    // "8,16GB RAM" read as 8.16 GB: no module has that size, so the number is doubtful.
    const parsed = parseFreeText("Dell 5490 i5 8,16GB RAM");
    expect(parsed.ramGB?.confidence).toBe(0.6);
    expect(parsed.ramGB?.note).toMatch(/not a size RAM/i);
  });
});

describe("parseFreeText: a drive without a unit written before the RAM", () => {
  it("uses the drive word once: '512 SSD 8GB' is a 512 drive and 8 GB of RAM", () => {
    const parsed = parseFreeText("HP EliteBook 840 G5 i5-8350U 512 SSD 8GB");
    expect(parsed.storageGB).toMatchObject({ value: 512, raw: "512 SSD", confidence: 0.6 });
    expect(parsed.storageGB?.note).toMatch(/GB assumed/);
    expect(parsed.ramGB).toMatchObject({ value: 8, raw: "8GB" });
    expect(parsed.model?.value).toBe("EliteBook 840 G5");
  });

  it("keeps labelled RAM that follows the drive", () => {
    const parsed = parseFreeText("Dell Latitude 5490 256 SSD 16GB RAM");
    expect(parsed.storageGB).toMatchObject({ value: 256, raw: "256 SSD", confidence: 0.6 });
    expect(parsed.ramGB).toMatchObject({ value: 16, confidence: 0.95 });
  });
});

describe("parseFreeText: specs of an accessory mentioned after the computer", () => {
  it.each([
    ["Dell OptiPlex 7060 + 24in monitor", "OptiPlex 7060", "desktop"],
    ["HP EliteDesk 800 G3 with 22in monitor", "EliteDesk 800 G3", "desktop"],
    ["Dell Latitude 5490 with 1TB external HDD", "Latitude 5490", "laptop"],
    ["HP EliteBook 840 G5 with 65W charger and 500GB external drive", "EliteBook 840 G5", "laptop"],
    ["Lat 5490 + 24in monitor", "Latitude 5490", "laptop"],
  ])("%s: the computer gets no screen or storage from the accessory", (text, model, type) => {
    const parsed = parseFreeText(text);
    expect(parsed.screenInches).toBeUndefined();
    expect(parsed.storageGB).toBeUndefined();
    expect(parsed.ramGB).toBeUndefined();
    expect(parsed.nonComputer).toBeUndefined();
    expect(parsed.model?.value).toBe(model);
    expect(parsed.assetType?.value).toBe(type);
  });

  it("still reads specs written before the remark", () => {
    const parsed = parseFreeText('HP EliteBook 840 G5 14" 8GB 256GB SSD + 24in monitor');
    expect(values(parsed)).toMatchObject({ screenInches: 14, ramGB: 8, storageGB: 256 });
  });

  it.each([
    ["Dell Latitude 5490 with 16GB RAM and 512GB SSD", 16, 512],
    ["Dell Latitude 5490 with i5-8350U 8GB 256GB SSD", 8, 256],
  ])("%s: a remark that names no accessory is the computer's own specs", (text, ram, storage) => {
    const parsed = parseFreeText(text);
    expect(parsed.ramGB?.value).toBe(ram);
    expect(parsed.storageGB?.value).toBe(storage);
  });
});

describe("parseFreeText: a model number that is also a drive size", () => {
  it.each([
    ["Lenovo IdeaPad 320 HDD", undefined],
    ["Lenovo IdeaPad 320 SSD 8GB", 8],
    ["HP 250 SSD 8GB", 8],
    ["HP 240 SSD 4GB 14in", 4],
  ])("%s: the first number in the cell is not read as a drive", (text, ram) => {
    const parsed = parseFreeText(text);
    expect(parsed.storageGB).toBeUndefined();
    expect(parsed.ramGB?.value).toBe(ram);
  });

  it("keeps the number in the model", () => {
    expect(parseFreeText("Lenovo IdeaPad 320 HDD").model?.value).toMatch(/^IdeaPad 320/);
    expect(parseFreeText("Lenovo IdeaPad 320 SSD 8GB").model?.value).toMatch(/^IdeaPad 320/);
    expect(parseFreeText("HP 250 SSD 8GB").model?.value).toMatch(/^250/);
  });

  it("shows an assumed unit for checking: the confidence is below the review threshold", () => {
    expect(parseFreeText("Dell Latitude 5490 i5-8350U 8GB 256SSD").storageGB).toMatchObject({ value: 256, confidence: 0.6 });
  });
});

// --- Third review: the five values the verifier still found wrong, with the strings it ran -----

describe("parseFreeText: a count in front of a drive without a unit", () => {
  it.each([
    ["Dell Latitude 5490 2 x 512 SSD 16GB", "2 x 512 SSD", 1024, 16],
    ["Dell PowerEdge R740 4 x 960 SSD 64GB", "4 x 960 SSD", 3840, 64],
    ["Dell PowerEdge R740 2x 480 SSD 32GB RAM", "2x 480 SSD", 960, 32],
  ])("%s: the count multiplies the drive, not the RAM", (text, raw, storage, ram) => {
    const parsed = parseFreeText(text);
    expect(parsed.storageGB).toMatchObject({ value: storage, raw, confidence: 0.6 });
    expect(parsed.storageGB?.note).toMatch(/GB assumed/);
    expect(parsed.ramGB?.value).toBe(ram);
  });

  it("keeps labelled RAM at top confidence", () => {
    expect(parseFreeText("Dell PowerEdge R740 2x 480 SSD 32GB RAM").ramGB).toMatchObject({ value: 32, confidence: 0.95 });
  });
});

describe("parseFreeText: a screen size written after a remark", () => {
  const NOTE = 'Written after "with"; it may be a separate monitor';

  it.each([
    ["Dell OptiPlex 7060 + 24in monitors", 24],
    ["Dell OptiPlex 7060 incl 2x 24in monitors", 24],
    ["Dell OptiPlex 7060 with 27 inch display", 27],
    ["Dell OptiPlex 7060 with 27 inch screen", 27],
    ["Dell OptiPlex 7060 with 24in LCD", 24],
    ["Dell OptiPlex 7060 with Dell P2419H 24in", 24],
  ])("%s: kept for checking, because a desktop has no screen of its own", (text, inches) => {
    const parsed = parseFreeText(text);
    expect(parsed.screenInches).toEqual({ value: inches, raw: expect.any(String), confidence: 0.6, note: NOTE });
    expect(parsed.assetType?.value).toBe("desktop");
    expect(parsed.model?.value).toBe("OptiPlex 7060");
  });

  it.each([
    ["Dell Latitude 5490 with 14 inch display", 14],
    ["Apple iPad with 10.2 inch display", 10.2],
  ])("%s: a laptop or tablet has its own screen, so it stays trusted", (text, inches) => {
    const screen = parseFreeText(text).screenInches;
    expect(screen).toMatchObject({ value: inches, confidence: 0.95 });
    expect(screen?.note).toBeUndefined();
  });

  it("does not doubt a screen written before the remark", () => {
    expect(parseFreeText("Dell OptiPlex 7060 24in with keyboard").screenInches).toMatchObject({ value: 24, confidence: 0.95 });
  });
});

describe("parseFreeText: a drive word in front of a size too small to be a drive", () => {
  it.each([
    ["Dell Latitude 5490 SSD 8GB"],
    ["Lenovo ThinkPad T480 SSD 8GB"],
    ["Lenovo IdeaPad 330 SSD 8GB"],
    ["HP 250 G7 SSD 8GB"],
  ])("%s: the size is read as unlabelled, so RAM for checking and no storage", (text) => {
    const parsed = parseFreeText(text);
    expect(parsed.storageGB).toBeUndefined();
    expect(parsed.ramGB).toMatchObject({ value: 8, raw: "8GB", confidence: 0.6 });
    expect(parsed.ramGB?.note).toMatch(/Only one size in the cell and no label/);
  });

  it("lets a RAM label written after the size decide", () => {
    const parsed = parseFreeText("Dell Latitude 5490 SSD 8GB RAM");
    expect(parsed.storageGB).toBeUndefined();
    expect(parsed.ramGB).toMatchObject({ value: 8, confidence: 0.95 });
  });

  it.each([
    ["Dell Latitude 5490 SSD 120GB", 120],
    ["Dell Latitude 5490 SSD 256GB", 256],
    ["Dell Latitude 5490 HDD: 1TB", 1000],
  ])("%s: a size drives are sold in is still storage at top confidence", (text, storage) => {
    expect(parseFreeText(text).storageGB).toMatchObject({ value: storage, confidence: 0.95 });
  });
});

describe("parseFreeText: a part named as absent", () => {
  it.each([
    ["Dell Latitude 5490 missing 256GB SSD"],
    ["Dell Latitude 5490 w/o 500GB HDD"],
    ["Dell Latitude 5490 without 500GB HDD"],
    ["Dell Latitude 5490 no 256GB SSD"],
  ])("%s: the drive is not in the computer, so no storage", (text) => {
    const parsed = parseFreeText(text);
    expect(parsed.storageGB).toBeUndefined();
    expect(parsed.ramGB).toBeUndefined();
    expect(parsed.model?.value).toBe("Latitude 5490");
  });

  it("gives no screen either", () => {
    expect(parseFreeText("Dell Latitude 5490 missing 14 inch screen").screenInches).toBeUndefined();
  });

  it("still reads specs written before the remark", () => {
    const parsed = parseFreeText("Dell Latitude 5490 8GB RAM missing 256GB SSD");
    expect(parsed.ramGB).toMatchObject({ value: 8, confidence: 0.95 });
    expect(parsed.storageGB).toBeUndefined();
  });
});
