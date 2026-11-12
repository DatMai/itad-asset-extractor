# Map

What is in the repository and where to change things. This file describes the code as it is.

## Data flow

```
File (browser)
  │  readWorkbook(bytes, name) ................ RawSheet[]      text cells; rows[0] = spreadsheet row 1
  │  planSheet(sheet, headerRow?) ............. SheetPlan       { sheet, header, columns }
  │     ├─ detectHeader(rows) ................. HeaderGuess     { rowIndex | null, confidence, reason }
  │     └─ mapColumns(headers, dataRows) ...... ColumnMapping[] { target, confidence, reason, source }
  │  extractAll(plans) ........................ { assets, skipped }
  │     ├─ extractSheet(plan) ................. one sheet: rows -> Asset | SkippedRow
  │     │     ├─ NORMALISERS[field](cell) ..... a column mapped to one field
  │     │     └─ parseFreeText(cell) .......... a combined cell, or a model cell that holds more
  │     └─ flagDuplicateSerials(assets)
  │  applyEdits(assets, edits) ................ the user's corrections laid on top; serial warnings redone
  └─ toExportRows(assets) -> toCsv / toJson ... checked by ExportedAssetSchema

User corrections:  setColumnTarget(plan, column, target)   planSheet(sheet, row)   Edits
Optional AI:       buildSuggestRequest(plan) -> POST /api/suggest-mapping -> applySuggestions(plan, answer)
```

## The pipeline: `src/lib/extraction/`

Pure TypeScript. Nothing here imports React, Next.js or browser globals. Nine files have a test
file beside them (`text`, `normalise`, `parseFreeText`, `mapColumns`, `detectHeader`,
`readWorkbook`, `extractAssets`, `edits`, `exportAssets`), and `pipeline.test.ts` runs the whole
pipeline on the sample files. `types.ts`, `limits.ts`, `fields.ts` and `vocab.ts` have no test
file of their own; they are tested through the files that use them.

| File | Responsibility | Main exports |
| --- | --- | --- |
| `types.ts` | The contract between the pipeline and everything else | `FIELD_KEYS`, `FieldKey`, `ASSET_TYPES`, `AssetType`, `ColumnTarget`, `RawSheet`, `HeaderGuess`, `ColumnMapping`, `SheetPlan`, `FieldSource`, `FieldValue`, `Asset`, `SkippedRow`, `Normalised`, `LOW_CONFIDENCE` |
| `limits.ts` | Size limits, importable without loading the parser | `LIMITS` (`fileBytes`, `unpackedBytes`, `rows`, `columns`, `sheets`) |
| `text.ts` | Text helpers | `normaliseText`, `stripAccents`, `tokens`, `isPlaceholder`, `cleanText`, `similarity`, `parseNumber`, `round` |
| `fields.ts` | The target fields, the names their columns go by, and the words that cancel a match (`notWith`) | `FieldDef`, `FIELDS`, `COMBINED`, `targetLabel` |
| `vocab.ts` | Tables: brands, product lines and their shorthand, type words, non-computer words, CPU families | `BRANDS`, `PRODUCT_LINES`, `LINE_ABBREVIATIONS`, `TYPE_WORDS`, `TYPE_COLUMN_ONLY_WORDS`, `NON_COMPUTER_WORDS`, `MONITOR_TYPE_WORDS`, `CpuMatch`, `BrandMatch`, `findCpu`, `findBrand`, `findProductLine`, `findTypeWord`, `findNonComputerWord` |
| `normalise.ts` | One cell to one clean value | `normaliseRam`, `normaliseStorage`, `normaliseScreen`, `normaliseAssetType`, `normaliseManufacturer`, `normaliseCpu`, `normaliseDate`, `normaliseSerial`, `normalisePlainText`, `unitFromHeader`, `tidyCpuText`, `toUnit`, `toGB`, `AMOUNT` (the number pattern shared with `parseFreeText.ts`), `CapacityUnit` |
| `parseFreeText.ts` | One combined cell to several values | `parseFreeText`, `ParsedText`, `Found` |
| `mapColumns.ts` | Column to field, from header names and values | `mapColumns`, `kindOfValue`, `isKnownColumnName`, `columnLetter` |
| `detectHeader.ts` | Which row holds the column names | `detectHeader` |
| `readWorkbook.ts` | Bytes to text cells; the only user of SheetJS | `readWorkbook`, `UnreadableFileError` (and `LIMITS` again, for its test) |
| `extractAssets.ts` | Rows to assets, skipped rows, row warnings, duplicate serials | `extractSheet`, `flagDuplicateSerials`, `NORMALISERS`, `NO_SERIAL_WARNING`, `DUPLICATE_SERIAL_PREFIX` |
| `pipeline.ts` | The two entry points the UI calls | `planSheet`, `extractAll` (and `extractSheet` again, for tests) |
| `edits.ts` | Manual corrections, and the serial warnings that follow from them | `setColumnTarget`, `applyEdits`, `Edits`, `NO_EDITS` |
| `exportAssets.ts` | Clean output: 21 columns, computers only | `ExportedAssetSchema`, `ExportedAsset`, `toExportRows`, `toCsv`, `toJson`, `needsReview` |
| `pipeline.test.ts` | The acceptance criteria on the real sample files | |

## The optional AI suggestion: `src/lib/llm/` and `src/app/api/`

| File | Responsibility | Main exports |
| --- | --- | --- |
| `src/lib/llm/prompt.ts` | The only prompt in the app. Tells the model what the masked shapes mean | `SYSTEM_PROMPT`, `buildUserMessage` |
| `src/lib/llm/schema.ts` | Zod schemas for the request and the answer, shared by browser, route and model | `SuggestRequestSchema`, `SuggestRequest`, `SuggestionsSchema` |
| `src/lib/llm/suggestions.ts` | Browser side: which columns to ask about, what to send (masked word by word), how to apply the answer without trusting it | `unclearColumns`, `buildSuggestRequest`, `maskSample`, `shapeOf`, `applySuggestions` |
| `src/lib/llm/suggestions.test.ts` | What is sent as written and what as a shape; how an answer is applied | |
| `src/app/api/suggest-mapping/route.ts` | Server side: caps the body at 128,000 bytes, validates, calls Claude with structured output (3,000 answer tokens), trims the answer, maps every failure to a message | `POST` |
| `src/app/api/suggest-mapping/route.test.ts` | The route with a fake client | |

## The screens: `src/components/` and `src/app/`

| File | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Server component. Passes only "is a key configured" to the browser |
| `src/app/layout.tsx`, `globals.css` | Shell. System fonts, Tailwind |
| `src/app/security-headers.test.ts` | The response headers set in `next.config.ts` |
| `Importer.tsx` | All state: opened file and plans, manual edits, last problem, AI status. Derives the results. Each opened file gets a `loadId`, so the panels start fresh |
| `UploadPanel.tsx` | Drop zone, file input, bundled samples, the error box. Exports `Problem` |
| `MappingPanel.tsx` | Per sheet: header row, include toggle, one row per column with target, level and reason |
| `AiSuggest.tsx` | The opt-in "Ask AI" control and the statement of what it will send. Exports `AiStatus` |
| `ResultsPanel.tsx` | Row filters, the asset table, skipped rows, CSV and JSON download |
| `ValueCell.tsx` | One value: display, explanation on hover and for screen readers, inline edit |
| `format.ts` | Display only: `formatValue`, `levelOf`, `LEVEL_LABEL`, `LEVEL_STYLE`, `explain` (the hover text) |
| `plans.ts` | Two questions about a plan when something changes under it: `findCurrentPlan` (is a late AI answer still about this sheet?) and `keepChosenColumns` (keep hand-set columns after "Detect again") |
| `plans.test.ts` | Tests for `plans.ts` |
| `screens.test.ts` | `ResultsPanel`, `ValueCell` and `AiSuggest` drawn to static HTML: the empty states, the labels, the privacy statement. No browser |

## Browser tests: `e2e/`

| File | Responsibility |
| --- | --- |
| `e2e/app.spec.ts` | Playwright tests against the built app: both client samples, an unseen layout, remapping and header row, editing and both downloads, unreadable files, "no request carries the file", all six samples |
| `e2e/fixtures.ts` | The path of a bundled sample, and one CSV layout no sample has |
| `playwright.config.ts` | Builds the app, serves it on port 3100, drives the installed Chrome (`pnpm e2e`) |

## Where do I change…

