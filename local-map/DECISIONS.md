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
