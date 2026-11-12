# Asset Sheet Extractor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status of this document.** The work below is finished, so every box is ticked. The plan was
> first written on 11 Nov 2026 as a short table of steps. On 12 Nov 2026 it was rewritten in the
> Superpowers plan format (header, files, interfaces, test-first steps) without changing what was
> built. Each task names the commit that delivered it, so the plan can be checked against
> `git log`. What was not done the Superpowers way is listed under "Differences from the
> Superpowers workflow" at the end.

**Goal:** Turn any customer spreadsheet of IT assets (`.xlsx`, `.xls`, `.csv`) into one clean row per device, with a confidence level and the original text next to every value.

**Architecture:** A pipeline of pure TypeScript functions in `src/lib/extraction` (read → find header → map columns → extract and normalise → export) that runs in the browser and in Vitest unchanged. A one-page React UI keeps the state (sheets, header rows, mappings, edits) and calls the pipeline again on every change. One optional server route asks an LLM about columns the rules left unclear.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), Tailwind 4, Zod 4, SheetJS 0.20.3 (from cdn.sheetjs.com), Vitest 5, Playwright 1.65, `@anthropic-ai/sdk`, pnpm, Node.js 22.12 or later.

**Spec:** [`docs/superpowers/specs/2026-11-11-asset-sheet-extractor-design.md`](../specs/2026-11-11-asset-sheet-extractor-design.md). Research behind the choices: [`docs/research.md`](../../research.md).

## Global Constraints

Copied from section 3 of the spec. Every task includes them.

- **C1 Explainable.** Small files, plain functions, no library unless it removes real work.
- **C3 Deterministic first.** The default pipeline has no LLM. The LLM is an opt-in second opinion; if it fails the heuristic result stands.
- **C4 Security and privacy.** The spreadsheet is parsed in the browser and is never uploaded or stored. Limits: 5 MB per file; 100 MB unpacked for a zip workbook; 5,000 rows and 60 columns per sheet; 20 sheets. No secrets in git.
- **C5 Never invent data.** Unknown stays empty with low confidence. The original cell text is kept next to every normalised value.
- **C7 Clean history.** Small commits with clear messages. `pnpm i && pnpm dev` must work.
- Everything under `src/lib/extraction` is pure: no React, no DOM, no network.
- A task is done when `pnpm typecheck && pnpm lint && pnpm test` pass.

## Review Focus

Inputs the spec implies and that are most likely to bite a real user. Each has a test in the task that owns the code.

1. **A header row that is not row 1**, under title lines and above a total row. Expected: the right row is chosen and the total row is skipped with a reason. Task 4, Task 6.
2. **A file with no header row at all.** Expected: columns are identified from their values, with lower confidence. Task 3, Task 4.
3. **A capacity that could be RAM or storage** (`16GB` next to `512GB`, `8,1TB`, a bare `512`). Expected: a value only when the text decides it; otherwise empty or flagged. Task 1, Task 2.
4. **An accessory or remark inside a computer's description** ("with dock", "external 1TB drive"). Expected: the accessory's numbers are not attached to the computer. Task 2, Task 6.
5. **A file the reader cannot open** (empty, corrupt, password-protected, wrong type, over a limit). Expected: a specific message per case, and the app still works afterwards. Task 5, Task 9.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `src/lib/extraction/types.ts`, `fields.ts`, `limits.ts` | Shared types, the list of fields, the size limits |
| `src/lib/extraction/text.ts` | Small text helpers (normalise, tokens, similarity, placeholders) |
| `src/lib/extraction/vocab.ts` | The vocabulary tables: brands, product lines, type words, CPU families |
| `src/lib/extraction/normalise.ts` | One cell → one clean value |
| `src/lib/extraction/parseFreeText.ts` | One combined cell → several values |
| `src/lib/extraction/mapColumns.ts` | Column → field, with confidence and reason |
| `src/lib/extraction/detectHeader.ts` | Which row holds the column names |
| `src/lib/extraction/readWorkbook.ts` | File bytes → sheets of text cells (the only code that knows SheetJS) |
| `src/lib/extraction/extractAssets.ts`, `pipeline.ts` | Rows → assets; the two entry points the UI calls |
| `src/lib/extraction/exportAssets.ts` | Assets → CSV and JSON, checked by a Zod schema |
| `src/lib/extraction/edits.ts` | The user's corrections, applied on top of the pipeline |
| `src/components/*`, `src/app/page.tsx` | The three screens: upload, mapping, results |
| `src/lib/llm/*`, `src/app/api/suggest-mapping/route.ts` | The optional AI suggestion |
| `e2e/*`, `playwright.config.ts` | Browser tests on the production build |

