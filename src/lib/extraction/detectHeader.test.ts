import { describe, expect, it } from "vitest";
import { detectHeader } from "./detectHeader";

const assetsSheet = [
  ["Acme Logistics Pty Ltd - IT Asset Register"],
  ["Exported by: K. Brown  |  03/09/2026"],
  [],
  ["Device Type", "Make", "Model Name", "S/N", "Processor", "Memory", "HDD/SSD", "Display", "Assigned To", "Location"],
  ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "Intel Core i7-1185G7", "16GB", "512GB SSD", '14"', "Sarah Lee", "Sydney"],
  ["Desktop PC", "Dell", "OptiPlex 7090", "9JZL5N2", "Intel i7-10700", "32768 MB", "1 TB HDD", "N/A", "Reception", "Sydney"],
  [],
  ["TOTAL", "", "", "", "", "", "", "", "", "15"],
];

describe("detectHeader", () => {
  it("finds the header on row 4 of sample 1 / Assets, under two title rows and a blank row", () => {
    const guess = detectHeader(assetsSheet);
    expect(guess.rowIndex).toBe(3);
    expect(guess.confidence).toBe(1);
    expect(guess.reason).toBe("Row 4: 10 of 10 cells are column names we know");
  });

  it("finds the header on row 3 of sample 1 / Sheet1 (2)", () => {
    const guess = detectHeader([
      ["old list - check with Kevin before deleting!!"],
      [],
      ["Serial", "Equipment", "CPU / RAM / Disk", "Screen"],
      ["8RTQ3L2", "Dell Latitude 7400 laptop", "i5-8365U / 8GB / 256GB", "14in"],
    ]);
    expect(guess.rowIndex).toBe(2);
  });

  it("finds a header on the first row", () => {
    const guess = detectHeader([
      ["Asset Tag", "Item Description", "Serial No.", "Cost Centre", "Purchased", "Notes"],
      ["IT-0001", "HP EliteBook 850 G7 - i7-10610U / 16GB / 512GB SSD / 15.6in", "5CG0451QRS", "FIN", "12/03/2021", ""],
    ]);
    expect(guess.rowIndex).toBe(0);
  });

  it("is not distracted by title rows that have several cells", () => {
    const guess = detectHeader([
      ["Company:", "Acme Pty Ltd", "", "Printed:", "2026-09-03"],
      ["Site:", "Sydney", "", "Owner:", "IT Operations"],
      [],
      [],
      ["Notes:", "laptops due for refresh are marked"],
      [],
      ["Type", "Brand", "Model", "Serial", "RAM"],
      ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "16GB"],
    ]);
    expect(guess.rowIndex).toBe(6);
  });

  it("finds a header whose names it does not know, because the row is all labels", () => {
    const guess = detectHeader([
      ["Bestandsliste 2026"],
      ["Art", "Marke", "Bezeichnung", "Zustand", "Standort"],
      ["Laptop", "Dell", "Latitude 5420", "gut", "Berlin"],
      ["Server", "HPE", "ProLiant DL380 Gen10", "gut", "Hamburg"],
    ]);
    expect(guess.rowIndex).toBe(1);
    expect(guess.confidence).toBeLessThan(0.7);
    expect(guess.reason).toMatch(/none of its cells is a column name we know/);
  });

  it("reports no header when the first rows are already data", () => {
    const guess = detectHeader([
      ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "i7-1185G7", "16GB", "512GB SSD", '14"'],
      ["Desktop", "HP", "ProDesk 400 G7", "4CE0471ABC", "i5-10500", "8GB", "1TB HDD", ""],
    ]);
    expect(guess.rowIndex).toBeNull();
    expect(guess.reason).toMatch(/No row looks like column titles/);
  });

  it("reports no header for an empty sheet", () => {
    expect(detectHeader([]).rowIndex).toBeNull();
    expect(detectHeader([[], ["", ""]]).rowIndex).toBeNull();
  });

  it("takes the first header when it is repeated further down", () => {
    const header = ["Type", "Brand", "Model", "Serial"];
    const guess = detectHeader([header, ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3"], header, ["Server", "HPE", "ProLiant DL380", "CZJ93805KL"]]);
    expect(guess.rowIndex).toBe(0);
  });

  it("prefers the row of column names over a group-heading row above it", () => {
    const guess = detectHeader([
      ["Device", "", "", "Specification", "", ""],
      ["Type", "Brand", "Model", "CPU", "RAM", "Storage"],
      ["Laptop", "Dell", "Latitude 5420", "i7-1185G7", "16GB", "512GB SSD"],
    ]);
    expect(guess.rowIndex).toBe(1);
  });

  it("accepts a one-cell header when the whole sheet is one column wide", () => {
    const guess = detectHeader([["Devices for collection - March"], ["Device"], ["Dell Lat 5420 i7 16GB"], ["Cisco Catalyst 2960 switch"]]);
    expect(guess.rowIndex).toBe(1);
  });

  it("does not take a label row for a header when the table itself has none", () => {
    const data = [
      ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "i7-1185G7", "16GB", "512GB SSD"],
      ["Desktop", "HP", "ProDesk 400 G7", "4CE0471ABC", "i5-10500", "8GB", "1TB HDD"],
    ];
    // A title above the data: far narrower than the rows under it.
    expect(detectHeader([["Location:", "Sydney"], ...data]).rowIndex).toBeNull();
    // A footer below the data: nothing under it.
    expect(detectHeader([...data, [], ["Notes:", "call Kevin before collection"]]).rowIndex).toBeNull();
  });

  it("says what it measured when it picks a row of unknown names", () => {
    // Row 1 is also made only of labels and comes first; row 3 wins because it has more of them.
    const guess = detectHeader([["Name", "Place"], ["x"], ["Alpha", "Beta", "Gamma"], ["Delta", "Eps", "Zeta"]]);
    expect(guess.rowIndex).toBe(2);
    expect(guess.confidence).toBe(0.5);
    expect(guess.reason).toBe("Row 3: none of its cells is a column name we know, but it has the most cells that read like labels and a table under it");
    expect(guess.reason).not.toMatch(/first row/);
  });

  it("still finds a header that has property columns such as HDD Type beside the size columns", () => {
    const guess = detectHeader([
      ["Audit export"],
      ["Model", "Serial Number", "HDD Type", "HDD Size", "RAM Type", "RAM Size", "Processor Speed", "Processor"],
      ["Latitude 5420", "7HKQ2M3", "SSD", "256GB", "DDR4", "8GB", "2.4GHz", "Intel Core i5-1145G7"],
    ]);
    expect(guess.rowIndex).toBe(1);
    expect(guess.reason).toBe("Row 2: 5 of 8 cells are column names we know");
  });

  it("looks past blank rows for the table under a header, and gives the same answer on a long sheet", () => {
    const header = ["Type", "Brand", "Model", "Serial"];
    const row = ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3"];
    expect(detectHeader([header, [], ["", ""], row]).rowIndex).toBe(0);
    const long = [["Register"], header, ...Array.from({ length: 5000 }, () => row)];
    expect(detectHeader(long)).toEqual(detectHeader(long.slice(0, 40)));
  });
});
