# Spec: Asset Sheet Extractor

This is the working brief for the project. It is the challenge brief rewritten so that every
requirement is measurable and traceable. A brief is only usable when it states all eight of:
**goal, inputs, constraints, trade-offs, acceptance criteria, examples, evidence, sources.**
Section 9 lists what was missing or contradictory in the first draft and how it was fixed.

Status: accepted. Changes go through `.local-map/DECISIONS.md`.

## 1. Goal

Build a web app (TypeScript, Next.js App Router, React) where a user can:

1. Upload a spreadsheet of IT assets (`.xlsx` and `.csv` at minimum; `.xls` and `.tsv` come free).
2. Get the key facts for every asset extracted automatically, **whatever the layout**: header on
   any row, several sheets, unknown column names, any column order, several facts in one cell.
3. Review the result in one clean table that shows how sure the app is, and fix what it got wrong.

**Success** means: in the demo the client uploads a file nobody here has seen, the app extracts
most of it correctly, points at the values it is unsure about, never invents a value, and every
technical decision can be explained from this repository.

**Not goals:** persistence, accounts, bulk/streaming import of very large files, editing the
source file, a fleet dashboard. One idea done properly beats ten done halfway.

## 2. Inputs

| Input | Detail |
| --- | --- |
| Challenge brief | Email from the recruiter, 11 Nov 2026, forwarding the client's instructions. Authoritative. |
| Candidate brief (PDF) | Who the client is and what they assess. |
| `sample_assets_1.xlsx` | 2 sheets. `Assets`: 2 title rows, blank row 3, header on row 4, 15 assets (rows 5–19), blank row 20, `TOTAL … 15` on row 21. `Sheet1 (2)`: note on row 1, header on row 3, 4 assets, one composite column `CPU / RAM / Disk`. |
| `sample_assets_2.csv` | 16 rows. Everything is in `Item Description`. 14 computers (one is a NAS), 1 monitor, 1 keyboard. Two date formats in `Purchased`. CRLF line endings. |
| Target fields (required) | `assetType`, `manufacturer`, `model`, `serialNumber`, `cpu`, `ramGB`, `storageGB` (+ `storageRaw`), `screenInches` |
| Target fields (bonus) | `assetTag`, `assignedTo`, `location`, `costCentre`, `purchaseDate`, `notes` |
| `assetType` values | `laptop`, `desktop`, `workstation`, `server`, `mini-pc`, `tablet`, `nas`, `other` |
| Stack | Next.js 16 (current stable), React 19, TypeScript strict, Tailwind 4, SheetJS, Zod, Vitest |
| Optional LLM | Claude API through `ANTHROPIC_API_KEY`. Off by default. |
| Deadline | Repository link by **12:00 Friday 13 Nov 2026**. The brief gives no time zone; Vietnam time (GMT+7) is assumed, so the safe target is Thursday evening. |
| Time budget | The brief suggests 2–3 hours. Scope is cut to fit (section 4). |

## 3. Constraints

- **C1 Explainable.** Every line must be explainable in the demo. Small files, plain functions,
  no library unless it removes real work.
- **C2 AI transparency.** README states which AI tools were used, for what, what was reviewed by
  hand, and where the in-app LLM prompt lives.
- **C3 Deterministic first.** Default pipeline has no LLM: read → find header → map columns →
  parse → normalise. The LLM is an opt-in second opinion; if it fails the heuristic result stands.
- **C4 Security and privacy.**
  - The spreadsheet is parsed in the browser and is never uploaded or stored.
  - No secrets in git (`.env.local` ignored, `.env.example` provided).
  - Limits: 5 MB per file, 5,000 rows and 60 columns per sheet, 20 sheets.
  - The LLM call only happens on an explicit click. It sends the column names of one sheet and
    at most five sample values from the columns the rules could not identify; values of settled
    columns are never sent, and identifiers are masked to their shape.
  - Exported CSV neutralises formula injection.
