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
