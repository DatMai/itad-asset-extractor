# Parsing libraries and header-row detection (.xlsx/.csv in Next.js), state as of 2026-11-11

Versions, dates, advisories and sizes were checked live on 2026-11-11. Sizes are raw / gzip-9 of the published files, measured in this session. Doc statements are paraphrased.

## 1. Library status, licence, size, formats, advisories; the `xlsx` 0.18.5 claim; pnpm command

### Takeaway
The claim is confirmed. npm `xlsx` is frozen at 0.18.5 and inside both CVE ranges; fixed builds exist only on cdn.sheetjs.com, where 0.20.3 (tagged 2024-07-18) is still the latest: `pnpm install --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. SheetJS is the only one of the four that reads .xlsx, .xls and .csv. exceljs is stale and has unpatched 2026 CVEs.

### Cited Findings
- npm `xlsx`: latest 0.18.5 (2022-03-24), Apache-2.0, not marked deprecated — [npm registry](https://registry.npmjs.org/xlsx). SheetJS calls the registry out of date and the CDN authoritative — [SheetJS install docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs).
- CVE-2023-30533 (prototype pollution, High 7.8): `xlsx` < 0.19.3, only when reading a crafted file — [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6). CVE-2024-22363 (ReDoS, High 7.5): < 0.20.2 — [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). Neither has a patched npm version. No reviewed advisory reaches 0.20.3 — [GitHub Advisory API](https://api.github.com/advisories?ecosystem=npm&affects=xlsx).
- Latest SheetJS: the CDN manifest reports 0.20.3, Apache-2.0, zero dependencies; a 0.20.4 tarball URL returns 404 — [CDN manifest](https://cdn.sheetjs.com/xlsx-latest/package/package.json). Tagged 2024-07-18 — [tags](https://git.sheetjs.com/api/v1/repos/sheetjs/sheetjs/tags). Unreleased master commits continue to 2026-02-09 — [commits](https://git.sheetjs.com/api/v1/repos/sheetjs/sheetjs/commits?limit=4).
- Official pnpm steps: `pnpm rm xlsx`, then the command above. Vendoring is strongly recommended: `pnpm install --save file:vendor/xlsx-0.20.3.tgz` — [SheetJS install docs](https://docs.sheetjs.com/docs/getting-started/installation/nodejs).
- SheetJS reads and writes XLSX, XLS (BIFF8) and CSV/TXT — [formats](https://docs.sheetjs.com/docs/miscellany/formats). Full build: 952 KB (335 KB gzip) — [xlsx.full.min.js](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js). Mini build: 280 KB (86 KB gzip), but it omits XLS/XLSB and CSV codepage encodings — [xlsx.mini.min.js](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.mini.min.js), [standalone docs](https://docs.sheetjs.com/docs/getting-started/installation/standalone).
- exceljs: 4.4.0 (2023-10-19) is still latest; MIT; xlsx and csv only per its description — [npm registry](https://registry.npmjs.org/exceljs). Last default-branch commit 2024-01-12 — [GitHub API](https://api.github.com/repos/exceljs/exceljs/commits?per_page=2). Four CVEs published 2026-08-24 cover all versions through 4.4.0: decompression-bomb DoS on read ([CVE-2026-78206](https://www.cve.org/CVERecord?id=CVE-2026-78206), 7.5), prototype pollution ([CVE-2026-78207](https://www.cve.org/CVERecord?id=CVE-2026-78207), 9.4), `addImage` path traversal ([CVE-2026-78208](https://www.cve.org/CVERecord?id=CVE-2026-78208)), CSV formula injection on write ([CVE-2026-78209](https://www.cve.org/CVERecord?id=CVE-2026-78209)). The records point to a single-maintainer fork, `exceljs-hardened` 5.1.0 — [npm registry](https://registry.npmjs.org/exceljs-hardened). Size 948 KB (256 KB gzip) — [exceljs.min.js](https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js).
- papaparse: 5.7.0 (2026-08-24), MIT, zero dependencies, CSV only, commits to 2026-10-27 — [npm registry](https://registry.npmjs.org/papaparse), [GitHub API](https://api.github.com/repos/mholt/PapaParse). 18.9 KB (6.8 KB gzip) — [papaparse.min.js](https://cdn.jsdelivr.net/npm/papaparse@5.7.0/papaparse.min.js). Sole advisory: ReDoS CVE-2020-36649, fixed in 5.2.0 — [GHSA-qvjc-g5vr-mfgr](https://github.com/advisories/GHSA-qvjc-g5vr-mfgr).
- read-excel-file: 9.3.15 (published 2026-11-11), MIT, Node 18+ — [npm registry](https://registry.npmjs.org/read-excel-file). Reads .xlsx only and rejects legacy .xls — [README](https://github.com/catamphetamine/read-excel-file). 48 KB (14 KB gzip) — [browser bundle](https://cdn.jsdelivr.net/npm/read-excel-file@9.3.15/bundle/read-excel-file.min.js). No advisories — [GitHub Advisory API](https://api.github.com/advisories?ecosystem=npm&affects=read-excel-file).

### Inferences
- SheetJS is maintained only in the sense of a live repository: no release for about 28 months. Pin 0.20.3 and vendor the tarball.
- 0.20.3 is outside both advisory ranges, so version-based audits should pass.
- If .xls is dropped, read-excel-file plus papaparse (about 21 KB gzip, both actively released) is the lean alternative. With .xls, SheetJS is the only candidate here.

### Gaps
- Scanner data for exceljs conflicts: Snyk lists the issues as affecting versions below 5.0.0 ([Snyk](https://security.snyk.io/vuln/SNYK-JS-EXCELJS-19234023), title seen in search results only), npm has no exceljs 5.x, and GitHub's reviewed list shows only CVE-2018-16459 ([GitHub Advisory API](https://api.github.com/advisories?ecosystem=npm&affects=exceljs)).
- Unreleased SheetJS commits were not assessed. The tree-shaken ESM size of 0.20.3 inside a Next.js bundle was not measured.

## 2. Can SheetJS alone parse CSV robustly, or is Papa Parse needed?

### Takeaway
SheetJS alone is enough if the app decodes the bytes itself and passes `raw: true`. Papa Parse is optional; it adds a reported delimiter and per-row error codes.

### Cited Findings
- Delimiter: SheetJS honours a leading `sep=` line, then the `FS` option; otherwise it counts unquoted `,` tab `;` `|` in the first 1024 characters and takes the most frequent — [parse options](https://docs.sheetjs.com/docs/api/parse-options), [0.20.3 source, `guess_sep`](https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs).
- Quoting: a field that starts with a double quote may contain separators and line breaks; doubled quotes are unescaped — [0.20.3 source, `dsv_to_sheet_str`](https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs).
- Encoding: a UTF-8 BOM switches on UTF-8 decoding. BOM-less bytes passed as `array` or `buffer` are read byte-per-character (Latin-1) unless `codepage: 65001` is set — [0.20.3 source, `prn_to_sheet`](https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs). The codepage library is not guaranteed to be loaded — [parse options](https://docs.sheetjs.com/docs/api/parse-options).
- Coercion: without `raw: true`, TRUE/FALSE become booleans, numeric-looking text becomes numbers and date-looking text becomes date codes with format 14. The original text survives in `w` — [parse options](https://docs.sheetjs.com/docs/api/parse-options), [0.20.3 source](https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs).
- Papa Parse tries `,` tab `|` `;` and two ASCII separators on a 10-row preview and keeps the candidate with the most consistent field count, falling back to comma. It strips a leading BOM from string input — [5.7.0 source](https://cdn.jsdelivr.net/npm/papaparse@5.7.0/papaparse.js). `encoding` applies only to local files; results expose `meta.delimiter` and errors such as `UndetectableDelimiter`, `TooFewFields`, `TooManyFields`; `dynamicTyping` is opt-in and leaves numbers beyond 2^53 as strings — [Papa Parse docs](https://www.papaparse.com/docs).

### Inferences
- Safe SheetJS-only path: decode with `TextDecoder` (UTF-8, falling back to windows-1252), then `XLSX.read(text, { type: "string", raw: true })`. This avoids mojibake and keeps leading zeros, long serials and dates as text.
- Both sniffers sample only the top of the file, where title and note rows sit. Offer a delimiter override and treat a one-column result as a failed detection.

### Gaps
- Findings come from reading docs and source, not from running test files. File-type sniffing edge cases were not tested, for example a CSV whose first cell is `ID`, which resembles SYLK ([parse options](https://docs.sheetjs.com/docs/api/parse-options)).
- No published robustness comparison of the two CSV readers was found.

## 3. Client-side vs server-side parsing in Next.js

### Takeaway
Parse in the browser. Nothing is uploaded, so Vercel's 4.5 MB cap and the 1 MB Server Action default never apply, the file stays private, and parser flaws cannot reach the server. Lazy-load the parser. A Web Worker is optional below 5 MB.

### Cited Findings
- Vercel Functions cap request and response bodies at 4.5 MB (figure unchanged; page updated 2026-08-24). Larger requests get `413 FUNCTION_PAYLOAD_TOO_LARGE` — [Vercel limits](https://vercel.com/docs/functions/limitations). Vercel's remedy for large uploads is uploading straight to storage — [Vercel KB](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions).
- Server Actions accept 1 MB by default; raise it with `experimental.serverActions.bodySizeLimit` (multipart overhead counts) — [Next.js serverActions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions). With `proxy` in use, bodies are buffered up to 10 MB by default and only partially available beyond that — [Next.js proxyClientMaxBodySize](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize).
- SheetJS warns that parsing large spreadsheets on the main thread can freeze the page, and shows Workers as the fix with all work staying local — [SheetJS worker demo](https://docs.sheetjs.com/docs/demos/bigdata/worker). Papa Parse's `worker: true` keeps the page responsive at a small speed cost — [Papa Parse docs](https://www.papaparse.com/docs). read-excel-file already uses Workers in the browser and reports 0.1 s for 1 MB and 0.5 s for 10 MB — [README](https://github.com/catamphetamine/read-excel-file).
- Client bundle cost: SheetJS full 335 KB gzip, versus read-excel-file 14 KB plus papaparse 6.8 KB — [xlsx.full.min.js](https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js), [read-excel-file bundle](https://cdn.jsdelivr.net/npm/read-excel-file@9.3.15/bundle/read-excel-file.min.js), [papaparse.min.js](https://cdn.jsdelivr.net/npm/papaparse@5.7.0/papaparse.min.js).

### Inferences
- Use `await import("xlsx")` inside the file handler of a Client Component, so the parser downloads only when a file is chosen.
- Below 5 MB a Worker is mainly insurance: a zip bomb or regex blow-up then stalls a killable thread, not the UI or a billed function.
- If rows must reach the server, post the parsed JSON, not the file, and keep a client-side size cap.

### Gaps
- No SheetJS timing figures for files near 5 MB were found; measure on target hardware.
- Next.js docs state no framework-level body limit for Route Handlers; only platform and proxy limits were found.
- SheetJS's Next.js demo covers Pages Router patterns only ([demo](https://docs.sheetjs.com/docs/demos/static/nextjs)).

## 4. SheetJS date and number pitfalls

### Takeaway
Read dates as numeric codes or with `UTC: true`, read identifiers from raw values and never from formatted text, and handle merges and hidden content explicitly.

### Cited Findings
- Dates are stored as numbers. Default parsing yields numeric cells; `cellDates: true` yields Date cells. Date handling was overhauled in 0.20.0, so older builds such as npm 0.18.5 behave differently — [dates](https://docs.sheetjs.com/docs/csf/features/dates), [parse options](https://docs.sheetjs.com/docs/api/parse-options).
- `sheet_to_json` has `UTC` default false, so Dates are built for local time; `true` uses UTC methods — [array utilities](https://docs.sheetjs.com/docs/api/utilities/array), [dates](https://docs.sheetjs.com/docs/csf/features/dates).
- Timezone-free route: convert numeric codes with `XLSX.SSF.parse_date_code` — [cell objects](https://docs.sheetjs.com/docs/csf/cell). `XLSX.SSF.is_date(format)` tells whether a number format is a date; formats are only kept with `cellNF: true` — [dates](https://docs.sheetjs.com/docs/csf/features/dates), [number formats](https://docs.sheetjs.com/docs/csf/features/nf).
- 1904 date system: flag at `wb.Workbook.WBProps.date1904` — [dates](https://docs.sheetjs.com/docs/csf/features/dates).
- `sheet_to_json` `raw` defaults to true. `raw: false` returns formatted text, where dates use format 14 (m/d/yy) unless `dateNF` overrides it — [array utilities](https://docs.sheetjs.com/docs/api/utilities/array), [parse options](https://docs.sheetjs.com/docs/api/parse-options).
- Numbers are IEEE754 doubles; `v` holds the raw value and `w` the formatted text — [cell objects](https://docs.sheetjs.com/docs/csf/cell). Excel itself strips leading zeros, shows large numbers in scientific notation and truncates to 15 digits — [Microsoft Support](https://support.microsoft.com/en-us/office/keeping-leading-zeros-and-large-numbers-1bf7b935-36e1-4985-842f-5dfa51f85fe7).
- Merged cells: only the top-left cell holds the value; ranges are listed in `ws["!merges"]` — [merges](https://docs.sheetjs.com/docs/csf/features/merges).
- Hidden content: sheet state is `wb.Workbook.Sheets[i].Hidden` (0 visible, 1 hidden, 2 very hidden) — [visibility](https://docs.sheetjs.com/docs/csf/features/visibility). Row properties need `cellStyles: true` at read time — [row properties](https://docs.sheetjs.com/docs/csf/features/rowprops). `skipHidden` defaults to false — [array utilities](https://docs.sheetjs.com/docs/api/utilities/array).
- Useful for header scanning: `header: 1` returns arrays and keeps blank rows, `defval` fills empty cells, a numeric `range` sets the start row — [array utilities](https://docs.sheetjs.com/docs/api/utilities/array). The `sheetRows` parse option caps rows read — [parse options](https://docs.sheetjs.com/docs/api/parse-options).

### Inferences
- Off-by-one days appear when a local-midnight Date is serialised with `toISOString()` in zones east of UTC, or when server and browser zones differ. `UTC: true` with UTC getters, or `parse_date_code`, avoids both.
- For serial and asset-tag columns use raw values and `String(v)`. Digits beyond 15 are already lost if the cell was numeric in Excel; text cells are intact.
- Forward-fill `!merges` before header detection. Decide explicitly whether hidden sheets and rows are ingested; they are by default.

### Gaps
- The docs do not specify the formatted text for long integers under General format; not tested here.
- No dated list of pre-0.20 off-by-one bugs was retrieved; the docs only state the overhaul.

## 5. Published heuristics for locating the header row

### Takeaway
Commercial importers use simple rules: the fullest row near the top, confirmed by expected column names. Research systems add coherence of the rows below. Type contrast alone fails on all-text tables, which asset lists often are.

### Cited Findings
- Fill ratio: Flatfile's default scans the first 10 rows (`rowsToSearch`) and picks the row with the most non-empty cells, earliest on ties — [Flatfile xlsx extractor](https://flatfile.com/plugins/plugin-xlsx-extractor/). messytables picks the first row whose non-empty count is within 1 of the modal count — [messytables headers.py](https://raw.githubusercontent.com/okfn/messytables/master/messytables/headers.py).
- First data row, then the row above: Flatfile's `dataRowAndSubHeaderDetection` looks for the first data row (values castable to number or boolean) and takes the previous row. A following row replaces the header when over half its fields fuzzy-match it — [Flatfile xlsx extractor](https://flatfile.com/plugins/plugin-xlsx-extractor/).
- Expected-name match: OneSchema skips its header-selection step when detected header names match the template's columns — [OneSchema docs](https://docs.oneschema.co/docs/2-select-header-row). Its API defaults the header row to `auto` — [OneSchema API](https://docs.oneschema.co/reference/set-header-row).
- Type contrast with rows below: Python's `csv.Sniffer.has_header` votes per column on whether later rows are numeric or differ in string length from the first row, over about 20 rows — [Python csv docs](https://docs.python.org/3/library/csv.html#csv.Sniffer.has_header). DuckDB treats the first row as a header when its types deviate from the rows below, and states this cannot work when every column is text — [DuckDB auto detection](https://duckdb.org/docs/stable/data/csv/auto_detection.html).
- Pytheas (PVLDB 2020): weighted fuzzy rules classify lines as context, header, subheader, data, footnote or other. Rules compare each cell with a window of cells below it (character-class patterns, case, length, digits) and use keyword lists (totals, notes, null markers). It finds the first data line, then scans upward for a header whose values are unique and non-empty in all columns (the outer one or two may be empty). Multi-row headers are contiguous lines that become valid once merged, each value prefixed onto the cells below and to its right. Reported 95.9% precision and 95.7% recall on 2,000 annotated CSVs — [Pytheas paper](https://www.vldb.org/pvldb/vol13/p2075-christodoulakis.pdf), [Pytheas repo](https://github.com/cchristodoulaki/Pytheas).
- Learned models: Strudel is a random-forest line and cell classifier using content, contextual (type similarity with neighbours) and computational (arithmetic links) features — [HPI Strudel page](https://hpi.de/projects/data-preparation/structure-detection-in-verbose-csv-files.html). TableSense is a CNN over per-cell features, with 91.3% recall and 86.5% precision — [TableSense, arXiv](https://arxiv.org/abs/2106.13500). hypoparsr ranks alternative parses by data-quality features — [hypoparsr README](https://github.com/tdoehmen/hypoparsr).
- Manual baselines: OpenRefine asks the user which rows to skip and which to parse as headers — [OpenRefine manual](https://openrefine.org/docs/manual/starting). pandas only accepts a header row index or list (a list gives a MultiIndex) plus `skiprows` — [pandas read_excel](https://pandas.pydata.org/docs/reference/api/pandas.read_excel.html). Users locate the row themselves, typically the first row with the most values — [Stack Overflow 60434664](https://stackoverflow.com/questions/60434664/automatically-determine-header-row-when-reading-csv-in-pandas).
- table-header-detective, a small MIT TypeScript library, scores type differences, empty cells and uniqueness and supports multi-row headers; not vetted — [GitHub](https://github.com/lyleunderwood/table-header-detective).

### Inferences
- One heuristic that fits: over the first 30 rows (merges forward-filled), score each row by fill ratio against the modal width, share of text cells, uniqueness, hits against an asset-field synonym list (serial, model, manufacturer, asset tag), and contrast with the next 3 to 5 non-empty rows. Penalise single-cell rows. Take the top score, then check whether merging the row above improves uniqueness (two-row headers). Ask the user to confirm when the margin is small.
- Weight keyword hits and fill ratio above type contrast, because serial, model and location columns are text.

### Gaps
- OneSchema's fuller rule (first row with a majority of non-empty fields, then a template match) was visible only in a search snippet; its changelog page returns 404 ([OneSchema changelog](https://docs.oneschema.co/changelog/skip-header-row-mapping)).
- CSVBox publishes only marketing-level claims of header detection; no algorithm was found ([CSVBox blog](https://blog.csvbox.io/parse-csv-no-headers/)).
- No accuracy figures exist for the commercial heuristics. The hypoparsr and TableSense feature lists were not read in full.
