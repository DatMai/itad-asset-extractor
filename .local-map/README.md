# Local map

A real map of this project, kept current while the work happens: where things are, the route
taken, the forks in the road, and the tools and evidence gathered on the way. Someone arriving
cold, human or agent, should be able to find their way from this folder alone.

## Legend

| Path | What it holds | Use it to |
| --- | --- | --- |
| [`MAP.md`](MAP.md) | The terrain: every module, what it does, where to change what | Find the code for X |
| [`JOURNEY.md`](JOURNEY.md) | The route: what was done, in order, with evidence | See how we got here |
| [`DECISIONS.md`](DECISIONS.md) | The forks: options, choice, what it cost | Understand why it is built this way |
| [`REVIEW.md`](REVIEW.md) | What each review found, what was fixed, what is still open or not verified | Know how far to trust it |
| [`scripts/`](scripts/) | Tools made along the way | Repeat a check or an investigation |
| [`evidence/`](evidence/) | Outputs that back the claims | Verify without re-running |
| [`screenshots/`](screenshots/) | The UI at each milestone | See the app without starting it |
| [`research/`](research/) | Raw research notes and the full report | Check a source behind `docs/research.md` |
| [`../.agent/HANDOFF.md`](../.agent/HANDOFF.md) | You are here: current state and next step | Pick up the work |

Related: [the spec](../docs/superpowers/specs/2026-11-11-asset-sheet-extractor-design.md) (requirements; wins over everything),
[`../docs/research.md`](../docs/research.md), [the plan](../docs/superpowers/plans/2026-11-11-asset-sheet-extractor.md),
[`../AGENTS.md`](../AGENTS.md), [`../.agent/PROTOCOL.md`](../.agent/PROTOCOL.md).

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/inspect-workbook.py <file>` | Prints what is really stored in an `.xlsx` or `.csv`: sheets, row numbers, cell types, formulas, merged ranges, BOM, line endings. Standard library only. |
| `scripts/check.sh` | Runs typecheck, lint and unit tests, and saves the output to `evidence/checks/latest.txt`. Absolute paths are replaced with `.` before saving. |
| `scripts/check.sh --all` | The same, then `pnpm e2e`: the production build and the browser tests. Needs a local port, so it cannot run in a sandbox that forbids one. |

## Screenshots

Taken in the app's built-in browser (Chromium) at 1280 px while checking each milestone, on
11 Nov 2026. They were not retaken after the 12 Nov changes, so some wording on screen differs
now, for example the text beside "Ask AI".

| File | Shows |
| --- | --- |
| `01-upload.jpg` | The upload panel and the six bundled samples |
| `02-mapping-sample1.jpg` | Client sample 1: header on row 4, ten columns mapped, each with its reason |
| `03-results-sample1.jpg` | Client sample 1: 19 assets from two sheets; the one flagged CPU |
| `04-mapping-no-header.jpg` | A file with no header row: columns identified from values, two flagged |
| `05-not-computers-sample2.jpg` | Client sample 2: the monitor and the keyboard set aside |
| `06-error-not-a-spreadsheet.jpg` | An image renamed `.xlsx`: a specific message and a next step |
| `07-ai-failure-keeps-the-rules-result.jpg` | The AI suggestion failing (invalid key): message shown, mapping unchanged |

## Evidence

| Path | What it proves |
| --- | --- |
| `evidence/sample-dumps/*.txt` | The row numbers, counts and cell values quoted in the spec, straight from the client's sample files. |
| `evidence/checks/latest.txt` | The last recorded run of the checks, with date, commit and Node version. The commit in it is the one the run was made on; saving the file creates a newer commit, so it is never `HEAD` itself. It contains a build and the browser tests only when the run was made with `--all`. |

## Conventions

- **`JOURNEY.md` is append-only.** New entries go at the bottom with a date, and a time when it
  is known. A mistake is corrected by a new entry, not by editing an old one. Commit hashes
  written before 12 Nov 2026 are from before the history was rewritten; the entry of that day
  gives the ones that changed.
- **Every claim has evidence.** A test name, a command and its result, a commit hash, a file in
  `evidence/`, a screenshot, or a link. "Should work" is not evidence.
- **`MAP.md` describes the code as it is**, not as planned. Plans live in `docs/superpowers/plans/`.
- **`DECISIONS.md` records choices between real alternatives** and what each choice costs.
  A reversal is a new entry that names the one it replaces.
- **A script used twice belongs in `scripts/`**, with a usage line at the top.
- **A UI milestone gets a screenshot**, named `NN-what-it-shows.jpg` in the order taken.
- Update the map in the same commit as the change it describes.