| I want to… | Go to |
| --- | --- |
| Accept another column name | `fields.ts`, the `synonyms` of the field |
| Stop a qualifier from matching a field ("HDD Type" is not storage) | `fields.ts`, the `notWith` of the field |
| Recognise another brand, product line or type word | `vocab.ts` |
| Recognise another CPU family | `vocab.ts`, `CPU_RULES` |
| Change how RAM, storage, screen or dates are read | `normalise.ts` |
| Change how RAM and storage are told apart in a description | `parseFreeText.ts`, `findSizes` and `resolveRamAndStorage` |
| Change what starts a remark ("with", "no", "+") | `parseFreeText.ts`, `TRAILING_NOTE` |
| Change which numbers after a remark belong to the computer | `parseFreeText.ts`, `ownSpecs` (`EXTERNAL`, `ABSENT`, `TYPES_WITH_OWN_SCREEN`) |
| Change how a drive size with no unit is read ("512 SSD") | `parseFreeText.ts`, `findDrivesWithoutUnit`, `DRIVE_SIZES`, `SMALLEST_DRIVE_GB` |
| Change how header and value evidence combine | `mapColumns.ts`, `candidatesFor` |
| Change what happens to a second drive or memory column | `mapColumns.ts`, `SPLIT_SIZE_LIMIT` |
| Change which rows are skipped (totals, headings) | `extractAssets.ts`, `extractSheet` |
| Change when an accessory word sets a row aside | `extractAssets.ts`, `buildAsset` (`rowSaysComputer`); `parseFreeText.ts`, step 6 |
| Add a field | `types.ts` (`FIELD_KEYS`), `fields.ts`, `extractAssets.ts` (`NORMALISERS`), `exportAssets.ts`, `prompt.ts` |
| Add an export column | `exportAssets.ts`, `ExportedAssetSchema` and `toExportRows` |
| Change the limits | `limits.ts` (the 5 MB message is still written out in `readWorkbook.ts`) |
| Swap the spreadsheet library | `readWorkbook.ts` only |
| Change what is sent to the model | `suggestions.ts`, `buildSuggestRequest` |
| Change which words may leave the browser as written | `suggestions.ts`, `mayLeave` and `SPEC_WORDS`. A new brand or product line in `vocab.ts` is picked up on its own; a new unit, drive word or CPU family word must be added to `SPEC_WORDS` |
| Change how column names are masked | `suggestions.ts`, `maskHeader` |
| Change the prompt or the model | `prompt.ts`; `route.ts` or `ANTHROPIC_MODEL` |
| Change the caps on the AI route | `route.ts` (`MAX_BODY_BYTES`, `MAX_ANSWER_TOKENS`), `schema.ts` |
| Change the response headers | `next.config.ts`, `SECURITY_HEADERS`; test in `src/app/security-headers.test.ts` |
| Change the confidence threshold for "Check" | `types.ts`, `LOW_CONFIDENCE` |
| Change how a cell is edited | `ValueCell.tsx` |
| Add or change a browser test | `e2e/app.spec.ts` |

## Everything else

| Path | What it is |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Rules and commands for coding agents. `CLAUDE.md` imports `AGENTS.md` |
| `.agent/` | Tool-neutral agent protocol (`PROTOCOL.md`) and live state (`HANDOFF.md`) |
| `.claude/` | Claude Code skills, subagent definitions, and `launch.json` for the dev server |
| `.local-map/` | This map; see its `README.md` |
| `docs/` | `research.md`; `superpowers/specs/` (the spec: requirements and acceptance criteria); `superpowers/plans/` (the implementation plan) |
| `public/samples/` | The client's two samples and the four generated fixtures; used by tests and by the sample buttons |
| `scripts/make-fixtures.mjs` | Generates the four fixtures (`pnpm fixtures`) |
| `next.config.ts` | The security headers sent with every response and `poweredByHeader: false`; then the scaffold defaults: `cacheComponents` (the page is prerendered as a static shell), `partialPrefetching` (link prefetching; irrelevant with one route), and the Turbopack rule that runs Tailwind 4 on CSS |
| `vitest.config.mts` | Unit tests run in Node; `@` maps to `src` |
| `playwright.config.ts`, `e2e/` | Browser tests; see above |
| `package.json` | Scripts, and `engines`: Node.js 22.12 or later |
| `pnpm-workspace.yaml` | Tells pnpm not to run the install scripts of `sharp` and `unrs-resolver` |
| `.env.example` | The two optional environment variables |
