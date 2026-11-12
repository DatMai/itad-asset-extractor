# Review

Two reviews are recorded here: the one the agent ran on its own work, and the author's.

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

To be filled in by the author before the repository link is shared. Suggested order:

- [ ] `docs/spec.md`: do the acceptance criteria still say what I want?
- [ ] `src/lib/extraction/pipeline.test.ts`: are the expected values what I would expect by hand?
- [ ] `detectHeader.ts`, `mapColumns.ts`: can I explain the scoring in my own words?
- [ ] `parseFreeText.ts`: walk one description through it by hand.
- [ ] `normalise.ts`: the unit rules.
- [ ] `src/app/api/suggest-mapping/route.ts` and `src/lib/llm/`: what leaves the browser.
- [ ] The app in a browser with a file of my own.
- [ ] README: every claim, especially "How AI was used".

Notes:
