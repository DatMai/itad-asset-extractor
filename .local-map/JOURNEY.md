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
