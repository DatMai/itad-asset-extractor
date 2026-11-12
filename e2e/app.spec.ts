import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { sample, UNSEEN_CSV } from "./fixtures";

/** Upload a file through the real file input, the way a user's "choose file" does. */
async function upload(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('input[type="file"]').setInputFiles(file);
}

/** The line under the upload box: "Opened <file>: N sheets, M rows extracted." */
const opened = (page: Page) => page.getByText(/^Opened /);

/** One editable value in the results table, found by the label a screen reader hears. */
const cell = (page: Page, label: RegExp) => page.getByRole("button", { name: label });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Asset Sheet Extractor" })).toBeVisible();
});

test("client sample 1: header on row 4, two sheets, 19 assets, the TOTAL row explained", async ({ page }) => {
  await page.getByRole("button", { name: /Client sample 1/ }).click();

  await expect(opened(page)).toContainText("sample_assets_1.xlsx");
  await expect(opened(page)).toContainText("2 sheets, 19 rows extracted");
  // Row index 3 is spreadsheet row 4; the second sheet's header is on row 3.
  await expect(page.locator('[id="header-row-Assets"]')).toHaveValue("3");
  await expect(page.locator('[id="header-row-Sheet1 (2)"]')).toHaveValue("2");

  // A normalised value keeps its original text one hover away.
  const ram = page.locator('button[title*="32768 MB"]');
  await expect(ram).toContainText("32 GB");
  await expect(ram).toBeVisible();
  await expect(ram).toHaveAttribute("title", /32768 MB/);

  await page.getByRole("button", { name: /^Skipped rows \(\d+\)/ }).click();
  await expect(page.getByRole("cell", { name: /TOTAL/ })).toBeVisible();
});

test("client sample 2: one description column becomes fields; non-computers are set aside", async ({ page }) => {
  await page.getByRole("button", { name: /Client sample 2/ }).click();

  await expect(page.getByRole("button", { name: "Computers (14)" })).toBeVisible();
  await expect(cell(page, /^Model: EliteBook 850 G7/)).toBeVisible();
  await expect(cell(page, /^CPU: Intel Core i7-10610U/)).toBeVisible();

  await page.getByRole("button", { name: "Not computers (2)" }).click();
  await expect(page.getByRole("button", { name: /P2422H/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /MX Keys/ })).toBeVisible();
});

test("a layout it has never seen: title lines, unusual header names, a subtotal row", async ({ page }) => {
  await upload(page, { name: "unseen.csv", mimeType: "text/csv", buffer: Buffer.from(UNSEEN_CSV) });

  await expect(opened(page)).toContainText("unseen.csv");
  await expect(page.getByRole("button", { name: "Computers (3)" })).toBeVisible();
  await expect(page.locator('[id="header-row-unseen.csv"]')).toHaveValue("3");

  await expect(cell(page, /^Serial number: 7XK2PQ2/)).toBeVisible();
  await expect(cell(page, /^CPU: Intel Core i5-8350U/)).toBeVisible();
  await expect(cell(page, /^RAM \(GB\): 8 GB/)).toHaveCount(2); // "8GB" and "8192 MB"
  await expect(cell(page, /^Storage \(GB\): 1 TB/)).toBeVisible();
  await expect(cell(page, /^Asset tag: A-101/)).toBeVisible();

  await page.getByRole("button", { name: /^Skipped rows \(\d+\)/ }).click();
  await expect(page.getByRole("cell", { name: /Subtotal/ })).toBeVisible();
});

test("the user can correct how the file was read", async ({ page }) => {
  await page.getByRole("button", { name: /Client sample 1/ }).click();
  await expect(opened(page)).toContainText("19 rows extracted");

  // Remap one column: Location (column J) is no longer used, then becomes Notes.
  const location = page.locator('[id="target-Assets-9"]');
  await expect(location).toHaveValue("location");
  await location.selectOption("ignore");
  await expect(cell(page, /^Location: Sydney/)).toHaveCount(0);
  await location.selectOption("notes");
  await expect(page.getByText("Set by you").first()).toBeVisible();
  await expect(cell(page, /^Notes: Sydney/).first()).toBeVisible();

  // Leave the second sheet out, then put it back.
  const include = page.getByRole("checkbox", { name: "Include this sheet" });
  await include.nth(1).uncheck();
  await expect(opened(page)).toContainText("15 rows extracted");
  await include.nth(1).check();
  await expect(opened(page)).toContainText("19 rows extracted");

  // Tell it there is no header row, then let it detect the header again.
  const headerRow = page.locator('[id="header-row-Assets"]');
  await headerRow.selectOption("none");
  await expect(opened(page)).not.toContainText("19 rows extracted");
  await page.getByRole("button", { name: "Detect again" }).first().click();
  await expect(headerRow).toHaveValue("3");
  await expect(opened(page)).toContainText("19 rows extracted");
});