---

### Task 1: Normalisers

Commit: `dd6c6e2 feat(extraction): normalise RAM, storage, screen, type, CPU and dates`

**Files:**
- Create: `src/lib/extraction/types.ts`, `src/lib/extraction/text.ts`, `src/lib/extraction/vocab.ts`, `src/lib/extraction/normalise.ts`
- Test: `src/lib/extraction/normalise.test.ts`, `src/lib/extraction/text.test.ts`

**Interfaces:**
- Produces: `interface Normalised<T> { value: T | null; confidence: number; note?: string }`
- Produces: `normaliseRam(raw: string, headerUnit?: CapacityUnit): Normalised<number>`, `normaliseStorage(raw, headerUnit?)`, `normaliseScreen(raw)`, `normaliseAssetType(raw)`, `normaliseManufacturer(raw)`, `normaliseCpu(raw)`, `normaliseDate(raw)`, `normaliseSerial(raw)`
- Produces: `findCpu`, `findBrand`, `findProductLine`, `findTypeWord`, `findNonComputerWord` from `vocab.ts`

- [x] **Step 1: Write the failing tests** (the AC5 table of the spec)

```ts
it.each([
  ["32768 MB", 32],
  ["8gb", 8],
  ["2x8GB", 16],
])("%j -> %d GB", (raw, expected) => {
  const result = normaliseRam(raw);
  expect(result.value).toBe(expected);
  expect(result.confidence).toBe(1);
});

it("assumes a unit for a bare number and says so", () => {
  expect(normaliseRam("16")).toMatchObject({ value: 16, confidence: 0.7 });
  expect(normaliseRam("16").note).toMatch(/assumed/i);
});
```

Same shape for storage (decimal: 1 TB = 1000 GB), screen, asset type, CPU and dates (day first).

- [x] **Step 2: Run to see them fail.** Run: `pnpm test normalise`. Expected: FAIL, module not found.
- [x] **Step 3: Implement the normalisers in `normalise.ts`.** RAM is binary (1024 MB = 1 GB), storage is decimal. A value that cannot be read returns `value: null`, never a guess.
- [x] **Step 4: Run to see them pass.** Run: `pnpm test normalise text`. Expected: PASS.
- [x] **Step 5: Commit.**

### Task 2: Free-text parser

Commit: `95d0988 feat(extraction): split combined cells into fields`

**Files:**
- Create: `src/lib/extraction/parseFreeText.ts`
- Test: `src/lib/extraction/parseFreeText.test.ts`

**Interfaces:**
- Consumes: the normalisers and `vocab.ts` lookups from Task 1
- Produces: `parseFreeText(text: string): ParsedText`, where each field is a `Found<T>` (value, confidence, the matched text)

- [x] **Step 1: Write the failing tests.** One row per description in `sample_assets_2.csv` (16), the cells of `sample_assets_1.xlsx` / `Sheet1 (2)`, and the examples quoted in the brief: `reads 'Dell Lat 5420 i7 16GB' and flags what is uncertain`, `reads 'HP EliteBook 840 G8 / i5 / 16GB / 256GB SSD / 14in'`, `trusts labels over position`.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test parseFreeText`. Expected: FAIL.
- [x] **Step 3: Implement `parseFreeText`.** Take the parts with a clear shape first (CPU, screen, capacities); what remains is manufacturer and model. Two capacities: the smaller is RAM only when the text supports it.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 3: Column mapper

Commit: `7008058 feat(extraction): map columns from header names and values`

**Files:**
- Create: `src/lib/extraction/fields.ts`, `src/lib/extraction/mapColumns.ts`
- Test: `src/lib/extraction/mapColumns.test.ts`

**Interfaces:**
- Produces: `mapColumns(headers: string[], rows: string[][]): ColumnMapping[]` (target, confidence 0–1, reason, sample values)
- Produces: `type ColumnTarget = FieldKey | "combined" | "ignore"`, `isKnownColumnName(text)`, `kindOfValue(value)`, `columnLetter(index)`

- [x] **Step 1: Write the failing tests.** `maps every column of sample 1 / Assets with high confidence`, `maps sample 1 / Sheet1 (2), including the column that lists its parts`, `maps sample 2`, plus misspelled names, abbreviations, Vietnamese names and a sheet with no header.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test mapColumns`. Expected: FAIL.
- [x] **Step 3: Implement `mapColumns`.** Two sources of evidence, one score: the column name (exact synonym, then strict fuzzy match) and the values in the column (support or veto). Every mapping carries a reason in plain words.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 4: Header detection

