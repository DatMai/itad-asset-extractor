import { describe, expect, it } from "vitest";
import { planSheet } from "@/lib/extraction/pipeline";
import type { RawSheet } from "@/lib/extraction/types";
import { applySuggestions, buildSuggestRequest, maskSample, unclearColumns } from "./suggestions";

const sheet: RawSheet = {
  name: "S",
  hidden: false,
  rows: [
    ["Type", "Brand", "Kit", "Ref", "Keeper", "Building", "Bin"],
    ["Laptop", "Dell", "Latitude 5420 i7-1185G7 16GB", "7HKQ2M3", "Sarah Lee", "HQ-2", "A1B2C3D"],
    ["Desktop", "HP", "ProDesk 400 G7 i5-10500 8GB", "4CE0471ABC", "Tom Nguyen", "HQ-1", "E4F5G6H"],
  ],
};
const plan = planSheet(sheet);
const headers = (columns: { header: string }[]) => columns.map((column) => column.header);

describe("unclearColumns", () => {
  it("lists the columns the rules left unused or unsure about", () => {
    // "Ref" is read as a serial number from its values, with a flag; nothing says what
    // "Keeper" and "Bin" are.
    expect(headers(unclearColumns(plan))).toEqual(["Ref", "Keeper", "Bin"]);
  });

  it("never lists a column the user mapped by hand", () => {
    const columns = plan.columns.map((column) => (column.header === "Bin" ? { ...column, source: "you" as const } : column));
    expect(headers(unclearColumns({ ...plan, columns }))).toEqual(["Ref", "Keeper"]);
  });
});

