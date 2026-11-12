# Journey

Append-only log. Newest at the bottom. Times are Vietnam time (GMT+7).

## 2026-11-11

### 22:10 Read the sources

- Read the challenge email, the candidate brief (PDF) and both sample files.
- Read the samples as raw data, not through a spreadsheet app, to see what is really stored:
  - `sample_assets_1.xlsx` has two sheets, `Assets` and `Sheet1 (2)`. All cells are inline
    strings; there are no numeric or date cells and no merged cells.
  - `Assets`: title on row 1, "Exported by" on row 2, row 3 blank, header on row 4, assets on rows
    5–19 (15 of them), row 20 blank, `TOTAL` in column A and `15` in column J on row 21.
  - `Sheet1 (2)`: note on row 1, row 2 blank, header on row 3 (`Serial`, `Equipment`,
    `CPU / RAM / Disk`, `Screen`), 4 assets on rows 4–7.
  - `sample_assets_2.csv`: 16 data rows, CRLF line endings, quoted cells containing commas and
    doubled quotes. 14 computers (IT-0014 is a NAS), a monitor (IT-0005), a keyboard (IT-0011).
    `Purchased` mixes `12/03/2021` and `2021-08-19`.
- Evidence: the raw dumps were produced by unzipping the workbook and printing every row.

### 22:20 Reviewed the brief against eight criteria

- Criteria: goal, inputs, constraints, trade-offs, acceptance criteria, examples, evidence,
  sources. The first draft had no trade-offs, no evidence and did not cite the email.
- Found two contradictions in its examples: storage (`2x 1TB` → 2048 while everything else used
  1 TB = 1000 GB) and CPU text (one example canonicalised, the others verbatim).
- Found three things in the email the draft had dropped: "16 gig", the cell
  "Dell Lat 5420 i7 16GB", and that the client weighs "UX when things go wrong".
- Result: `docs/spec.md`. Section 9 there lists every change.

### 22:25 Checked what is current

- From the npm registry today: next 16.4.6, react 19.3, tailwindcss 4.3, zod 4.6, vitest 5.1.
- `xlsx` on npm is still 0.18.5 (the last npm release); `exceljs` 4.4.0 was last published in
  December 2024.
- Decision D7: use Next.js 16, not 15 as the first draft said.

### 22:30 Scaffolded the app

- `create-next-app` 16.4.6 with TypeScript, Tailwind, ESLint, App Router, `src/` directory, pnpm.
- Added `zod` and `vitest`.
- Commit `ca36d6c` on `main`. All further work is on `feat/asset-extraction`.
- The scaffold's `AGENTS.md` warns that this Next.js differs from older versions and points at
  `node_modules/next/dist/docs/`. Read the route handler and Vitest guides before writing code.

### 22:35 Started research and the agent documents

- Research questions (four, narrow): reading xlsx/csv and finding the header row; column
  identification; parsing combined cells; importer UX patterns. Output: `docs/research.md`.
- Wrote `AGENTS.md`, `CLAUDE.md`, `.agent/PROTOCOL.md`, three skills and three subagent
  definitions under `.claude/`, and this map.

### 22:40 The map became `.local-map`

- The owner corrected the first version: the map is a folder that holds scripts, screenshots and
  evidence, not only notes. Renamed `local-map/` to `.local-map/`, added `scripts/`, `evidence/`,
  `screenshots/`, `research/`.
- Evidence: `scripts/inspect-workbook.py`, `evidence/sample-dumps/*.txt`.

### 22:45 Installed SheetJS and probed how it behaves

- Installed 0.20.3 from `cdn.sheetjs.com` (decisions D1 and D18).
- Probed before writing the reader, to replace assumptions with facts:
  - With `raw: true`, CSV cells stay text: `0012`, `1E5` and `12/03/2021` come back unchanged.
  - Delimiters `;`, tab and `|` are detected; `sep=|` is honoured.
  - A JavaScript `Date` for midnight UTC, written on a machine in GMT+7, is stored as
    `44267.29` and formatted `3/12/21`. That is the time-zone trap; we convert the day number
    ourselves instead (`readWorkbook.ts`, `dayNumberToIso`).
  - A PNG is refused by SheetJS; a PDF is not (it parses as one text column), so we check for it.

### 22:48 Normalisers

- `normalise.ts` with 116 tests for the AC5 table.
- Honest note on process: these tests were written before the code but first run after it.
  From `parseFreeText` on, every test file was run and seen failing before the code existed.

### 22:53 Combined cells

- `parseFreeText.ts`: all 16 descriptions of `sample_assets_2.csv` parse exactly, plus the cells
  of `Sheet1 (2)` and "Dell Lat 5420 i7 16GB" from the brief.

### 23:00 Column mapping

- `mapColumns.ts`. Swapped the similarity measure from letter pairs to edit distance: "Seriel No"
  scored only 0.71 against "serial no" with letter pairs, which missed a one-letter typo (D9).

### 23:02 Research finished

- Report in `research/report.md`, one page in `docs/research.md`. Four findings changed the plan:
  count delimiters ourselves (SheetJS looks at 1,024 characters only); load the parser with
  `import()`; show confidence as named levels, not bare percentages; let the model answer
  "unmapped".

### 23:04 Header detection, 23:07 the reader and four fixtures

- `detectHeader.ts`, `readWorkbook.ts`, `scripts/make-fixtures.mjs`.
- A mistake caught by its own test: the first hand-made "encrypted zip" bytes did not trigger
  SheetJS's encryption error. The test now uses bytes that do, and says that no real
  password-protected workbook was available.

### 23:11 The pipeline on the real files

- `extractAssets.ts`, `pipeline.ts`. 23 of 24 acceptance tests passed on the first run. The one
  that failed showed a CPU with no model number sitting exactly on the "Check" threshold; it is
  now below it (D12).
- A probe then showed the `Memory` column at 0.92 because `256 GB` was classed as storage.
  Fixed how values count for or against a header (D10). Details in `REVIEW.md`.

### 23:17 Manual corrections, 23:20 the UI

- `edits.ts`, then the four panels.
- Checked in the browser (Chromium, 1280 px): both client samples, the four fixtures, six kinds
  of unreadable file, remapping a column, editing a cell, the non-computer and skipped views.
- Found there: the page scrolled sideways (fixed). Screenshots `01`–`06`.

### 23:27 The optional AI suggestion

- `src/lib/llm/`, `src/app/api/suggest-mapping/route.ts`, tests with a fake client (D13).
- Ran it in the browser with a deliberately invalid key: request sent, 401 handled, message
  shown, mapping unchanged. Screenshot `07`. A live suggestion is not verified: no key.
- The placeholder `.env.local` could not be deleted (a guard on this machine protects `.env`
  files), so it was left with an empty key. It is ignored by git.

### 23:33 Production build

- `pnpm build` passes: `/` static, `/api/suggest-mapping` dynamic. The parser is a separate
  381 KB chunk (128 KB gzip) that the page does not reference until a file is opened.
- The first attempts failed with "binding to a port: Operation not permitted". Cause: the build
  had first been run inside a sandbox that forbids local ports, and Turbopack cached that
  failure. Clearing `.next/cache` and `.next/turbopack` fixed it.

### 23:36 Review as the client's engineer

- Four data bugs and four UI issues found after the tests were green; each got a failing test
  first. Listed in `REVIEW.md`. Commit `fd82557`.
- Measured speed at the row limit: 5,000 rows, plan 167 ms, extract 136 ms (Node).

### 23:39 README, map and handoff

- `README.md`, `MAP.md`, `REVIEW.md`, `.agent/HANDOFF.md`.
- Final check run saved to `evidence/checks/latest.txt`.

## 2026-11-12

### 09:40 Released, with the history rewritten

- Merged `feat/asset-extraction` into `main` and pushed both to a new public repository,
  https://github.com/DatMai/itad-asset-extractor.
- Commit messages were rewritten before the first push. Every hash written in this file before
  today is from the old history and does not resolve in a clone. Two corrections to the entries
  above: the scaffold commit cited as `ca36d6c` (22:30) is now `1620303`; the review fixes
  (23:36) are in `fd82557` in the pushed history.
- Before the push: typecheck, lint and 287 unit tests passed on the pushed commit, and the author
  tried the app by hand. The build was last run on 11 Nov and was not in the evidence file,
  because `check.sh` did not run it then.
