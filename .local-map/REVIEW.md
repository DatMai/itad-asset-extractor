# Review

Three reviews are recorded here: the agent's first review of its own work (section 1), the
author's (section 2), and a second, wider agent review on 12 Nov 2026 (section 3).

## 1. Agent review, as the client's engineer (2026-11-11)

Method: after all tests were green, read the code looking for inputs the tests did not cover,
following the checklist in `.claude/agents/reviewer.md` (wrong data first, then spec, failure
paths, tests, explainability, privacy). Each finding got a failing test before the fix.
Fixes are in commit `fd82557`.

### Data bugs found and fixed

| # | Input | What came out | What should come out | Test |
| --- | --- | --- | --- | --- |
| 1 | CPU cell `Intel(R) Xeon(R) CPU E5-2680 v4 @ 2.40GHz` | `Intel Xeon`, model number lost | `Intel Xeon E5-2680 v4` | `normalise.test.ts` › normaliseCpu |
| 2 | `Lenovo ThinkPad X1 Carbon 7th Gen i7-8565U …` | model `ThinkPad X1 Carbon` (the generation was taken for a CPU generation) | model `ThinkPad X1 Carbon 7th Gen` | `parseFreeText.test.ts` › generation words |
| 3 | A headerless table with `Location: \| Sydney` above it, or a `Notes: \| …` row under it | That row was taken as the header: wrong mapping, or zero assets | No header; columns identified from values | `detectHeader.test.ts` › does not take a label row… |
| 4 | A `Qty` column with `12` | One asset, silently | One asset with the warning "This row stands for 12 devices" | `pipeline.test.ts` › a quantity column |

### Found earlier, while building

| Input | Problem | Fix |
| --- | --- | --- |
| `Memory` column holding `256 GB`, `384GB` | Those values were classed as storage and lowered the column's confidence to 0.92 | A bare size no longer counts against a header that says RAM or storage |
| `Notes` holding `2-in-1`, `storage server?` | Counted against the header | Free-text columns cannot be contradicted by their values |
| `Model Name` holding `Surface Laptop 5` | Classed as an asset type because of the word "Laptop" | A product line is checked before type words |
| Model column holding `P2422H` | Looked like a serial number and lowered the column's confidence | Identifiers do not count against Model, Serial or Asset tag headers |
| Wide results table | Screen-reader-only text widened the whole page | The scroll box is now the containing block |
| Dev server while installing a package | Next.js dev overlay showed validation errors | Not an app bug: the running server pointed at a module path that the install had renamed. Restarting cleared it |

### UI issues fixed in the same pass

- The column table could not stay collapsed: React re-opened `<details open>` on every render.
- Row filters used `role="tab"` without the keyboard behaviour tabs require. They are toggle
  buttons now.
- A table of thousands of editable rows would be sluggish. 200 rows are drawn first, with
  "Show all"; exports always contain every row.
- Typing a correction re-ran the whole extraction. Edits are now applied on top of it.

### Checked and left as they are

| Concern | Why it stands |
| --- | --- |
| A header named `__proto__` used as an object key in `extras` | Assigning a string to `__proto__` is a no-op in JavaScript; nothing is polluted. Sheet counts use a `Map` |
| Prompt injection through cell values sent to the model | The model can only return mapping suggestions, which are schema-checked, limited to unclear columns, capped at Medium and labelled "AI". Wrong suggestions are possible; actions are not |
| The AI route has no authentication or rate limit | Out of scope for a demo; stated in the README. Request size and answer length are capped |
| Values exactly at 0.7 confidence are not flagged | By definition: "Check" is below 0.7. A bare `16` under an exact `RAM` header scores 0.7 |

### Not verified

- A real suggestion from a live model: no API key was available. The route was run in the browser
  with an invalid key, which exercised the request, the 401 handling and the "nothing was changed"
  path. Screenshot: `screenshots/07-ai-failure-keeps-the-rules-result.jpg`.
- A real password-protected workbook. The message is matched from SheetJS's error text.
- Browsers other than Chromium, and screen readers.
- Deployment to Vercel.

## 2. Author review

Done by the author before the repository was made public and the link was sent (12 Nov 2026).
I read all of the code and the documents, and I can explain every part of it.

