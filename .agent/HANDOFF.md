# Handoff

The state of the work, for whoever picks it up next. Format and rules: `.agent/PROTOCOL.md`.

## State right now

- **Branch:** `main` and `feat/asset-extraction` point at the same commit and are pushed to
  `origin` (https://github.com/DatMai/itad-asset-extractor, public). The work of 12 Nov after the
  release (second review, three fix rounds, browser tests, documents) is committed and pushed.
- **Works, with proof:**
  - 507 unit tests in 15 files (`pnpm test`), `pnpm typecheck` and `pnpm lint`. The
    last recorded run is `.local-map/evidence/checks/latest.txt`; check its date and commit
    before relying on it, and run `.local-map/scripts/check.sh --all` to replace it.
  - Client sample 1: headers on rows 4 and 3, 15 + 4 = 19 assets, `TOTAL` skipped, one value to
    check.
  - Client sample 2: 14 of 14 computers with all six fields right, 2 non-computers, NAS typed.
  - Four generated fixtures (Vietnamese headers on row 7, `;` CSV with abbreviations, no header,
    one cell per asset in `.xls`) extract as asserted in `pipeline.test.ts`.
  - Every value below 0.7 on the six samples carries a note (asserted).
- **Browser tests pass:** 8 of 8 in `e2e/app.spec.ts` (`pnpm e2e`, Chrome, production build;
  output in `.local-map/evidence/checks/latest.txt`): the two client samples, an unseen layout, remapping, editing, both downloads,
  three unreadable files, "no request carries the file", all six samples.
- **Not verified:**
  - By hand in a browser, after the 12 Nov UI changes: focus after an edit, the asset type
    dropdown (it now saves on change), a drop during a load, the reset when a second file is
    opened, the late-AI-answer guard, the response headers on a running server. The screenshots
    in `.local-map/screenshots/` are from 11 Nov.
  - A real AI suggestion. No API key was available; the route is tested with a fake client and
    was run once in the browser with an invalid key (401 path), before the masking changed.
  - Time and memory on the hostile workbook from the review, after the reader fix.
  - A real password-protected workbook.
  - Browsers other than Chrome; screen readers; narrow screens.
  - Deployment.
- **Not done:**
  - Commit and push today's work.
  - Deploy to Vercel; send the repository link to Astek.
  - Everything under "Still open" in `.local-map/REVIEW.md`, section 3.

## In progress

Nothing is claimed.

## Next up

1. Run `.local-map/scripts/check.sh --all` outside a sandbox and read the output. It replaces
   the evidence file, which still shows a local path from the earlier run.
2. Try the changed screens by hand in Chrome: edit a text cell with Enter and Escape, change an
   asset type with mouse and keyboard, "Detect again" after a manual remap, open a second file
   from the "Skipped rows" tab.
4. Commit in small steps and push. Reply to the Astek email with the repository link before
   12:00 on Friday 13 November.
5. Rehearse the five-minute demo in the README; try a few unseen files.
6. Optional: deploy to Vercel without `ANTHROPIC_API_KEY` (the AI route has no authentication);
   add the URL to the README.
7. Optional: put a real key in `.env.local`, click "Ask AI" on the *No header row* sample, and
   record what the model answers to masked samples.

## Ideas not taken, in order of value

- Several tables in one sheet (a second header further down).
- A Web Worker for parsing, with a timeout: lifts the 5,000-row limit and stops a crafted file
  from stalling the tab.
- Add up separate drive or memory columns in each row (D22 only flags them).
- Export every row with a `kind` column, and the original text of each value (D23).
- A full Content-Security-Policy, after trying it in dev and production (D24).
- Authentication and a rate limit on the AI route.
- Remember a corrected mapping per header signature, so the same supplier's next file maps itself.
- AI help for single cells the rules could not read (sends row data; needs consent per cell).
- Browser tests for the AI button (with the route mocked), focus after an edit, and a second
  browser.

## Open questions for the human

- The brief says "12 PM Friday 13 November" with no time zone. Vietnam time is assumed.
- From the 12 Nov fixes, choices made by the engineers that the owner may want to overrule:
  - A CPU cell that is only `M2` is trusted as Apple M2 at full confidence.
  - A doubtful comma number (`8,1TB` in a comma list) is kept at 0.6 with a note, not emptied.
  - In an AI sample, a word with a digit and at most four characters is sent as written, and a
    label such as `SN` is masked.
  - Column names are sent to the AI as written, except code-like words.
  - The asset type dropdown saves on the first change (D25).
- `.env.local` exists with an empty key. It could not be deleted from here (a guard protects
  `.env` files on this machine). It is ignored by git and harmless; delete it by hand if unwanted.

## Log

### 2026-11-12 Second review, three fix rounds, browser tests, documents
- Changed: `src/lib/extraction` (all stages), `src/lib/llm`, the API route, `src/components`,
  `next.config.ts`, `package.json` (engines, `e2e` script, `@playwright/test`),
  `playwright.config.ts`, `e2e/`, `.local-map/scripts/check.sh`, and every document. New test
  files: `extractAssets.test.ts`, `plans.test.ts`, `screens.test.ts`, `security-headers.test.ts`.
  New source file: `src/components/plans.ts`. Details by round in `.local-map/JOURNEY.md`;
  findings and status in `.local-map/REVIEW.md`, section 3; decisions D19 to D25.
- Verified: after round two, 478 unit tests in 15 files, typecheck and lint, run by a reviewer.
  After round three the suite has 507 unit tests. The six samples were run through
  the pipeline again and still give the numbers under "State right now".
- Not done / not verified: see "Not verified" and "Not done" above. After the UI changes
  the app was driven only by the browser tests, not by hand. Their first run caught a real bug
  from the simpler cell editor: Enter saved, then the same key press "clicked" the cell button
  that had just taken the focus and opened the editor again. Fixed in `ValueCell.tsx`
  (`preventDefault`), and the edit test now asserts that the focus is back on the cell.
  `check.sh --all` passes: typecheck, lint, 507 unit tests, build and 8 browser tests.
- Next: rehearse the demo.
- Watch out:
  - The shapes in `types.ts` did not change today (comments only), but `ExportedAssetSchema` has
    two new columns at the end (`warnings`, `editedFields`) and `LIMITS` has `unpackedBytes`.
  - `mapColumns.ts` now calls the normalisers to judge values. A change to `normaliseRam`,
    `normaliseStorage`, `normaliseScreen` or `normaliseDate` can move a column mapping.
  - A new unit, drive word or CPU family word must also go into `SPEC_WORDS` in
    `src/lib/llm/suggestions.ts`, or the AI request masks it.
  - `pnpm e2e` builds first and needs port 3100 and Google Chrome. It fails in a sandbox that
    forbids local ports; see the build note in the 11 Nov entry.
  - The sentence under the results table says the downloads contain "every row". They contain
    every computer row. It is in `ResultsPanel.tsx` and was not changed.

### 2026-11-12 09:40 Extraction engineer: released
- Changed: merged into `main`, created the public GitHub repository, pushed both branches.
  Commit messages were rewritten before the first push, so hashes differ from earlier notes.
- Verified: typecheck, lint, 287 tests on the pushed commit; the author tried the app by hand.
- Next: send the link; optional deploy.

### 2026-11-11 23:40 Extraction engineer: first complete version
- Changed: everything. Pipeline, UI, optional AI route, tests, fixtures, README, map.
- Verified: typecheck, lint, 287 tests, production build; the app by hand in a browser.
- Not done / not verified: see "Not verified" and "Not done" above.
- Next: the author's review, then merge and push.
- Watch out:
  - Do not run `pnpm add` while `pnpm dev` is running: the dev server keeps pointing at module
    paths the install renames, and shows validation errors until it is restarted.
  - `pnpm build` needs to open a local port (Turbopack runs Tailwind in a child process). In a
    sandbox that forbids it the build fails, and the failure is cached: delete `.next/cache` and
    `.next/turbopack` before retrying outside the sandbox.
  - A new synonym can take a column away from another field. Run the whole suite, not one file.

### 2026-11-11 22:35 Extraction engineer: project set up
- Changed: scaffold, spec, agent guides, local map.
- Verified: `pnpm install` completed.
- Next: plan, then the pipeline, test first.
