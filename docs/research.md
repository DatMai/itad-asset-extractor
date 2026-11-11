# Research summary

One page. Four questions, each with the decision it led to. Checked on 11 Nov 2026.
The full report with every source is in [`.local-map/research/report.md`](../.local-map/research/report.md);
the raw notes are in [`.local-map/research/notes/`](../.local-map/research/notes/).

## 1. Reading .xlsx and .csv, and finding the header row

| Library | State | Verdict |
| --- | --- | --- |
| `xlsx` on npm | Frozen at 0.18.5 (2022); inside [CVE-2023-30533](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6) and [CVE-2024-22363](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) | Do not use |
| **SheetJS 0.20.3 from [its CDN](https://docs.sheetjs.com/docs/getting-started/installation/nodejs)** | Both CVEs fixed; reads xlsx, xls, csv; 335 KB gzip; no release since Jul 2024 | **Chosen** |
| exceljs 4.4.0 | Four CVEs published Aug 2026 ([example](https://www.cve.org/CVERecord?id=CVE-2026-78207)), no upstream fix | Do not use |
| read-excel-file + Papa Parse | Maintained, 21 KB together, no `.xls` | Fallback if SheetJS must go |

- **Parse in the browser.** Vercel rejects request bodies over [4.5 MB](https://vercel.com/docs/functions/limitations); in the browser the file never leaves the device. Load the parser with `import()` so it downloads only when a file is chosen.
- **CSV:** decode with `TextDecoder`, then `XLSX.read(text, { type: "string", raw: true })`. Without `raw`, `0012` becomes 12 and `12/03/2021` becomes a US date ([parse options](https://docs.sheetjs.com/docs/api/parse-options)). Delimiter detection only looks at the first 1,024 characters, so we count delimiters ourselves.
- **Dates:** SheetJS builds local-time `Date` objects, which shift a day east of UTC ([dates](https://docs.sheetjs.com/docs/csf/features/dates)). We keep the day number and convert it with `SSF.parse_date_code`, so no time zone is involved.
- **Header row:** importers use simple signals (Flatfile takes the fullest of the first 10 rows). Type contrast fails when every column is text ([DuckDB](https://duckdb.org/docs/stable/data/csv/auto_detection.html)), which asset lists are. So we score the top rows on known column names and label-like cells, and let the user change the row.

## 2. Identifying columns

No single matcher is enough; research ([COMA](https://pubs.dbs.uni-leipzig.de/se/node/301), [Valentine](https://ar5iv.labs.arxiv.org/html/2010.07386)) and vendors ([CSVBox](https://csvbox.io/resources/ai-column-mapping), [Flatfile](https://support.flatfile.com/en/articles/7873666-matching)) layer them.

| Matcher | Good at | Fails when |
| --- | --- | --- |
| Synonym list | Abbreviations (`S/N`), other languages; gives a reason | The name is not listed |
| Fuzzy similarity | Typos | Abbreviations: `S/N` shares nothing with "serial number"; look-alikes collide |
| Value profiling | Missing or meaningless headers | Values are ambiguous (any ID looks like a serial) |
| LLM, structured output | Names nobody anticipated | Valid JSON is not a correct answer; latency, privacy, not repeatable |

**Decision:** synonyms first, strict fuzzy second, values as support or veto, one score and one reason per column. An LLM only for columns left unresolved, with "unmapped" as an allowed answer ([structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)). Cost is negligible (about $0.0006 per file on Haiku 5.5), so the reasons to keep it last are privacy and repeatability.

## 3. Parsing combined cells

No maintained library parses whole hardware strings; the nearest are small CPU-name helpers. LLMs extract product attributes well (91% F1 in [Brinkmann et al.](https://arxiv.org/abs/2403.02130)) but would send serial-bearing rows off the device and cannot be unit-tested.

**Decision:** hand-written rules. RAM versus storage is decided by, in order: a label next to the number (RAM, SSD), unit and shape (TB, `6x`), position (RAM then storage), and magnitude last. Storage is decimal ([Seagate](https://www.seagate.com/support/kb/why-does-my-hard-drive-report-less-capacity-than-indicated-on-the-drives-label-172191en/)), RAM binary ([NIST](https://physics.nist.gov/cuu/Units/binary.html)). These rules have no published accuracy, so the fixture files are the benchmark.

## 4. Importer UX patterns

Flatfile, OneSchema, Dromo and CSVBox share one flow: upload → header row → map columns → review.

- Every step is pre-filled; the user confirms or corrects. The header row is pre-selected and changeable, with a "no header" option.
- Mapping: one row per source column, sample values, a target dropdown, an "ignore" choice. Choosing a field already in use frees the earlier column, with a notice.
- Review: editable grid, message on hover, an issues-only filter. Changed values keep the original visible.
- Doubt is shown as named levels with a reason; percentages invite over-trust ([Google PAIR](https://pair.withgoogle.com/chapter/explainability-trust/)). We show a level first and the number second.
- Errors name the cause and the remedy and keep the user in the flow ([NN/g](https://www.nngroup.com/articles/error-message-guidelines/)).

## Caveats

SheetJS has had no release for 28 months, so it sits behind one function (`readWorkbook`) and can be swapped. Several vendor and literature findings were read from summaries, not full texts.
