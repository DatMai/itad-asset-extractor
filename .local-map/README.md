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
| [`scripts/`](scripts/) | Tools made along the way | Repeat a check or an investigation |
| [`evidence/`](evidence/) | Outputs that back the claims | Verify without re-running |
| [`screenshots/`](screenshots/) | The UI at each milestone | See the app without starting it |
| [`research/`](research/) | Raw research notes and the full report | Check a source behind `docs/research.md` |
| [`../.agent/HANDOFF.md`](../.agent/HANDOFF.md) | You are here: current state and next step | Pick up the work |

Related: [`../docs/spec.md`](../docs/spec.md) (requirements; wins over everything),
[`../docs/research.md`](../docs/research.md), [`../docs/plan.md`](../docs/plan.md),
[`../AGENTS.md`](../AGENTS.md), [`../.agent/PROTOCOL.md`](../.agent/PROTOCOL.md).

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/inspect-workbook.py <file>` | Prints what is really stored in an `.xlsx` or `.csv`: sheets, row numbers, cell types, formulas, merged ranges, BOM, line endings. Standard library only. |
| `scripts/check.sh` | Runs typecheck, lint and tests, and saves the output to `evidence/checks/latest.txt`. |
| `scripts/screenshot.sh` | Captures the running app into `screenshots/` with headless Chrome. |

## Evidence

| Path | What it proves |
| --- | --- |
| `evidence/sample-dumps/*.txt` | The row numbers, counts and cell values quoted in `docs/spec.md`, straight from the client's sample files. |
| `evidence/checks/latest.txt` | The last run of all checks, with date and commit. |

## Conventions

- **`JOURNEY.md` is append-only.** New entries go at the bottom with a date and time. A mistake is
  corrected by a new entry, not by editing an old one.
- **Every claim has evidence.** A test name, a command and its result, a commit hash, a file in
  `evidence/`, a screenshot, or a link. "Should work" is not evidence.
- **`MAP.md` describes the code as it is**, not as planned. Plans live in `docs/plan.md`.
- **`DECISIONS.md` records choices between real alternatives** and what each choice costs.
  A reversal is a new entry that names the one it replaces.
- **A script used twice belongs in `scripts/`**, with a usage line at the top.
- **A UI milestone gets a screenshot**, named `NN-what-it-shows.png` in the order taken.
- Update the map in the same commit as the change it describes.
