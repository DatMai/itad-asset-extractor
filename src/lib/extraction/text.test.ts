import { describe, expect, it } from "vitest";
import { isPlaceholder, normaliseText, parseNumber, similarity } from "./text";

describe("normaliseText", () => {
  it("makes spelling variants of a header equal", () => {
    expect(normaliseText("S/N")).toBe("s n");
    expect(normaliseText("  Serial No. ")).toBe("serial no");
    expect(normaliseText("HDD/SSD")).toBe("hdd ssd");
    expect(normaliseText("Serial #")).toBe("serial no");
  });

  it("strips Vietnamese accents", () => {
    expect(normaliseText("Số sê-ri")).toBe("so se ri");
    expect(normaliseText("Ổ cứng")).toBe("o cung");
    expect(normaliseText("Địa điểm")).toBe("dia diem");
  });
});

describe("isPlaceholder", () => {
  it.each(["", "  ", "N/A", "n/a", "-", "--", "?", "None", "unknown", "TBC"])(
    "treats %j as no value",
    (text) => expect(isPlaceholder(text)).toBe(true),
  );

  it.each(["0", "Dell", "14"])("treats %j as a value", (text) =>
    expect(isPlaceholder(text)).toBe(false),
  );
});

describe("similarity", () => {
  it("is 1 for the same letters regardless of spacing and case", () => {
    expect(similarity("Serial Number", "serialnumber")).toBe(1);
  });

  it("stays high for one typo", () => {
    expect(similarity("seriel number", "serial number")).toBeGreaterThan(0.8);
    expect(similarity("Seriel No", "serial no")).toBeGreaterThan(0.8);
    expect(similarity("procesor", "processor")).toBeGreaterThan(0.8);
  });

  it("is not fooled by different words that share letters", () => {
    expect(similarity("location", "processor")).toBeLessThan(0.5);
    expect(similarity("asset tag", "asset type")).toBeLessThan(0.8);
    expect(similarity("modem", "model")).not.toBeGreaterThan(0.8); // one letter in five is too much
  });
});

describe("parseNumber", () => {
  it("reads decimal commas and thousands commas", () => {
    expect(parseNumber("15,6")).toBe(15.6);
    expect(parseNumber("32,768")).toBe(32768);
    expect(parseNumber("1.92")).toBe(1.92);
    expect(parseNumber("1,5")).toBe(1.5);
  });
});