Commit: `ca62954 feat(extraction): find the header row`

**Files:**
- Create: `src/lib/extraction/detectHeader.ts`
- Test: `src/lib/extraction/detectHeader.test.ts`

**Interfaces:**
- Consumes: `isKnownColumnName`, `kindOfValue` from Task 3
- Produces: `detectHeader(rows: string[][]): HeaderGuess`, `interface HeaderGuess { rowIndex: number | null; confidence: number; reason: string }` (`null` means no header)

- [x] **Step 1: Write the failing tests.** `finds the header on row 4 of sample 1 / Assets, under two title rows and a blank row`, `finds the header on row 3 of sample 1 / Sheet1 (2)`, `finds a header on the first row`, `is not distracted by title rows that have several cells`, and a table with no header.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test detectHeader`. Expected: FAIL.
- [x] **Step 3: Implement `detectHeader`.** Score the first thirty rows: +3 for a known column name, +1 for a label, −2 for a cell that looks like data; a header must have a table of similar width below it.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 5: Workbook reader

Commits: `2e4ed22 build: add SheetJS from its own CDN and fix the check scripts`, `e6b7d39 feat(extraction): read xlsx, xls and csv into plain text cells`

**Files:**
- Create: `src/lib/extraction/limits.ts`, `src/lib/extraction/readWorkbook.ts`, `scripts/make-fixtures.mjs`
- Modify: `package.json` (SheetJS from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`; the npm copy is stale)
- Test: `src/lib/extraction/readWorkbook.test.ts`

**Interfaces:**
- Produces: `readWorkbook(bytes: Uint8Array, fileName: string): RawSheet[]`, `interface RawSheet { name: string; rows: string[][]; hidden: boolean; truncated?: string }`, `LIMITS`

- [x] **Step 1: Write the failing tests.** `reads both sheets of sample 1 with spreadsheet row numbers intact`, `reads sample 2 as text, so dates and quoted commas survive`, `finds the delimiter even when a title line uses another one`, `keeps identifiers exactly as written` (a serial that starts with 0 keeps it), and one test per file it must refuse, each with its own message.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test readWorkbook`. Expected: FAIL.
- [x] **Step 3: Implement `readWorkbook`.** Recognise the format from the first bytes, not the extension. Read every cell as text. Enforce `LIMITS`.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 6: Row assembly and the pipeline on the real files

Commit: `88e54e3 feat(extraction): assemble assets and run the pipeline on real files`

**Files:**
- Create: `src/lib/extraction/extractAssets.ts`, `src/lib/extraction/pipeline.ts`
- Test: `src/lib/extraction/pipeline.test.ts`

**Interfaces:**
- Consumes: Tasks 1–5
- Produces: `planSheet(sheet: RawSheet, headerRow?: number | null): SheetPlan`, `extractAll(plans: SheetPlan[]): { assets: Asset[]; skipped: SkippedRow[] }`, `extractSheet(plan)`, `flagDuplicateSerials(assets)`

- [x] **Step 1: Write the failing tests** (AC1–AC4 and AC7, on the client's files)

```ts
it("AC1: finds the header on row 4 of Assets and extracts exactly 15 assets", () => {
  expect(assets.filter((asset) => asset.sheet === "Assets")).toHaveLength(15);
});
it("AC2: finds the header on row 3 of Sheet1 (2) and extracts 4 more assets, 19 in total", () => {
  expect(assets).toHaveLength(19);
});
```

For sample 2: 16 rows, 14 computers with all six fields, 2 items set aside as not computers. For AC7: four self-made files unlike the samples (`pnpm fixtures`).

- [x] **Step 2: Run to see them fail.** Run: `pnpm test pipeline`. Expected: FAIL.
- [x] **Step 3: Implement `extractSheet`, `planSheet`, `extractAll`.** The confidence of a value is its own confidence multiplied by the confidence of its column. Heading and total rows are skipped, each with a reason.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 7: Export

Commit: `0c7b760 feat(extraction): export clean CSV and JSON, checked by a Zod schema`

**Files:**
- Create: `src/lib/extraction/exportAssets.ts`
- Test: `src/lib/extraction/exportAssets.test.ts`

**Interfaces:**
- Consumes: `Asset` from Task 6
- Produces: `ExportedAssetSchema`, `toExportRows(assets: Asset[]): ExportedAsset[]`, `toCsv(rows): string`, `toJson(rows): string`, `needsReview(asset): boolean`

- [x] **Step 1: Write the failing tests** (AC8). `produces one row per asset that satisfies the export schema`, `carries the lowest confidence of the row and the review flag`, `stops a cell from being run as a formula when the file is opened`.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test exportAssets`. Expected: FAIL.
- [x] **Step 3: Implement the export.**
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 8: Corrections by the user