test("editing a cell, moving a row, and exporting CSV and JSON", async ({ page }) => {
  await page.getByRole("button", { name: /Client sample 2/ }).click();
  await expect(page.getByRole("button", { name: "Computers (14)" })).toBeVisible();

  // Correct one value by hand.
  await cell(page, /^Manufacturer: HP/).first().click();
  const editor = page.getByRole("textbox", { name: "Edit Manufacturer" });
  await editor.fill("Acme Computers");
  await editor.press("Enter");
  const edited = cell(page, /^Manufacturer: Acme Computers/);
  await expect(edited).toBeFocused(); // Enter saves and puts the focus back on the cell
  await expect(edited).toBeVisible();
  await expect(edited).toContainText("edited");

  // Say one row is not a computer: it leaves the export.
  await page.getByRole("button", { name: "Not a computer" }).last().click();
  await expect(page.getByRole("button", { name: "Computers (13)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Not computers (3)" })).toBeVisible();

  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download CSV" }).click();
  const csvFile = await csvDownload;
  expect(csvFile.suggestedFilename()).toBe("sample_assets_2-assets.csv");
  const csv = await readFile(await csvFile.path(), "utf8");
  expect(csv.charCodeAt(0)).toBe(0xfeff); // the mark that makes Excel read it as UTF-8
  const lines = csv.trim().split("\r\n");
  expect(lines[0]).toContain("assetType,manufacturer,model,serialNumber,cpu,ramGB,storageGB");
  expect(lines[0]).toContain("confidence,needsReview");
  expect(lines).toHaveLength(1 + 13);
  expect(csv).toContain("Acme Computers");

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  const rows: Array<Record<string, unknown>> = JSON.parse(await readFile(await (await jsonDownload).path(), "utf8"));
  expect(rows).toHaveLength(13);
  expect(rows[0]).toMatchObject({ manufacturer: "Acme Computers", sourceSheet: expect.any(String), needsReview: expect.any(Boolean) });
  for (const row of rows) expect(row.confidence).toBeGreaterThanOrEqual(0);
});

test("files that cannot be read get a specific message, and the app recovers", async ({ page }) => {
  const alert = page.locator('section [role="alert"]'); // Next.js keeps an empty alert of its own on the page

  // A picture renamed to .xlsx: recognised from its first bytes, not its name.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  await upload(page, { name: "photo.xlsx", mimeType: "image/png", buffer: png });
  await expect(alert).toBeVisible();
  const pictureMessage = await alert.innerText();

  await upload(page, { name: "empty.csv", mimeType: "text/csv", buffer: Buffer.alloc(0) });
  await expect(alert).toBeVisible();
  await expect(alert).not.toHaveText(pictureMessage); // each failure has its own words

  await upload(page, { name: "huge.csv", mimeType: "text/csv", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, "a") });
  await expect(alert).toContainText("larger than 5 MB");
  await expect(page.getByRole("heading", { name: /Review the result/ })).toHaveCount(0);

  // A good file after a bad one works, and the message goes away.
  await upload(page, sample("semicolon_abbrev.csv"));
  await expect(opened(page)).toContainText("semicolon_abbrev.csv");
  await expect(alert).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Computers (5)" })).toBeVisible();
});

test("the spreadsheet never leaves the browser", async ({ page }) => {
  const sent: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    // Anything that could carry the file: a request with a body, or one to another host.
    if (request.method() !== "GET" || url.hostname !== "localhost") sent.push(`${request.method()} ${request.url()}`);
  });

  await upload(page, sample("sample_assets_1.xlsx"));
  await expect(opened(page)).toContainText("19 rows extracted");
  await page.locator('[id="target-Assets-9"]').selectOption("notes");
  await cell(page, /^Manufacturer: Dell/).first().click();
  await page.getByRole("textbox", { name: "Edit Manufacturer" }).press("Escape");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON" }).click();
  await download;

  expect(sent).toEqual([]);
});

test("the six bundled samples all open without an error", async ({ page }) => {
  const samples = page.getByRole("list").getByRole("button");
  await expect(samples).toHaveCount(6);
  for (let index = 0; index < 6; index++) {
    await samples.nth(index).click();
    await expect(opened(page)).toBeVisible();
    await expect(page.locator('section [role="alert"]')).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Computers \([1-9]\d*\)/ })).toBeVisible();
  }
});