- [x] The spec (`docs/superpowers/specs/2026-11-11-asset-sheet-extractor-design.md`): the acceptance criteria say what I want.
- [x] `src/lib/extraction/pipeline.test.ts`: the expected values are what I expect by hand.
- [x] `detectHeader.ts`, `mapColumns.ts`: I can explain the scoring in my own words.
- [x] `parseFreeText.ts`: walked descriptions through it by hand.
- [x] `normalise.ts`: the unit rules.
- [x] `src/app/api/suggest-mapping/route.ts` and `src/lib/llm/`: what leaves the browser.
- [x] The app in a browser, on the bundled samples and on files of my own.
- [x] README: every claim, including "How AI was used".

## 3. Second agent review (2026-11-12)

### How it was done

- Five areas were reviewed separately: extraction, UI, security and privacy, documentation, code
  quality.
- A finding was kept only when a second reviewer reproduced it, by running the code on the input
  the finding named or by reading the files it cited. 37 findings were confirmed: 12 high,
  15 medium, 10 low.
- Fixes were made test first, in three rounds. After rounds one and two a reviewer ran the
  checks again and probed the changed code with new inputs. Round one's check found nine
  problems, three of them high and caused by the fixes. Round two's check confirmed seven fixes
  and found five more cases; round three is about those.
- Status below: **fixed**, **partly** (the rest is under "Still open"), or **open**.

### Extraction

| # | Finding | Sev. | Status |
| --- | --- | --- | --- |
| 1 | `Core m3-7Y30` and a loose `M2` became an Apple CPU at full confidence | high | fixed. A bare `M2` with no Apple word is 0.6 with a note |
| 2 | A computer whose description mentions an accessory was hidden, even with CPU and RAM columns | high | partly |
| 3 | Section headings, footers and wide total rows became assets | high | fixed, one edge open |
| 4 | `HDD Type` beat `HDD Size`; `Memory Slots` became RAM; `HDD Serial` became storage | high | fixed |
| 5 | `16GB (2x8GB)` read as storage; `8G 256G`, `512 SSD`, `256SSD` not read | high | fixed, edges open |
| 6 | A condition prefix became the model; trailing words stayed in it | medium | fixed |
| 7 | A second drive or memory column was dropped silently | medium | partly: flagged, not added (D22) |
| 8 | `PC` in a type column made an EliteBook a desktop | medium | fixed in extraction; open for a typed edit |

### UI

| # | Finding | Sev. | Status |
| --- | --- | --- | --- |
| 9 | Row warnings not worked out again after a manual edit | high | fixed for serial edits; partly for kind edits |
| 10 | A late AI answer was applied to another file's sheet of the same name | medium | fixed; the race was not tried in a browser |
| 11 | Results tab, filter and "Show all" survived loading a second file | medium | fixed |
| 12 | Focus fell to the page body after an edit; the type dropdown saved only on blur | medium | partly (D25) |
| 13 | Exported `storageRaw` contradicted `storageGB` after an edit | medium | fixed with `editedFields`; one case open |
| 14 | "Detect again" discarded hand-set and AI mappings and left a stale AI message | low | fixed |
| 15 | A file dropped during a load started a second load | low | fixed |
| 16 | "No assets were found" shown for a file of only non-computers | low | fixed |

### Security and privacy

| # | Finding | Sev. | Status |
| --- | --- | --- | --- |
| 17 | The AI request sent names, emails, hostnames, MAC addresses and phone numbers as typed | high | fixed for samples (D20); stated limits remain |
| 18 | Limits applied after the whole workbook was parsed: an 820 KB file froze the tab for 13 s | high | partly (D21) |
| 19 | The AI route has no authentication or rate limit and spends the server's key | medium | partly: caps tightened, still open to anyone |
| 20 | The route read the whole body before any size check | medium | fixed |
| 21 | The reader trusted a sheet's declared size and dropped cells outside it | medium | fixed |
| 22 | No security headers | low | partly: headers added, no full CSP (D24) |
| 23 | The committed evidence file showed a local user name and path | low | fixed in `check.sh`, which now strips the path. The file is replaced on the next recorded run; the old one stays in the git history |

### Documentation

| # | Finding | Sev. | Status |
| --- | --- | --- | --- |
| 24 | The author's hand review was promised but empty; the README did not say what was reviewed by hand | high | fixed: the author's review is recorded in section 2 and in the README |
| 25 | Privacy statements overstated the masking | high | fixed: code changed (D20) and README, spec and screen rewritten |
| 26 | A cell doubtful only because of its column gave no reason (AC6) | medium | fixed |
| 27 | README said Node.js 20.9; the test runner needs 22.12 | medium | fixed |
| 28 | The export did not carry what the docs promised | medium | partly (D23) |
| 29 | README result for the Vietnamese fixture needed the hidden sheet switched on | medium | fixed in the README |
| 30 | Stale evidence: build claimed without output, a commit hash that no longer exists, no release entry | low | fixed in `check.sh --all` and in `JOURNEY.md`; a new recorded run is still to be saved |
| 31 | Small statements that did not match the repository | low | fixed, except the 20-sheet limit, which still has no notice |

