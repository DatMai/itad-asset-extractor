---
name: add-extraction-rule
description: Use when the extractor misreads or misses something in a spreadsheet, such as an unknown column name, unit, CPU family, brand, product line, asset type word or non-computer keyword. Walks through reproducing it with a failing test, adding the rule to the right table, and recording it.
---

# Add an extraction rule

The pipeline is table-driven. Most fixes are one new entry in a table plus one test, not new logic.

## 1. Reproduce first

Write the failing test before touching any table. Use the real text from the spreadsheet.

| What went wrong | Test file |
| --- | --- |
| Header row not found, or wrong row | `src/lib/extraction/detectHeader.test.ts` |
| Column mapped to the wrong field, or not mapped | `src/lib/extraction/mapColumns.test.ts` |
| A value in its own column parsed wrongly (RAM, storage, screen, type, CPU, date) | `src/lib/extraction/normalise.test.ts` |
| A combined cell split wrongly | `src/lib/extraction/parseFreeText.test.ts` |
| A whole file comes out wrong | add the file to `public/samples/` and a case to `src/lib/extraction/pipeline.test.ts` |

Run `pnpm test` and confirm the new test fails for the reason you expect.

## 2. Put the rule in the right table

| Kind of rule | File |
| --- | --- |
| Another name for a field ("Svc Tag", "Bộ nhớ") | `src/lib/extraction/fields.ts`, the `synonyms` of that field |
| Brand name or alias | `src/lib/extraction/vocab.ts`, `BRANDS` |
| Product line → manufacturer and type ("Latitude") | `src/lib/extraction/vocab.ts`, `PRODUCT_LINES` |
| Asset type word ("Ultrabook") | `src/lib/extraction/vocab.ts`, `TYPE_WORDS` |
| Non-computer word ("docking station") | `src/lib/extraction/vocab.ts`, `NON_COMPUTER_WORDS` |
| CPU family pattern | `src/lib/extraction/vocab.ts`, `CPU_PATTERNS` |
| Unit or number format | `src/lib/extraction/normalise.ts` |

Add only the entry the test needs. Do not add speculative synonyms: a wrong synonym maps a column
to the wrong field with high confidence, which is worse than leaving it unmapped.

## 3. Check for collateral damage

Run the whole suite. A new synonym can steal a column from another field; a looser pattern can
match inside model numbers. The fixture tests in `pipeline.test.ts` catch this.

## 4. Never trade correctness for coverage

If the value is ambiguous (for example a bare `256GB` with nothing else in the cell), the right
result is a low-confidence value or an empty one, not a confident guess. Rule 1 in `AGENTS.md`.

## 5. Record it

Add one line to `.local-map/JOURNEY.md`: the input that failed, the rule added, the test name.
