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
- **Cost.** A broken button would not be caught by the unit tests. (Changed by D19: browser tests were added.)

## D7 Next.js 16 instead of 15

- **Why.** 16.4 is the current stable release; starting a new project a major version behind
  would need its own justification.
- **Cost.** Some APIs differ from older tutorials; the bundled docs are the reference.

## D8 Work on a feature branch

- **Choice.** `main` holds the scaffold commit; work happens on `feat/asset-extraction`.
- **What happened.** The plan was to merge once the author had reviewed the work. On 12 Nov 2026
  the branch was merged into `main` and pushed to a public repository after the agent's first
  review, after the author had read the code and the documents (`REVIEW.md`, section 2) and
  had tried the app by hand. Commit messages
  were rewritten before the first push, so hashes written down before 12 Nov no longer resolve.
- **Cost.** One merge before the repository link is shared. The repository was public before the
  second review found its 37 problems.

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
- **Changed on 12 Nov 2026.** The masking is replaced by D20: names are no longer sent
  unmasked. The answer is now capped at 3,000 tokens (it was 8,000), the request body at
  128,000 bytes, and the route trims the answer to one suggestion per column with reasons of at
  most 200 characters.

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

## D19 Browser tests with Playwright, in the installed Chrome

- **Replaces** the "no browser test" half of D6.
- **Choice.** `@playwright/test` as a dev dependency; `pnpm e2e` builds the app, serves it on
  port 3100 and drives the Chrome already on the machine (`channel: "chrome"`).
- **Why.** The second review found bugs that live between the pipeline and the screen (state kept
  across files, focus after an edit, what the downloads contain). Unit tests cannot see those.
  The tests also prove a claim that was only words before: no request carries the file.
- **Alternatives.** Vitest browser mode (still needs a browser provider, and does not test the
  built app); checking by hand only (what D6 did; it missed the bugs above).
- **Cost.** One more dev dependency (no browser download, because the installed Chrome is used).
  The run needs Chrome and a free local port, so it is a separate command and not part of
  `pnpm test`. About half a minute, most of it the production build.

## D20 AI samples are masked word by word

- **Replaces** the masking part of D13.
- **Situation.** The second review ran the request builder on a sheet with Hostname, Email, MAC
  and Phone columns. Emails, MAC addresses and phone numbers left the browser as typed, and so
  did names. The README, the spec and the screen all said identifiers were masked.
- **Options.** (a) Keep the code and correct the three statements. (b) Mask a whole value unless
  it reads as a hardware detail. (c) Decide for each word.
- **Choice.** (c), on top of (b). A value that does not read as a hardware detail is sent as its
  shape whole. In one that does, a word is sent as written only if it is a hardware word from
  the tables (brand, product line, type word, unit, drive word, CPU family), a specification or
  a date, or has a digit and at most four letters and digits. Everything else becomes its shape:
  capital `A`, small letter `a`, digit `9`, punctuation kept. Two bare numbers in a row are
  masked as a phone number. The prompt tells the model what the shapes mean.
- **Why.** (b) was tried first and the re-check showed it still sent `Latitude 5420 - John Smith`
  whole. The default has to be "mask", with a short list of reasons to send.
- **Cost and stated limits.**
  - The shape shows length, capitals and punctuation.
  - A name that is also a hardware word is sent as written: `Taylor Swift` → `Aaaaaa Swift`.
  - A short word with a digit inside a hardware cell is sent as written: `7HKQ`, `ext 4521`.
  - Column names still follow the older rule: sent as written except code-like words, and masked
    whole only when the header row is a doubtful guess and the name is not one we know.
  - Useful model words are masked too (`ThinkPad X1 Carbon` → `ThinkPad X1 Aaaaaa`), so the model
    has less to go on. A label such as `SN` is masked as well.
  - Not tested against a live model.

## D21 A workbook may unpack to 100 MB at most

