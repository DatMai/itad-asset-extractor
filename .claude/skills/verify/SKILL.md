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

Run `pnpm build` as well when the change touches `src/app`, `next.config.ts` or dependencies.

## Acceptance numbers that must still hold

These come from `docs/spec.md` and are asserted in `src/lib/extraction/pipeline.test.ts`:

- `sample_assets_1.xlsx`: header on row 4 of `Assets` and row 3 of `Sheet1 (2)`; 15 + 4 = 19 assets;
  the `TOTAL` row is skipped.
- `sample_assets_2.csv`: 14 computers, 2 non-computers (monitor, keyboard), Synology typed `nas`.

## UI changes

Tests do not cover the screens. For a UI change, open the app in the browser, load a sample file,
and look at the mapping panel, the results table and one error state. Say what you looked at.

## Reporting

- State each check with its real outcome: "typecheck: pass", "test: 2 failed" plus the failing
  names and messages.
- If a check was skipped, say so and why.
- If something is not verified (for example the live LLM call without an API key), say that
  plainly. Do not round it up to "done".
