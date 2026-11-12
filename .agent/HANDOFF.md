# Handoff

The state of the work, for whoever picks it up next. Format and rules: `.agent/PROTOCOL.md`.

## State right now

- **Branch:** `main` and `feat/asset-extraction` point at the same commit and are pushed to
  `origin` (https://github.com/DatMai/itad-asset-extractor, public).
- **Works, with proof:**
  - `pnpm typecheck`, `pnpm lint`, `pnpm test` (287 tests) and `pnpm build` pass.
    Last run: `.local-map/evidence/checks/latest.txt`.
  - Client sample 1: headers on rows 4 and 3, 15 + 4 = 19 assets, `TOTAL` skipped.
  - Client sample 2: 14 of 14 computers with all six fields right, 2 non-computers, NAS typed.
  - Four generated fixtures (Vietnamese headers on row 7, `;` CSV with abbreviations, no header,
    one cell per asset in `.xls`) extract as asserted in `pipeline.test.ts`.
  - UI checked by hand in Chromium at 1280 px: upload, mapping, remap, header row, edit a cell,
    row filters, six kinds of unreadable file, CSV and JSON. Screenshots in
    `.local-map/screenshots/`.
- **Not verified:**
  - A real AI suggestion. No API key was available; the route is tested with a fake client and
    was run once in the browser with an invalid key (401 path).
  - A real password-protected workbook.
  - Browsers other than Chromium; screen readers; narrow screens.
  - Deployment.
- **Not done:** deploy to Vercel; send the repository link to Astek; the author's written
  review notes (`.local-map/REVIEW.md`, section 2).

## In progress

Nothing is claimed.

## Next up

1. Reply to the Astek email with the repository link before 12:00 on Friday 13 November.
2. Rehearse the five-minute demo in the README; try a few unseen files.
3. Optional: deploy to Vercel; add the URL to the README.
4. Optional: put a real key in `.env.local`, click "Ask AI" on the *No header row* sample, and
   record what the model answers.

## Ideas not taken, in order of value

- Several tables in one sheet (a second header further down).
- A Web Worker for parsing, to lift the 5,000-row limit.
- Remember a corrected mapping per header signature, so the same supplier's next file maps itself.
- AI help for single cells the rules could not read (sends row data; needs consent per cell).
- A Playwright test for the upload → export path.

## Open questions for the human

- The brief says "12 PM Friday 13 November" with no time zone. Vietnam time is assumed.
- `.env.local` exists with an empty key. It could not be deleted from here (a guard protects
  `.env` files on this machine). It is ignored by git and harmless; delete it by hand if unwanted.

## Log

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