- **C5 Never invent data.** Unknown stays empty with low confidence. The original cell text is
  kept next to every normalised value.
- **C6 Scope order.** (1) header and column detection, (2) combined-cell parsing, (3) unit
  normalisation, (4) confidence and fix-mapping screen, (5) non-computer filtering.
  Duplicate warnings and summary counts only if cheap. No dashboard.
- **C7 Clean history.** Small commits with clear messages. `pnpm i && pnpm dev` must work.

## 4. Trade-offs

| Decision | Options considered | Choice | What it costs |
| --- | --- | --- | --- |
| Where parsing runs | Browser · route handler · server action | **Browser** | Parser ships in the client bundle; no server-side validation of the file. Gains: file never leaves the device, no 4.5 MB request limit on Vercel, instant re-mapping. |
| Spreadsheet reader | SheetJS · exceljs · Papa Parse + read-excel-file | **SheetJS from its CDN tarball** | One dependency for xlsx/xls/csv, but it is not on npm in a safe version, so the install URL is pinned. See `docs/research.md`. |
| Column matching | Synonyms only · fuzzy library · value profiling · LLM | **Synonyms + small fuzzy + value profiling**, LLM as opt-in fallback | More code than "ask the LLM", but free, instant, offline, repeatable and testable. |
| Combined cells | Regex rules · NER library · LLM per row | **Regex rules** | Unknown phrasings are missed; they surface as low confidence instead of wrong values. |
| Storage units | Binary (1 TB = 1024 GB) · decimal (1 TB = 1000 GB) | **Decimal for storage, binary for RAM** | "512 GB + 1 TB" reads as 1512, which matches drive labels, not what an OS reports. |
| CPU text | Keep as typed · canonicalise | **Canonicalise the vendor prefix, keep raw** | `i5-8365U` becomes `Intel Core i5-8365U`; the table is consistent but no longer verbatim. |
| UI kit | shadcn/ui · plain Tailwind | **Plain Tailwind, native `<select>`** | Less polish than Radix components; in return no generated code to explain (C1). |
| Tests | Unit only · unit + Playwright | **Unit + fixture-driven pipeline tests** | No browser-level regression test; the UI is verified by hand before each release. |
| LLM scope | Column mapping · per-cell parsing · both | **Column mapping only** | Odd cell phrasings are left to manual edit. Per-cell parsing would send row data out. |
| Scope vs time | All ideas in the brief · one idea done well | **Layout-agnostic extraction with confidence and fix-mapping** | No dashboard, no persistence, duplicate detection is a warning only. |

## 5. Acceptance criteria

Each criterion names how it is checked. "Test" means a Vitest test in `src/lib/extraction`.

- **AC1 Header detection.** `sample_assets_1.xlsx` / `Assets`: header found on row 4, title rows
  ignored, `TOTAL` row skipped with a stated reason, exactly **15** assets. *Test.*
- **AC2 Multi-sheet.** `Sheet1 (2)`: header on row 3, **4** assets, `CPU / RAM / Disk` split into
  three fields. Whole file: **19** assets, each carrying its sheet name and row number. *Test.*
- **AC3 Combined cell.** `sample_assets_2.csv`: manufacturer, model, CPU, RAM, storage and screen
  come out of `Item Description`. At least **12 of 14** computers have at least 4 fields exactly
  right (target: 14 of 14). *Test with a golden table.*
- **AC4 Non-computers.** `Dell P2422H 24in Monitor` and `Logitech MX Keys keyboard` are marked
  `not-a-computer`, hidden from the main list and visible in their own tab. The Synology unit is
  typed `nas`. *Test + manual check.*
