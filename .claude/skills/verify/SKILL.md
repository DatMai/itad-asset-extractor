---
name: verify
description: Use before saying a task is done, fixed or passing, and before every commit. Runs the project checks and requires reading their output; a claim without evidence is not allowed.
---

# Verify before claiming

"It should work" is not a result. Run the checks, read what they print, then report.

## Checks, in this order

```bash
pnpm typecheck
```

```bash
pnpm lint
```

```bash
pnpm test
```

When the change touches `src/app`, `src/components`, `src/lib/llm`, `e2e`, `next.config.ts` or
dependencies, also run the browser tests. They build the app first, so they cover `pnpm build`:

```bash
pnpm e2e
```

`pnpm e2e` needs Google Chrome and a free local port (3100). It cannot run in a sandbox that
forbids local ports. If you cannot run it, say so; do not report the UI as verified.
`.local-map/scripts/check.sh --all` runs all four checks and saves the output as evidence.

## Acceptance numbers that must still hold

These come from `docs/superpowers/specs/2026-11-11-asset-sheet-extractor-design.md` and are asserted in `src/lib/extraction/pipeline.test.ts`:

- `sample_assets_1.xlsx`: header on row 4 of `Assets` and row 3 of `Sheet1 (2)`; 15 + 4 = 19 assets;
  the `TOTAL` row is skipped.
- `sample_assets_2.csv`: 14 computers, 2 non-computers (monitor, keyboard), Synology typed `nas`.

## UI changes

`e2e/app.spec.ts` covers the main paths: the samples, remapping, editing, the downloads, failure
messages. It does not cover focus after an edit, the AI button, narrow screens or other browsers.
For a UI change, also open the app in the browser, load a sample file, and look at the mapping
panel, the results table and one error state. Say what you looked at. A new visible behaviour
gets a test in `e2e/app.spec.ts`.

## Reporting

- State each check with its real outcome: "typecheck: pass", "test: 2 failed" plus the failing
  names and messages.
- If a check was skipped, say so and why.
- If something is not verified (for example the live LLM call without an API key), say that
  plainly. Do not round it up to "done".
