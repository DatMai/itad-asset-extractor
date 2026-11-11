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
  │  applyEdits(assets, edits) ................ the user's corrections laid on top
  └─ toExportRows(assets) -> toCsv / toJson ... checked by ExportedAssetSchema

User corrections:  setColumnTarget(plan, column, target)   planSheet(sheet, row)   Edits
Optional AI:       buildSuggestRequest(plan) -> POST /api/suggest-mapping -> applySuggestions(plan, answer)
```

## The pipeline: `src/lib/extraction/`

Pure TypeScript. Nothing here imports React, Next.js or browser globals. Each file has a test file
beside it.

| File | Responsibility | Main exports |
| --- | --- | --- |
| `types.ts` | The contract between the pipeline and everything else | `FIELD_KEYS`, `ASSET_TYPES`, `RawSheet`, `SheetPlan`, `ColumnMapping`, `FieldValue`, `Asset`, `SkippedRow`, `LOW_CONFIDENCE` |
| `limits.ts` | Size limits, importable without loading the parser | `LIMITS` |
| `text.ts` | Text helpers | `normaliseText`, `stripAccents`, `isPlaceholder`, `similarity`, `parseNumber` |
| `fields.ts` | The target fields and the names their columns go by | `FIELDS`, `COMBINED`, `targetLabel` |
| `vocab.ts` | Tables: brands, product lines, type words, non-computer words, CPU families | `BRANDS`, `PRODUCT_LINES`, `TYPE_WORDS`, `NON_COMPUTER_WORDS`, `findCpu`, `findBrand`, `findProductLine`, `findTypeWord` |
| `normalise.ts` | One cell to one clean value | `normaliseRam`, `normaliseStorage`, `normaliseScreen`, `normaliseAssetType`, `normaliseCpu`, `normaliseDate`, `normaliseSerial`, `unitFromHeader` |
| `parseFreeText.ts` | One combined cell to several values | `parseFreeText`, `ParsedText` |
| `mapColumns.ts` | Column to field, from header names and values | `mapColumns`, `kindOfValue`, `isKnownColumnName`, `columnLetter` |
| `detectHeader.ts` | Which row holds the column names | `detectHeader` |
| `readWorkbook.ts` | Bytes to text cells; the only user of SheetJS | `readWorkbook`, `UnreadableFileError` |
| `extractAssets.ts` | Rows to assets, skipped rows, duplicate serials | `extractSheet`, `flagDuplicateSerials`, `NORMALISERS` |
| `pipeline.ts` | The two entry points the UI calls | `planSheet`, `extractAll` |
| `edits.ts` | Manual corrections | `setColumnTarget`, `applyEdits`, `Edits` |
| `exportAssets.ts` | Clean output | `ExportedAssetSchema`, `toExportRows`, `toCsv`, `toJson`, `needsReview` |
| `pipeline.test.ts` | The acceptance criteria on the real sample files | |

## The optional AI suggestion: `src/lib/llm/` and `src/app/api/`

| File | Responsibility |
| --- | --- |
| `src/lib/llm/prompt.ts` | The only prompt in the app |
| `src/lib/llm/schema.ts` | Zod schemas for the request and the answer, shared by browser, route and model |
| `src/lib/llm/suggestions.ts` | Browser side: which columns to ask about, what to send (masked), how to apply the answer without trusting it |
| `src/app/api/suggest-mapping/route.ts` | Server side: validates, calls Claude with structured output, maps every failure to a message |

## The screens: `src/components/` and `src/app/`

| File | Responsibility |
| --- | --- |
| `src/app/page.tsx` | Server component. Passes only "is a key configured" to the browser |
| `src/app/layout.tsx`, `globals.css` | Shell. System fonts, Tailwind |
| `Importer.tsx` | All state: opened file and plans, manual edits, last problem, AI status. Derives the results |
| `UploadPanel.tsx` | Drop zone, file input, bundled samples, the error box |
| `MappingPanel.tsx` | Per sheet: header row, include toggle, one row per column with target, level and reason |
| `AiSuggest.tsx` | The opt-in "Ask AI" control and what it will send |
| `ResultsPanel.tsx` | Row filters, the asset table, skipped rows, CSV and JSON download |
| `ValueCell.tsx` | One value: display, explanation on hover, inline edit |
| `format.ts` | Display only: units, levels, the hover text |

## Where do I change…

| I want to… | Go to |
| --- | --- |
| Accept another column name | `fields.ts`, the `synonyms` of the field |
| Recognise another brand, product line or type word | `vocab.ts` |
| Recognise another CPU family | `vocab.ts`, `CPU_RULES` |
| Change how RAM, storage, screen or dates are read | `normalise.ts` |
| Change how RAM and storage are told apart in a description | `parseFreeText.ts`, `resolveRamAndStorage` |
| Change how header and value evidence combine | `mapColumns.ts`, `candidatesFor` |
| Change which rows are skipped | `extractAssets.ts`, `extractSheet` |
| Add a field | `types.ts` (`FIELD_KEYS`), `fields.ts`, `extractAssets.ts` (`NORMALISERS`), `exportAssets.ts`, `prompt.ts` |
| Change the limits | `limits.ts` |
| Swap the spreadsheet library | `readWorkbook.ts` only |
| Change what is sent to the model | `suggestions.ts`, `buildSuggestRequest` |
| Change the prompt or the model | `prompt.ts`; `route.ts` or `ANTHROPIC_MODEL` |
| Change the confidence threshold for "Check" | `types.ts`, `LOW_CONFIDENCE` |

## Everything else

| Path | What it is |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Rules and commands for coding agents. `CLAUDE.md` imports `AGENTS.md` |
| `.agent/` | Tool-neutral agent protocol (`PROTOCOL.md`) and live state (`HANDOFF.md`) |
| `.claude/` | Claude Code skills, subagent definitions, and `launch.json` for the dev server |
| `.local-map/` | This map; see its `README.md` |
| `docs/` | `spec.md` (requirements), `research.md`, `plan.md` |
| `public/samples/` | The client's two samples and the four generated fixtures; used by tests and by the sample buttons |
| `scripts/make-fixtures.mjs` | Generates the four fixtures (`pnpm fixtures`) |
| `next.config.ts` | Scaffold defaults: `cacheComponents` (the page is prerendered as a static shell), `partialPrefetching` (link prefetching; irrelevant with one route), and the Turbopack rule that runs Tailwind 4 on CSS |
| `vitest.config.mts` | Tests run in Node; `@` maps to `src` |
| `pnpm-workspace.yaml` | Tells pnpm not to run the install scripts of `sharp` and `unrs-resolver` |
| `.env.example` | The two optional environment variables |