describe("buildSuggestRequest", () => {
  const request = buildSuggestRequest(plan);

  it("sends every header, so the model knows which fields are already taken", () => {
    expect(request.columns.map((column) => [column.header, column.mappedTo])).toEqual([
      ["Type", "assetType"],
      ["Brand", "manufacturer"],
      ["Kit", "combined"],
      ["Ref", null],
      ["Keeper", null],
      ["Building", "location"],
      ["Bin", null],
    ]);
  });

  it("sends sample values only for the unclear columns", () => {
    const withSamples = request.columns.filter((column) => column.samples.length > 0);
    expect(headers(withSamples)).toEqual(["Ref", "Keeper", "Bin"]);
    expect(JSON.stringify(request)).not.toContain("Latitude"); // settled columns send no values
  });

  it("masks identifiers, keeping only their shape", () => {
    const samplesOf = (header: string) => request.columns.find((column) => column.header === header)?.samples;
    expect(samplesOf("Ref")).toEqual(["9AAA9A9", "9AA9999AAA"]);
    expect(samplesOf("Bin")).toEqual(["A9A9A9A", "A9A9A9A"]);
    // A name is sent as its shape too: capitals and spaces are enough to recognise "a person".
    expect(samplesOf("Keeper")).toEqual(["Aaaaa Aaa", "Aaa Aaaaaa"]);
  });

  it.each([
    ["a person's name", "Sarah O'Connor", "Aaaaa A'Aaaaaa"],
    ["a name with accents", "Nguyễn Văn An", "Aaaaaa Aaa Aa"],
    ["an email address", "sarah.oconnor@acme.com.au", "aaaaa.aaaaaaa@aaaa.aaa.aa"],
    ["a MAC address", "00:1A:2B:3C:4D:5E", "99:9A:9A:9A:9A:9A"],
    ["a phone number", "+61 412 345 678", "+99 999 999 999"],
    ["a hostname", "SYD-LT-SOCONNOR", "AAA-AA-AAAAAAAA"],
    ["an IP address", "192.168.1.10", "999.999.9.99"],
    ["a serial number", "5CG1234ABC", "9AA9999AAA"],
    ["a serial number with a prefix", "SN 5CG9876XYZ", "AA 9AA9999AAA"],
    ["a serial number written with spaces", "5CG 1234 ABC", "9AA 9999 AAA"],
    ["a serial number with a remark", "PF-2ABCDE (old)", "AA-9AAAAA (aaa)"],
    ["free text we cannot classify", "In use by finance", "Aa aaa aa aaaaaaa"],
  ])("sends %s as its shape only", (_label, value, shape) => {
    expect(maskSample(value)).toBe(shape);
  });

  it.each(["16GB", "512 GB SSD", "Intel Core i7-1185G7", "Latitude 5420", "Dell", "Laptop", "2021-03-04", '15.6"'])(
    "sends the hardware detail %s as written, because it identifies the column and nobody",
    (value) => {
      expect(maskSample(value)).toBe(value);
    },
  );

  it("masks a code-like word inside a hardware description", () => {
    // "SN" is not a hardware word, so it goes out as its shape too: every word is decided on its own.
    expect(maskSample("Dell Latitude 5420 i7-1185G7 16GB SN 7HKQ2M3")).toBe("Dell Latitude 5420 i7-1185G7 16GB AA 9AAA9A9");
    expect(maskSample("Latitude 5420 16GB sarah@acme.com")).toBe("Latitude 5420 16GB aaaaa@aaaa.aaa");
  });

  // The strings a reviewer ran: a person's name beside a brand, a type word or a spec used to
  // leave the browser, because the whole cell read as a hardware detail.
  it.each([
    ["Latitude 5420 - John Smith", "Latitude 5420 - Aaaa Aaaaa"],
    ["John Smith laptop", "Aaaa Aaaaa laptop"],
    ["MacBook of Priya Patel", "MacBook aa Aaaaa Aaaaa"],
    ["Dell Smith", "Dell Aaaaa"],
    ["Apple Tran", "Apple Aaaa"],
    ["HP (John)", "HP (Aaaa)"],
    ["16GB Sarah", "16GB Aaaaa"],
    ["Intel Core i7 - assigned to Mary Jones 0412345678", "Intel Core i7 - aaaaaaaa aa Aaaa Aaaaa 9999999999"],
  ])("keeps the hardware words of %s and sends the shape of every other word", (value, sent) => {
    expect(maskSample(value)).toBe(sent);
  });

  it.each([
    ["a phone number written with spaces", "Intel Core i7 - call 0412 345 678", "Intel Core i7 - aaaa 9999 999 999"],
    ["a phone number with an area code", "Dell laptop (04) 1234 5678", "Dell laptop (99) 9999 9999"],
    ["a name glued to a brand", "Dell/John 16GB", "Aaaa/Aaaa 16GB"],
    ["a name glued to a number", "Latitude 5420 Smith5420", "Latitude 5420 Aaaaa9999"],
    ["a name in another alphabet", "Latitude 5420 Иван Ив12345", "Latitude 5420 Aaaa Aa99999"],
    ["a name with accents", "ThinkPad T14 Nguyễn Văn An", "ThinkPad T14 Aaaaaa Aaa Aa"],
  ])("masks %s inside a hardware description", (_label, value, sent) => {
    expect(maskSample(value)).toBe(sent);
  });

  it.each([
    "HP ProDesk 400 G7 i5-10500 8GB 256GB SSD",
    "Lenovo ThinkPad X1 Gen 9, Core i7-1165G7, 16 GB RAM, 1TB NVMe",
    "MacBook Pro 14-inch",
    "Intel Xeon Gold 6230",
    "SSD/HDD 512 GB",
  ])("sends the hardware description %s as written: every word is vocabulary or a spec", (value) => {
    expect(maskSample(value)).toBe(value);
  });

  it("cannot tell a name that is also a hardware word from the hardware; the screen says so", () => {
    // "Swift" is an Acer product line. The rules have no way to know this one is a surname.
    expect(maskSample("Taylor Swift")).toBe("Aaaaaa Swift");
  });

  it("sends nothing personal from a sheet of unknown columns", () => {
    const personal: RawSheet = {
      name: "P",
      hidden: false,
      rows: [
        ["Serial Number", "Model", "Owner name", "Email", "Hostname", "MAC", "Phone", "Ref", "Old S/N"],
        ["5CG1234ABC", "Latitude 5420", "Sarah O'Connor", "sarah.oconnor@acme.com.au", "SYD-LT-SOCONNOR", "00:1A:2B:3C:4D:5E", "+61 412 345 678", "SN 5CG9876XYZ", "PF-2ABCDE (old)"],
        ["5CG1234ABD", "EliteBook 840", "James Nguyen", "james.nguyen@acme.com.au", "MEL-DT-JNGUYEN", "00:1A:2B:3C:4D:5F", "+61 413 222 111", "5CG 1234 ABC", "PF-2ABCDG"],
      ],
    };
    const sent = JSON.stringify(buildSuggestRequest(planSheet(personal)));
    for (const secret of ["Sarah", "Connor", "James", "Nguyen", "acme", "SOCONNOR", "JNGUYEN", "1A:2B", "412", "222", "5CG", "2ABCD"]) {
      expect(sent, secret).not.toContain(secret);
    }
  });

  it("sends the same from a sheet with no header row", () => {
    const bare: RawSheet = {
      name: "B",
      hidden: false,
      rows: [
        ["Sarah O'Connor", "Latitude 5420", "5CG1234ABC", "sarah.oconnor@acme.com.au"],
        ["James Nguyen", "EliteBook 840", "5CG1234ABD", "james.nguyen@acme.com.au"],
        ["Priya Patel", "ThinkPad T14", "PF2ABCDE", "priya.patel@acme.com.au"],
      ],
    };
    const sent = JSON.stringify(buildSuggestRequest(planSheet(bare, null)));
    for (const secret of ["Sarah", "James", "Priya", "Patel", "acme", "5CG", "PF2"]) expect(sent, secret).not.toContain(secret);
    expect(sent).toContain("Column A"); // the made-up column names are not data, and the prompt relies on them
  });

  it("masks a code-like word in a column name: a data row can be mistaken for the header row", () => {
    const wrongHeader: RawSheet = {
      name: "W",
      hidden: false,
      rows: [
        ["Owner", "Sarah O'Connor", "Serial", "5CG1234ABC"],
        ["Owner", "James Nguyen", "Serial", "5CG1234ABD"],
      ],
    };
    const request = buildSuggestRequest(planSheet(wrongHeader, 0));
    expect(request.columns.map((column) => column.header)).toEqual(["Owner", "Sarah O'Connor", "Serial", "9AA9999AAA"]);
  });

  it("masks every column name we do not know when the header row itself is a doubtful guess", () => {
    const doubtful = { ...plan, header: { ...plan.header, confidence: 0.4 } };
    const sent = buildSuggestRequest(doubtful).columns.map((column) => column.header);
    expect(sent).toEqual(["Type", "Brand", "Aaa", "Aaa", "Aaaaaa", "Building", "Aaa"]);
  });

  it("sends at most five short samples per column", () => {
    const long: RawSheet = { name: "L", hidden: false, rows: [["Mystery"], ...Array.from({ length: 9 }, (_, i) => [`${"x".repeat(200)} ${i}`])] };
    const [column] = buildSuggestRequest(planSheet(long)).columns;
    expect(column.samples.length).toBeLessThanOrEqual(5);
    expect(column.samples.every((sample) => sample.length <= 80)).toBe(true);
  });
});