### Code quality

| # | Finding | Sev. | Status |
| --- | --- | --- | --- |
| 32 | Two capacity grammars: a comma in a description gave a wrong size | high | fixed, one case open |
| 33 | Duplicate-serial warnings were quadratic: hundreds of megabytes of text | high | fixed |
| 34 | Planning a sheet did whole-sheet work for a 30-row question | medium | fixed in the pipeline; the same pattern is left in `suggestions.ts` and `MappingPanel.tsx` |
| 35 | The reason shown for a header with no known names did not match the code | low | fixed |
| 36 | The 5 MB message was written out in two files | low | partly: `Importer.tsx` uses `LIMITS`; `readWorkbook.ts` still has the literal |
| 37 | Unused exports, a branch that cannot run, a duplicated list | low | partly |

### Still open

Wrong or missing values:

- A phone with two sizes (`iPhone 13 4GB 128GB`) is read as a computer with RAM and storage.
  With one size (`iPhone 12 64GB`) it is set aside as a phone.
- `Samsung Galaxy Tab 4G 128G` gives no sizes: `4G` is taken as the mobile network.
- `Core M-5Y10` and `m3-8100Y` without the word Core are not recognised. In a CPU column they
  are kept as written at 0.6.
- A CPU cell that is only `M2` is trusted as Apple M2 at full confidence. This was left on
  purpose: flagging it would flag every Mac row.
- A description without a known product line: `HP 840 G5 with charger`, with no CPU or RAM in
  the row, is set aside as an accessory. So is `Dell Latitude 5490 charger`, which has no remark
  word.
- Once a remark names an accessory, the whole remark is dropped: `with 16GB RAM + dock` gives no
  RAM, and `with 8GB RAM, 256GB SSD and external 1TB HDD` gives neither. Empty, not wrong.
- A drive in a remark that is not called external (`with 2TB backup drive`, `with 1TB USB HDD`)
  is added to the computer's storage at 0.9.
- `8,1TB` as the only comma in a cell is read as 8,100 GB at 0.9 or higher. With another comma
  in the cell it is 0.6; that rule also flags the correct `128GB, 4 x 1,2TB SAS`.
- `i5-8350U 512 SSD 8GB`: the drive is not read, because 512 is the first number left in the
  text once the CPU is cut out. The drive word can stay in the model (`IdeaPad 320 HDD`).
- `HDD Serial` can still be taken as the serial number when the sheet has no other serial
  column.
- A one-cell note that has a digit is not caught by the heading rule. The check after round one
  saw `Building 2` become an asset with only an asset tag. Under a description column the same
  cell is skipped as "No asset details recognised".
- Separate drive or memory columns are flagged, not added up (D22).
- Typing `PC` into an asset type cell gives `desktop`. In extraction the same word is treated
  as no information.

Warnings and export:

- Marking a row "not a computer" removes "No serial number". Marking a set-aside row as a
  computer does not add it.
- An edit the app cannot read is kept as typed in `raw`, so a storage edit of `lots` exports
  `storageRaw` as `lots`.
- The export holds computers only and one confidence per row (D23). The sentence under the
  results table still says the downloads contain "every row".
- Sheets after the twentieth are not read and no notice is shown.

Privacy and security:

- Sent to the AI unmasked: a word with a digit and at most four letters and digits inside a
  hardware cell (`7HKQ`, `J0hn`, `ext 4521`, `Room 12`), and a name that is also a hardware word
  (`Michael Dell laptop` → `Aaaaaaa Dell laptop`). The screen says so before the click.
- Column names are sent as written, except code-like words. A person's name in a row that is
  taken for the header row with normal confidence, or chosen as header row by the user, goes
  out as a column name.
- The AI route has no authentication and no rate limit.
- A crafted file can still stall the tab: the unpacked-size check trusts declared sizes and
  parsing runs on the main thread. The hostile file from the review was not measured again.
- No script or connect Content-Security-Policy.

Not verified:

- Anything in a browser by hand after today's UI changes: focus after an edit, the dropdown, a
  drop during a load, the reset on a second file, the late-answer guard, the headers on a
  running server.
- The browser tests run in Chrome only. They do not cover the AI button or focus.
- A real answer from a live model, with the new masking and the 3,000-token cap.
- A real password-protected workbook; deployment; other browsers; screen readers.