- The author had read the code and the documents before this push (`REVIEW.md`, section 2).

### Second review: 37 confirmed findings

- Five areas were reviewed separately: extraction, UI, security and privacy, documentation, code
  quality. A finding was kept only when a second reviewer reproduced it, by running the code or
  by reading the files it named. 37 were confirmed: 12 high, 15 medium, 10 low.
- The high ones:
  - `Core m3-7Y30` and a loose `M2` (an M.2 drive) became an Apple CPU at full confidence.
  - A computer whose description mentions an accessory was hidden as "not a computer", even
    with CPU and RAM in their own columns.
  - Section headings, footers and wide total rows became assets.
  - `HDD Type` beat `HDD Size`; `Memory Slots` became RAM; `HDD Serial` became storage.
  - `16GB (2x8GB)` was read as storage; `8G 256G`, `512 SSD` and `256SSD` were not read.
  - A comma in a size (`1,92TB`, `32,768 MB`) gave a wrong number in a description.
  - One serial repeated on a large sheet built hundreds of megabytes of warning text.
  - Row warnings were not worked out again after a manual edit.
  - The AI request sent names, emails, MAC addresses and phone numbers as typed.
  - The row and column limits were applied after the whole workbook had been parsed.
  - The privacy statements overstated the masking.
  - The author's hand review was promised but empty.
- The full list with the status of each is in `REVIEW.md`, section 3.

### Fix round one: four areas, test first

- **Combined cells** (`vocab.ts`, `parseFreeText.ts`, `normalise.ts`). Intel Core m is its own
  rule; a bare `M1` to `M5` with no Apple word is 0.6 with a note; `M2 2280` is never a CPU. A
  bare Xeon model (`2x E5-2680 v4`) is read. One number pattern (`AMOUNT`) is shared by columns
  and descriptions, so decimal and thousands commas are read the same way. `G` and `T` count as
  units only beside another size; `3G`, `4G`, `5G` never. A drive size with no unit before a
  drive word is read as GB. A breakdown after a total is counted once. Three or more unlabelled
  sizes give RAM plus the rest as storage at 0.6. The model starts at the brand or product line;
  text in front is left out and noted. After a known product line, `with`, `no`, `+` and similar
  words start a remark. `iPhone 12 64GB` is a phone.
- **Rows and export** (`extractAssets.ts`, `edits.ts`, `exportAssets.ts`). A row with its own CPU
  or RAM stays a computer and gets `Mentions: <accessory>`. One-cell rows without a digit and
  total rows of any width are skipped with a reason. A generic type (`PC`) gives way to the
  product line. A cell doubtful only because of its column says so. Serial warnings are worked
  out again after a serial edit. Duplicate warnings name three rows at most. The export gains
  `warnings` and `editedFields`. New file `extractAssets.test.ts`.
- **Sheets and columns** (`fields.ts`, `mapColumns.ts`, `detectHeader.ts`, `readWorkbook.ts`,
  `limits.ts`). `notWith` stops `HDD Type` and `Memory Slots` from matching. Values the field's
  own normaliser cannot read count against a RAM, storage, screen or date header. A second drive
  or memory column is flagged (D22). The reader checks the declared unpacked size (D21), stops
  the parser at the row limit, and no longer trusts a sheet's declared size. Header detection
  classifies each cell once.
- **UI and AI** (`src/components`, `src/lib/llm`, the route, `next.config.ts`). A late AI answer
  is checked against the sheet on screen (`plans.ts`). Each opened file resets the panels. A
  drop during a load is ignored. "Detect again" keeps hand-set columns. A file of only
  non-computers gets its own message. Masking becomes the default. The route refuses a body
  over 128,000 bytes before reading it, caps the answer at 3,000 tokens and trims it. Security
  headers added (D24). New files `plans.ts`, `plans.test.ts`, `screens.test.ts`,
  `security-headers.test.ts`.
- Evidence: after the round the whole suite passed with 15 files and 427 tests; typecheck and
  lint were clean.