- **Situation.** The row and column limits were applied after SheetJS had parsed the whole
  workbook. The second review built an 820 KB `.xlsx` that froze the tab for about 13 seconds.
- **Options.** (a) A Web Worker with a timeout. (b) Read the unpacked sizes the zip declares and
  refuse above a limit, and let the parser stop at the row limit. (c) Both.
- **Choice.** (b): `LIMITS.unpackedBytes` is 100 MB, checked before parsing; `sheetRows` stops
  the parser one row past the row limit.
- **Why.** It is a few lines in the one file that knows the format, and needs no second thread
  to explain.
- **Cost.** The sizes are what the file declares and can be forged, so a crafted file can still
  stall the tab. A file under 5 MB that used to open cut short is now refused with its own
  message. The time and memory on the hostile file were not measured again after the fix. (a) is
  still the real answer.

## D22 A second drive or memory column is flagged, not added

- **Situation.** With `HDD 1` and `HDD 2`, or `SSD` and `HDD`, one column got the field and the
  other was dropped silently, so storage was under-reported at full confidence.
- **Options.** (a) Add the columns up in each row. (b) Keep one column and flag it.
- **Choice.** (b). The column that feeds the field is held at 0.6, so every value from it is
  marked "Check". Both columns say why in the mapping panel. The other column's cells are kept
  as extra data.
- **Why.** (b) fits inside the column mapper. (a) needs a new field on the column type and a
  change to row assembly, and a wrong sum is worse than a flagged part.
- **Cost.** The number shown is one drive, not the total, and the user has to add the rest by
  hand. There is no warning on the row itself, only the low confidence.

## D23 The export gains `warnings` and `editedFields`, and still holds computers only

- **Situation.** A row could export `needsReview: true` with no reason, and after a storage edit
  `storageRaw` and `storageGB` disagreed with nothing to explain it. The review also asked for
  raw text per value, unmapped columns and the non-computer rows.
- **Choice.** Two new columns at the end, so existing positions do not move: `warnings` (joined
  with `; `) and `editedFields` (field keys, space-separated). `storageRaw` stays the file's
  text. The scope stays as it was: computer rows, one confidence per row.
- **Why.** The two columns answer "why is this row flagged" and "what did a person change".
  Exporting every raw value would double the width of the file for a reader who mostly wants
  the clean values.
- **Cost.** The original text of other values, per-value confidence, unmapped columns,
  non-computers and skipped rows are on screen only. The README says so. One sentence under the
  results table still says the downloads contain "every row".

## D24 Security headers, without a full Content-Security-Policy

- **Choice.** `next.config.ts` sends `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, a `Permissions-Policy` that turns off
  camera, microphone and location, and `Content-Security-Policy: frame-ancestors 'none'`.
  `X-Powered-By` is off.
- **Not chosen.** A `script-src` / `connect-src` policy. Next.js puts inline scripts in the page
  and needs `unsafe-eval` in development; a wrong policy shows a blank page. It has to be tried
  in a browser in both modes first.
- **Cost.** No header stops the page from calling another host. "The file stays in the browser"
  rests on the code and on one browser test. The headers are tested from the config object, not
  from a response of a running server.

## D25 The asset type dropdown saves on change

- **Situation.** The first fix for focus after an edit left the cell editor with four refs, an
  effect and three handlers that depended on the order in which browsers fire events. The
  re-check called it the hardest part of the diff to explain.
- **Options.** (a) Keep it and document the flags. (b) Let the dropdown save as soon as its value
  changes.
- **Choice.** (b). One ref and one boolean are left. A text cell saves on Enter or on leaving,
  and Escape cancels. After Enter or Escape the focus goes back to the cell.
- **Cost.** Where arrow keys change a closed dropdown at once, the first arrow press saves and
  closes. Escape does not cancel inside the dropdown. Not checked by hand in a browser; the
  browser tests cover a text edit with Enter and Escape, not the dropdown and not the focus.