Commit: `3e0ea3c feat(extraction): let the user remap a column and edit a value`

**Files:**
- Create: `src/lib/extraction/edits.ts`
- Test: `src/lib/extraction/edits.test.ts`

**Interfaces:**
- Produces: `setColumnTarget(plan: SheetPlan, columnIndex: number, target: ColumnTarget): SheetPlan`, `interface Edits`, `NO_EDITS`, `applyEdits(assets: Asset[], edits: Edits): Asset[]`

- [x] **Step 1: Write the failing tests.** `maps a column by hand, with full confidence and a clear origin`, `frees the column that had the field, and says so`, `replaces a value with what the user typed, read the same way as file values`, `clears a value when the user empties the cell`.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test edits`. Expected: FAIL.
- [x] **Step 3: Implement.** Both functions return new objects; nothing is mutated.
- [x] **Step 4: Run to see them pass.** Expected: PASS.
- [x] **Step 5: Commit.**

### Task 9: The screens

Commit: `c089996 feat(ui): upload, column mapping, review and export on one page`

**Files:**
- Create: `src/components/Importer.tsx`, `UploadPanel.tsx`, `MappingPanel.tsx`, `ResultsPanel.tsx`, `ValueCell.tsx`, `format.ts`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`
- Test: none in this task. The screens were checked by hand; their tests came in Task 12.

**Interfaces:**
- Consumes: `readWorkbook`, `planSheet`, `extractAll`, `setColumnTarget`, `applyEdits`, `toExportRows`, `toCsv`, `toJson`

- [x] **Step 1: Build the three screens** (AC6, AC12): upload; mapping with header row and field per column; results with three confidence levels, the original text, cell editing, the non-computer list and the skipped rows with reasons; CSV and JSON download. State lives in `Importer`; every change calls the pipeline again.
- [x] **Step 2: Check the screens by hand** on both sample files and on a file with no header. Screenshots are in `.local-map/screenshots/`.
- [x] **Step 3: Run `pnpm typecheck && pnpm lint && pnpm test`.** Expected: PASS.
- [x] **Step 4: Commit.**

### Task 10: Optional AI suggestion

Commit: `fdc520d feat(llm): opt-in AI suggestion for columns the rules left unclear`

**Files:**
- Create: `src/lib/llm/prompt.ts`, `schema.ts`, `suggestions.ts`, `src/app/api/suggest-mapping/route.ts`, `src/components/AiSuggest.tsx`, `.env.example`
- Test: `src/lib/llm/suggestions.test.ts`, `src/app/api/suggest-mapping/route.test.ts`

**Interfaces:**
- Consumes: `SheetPlan`, `ColumnMapping`
- Produces: `unclearColumns(plan)`, `buildSuggestRequest(plan): SuggestRequest`, `maskSample(value: string): string`, `applySuggestions(...)`, `POST /api/suggest-mapping`

- [x] **Step 1: Write the failing tests.** `sends sample values only for the unclear columns`, `masks identifiers, keeping only their shape`, `never lists a column the user mapped by hand`; the route refuses a bad body, an oversized body and a missing key, and a failed call leaves the rules' result as it is.
- [x] **Step 2: Run to see them fail.** Run: `pnpm test llm suggest-mapping`. Expected: FAIL.
- [x] **Step 3: Implement.** The call happens only on a click. The answer is checked against a Zod schema, capped at the medium level and labelled AI.
- [x] **Step 4: Run to see them pass.** Expected: PASS. The route has not been tested against the live API.
- [x] **Step 5: Commit.**

