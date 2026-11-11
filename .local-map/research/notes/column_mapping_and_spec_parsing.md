# Column mapping and hardware spec-string parsing

_As of 11 Nov 2026. (S) = from a search-result summary of the linked page, not a full read._

## 1. Fuzzy string matching on short or abbreviated headers

### Takeaway
String similarity cannot resolve abbreviations or synonyms ("S/N", "Mem", "HDD/SSD") and confuses look-alikes; use it only after an alias table, with a strict threshold.

### Cited Findings
- Fuse.js (docs v7.6.0-beta.0): modified Bitap; score 0 = perfect, 1 = mismatch; default `threshold` 0.6; 32-character pattern limit — [Fuse.js](https://www.fusejs.io/fuzzy-search.html)
- RapidFuzz `token_set_ratio` "Returns 100.0 if one string is a subset of the other" — [RapidFuzz](https://rapidfuzz.github.io/RapidFuzz/Usage/fuzz.html)
- npm `string-similarity` (Dice's coefficient) is deprecated, archived May 2023 — [GitHub](https://github.com/aceakash/string-similarity)
- Vendor guide: Levenshtein for typos, Jaro-Winkler for short strings, token-set for superset headers; sample cut-off 0.87, to be tuned on real headers — [CSVBox](https://csvbox.io/resources/ai-column-mapping)

### Inferences
- Own test (textbook implementations against the eight canonical field names): "S/N" vs serial number scores Levenshtein 0.23, Jaro-Winkler 0.77, Dice 0.00; "Mem", "Processor", "HDD/SSD", "Display", "Make" and "Brand" each rank a wrong field first under Jaro-Winkler (e.g. "Brand" to ram at 0.69).
- False positives: "Asset Tag" vs "asset type" Jaro-Winkler 0.90; "proc" vs "product" 0.90 beats "processor" 0.89; token-set gives 1.00 for "CPU Model" against both cpu and model. Fuse's 0.6 default is too loose for headers.

### Gaps
- No benchmark on spreadsheet headers found; npm `jaro-winkler` and `fastest-levenshtein` pages not reviewed.

## 2. Alias dictionaries, instance-based matching and confidence scores

### Takeaway
The literature says to combine weak matchers (name, alias/reuse, cell values) into one score and keep a human check; no single matcher wins everywhere.

### Cited Findings
- Rahm & Bernstein (2001) classify matchers as schema- vs instance-level, element- vs structure-level, language- vs constraint-based (S) — [Leipzig](https://dbs.uni-leipzig.de/research/publications/a-survey-of-approaches-to-automatic-schema-matching); hybrid matchers integrate criteria in one algorithm, composite matchers aggregate independent matchers' results (S, course slides) — [Waterloo](https://cs.uwaterloo.ca/~tozsu/courses/cs856/F05/Presentations/Week7/CS856-SchemaMatchingSurvey-Slides.pdf)
- COMA (2002): combined matchers were superior, and reuse of earlier match results highly valuable (S) — [COMA](https://pubs.dbs.uni-leipzig.de/se/node/301)
- Valentine (2021): "One size does not fit all"; schema-based methods fail on noisy names, instance-based ones on noisy or non-overlapping values; a ~70-line Jaccard-Levenshtein baseline "works surprisingly well"; reported scores used grid-searched parameters — [Valentine](https://ar5iv.labs.arxiv.org/html/2010.07386)
- Value-only type detection: Sherlock (2019), 78 types, weighted F1 0.89, beating dictionary and regex baselines (S) — [Sherlock](https://vis.mit.edu/pubs/sherlock); Sato (2020) adds table context, 0.925 weighted and 0.735 macro F1 — [Sato](https://arxiv.org/abs/1911.06311)

### Inferences
- For eight fields: score = alias/exact hit + fuzzy name score + per-field value validator (serial-like token, CPU pattern, capacity with unit, inches); accept only above a threshold and clear of the runner-up.
- Sherlock/Sato's general types will not cover hardware fields: reuse the idea, not the models.

### Gaps
- Survey PDF was blocked (403), so hybrid/composite wording is unverified; no calibrated-confidence method for header mapping found.

## 3. What commercial importers document

### Takeaway
All layer aliases, remembered mappings, fuzzy matching and an AI step behind user review; none publishes algorithms or accuracy.

### Cited Findings
- Flatfile: exact, then historical, then fuzzy matching (S; possibly legacy) — [Flatfile support](https://support.flatfile.com/en/articles/7873666-matching); its automap plugin proceeds only if every field is "strong" (> 90%) or "absolute" (100%) — [Flatfile docs](https://flatfile.com/docs/plugins/automap)
- OneSchema: alternate column names, user- and org-level mapping history, AI-suggested mappings (S) — [alternate names](https://docs.oneschema.co/changelog/alternative-column-name-mappings), [history](https://docs.oneschema.co/changelog/historical-column-matching-intelligence), [AI](https://docs.oneschema.co/changelog/ai-suggested-mappings-and-1-click-mode-are-now-public)
- Dromo (Sep 2025; names GPT-3/4): matches on "header labels (and even samples of the data)"; remembers prior mappings — [Dromo](https://dromo.io/blog/improving-data-import-accuracy-with-dromos-ai-powered-column-matching)
- CSVBox (Aug 2026): per-field aliases; cascade exact, normalised, fuzzy, semantic; auto-apply high confidence, flag medium, leave low unmapped — [CSVBox](https://csvbox.io/resources/ai-column-mapping)
- Osmos Uploader "AutoMap" (S) — [Osmos docs](https://42layers.gitbook.io/uploader/standard-mode/overview); Microsoft acquired Osmos in January 2026 (S) — [The Register](https://www.theregister.com/2026/01/06/microsoft_acquires_osmos/)

### Inferences
- This layered design is the de facto standard and small enough to build in-house.

### Gaps
- Osmos Uploader's post-acquisition status unknown; sources are marketing or changelog text.

## 4. LLM column mapping with Claude structured outputs

### Takeaway
Structured outputs are generally available and guarantee schema-valid JSON, not correct mappings; call the model only for columns heuristics leave unresolved.

### Cited Findings
- `output_config.format` with `type: "json_schema"` (old `output_format` deprecated) or `strict: true` tools; no beta header; every model; constrained decoding; a new schema adds compile latency, then is cached 24 hours — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Limits: `additionalProperties: false`; no `minimum`/`maximum`, `minLength` or recursion; schema can break on `refusal` or `max_tokens`; no citations or prefill; zero-data-retention eligible except some models — [Anthropic](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- Input/output price per million tokens: Haiku 5.5 $0.10/$0.50, Sonnet 5.5 $2/$10 — [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- Names-only LLM matching works but degrades with too little or too much context; three runs with majority vote were used; LLM and string similarity are complementary (S) — [Parciak et al. 2024](https://arxiv.org/abs/2407.11852v1)
- "relying only on a model performs worse and costs more"; "Abstaining has to be an allowed and encouraged output" — [CSVBox](https://csvbox.io/resources/ai-column-mapping)

### Inferences
- Pattern: alias/exact, then fuzzy + value validators, then LLM for leftovers, with the target as an enum including "unmapped"; range-check confidence in code.
- Headers plus five rows (about 3,000 input, 500 output tokens) cost roughly $0.0006 on Haiku 5.5 or $0.011 on Sonnet 5.5; the real costs are latency, privacy (mask serials in sample rows) and run-to-run variation (cache by header signature).

### Gaps
- No Anthropic figures on mapping accuracy, latency or sample-row count; cited LLM studies used 2023-24 models. A bundled Anthropic API reference (no public URL) says forced `tool_choice` is rejected on the newest models; unverified.

## 5. Parsing combined configuration strings

### Takeaway
No maintained library for whole configuration strings was found; write regex and dictionary rules per component and send unparsed rows to an LLM.

### Cited Findings
- CPU-name helpers are small: `cpumodel` v0.0.2 covers Ryzen, EPYC, Core, Xeon (S) — [PyPI](https://pypi.org/project/cpumodel/0.0.2); Ultralytics has regexes for Intel i-series and Ryzen (S) — [Ultralytics](https://docs.ultralytics.com/reference/utils/cpu)
- GPT-4 reached 91% F1 on product attribute-value extraction, about 10 points above trained taggers (S for the margin), "particularly strong at string wrangling and name expansion" — [Brinkmann et al. 2024](https://arxiv.org/abs/2403.02130); taggers need much labelled data and generalise poorly to unseen values (S) — [Brinkmann et al. 2023](https://arxiv.org/abs/2310.12537v2)
- Bare capacities are ambiguous: "4g" can be a network standard or 4 GB RAM (S) — [Amazon Science](https://cdn.amazon.science/a1/97/116ffa7f44e28bcc4bcdfccaceee/building-natural-language-interface-for-product-search.pdf)

### Inferences
- RAM vs storage, most reliable first: adjacent keyword (RAM/DDR vs SSD/HDD/NVMe); TB, decimals (3.84TB) or a count prefix ("6x") mean storage; position (CPU / RAM / storage); magnitude last, since it fails on servers (512GB RAM in the R650 example) and 32-64GB eMMC devices.
- Split on " - ", "/", commas and parentheses; text before the first recognised spec is manufacturer + model; keep an "unrecognised CPU" path for new names (Core Ultra, Apple M).

### Gaps
- No regex vs NER vs LLM comparison, open dataset or authoritative RAM/storage guide for hardware strings found; the rules above are untested.

## 6. Unit conventions for storage and RAM

### Takeaway
Yes: drive capacity is decimal (1 TB = 1000 GB); RAM is binary in practice (16384 MB = 16 GB).

### Cited Findings
- NIST: memory makers used megabyte for 2^20 bytes, storage makers for 1,000,000 bytes; IEC binary prefixes (kibi, mebi, gibi) date from December 1998 (IEC 60027-2) and are not SI — [NIST](https://physics.nist.gov/cuu/Units/binary.html)
- Seagate: 1 GB = 1,000,000,000 bytes; Windows counts in binary, so a 500 GB drive shows as 465 GB (S) — [Seagate](https://www.seagate.com/support/kb/why-does-my-hard-drive-report-less-capacity-than-indicated-on-the-drives-label-172191en/)
- JEDEC Standard 100B.01 defines K = 1024, M = 1,048,576, G = 1,073,741,824 for semiconductor memory, "included only to reflect common usage" (via Wikipedia; jedec.org returned 403) — [Wikipedia](https://en.wikipedia.org/wiki/JEDEC_memory_standards)

### Inferences
- Convert storage with x1000 (3.84 TB = 3840 GB) and RAM with /1024; readings of 465, 476 or 931 GB are binary views of 500, 512 and 1000 GB drives.

### Gaps
- IEC 80000-13 and jedec.org primary texts not accessed.
