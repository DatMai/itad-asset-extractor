import { describe, expect, it } from "vitest";
import { mapColumns } from "./mapColumns";
import { LOW_CONFIDENCE } from "./types";

/** header -> target, for compact comparison. */
function targets(headers: string[], rows: string[][]) {
  return Object.fromEntries(mapColumns(headers, rows).map((column) => [column.header, column.target]));
}

const byHeader = (headers: string[], rows: string[][], header: string) => {
  const column = mapColumns(headers, rows).find((item) => item.header === header);
  if (!column) throw new Error(`No column "${header}"`);
  return column;
};

describe("mapColumns: the client's samples", () => {
  const assetsHeaders = ["Device Type", "Make", "Model Name", "S/N", "Processor", "Memory", "HDD/SSD", "Display", "Assigned To", "Location"];
  const assetsRows = [
    ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "Intel Core i7-1185G7", "16GB", "512GB SSD", '14"', "Sarah Lee", "Sydney"],
    ["Notebook", "Apple", "MacBook Pro 14 (2023)", "C02FK8ZTMD6R", "Apple M2 Pro", "32GB", "1TB", "14.2in", "Priya Shah", "Melbourne"],
    ["Desktop PC", "Dell", "OptiPlex 7090", "9JZL5N2", "Intel i7-10700", "32768 MB", "1 TB HDD", "N/A", "Reception", "Sydney"],
    ["Rack Server", "HPE", "ProLiant DL380 Gen10", "CZJ93805KL", "2x Intel Xeon Gold 6230", "384GB", "8x 2.4TB SAS", "", "", "Sydney DC"],
    ["Laptop", "Apple", "MacBook Air M2", "FVFHK2Q1Q6L4", "Apple M2", "8GB", "256GB", '13.6"', "Leo Park", "Melbourne"],
  ];

  it("maps every column of sample 1 / Assets with high confidence", () => {
    expect(targets(assetsHeaders, assetsRows)).toEqual({
      "Device Type": "assetType",
      Make: "manufacturer",
      "Model Name": "model",
      "S/N": "serialNumber",
      Processor: "cpu",
      Memory: "ramGB",
      "HDD/SSD": "storageGB",
      Display: "screenInches",
      "Assigned To": "assignedTo",
      Location: "location",
    });
    for (const column of mapColumns(assetsHeaders, assetsRows)) {
      expect(column.confidence, column.header).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("explains each mapping", () => {
    expect(byHeader(assetsHeaders, assetsRows, "S/N").reason).toBe('"S/N" is a known name for Serial number');
  });

  it("gives a few sample values for the mapping screen", () => {
    expect(byHeader(assetsHeaders, assetsRows, "Make").samples).toEqual(["Dell", "Apple", "HPE"]);
  });

  it("maps sample 1 / Sheet1 (2), including the column that lists its parts", () => {
    const headers = ["Serial", "Equipment", "CPU / RAM / Disk", "Screen"];
    const rows = [
      ["8RTQ3L2", "Dell Latitude 7400 laptop", "i5-8365U / 8GB / 256GB", "14in"],
      ["PC0X7Y8Z", "Lenovo ThinkCentre M720q", "i5-9500T / 16GB / 512GB SSD", ""],
      ["MXL9876ABC", "HP Z2 G5 Tower Workstation", "Xeon W-1270 / 64GB / 1TB", ""],
    ];
    expect(targets(headers, rows)).toEqual({
      Serial: "serialNumber",
      Equipment: "combined",
      "CPU / RAM / Disk": "combined",
      Screen: "screenInches",
    });
    expect(byHeader(headers, rows, "CPU / RAM / Disk").parts).toEqual(["cpu", "ramGB", "storageGB"]);
    expect(byHeader(headers, rows, "Equipment").parts).toBeUndefined();
  });

  it("maps sample 2", () => {
    const headers = ["Asset Tag", "Item Description", "Serial No.", "Cost Centre", "Purchased", "Notes"];
    const rows = [
      ["IT-0001", "HP EliteBook 850 G7 - i7-10610U / 16GB / 512GB SSD / 15.6in", "5CG0451QRS", "FIN", "12/03/2021", ""],
      ["IT-0005", "Dell P2422H 24in Monitor", "CN0ABC1234", "OPS", "2020-11-02", "monitor - not a computer"],
      ["IT-0014", "Synology RS1221+ NAS (Ryzen V1500B, 4GB, 8x 8TB)", "2150QWE123", "INFRA", "2021-07-22", "storage server?"],
    ];
    expect(targets(headers, rows)).toEqual({
      "Asset Tag": "assetTag",
      "Item Description": "combined",
      "Serial No.": "serialNumber",
      "Cost Centre": "costCentre",
      Purchased: "purchaseDate",
      Notes: "notes",
    });
  });
});

describe("mapColumns: names it has not seen exactly", () => {
  it("accepts typos, abbreviations and extra words, with lower confidence than an exact name", () => {
    const headers = ["Seriel No", "Manuf", "Procesor", "Mem", "Stor", "Loc", "Device Serial Number"];
    const result = mapColumns(headers, []);
    const map = Object.fromEntries(result.map((column) => [column.header, column]));

    expect(map["Seriel No"].target).toBe("ignore"); // "Device Serial Number" is the better serial column
    expect(map["Manuf"]).toMatchObject({ target: "manufacturer" });
    expect(map["Procesor"]).toMatchObject({ target: "cpu" });
    expect(map["Mem"]).toMatchObject({ target: "ramGB", confidence: 1 });
    expect(map["Stor"]).toMatchObject({ target: "storageGB" });
    expect(map["Loc"]).toMatchObject({ target: "location" });
    expect(map["Device Serial Number"]).toMatchObject({ target: "serialNumber" });

    expect(map["Manuf"].reason).toMatch(/abbreviation of "manufacturer"/);
    expect(map["Procesor"].reason).toMatch(/close to "processor"/);
    expect(map["Device Serial Number"].reason).toMatch(/contains "serial number"/);
    expect(map["Procesor"].confidence).toBeLessThan(0.9);
  });

  it("ignores unit words in a header", () => {
    expect(byHeader(["RAM (GB)"], [], "RAM (GB)")).toMatchObject({ target: "ramGB", confidence: 1 });
  });

  it("reads a misspelt header when it is the only candidate", () => {
    expect(byHeader(["Seriel No"], [], "Seriel No")).toMatchObject({ target: "serialNumber" });
  });

  it("understands Vietnamese headers", () => {
    const headers = ["Loại thiết bị", "Hãng SX", "Dòng máy", "Số serial", "Vi xử lý", "Bộ nhớ (GB)", "Ổ cứng", "Màn hình", "Người dùng", "Phòng ban", "Ngày mua", "Ghi chú"];
    expect(Object.values(targets(headers, []))).toEqual([
      "assetType", "manufacturer", "model", "serialNumber", "cpu", "ramGB", "storageGB", "screenInches", "assignedTo", "costCentre", "purchaseDate", "notes",
    ]);
  });

  it("does not confuse look-alike names", () => {
    expect(targets(["Asset Type", "Asset Tag"], [])).toEqual({ "Asset Type": "assetType", "Asset Tag": "assetTag" });
    expect(byHeader(["Storage Type"], [["SSD"], ["HDD"]], "Storage Type").target).not.toBe("assetType");
  });
});

describe("mapColumns: using the values", () => {
  it("maps a table with no header row from the values alone, and says so", () => {
    const rows = [
      ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "i7-1185G7", "16GB", "512GB SSD", '14"'],
      ["Desktop", "HP", "ProDesk 400 G7", "4CE0471ABC", "i5-10500", "8GB", "1TB HDD", '24"'],
      ["Server", "Lenovo", "ThinkSystem SR650", "J30091AB", "Xeon Silver 4314", "32GB", "2x 1TB SSD", ""],
    ];
    const result = mapColumns([], rows);
    expect(result.map((column) => column.target)).toEqual([
      "assetType", "manufacturer", "model", "serialNumber", "cpu", "ramGB", "storageGB", "screenInches",
    ]);
    expect(result.map((column) => column.header)).toEqual([
      "Column A", "Column B", "Column C", "Column D", "Column E", "Column F", "Column G", "Column H",
    ]);
    expect(result[4].reason).toBe("3 of 3 values look like CPU");
    // Anything alphanumeric looks like a serial number, so that guess is always flagged.
    expect(result[3].confidence).toBeLessThan(LOW_CONFIDENCE);
  });

  it("goes with the values when they contradict the header, and flags it", () => {
    const column = byHeader(["RAM"], [["i5-8365U"], ["i7-10700"], ["Xeon W-1270"]], "RAM");
    expect(column.target).toBe("cpu");
    expect(column.confidence).toBeLessThan(LOW_CONFIDENCE);
    expect(column.reason).toBe('3 of 3 values look like CPU, although the header "RAM" suggests RAM (GB)');
  });

  it("keeps the header's field but lowers confidence when only some values disagree", () => {
    const column = byHeader(["RAM"], [["16GB"], ["i7-10700"], ["Xeon W-1270"], ["8GB"]], "RAM");
    expect(column.target).toBe("ramGB");
    expect(column.confidence).toBe(0.8);
    expect(column.reason).toMatch(/but 2 of 4 values look like something else/);
  });

  it("lets the values overrule a vague header", () => {
    // "Type" usually means asset type, but these cells are full descriptions.
    const rows = [["Dell Latitude 7400 laptop"], ["Lenovo ThinkCentre M720q"], ["HP EliteBook 840 G8 i5 16GB"]];
    expect(byHeader(["Type"], rows, "Type").target).toBe("combined");
    // "Equipment" usually means a description, but these cells are plain types.
    expect(byHeader(["Equipment"], [["Laptop"], ["Desktop"], ["Server"]], "Equipment").target).toBe("assetType");
  });

  it("treats a Model column full of specs as a combined column", () => {
    const rows = [["Dell Lat 5420 i7 16GB"], ["HP EliteBook 840 G8 i5 8GB 256GB"]];
    expect(byHeader(["Model"], rows, "Model").target).toBe("combined");
  });
});

describe("mapColumns: columns it should leave alone", () => {
  it("ignores row numbers, operating systems and unknown dates", () => {
    const headers = ["No.", "Operating System", "Warranty End", "Hostname"];
    const rows = [
      ["1", "Microsoft Windows 11 Pro", "2025-03-12", "SYD-LT-0042"],
      ["2", "Microsoft Windows 10 Pro", "2024-08-19", "SYD-LT-0043"],
      ["3", "Ubuntu 22.04", "2026-01-01", "MEL-DT-0007"],
    ];
    const result = targets(headers, rows);
    expect(result["No."]).toBe("ignore");
    expect(result["Operating System"]).toBe("ignore");
    expect(result["Warranty End"]).toBe("ignore");
  });

  it("gives a field to one column only and says why the other lost", () => {
    const result = mapColumns(["Serial", "Serial Number"], [["A1B2C3D", "A1B2C3D"]]);
    expect(result.filter((column) => column.target === "serialNumber")).toHaveLength(1);
    expect(result.find((column) => column.target === "ignore")?.reason).toMatch(/already/);
  });

  it("leaves out columns that are completely empty", () => {
    expect(mapColumns(["Serial", "", "Model"], [["A1B2C3D", "", "Latitude 5420"]]).map((column) => column.index)).toEqual([0, 2]);
  });
});
