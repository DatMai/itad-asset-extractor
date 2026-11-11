# Decisions

Each entry: the situation, the options, the choice, and what the choice costs. A reversal is a new
entry that names the one it replaces. The short version of these is the trade-off table in
`docs/spec.md` section 4.

## D1 Parse the spreadsheet in the browser

- **Situation.** The file can be read in the browser or sent to the server.
- **Options.** (a) Browser. (b) Route handler. (c) Server action.
- **Choice.** (a).
- **Why.** The client's business is data sanitisation; "your asset list never leaves your device"
  is the right default. Serverless request bodies are capped (Vercel: 4.5 MB), which is below our
  own 5 MB limit. Re-running extraction after a mapping change is instant with no round trip.
- **Cost.** The parser is in the client bundle. There is no server-side check of the file.

## D2 Deterministic pipeline first, LLM as an opt-in fallback

- **Options.** (a) LLM does the extraction. (b) Heuristics only. (c) Heuristics, with an LLM
  suggestion for columns the heuristics are unsure about.
- **Choice.** (c).
- **Why.** Heuristics are free, instant, repeatable and unit-testable, and they work in a demo
  with no network. An LLM is good exactly where rules run out: a column name nobody anticipated.
- **Cost.** More code than a single prompt. Unusual phrasings inside cells are not rescued by the
  LLM in this version; they show as low confidence and can be edited.

## D3 Storage is decimal, RAM is binary

- **Choice.** 1 TB = 1000 GB for storage; 1024 MB = 1 GB for RAM.
- **Why.** That is how each is sold and labelled. The examples in the brief agree in every case
  but one (which is treated as a typo).
- **Cost.** A value typed as "512 GB + 1 TB" totals 1512, which is not what an operating system
  would display.

## D4 Canonical CPU names, raw text kept

- **Choice.** Add the vendor and family prefix from a fixed table (`i5-8365U` →
  `Intel Core i5-8365U`), keep the cell text as `raw`.
- **Why.** One spelling per CPU makes the table scannable and grouping possible.
- **Cost.** The value shown is not verbatim. The prefix comes from a table of facts, not from a
  guess, so it does not break the "never invent data" rule.

## D5 Plain Tailwind, no component library

- **Options.** (a) shadcn/ui. (b) Plain Tailwind with native controls.
- **Choice.** (b).
- **Why.** The screens are one drop zone, a few `<select>`s and one table. A component library
  adds generated files and dependencies that would each need explaining.
- **Cost.** Less polish; menus and tooltips are the browser's.

## D6 Unit and fixture tests, no browser test

- **Choice.** Vitest on the pure pipeline, driven by fixture files. UI checked by hand.
- **Why.** The risk is in interpreting data, and that is all pure functions.
- **Cost.** A broken button would not be caught by CI.

## D7 Next.js 16 instead of 15

- **Why.** 16.4 is the current stable release; starting a new project a major version behind
  would need its own justification.
- **Cost.** Some APIs differ from older tutorials; the bundled docs are the reference.

## D8 Work on a feature branch

- **Choice.** `main` holds the scaffold commit; work happens on `feat/asset-extraction` and is
  merged when reviewed.
- **Cost.** One merge before the repository link is shared.

## D9 Edit distance for misspelt headers

- **Options.** (a) Letter-pair similarity (Dice). (b) Edit distance. (c) A fuzzy-search library.
- **Choice.** (b), accepting a header only above 0.8: one wrong letter in six.
- **Why.** Letter pairs scored "Seriel No" at 0.71, missing a one-letter typo. Edit distance is
  twenty lines and its threshold has a plain meaning. A library would add a dependency for the
  same job. Abbreviations are not a similarity problem at all ("S/N" shares nothing with "serial
  number"), so they are handled by the synonym lists and an abbreviation rule.
- **Cost.** Two short words one letter apart ("model", "modem") sit exactly at the limit; they
  are kept out by requiring a score strictly above 0.8.

## D10 Values can weaken or replace the header

- **Choice.** A header match is multiplied by `1 - 0.4 × share of values that look like something
  else`. A column with no usable header is mapped from its values when at least 60% have the
  field's shape, up to a per-field ceiling (CPU 0.8, serial 0.6, dates never).
- **Why.** Headers lie ("Type" over a column of descriptions), and some files have none. But most
  values prove little: any identifier looks like a serial number, any date could be a warranty
  date. So the ceiling depends on how unmistakable the shape is.
- **Cost.** More rules to explain. A column recognised only by its values is always shown as
  Medium or Check, never High.

## D11 Confidence is a level with a reason

- **Choice.** High from 0.85, Medium, Check below 0.7. The number is shown second. A value's
  confidence is its own times its column's.
- **Why.** Research (Google PAIR, importer products) says people over-trust bare percentages and
  act on categories. The reason matters more than the number.
- **Cost.** The thresholds are judgment, not measured accuracy. They are tuned on six files.

## D12 A CPU without a model number is flagged

- **Choice.** `Core i5 11th gen` and `i7` score 0.6, below the "Check" line.
- **Why.** The family alone does not identify a processor, and for resale value the model matters.
- **Cost.** One yellow cell in the client's first sample.

## D13 The shape of the AI suggestion

- **Choice.** Column mapping only, on a click, for unclear columns only. Default model
  `claude-opus-5-5`, low effort, structured output from a Zod schema. Identifiers masked.
  Suggestions capped at Medium and labelled. No server-side model fallback: if the model
  declines or fails, the rule-based mapping stands.
- **Why.** The default model is Anthropic's documented default; choosing a cheaper one is the
  operator's call (`ANTHROPIC_MODEL`). The call is a short classification, so low effort.
  Our fallback is the deterministic result itself, so a second model would add a beta header
  and a code path for a refusal that column names will not trigger.
- **Cost.** About two cents per sheet on the default model. Names in an unclear column are sent
  unmasked, because free text cannot be masked without losing what identifies the column.

## D14 System fonts

- **Choice.** Removed the scaffold's Google font.
- **Why.** `next/font/google` downloads at build time; the app should build and run offline.
- **Cost.** The typeface differs per operating system.

## D15 Hidden sheets are read but left out by default

- **Why.** Hidden sheets usually hold stale copies. Showing them, switched off, lets the user
  decide and keeps nothing invisible.
- **Cost.** One more control on the page.

## D16 A quantity column raises a warning

- **Options.** (a) Ignore it. (b) Multiply the row. (c) Warn.
- **Choice.** (c).
- **Why.** Multiplying invents assets with identical details and no serial numbers. Ignoring
  undercounts silently.
- **Cost.** The count of assets is still the count of rows.

## D17 The scaffold's Next.js flags stay

- **Choice.** `cacheComponents` and `partialPrefetching` are left as generated.
- **Why.** They are the framework's current defaults and do not change how this one-page app
  behaves: the page is a static shell either way.
- **Cost.** Two lines of configuration whose effect here is nil.

## D18 SheetJS from its URL, not vendored

- **Options.** (a) Depend on the CDN tarball URL. (b) Commit the tarball and depend on the file.
- **Choice.** (a). The lockfile pins the URL and its integrity hash.
- **Why.** It is the install command SheetJS documents, and it keeps a multi-megabyte archive
  (7.8 MB unpacked) out of git.
- **Cost.** `pnpm i` needs `cdn.sheetjs.com` to be reachable. SheetJS itself recommends (b) for
  that reason; it is the first thing to change if installs must work offline.