- **AC5 Normalisation.** *Test.*
  - RAM (binary): `32768 MB` → 32, `8gb` → 8, `16 GB RAM` → 16, `16 gig` → 16.
  - Storage (decimal, raw capacity): `1 TB HDD` → 1000, `2x 1TB SSD` → 2000,
    `4 x 1.92TB SSD (RAID 5)` → 7680, `8x 2.4TB SAS` → 19200. Original text kept.
  - Screen: `14"`, `14 inch`, `14in`, `14`, `24-inch` → number; `N/A`, `-`, `n/a`, empty → null.
  - Type: `Notebook` → laptop, `Desktop PC` → desktop, `Rack Server` → server, `Mini PC` → mini-pc.
  - CPU: `Intel i7-10700` → `Intel Core i7-10700`, `2 x Xeon Silver 4210` → `2x Intel Xeon Silver 4210`.
  - Dates: `2021-08-19` kept; `12/03/2021` → `2021-03-12` (day first, Australian default).
- **AC6 Confidence and fix-mapping.** Every mapped column shows its target, a 0–1 score and a
  reason (for example `"S/N" is a known name for Serial number`). Changing a dropdown re-extracts
  immediately. Low-confidence cells are highlighted and explain why. Cells can be edited.
  *Test for scores and reasons; manual check for the screen.*
- **AC7 Unseen files.** At least four self-made fixtures, unlike the samples, extract without a
  crash: Vietnamese and abbreviated headers with the header on row 7, blank rows and real date
  cells; a `;`-separated CSV with a BOM and decimal commas; a file with no header row; a sheet
  where each asset is one free-text cell. *Test.*
- **AC8 Export.** Clean CSV and JSON downloads that satisfy the Zod export schema; CSV cells are
  quoted correctly and cannot start a formula. *Test.*
- **AC9 Quality.** `pnpm typecheck`, `pnpm lint`, `pnpm test` all pass. Unit tests exist for header
  detection, column matching, normalisers, the free-text parser and the whole pipeline.
- **AC10 README.** How to run, pipeline diagram, decisions and trade-offs, known limitations,
  "How AI was used", a five-minute demo script.
- **AC11 Demo.** Deployed URL or local instructions, plus three points to stress when presenting.
- **AC12 When things go wrong.** Wrong file type, file over 5 MB, empty file, sheet with no table,
  password-protected workbook and LLM failure each give a specific message and a next step. The
  app never shows a blank screen or a stack trace. *Test for the reader; manual check for the UI.*

## 6. Examples

Sample 1, sheet `Assets` (header row 4):

| Source row | Expected |
| --- | --- |
| `Desktop PC · Dell · OptiPlex 7090 · 9JZL5N2 · Intel i7-10700 · 32768 MB · 1 TB HDD · N/A` | type `desktop`, cpu `Intel Core i7-10700`, ramGB `32`, storageGB `1000`, storageRaw `1 TB HDD`, screenInches `null` |
| `Notebook · Apple · MacBook Pro 14 (2023) · C02FK8ZTMD6R · Apple M2 Pro · 32GB · 1TB · 14.2in` | type `laptop`, ramGB `32`, storageGB `1000`, screenInches `14.2` |
| `Rack Server · HPE · ProLiant DL380 Gen10 · CZJ93805KL · 2x Intel Xeon Gold 6230 · 384GB · 8x 2.4TB SAS` | type `server`, cpu `2x Intel Xeon Gold 6230`, ramGB `384`, storageGB `19200` |
| `TOTAL · … · 15` | skipped: summary row |

Sample 1, sheet `Sheet1 (2)` (header row 3):

| Source row | Expected |
| --- | --- |
| `8RTQ3L2 · Dell Latitude 7400 laptop · i5-8365U / 8GB / 256GB · 14in` | type `laptop`, manufacturer `Dell`, model `Latitude 7400`, cpu `Intel Core i5-8365U`, ramGB `8`, storageGB `256`, screenInches `14` |

Sample 2 (`Item Description`):