### Task 11: Review as the client's engineer, and the README

Commits: `fd82557 fix: issues found when reviewing as the client's engineer would`, `0ebafcf docs: README, map of the code, review record and handoff`

**Files:**
- Modify: files named in `.local-map/REVIEW.md`
- Create: `README.md` sections for AC10 and AC11

- [x] **Step 1: Review the branch** against the spec and `AGENTS.md` with the `reviewer` checklist (`.claude/agents/reviewer.md`).
- [x] **Step 2: For each finding, write the failing test, then fix it.** Four data bugs found and fixed.
- [x] **Step 3: Write the README:** how to run, pipeline diagram, decisions and trade-offs, known limits, how AI was used.
- [x] **Step 4: Run `.local-map/scripts/check.sh`** and keep its output in `.local-map/evidence/checks/latest.txt`.
- [x] **Step 5: Commit.**

### Task 12: Second review and browser tests (added 12 Nov 2026)

Commits: `1134469 fix(extraction): second review, 20 data findings fixed test first`, `a4e8096 fix(ui,ai): state, focus and what leaves the browser`, `52a68dd test(e2e): browser tests with Playwright in the installed Chrome`

**Files:**
- Create: `e2e/app.spec.ts`, `e2e/fixtures.ts`, `playwright.config.ts`, `src/app/security-headers.test.ts`, `src/components/plans.ts`
- Test: `src/lib/extraction/extractAssets.test.ts`, `src/components/screens.test.ts`, `src/components/plans.test.ts`
- Modify: `src/lib/extraction/*`, `src/components/*`, `src/lib/llm/*`, `next.config.ts`

- [x] **Step 1: Review five areas** (extraction, UI, security, docs, tests), with a second reader trying to refute each finding. 37 findings confirmed; they are listed in `.local-map/REVIEW.md` section 3.
- [x] **Step 2: Fix each finding test first,** in three rounds.
- [x] **Step 3: Write eight browser tests** (AC13) that drive the production build in Chrome: both client samples, an unseen layout, fixing the mapping, edit and export, unreadable files, "the spreadsheet never leaves the browser", and the six bundled samples.
- [x] **Step 4: Run `.local-map/scripts/check.sh --all`.** Expected: typecheck, lint, 507 unit tests and 8 browser tests pass.
- [x] **Step 5: Commit.**

---

## Order of cuts if time had run out

Drop from the bottom: Task 10 (LLM), then cell editing in Task 9, then the extra fixture formats in Task 6. Tasks 1–6 and the mapping screen are the product.

## Not planned

Persistence, accounts, dashboard, server-side parsing, per-cell LLM parsing, several tables in one sheet, transposed tables. See "Known limitations" in the README.

## Differences from the Superpowers workflow

This repository follows the Superpowers layout and its order of work (design → plan → test first → review → verify before saying done). These parts were done differently, and are stated here so nobody has to guess:

| Superpowers step | What was done here |
| --- | --- |
| `brainstorming`: one question at a time, two or three approaches, design approved section by section | The author wrote the brief and its acceptance criteria; the agent tightened it into the spec. Section 9 of the spec lists what changed. The alternatives considered are in `docs/research.md` and `.local-map/DECISIONS.md`. |
| `writing-plans`: this format, written before the code | The first plan was a short table of steps written on 11 Nov. This document is the same plan, rewritten in the format on 12 Nov. |
| `using-git-worktrees` | One branch, `feat/asset-extraction`, in the main checkout. |
| `subagent-driven-development`: a fresh subagent and a fresh reviewer per task | Tasks 1–10 were implemented in one session. Tasks 11 and 12 used separate reviewers and separate fixers. |
| `test-driven-development` | Followed for the pipeline and the AI route (Tasks 1–8, 10) and for every review fix. The screens in Task 9 were built first and checked by hand; their unit tests and the browser tests were added in Task 12. |
| `requesting-code-review`, `verification-before-completion` | Followed in substance, with this project's own `reviewer` checklist and `check.sh`; the output of every run is kept in `.local-map/evidence/checks/`. |

Later changes to this repository follow the Superpowers skills as written.