describe("applySuggestions", () => {
  const index = (header: string) => plan.columns.find((column) => column.header === header)?.index ?? -1;
  const target = (result: typeof plan, header: string) => result.columns.find((column) => column.header === header);

  it("maps an unclear column and marks the mapping as coming from AI", () => {
    const result = applySuggestions(plan, [{ index: index("Keeper"), target: "assignedTo", confidence: 0.95, reason: "A keeper is the person holding the asset" }]);
    expect(target(result, "Keeper")).toMatchObject({
      target: "assignedTo",
      source: "ai",
      confidence: 0.8, // capped: an AI suggestion is never shown as "High"
      reason: "AI suggestion: A keeper is the person holding the asset",
    });
  });

  it("ignores a suggestion for a column the rules already settled", () => {
    const result = applySuggestions(plan, [{ index: index("Brand"), target: "notes", confidence: 1, reason: "x" }]);
    expect(target(result, "Brand")?.target).toBe("manufacturer");
  });

  it("ignores a suggestion for a field another column already holds", () => {
    const result = applySuggestions(plan, [{ index: index("Bin"), target: "location", confidence: 0.9, reason: "x" }]);
    expect(target(result, "Bin")?.target).toBe("ignore");
    expect(target(result, "Building")?.target).toBe("location");
  });

  it("ignores 'unmapped', unknown fields and columns that do not exist", () => {
    const result = applySuggestions(plan, [
      { index: index("Bin"), target: "unmapped", confidence: 0.9, reason: "x" },
      { index: index("Keeper"), target: "favouriteColour", confidence: 0.9, reason: "x" },
      { index: 99, target: "notes", confidence: 0.9, reason: "x" },
    ]);
    expect(result.columns).toEqual(plan.columns);
  });

  it("accepts field names whatever their capitalisation and clamps odd confidences", () => {
    const result = applySuggestions(plan, [{ index: index("Keeper"), target: "ASSIGNEDTO", confidence: -3, reason: "x" }]);
    expect(target(result, "Keeper")).toMatchObject({ target: "assignedTo", confidence: 0 });
  });

  it("gives a field to the first of two columns suggested for it", () => {
    const result = applySuggestions(plan, [
      { index: index("Keeper"), target: "notes", confidence: 0.7, reason: "x" },
      { index: index("Bin"), target: "notes", confidence: 0.7, reason: "x" },
    ]);
    expect([target(result, "Keeper")?.target, target(result, "Bin")?.target]).toEqual(["notes", "ignore"]);

    // A flagged column can be re-read, which frees its field for another column.
    const swapped = applySuggestions(plan, [
      { index: index("Ref"), target: "assetTag", confidence: 0.7, reason: "x" },
      { index: index("Bin"), target: "serialNumber", confidence: 0.7, reason: "x" },
    ]);
    expect([target(swapped, "Ref")?.target, target(swapped, "Bin")?.target]).toEqual(["assetTag", "serialNumber"]);
  });
});