| Source text | Expected |
| --- | --- |
| `Lenovo ThinkPad X1 Carbon Gen 9, Core i7-1165G7, 16 GB RAM, 1TB SSD, 14 inch` | manufacturer `Lenovo`, model `ThinkPad X1 Carbon Gen 9`, cpu `Intel Core i7-1165G7`, ramGB `16`, storageGB `1000`, screenInches `14`, type `laptop` (inferred from ThinkPad) |
| `Dell PowerEdge R650 (2x Xeon Gold 5318Y, 512GB, 6x 3.84TB SSD)` | type `server`, cpu `2x Intel Xeon Gold 5318Y`, ramGB `512`, storageGB `23040` |
| `Dell P2422H 24in Monitor` | `not-a-computer` (monitor) |
| `Dell Lat 5420 i7 16GB` (from the brief) | manufacturer `Dell`, model `Latitude 5420`, cpu `Intel Core i7` and ramGB `16`, both flagged low confidence |

## 7. Evidence

| Requirement | Backed by |
| --- | --- |
| Layout must not be assumed | Brief: "there is no predefined format"; sample 1 has headers on rows 4 and 3. |
| Multiple sheets | Brief mentions a second tab "that nobody dares delete"; sample 1 has `Sheet1 (2)`. |
| Combined cells | Brief quotes "Dell Lat 5420 i7 16GB" in one cell; sample 2 has only `Item Description`. |
| Unit normalisation | Brief: "16 gig", "16GB", "16384 MB" should all become 16 GB; sample 1 has `32768 MB`. |
| Non-computer rows | Brief: "monitors, keyboards…"; sample 2 rows IT-0005 and IT-0011. |
| Confidence and fix-mapping | Listed in the brief under "where you can get creative". |
| Unseen files decide the result | Brief: "we'll test your app with files you haven't seen". |
| Error UX matters | Brief, what they look at: "User experience, especially when things go wrong". |
| Reviewing AI output matters more than typing | Candidate brief, key message. |
| Decimal storage units | Every storage example in the first draft except one uses 1 TB = 1000 GB. |
| Day-first dates | The client is Australian; sample 2 has `12/03/2021`. |

Row counts, row numbers and cell values above were read from the two sample files directly, not
taken from the first draft.

## 8. Sources

- Challenge email (recruiter, 11 Nov 2026) with attachments `sample_assets_1.xlsx`,
  `sample_assets_2.csv` and the candidate brief PDF. The samples are copied to `public/samples/`.
- Research summary with links: `docs/research.md`.
- Next.js documentation bundled with the installed version: `node_modules/next/dist/docs/`.

## 9. What changed from the first draft

| # | Problem in the first draft | Fix |
| --- | --- | --- |
| 1 | No trade-off section; decisions were implied. | Section 4. |
| 2 | Requirements were not tied to the source text or to the sample data. | Section 7; facts re-read from the files. |
| 3 | The brief email, the only authoritative source, was not cited. | Section 8. |
| 4 | Contradiction: `2x 1TB SSD` → 2048 GB, while every other example uses 1 TB = 1000 GB. | Decimal for storage everywhere: 2000 GB. |
| 5 | CPU examples were inconsistent (one canonicalised, the others verbatim). | One rule: canonical vendor prefix, raw text kept. |
| 6 | Missing from the email: "16 gig", the "Dell Lat 5420 i7 16GB" cell, and the weight the client puts on failure UX. | AC5, section 6, new AC12. |
| 7 | Stale stack: Next.js 15 (16 is current) and `xlsx` from npm (frozen, known CVEs). | Next.js 16; SheetJS from its own CDN. |
| 8 | shadcn/ui conflicts with "no library unless needed". | Plain Tailwind. |
| 9 | AC list larger than the 2–3 hour budget. | Priority order in C6; Playwright and dashboard dropped. |
| 10 | Deadline had no time zone. | Assumption stated; safe target is the evening before. |
| 11 | "File handled in memory or on the client" left the choice open. | Client-side only; nothing is uploaded. |