- A check of the round by a reviewer then found nine new or remaining problems. Three were high,
  all in `parseFreeText.ts` and all caused by the fixes: a decimal comma in a comma list gave
  `8100` GB at high confidence; `512 SSD 8GB` gave 520 GB; `+ 24in monitor` put the monitor's
  size on the desktop. Three were medium: `IdeaPad 320 HDD` lost its model number to a drive
  size, the masking still sent `Latitude 5420 - John Smith` whole, and the heading rule skipped
  `Apple MacBook Air`. Three were low.

### Fix round two

- **`parseFreeText.ts`.** A decimal comma is doubted when the cell has another comma. Drives
  without a unit are found first and hidden from the size search, are not taken when they are
  the first number in the text, and are 0.6, not 0.8. When a remark names an accessory or says
  `external`, screen and sizes are read only from the text before it.
- **`extractAssets.ts`, `edits.ts`.** A one-cell row that names a known product line is kept.
  Marking a row "not a computer" removes "No serial number".
- **`suggestions.ts`, `AiSuggest.tsx`.** Masking is decided per word (D20). The statement on
  screen now gives the rule and its one stated exception.
- **`ValueCell.tsx`.** Reduced to one ref and one flag; the dropdown saves on change (D25).
- Evidence: 15 files, 478 tests passed; typecheck and lint clean. Seven of seven re-run problems
  were confirmed fixed. The same check found five more cases of a wrong value, two of them
  caused by this round. They are the subject of round three.

### Fix round three

- **`parseFreeText.ts`.**
  - A drive with no unit takes its count with it: `2 x 512 SSD 16GB` is 1,024 GB at 0.6 and
    16 GB RAM. Before, the count was left behind and doubled the RAM.
  - A screen size written in a remark, for a device that is not a laptop or tablet, is kept at
    0.6 with the note that it may be a separate monitor.
  - A drive word in front of a size under 120 GB does not label it: `Latitude 5490 SSD 8GB` is
    8 GB RAM, not 8 GB storage.
  - Sizes after `missing`, `without`, `w/o` or `no` are not the computer's.
- **`extractAssets.ts`.** A one-cell row that is only the product-line word (`Latitude`) or has
  a plural type word (`Latitude laptops`) is a heading again.
- The suite has 507 unit tests after this round.

### Browser tests

- Added `@playwright/test`, `playwright.config.ts`, `e2e/app.spec.ts` and `e2e/fixtures.ts`
  (D19). `pnpm e2e` builds the app, serves it on port 3100 and drives the installed Chrome.
- 8 tests: client sample 1; client sample 2; a layout no sample has; remapping,
  leaving a sheet out and changing the header row; editing a cell, moving a row and both
  downloads; three unreadable files and recovery; no request other than a `GET` to the app
  itself; all six samples open.
- Their first run failed on a real bug, not a test mistake: after round two simplified the cell
  editor, Enter saved the value and then the same key press activated the cell button that had
  just taken the focus, so the editor opened again. Fixed with `preventDefault` in
  `ValueCell.tsx`; the edit test asserts the focus is back on the cell. Result: 8 of 8 pass.
- `check.sh --all` now runs the browser tests after the other checks. It also replaces the
  project's absolute path with `.` in the saved output, because the earlier evidence file showed
  a local user name. `package.json` states Node.js 22.12 or later.

### Documents brought in line with the code

- README, `docs/spec.md` (C4, notes under AC4, AC6, AC8, AC12, new AC13), `docs/plan.md`,
  `AGENTS.md`, `CLAUDE.md`, `.agent/PROTOCOL.md`, `.agent/HANDOFF.md`, the `verify` and
  `add-extraction-rule` skills, the `ui-engineer` and `reviewer` definitions, `MAP.md`,
  `DECISIONS.md` (D8 reworded, D13 annotated, D20 to D25 added) and `REVIEW.md` (section 3).
- Each statement was checked against the code or a run. The results quoted for the six samples
  were produced by running the pipeline on them today.
- Still open and written down as such: the items under "Still open" in `REVIEW.md`.


### Author review recorded

- `REVIEW.md` section 2 and the README now state the author's own review: all of the code and
  documents were read before the repository was made public. Earlier entries of today said the
  checklist was open; that was the agent's wrong assumption and they were corrected.
