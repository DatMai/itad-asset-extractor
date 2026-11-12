/**
 * What the screens say, checked on the HTML the components produce. There is no browser here,
 * so clicks, focus and drag-and-drop are not covered; the end-to-end test covers those.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { extractAll, planSheet } from "@/lib/extraction/pipeline";
import type { RawSheet } from "@/lib/extraction/types";
import { AiSuggest } from "./AiSuggest";
import { ResultsPanel } from "./ResultsPanel";

const extract = (rows: string[][]) => {
  const sheet: RawSheet = { name: "S", hidden: false, rows };
  return extractAll([planSheet(sheet)]);
};
const results = (rows: string[][]) =>
  renderToStaticMarkup(createElement(ResultsPanel, { fileName: "list.csv", ...extract(rows), onEdit: () => {}, onKind: () => {} }));

describe("ResultsPanel with no computers", () => {
  it("says the file holds only non-computers, not that the header row is wrong", () => {
    const html = results([
      ["Type", "Brand", "Model", "Serial Number"],
      ["Monitor", "Dell", "U2419H", "CN0ABC123"],
      ["Docking station", "Dell", "WD19", "CN0ABC124"],
    ]);
    expect(html).toContain("Computers (0)");
    expect(html).toContain("Not computers (2)");
    expect(html).toContain("No computers in this file. 2 rows were set aside as non-computers");
    expect(html).not.toContain("No assets were found.");
  });

  it("keeps the header-row advice when nothing at all was found", () => {
    const html = results([["Remarks"], ["nothing to see"]]);
    expect(html).toContain("No assets were found.");
  });
});

describe("ValueCell, as drawn in the results table", () => {
  const html = results([
    ["Type", "Brand", "Model", "Serial Number", "RAM"],
    ["", "", "ThinkPad T14", "PF2ABCDE", "16GB"],
  ]);

  it("labels the cell button with the column title and the value", () => {
    expect(html).toContain('aria-label="Model: ThinkPad T14. Click to edit."');
    expect(html).toContain('aria-label="RAM (GB): 16 GB. Click to edit."');
  });

  it("tags a value that was worked out and not read", () => {
    expect(html).toMatch(/aria-label="Manufacturer: Lenovo[^"]*Click to edit\."[^>]*>.*?<span[^>]*>inferred<\/span>/);
  });

  it("does not ask for the focus when the table is first drawn", () => {
    expect(html).not.toContain("autofocus");
  });

  it("gives a screen reader the original text and the reason, not only a mouse tooltip", () => {
    const html = results([
      ["Type", "Brand", "Model", "Serial Number", "RAM"],
      ["Laptop", "Dell", "Latitude 5420", "7HKQ2M3", "16GB"],
    ]);
    const described = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    expect(described).toBeDefined();
    expect(html).toContain(`id="${described}" class="sr-only"`);
    expect(html).toContain("Confidence: High");
  });
});

describe("AiSuggest", () => {
  const html = renderToStaticMarkup(createElement(AiSuggest, { unclear: 2, status: undefined, onAsk: () => {} }));

  it("says what is sent as written and what is sent as a shape, before the click", () => {
    expect(html).toContain("Ask AI about the 2 unclear columns");
    expect(html).toContain("a word is sent as written only if it is a hardware word");
    expect(html).toContain("a specification or a date");
    expect(html).toContain("a number of at most four characters");
    expect(html).toContain("Every other word, including names, emails, phone numbers, serial numbers and tags");
    expect(html).toContain("each letter becomes A or a, each digit 9");
    expect(html).toContain("Nothing else leaves your browser.");
  });

  it("admits the one thing the rules cannot tell: a name that is also a hardware word", () => {
    expect(html).toContain("A name that is also a hardware word (such as “Swift”, an Acer laptop) is sent as written.");
  });

  it("no longer promises that a whole value is judged at once", () => {
    expect(html).not.toContain("Only sample values that read as hardware details or dates");
  });

  it("no longer claims that only serial numbers and tags are masked", () => {
    expect(html).not.toContain("Serial numbers and tags are masked.");
  });
});
