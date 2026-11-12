<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Asset Sheet Extractor: guide for coding agents

Any agent (Claude Code, Codex, Copilot, Cursor) starts here. Humans can read it too.

## Read in this order

1. This file: rules and commands.
2. `.local-map/README.md`, then `.local-map/MAP.md`: where everything is and how we got here.
3. `.agent/HANDOFF.md`: what is done, what is next, what is broken.
4. `docs/spec.md`: the requirements and acceptance criteria. It wins over everything else.

## What this project is

A Next.js app that reads a messy spreadsheet of IT assets in the browser and turns it into a clean
table: one row per asset, with a confidence score and, on screen, the original text beside every
value. The value of the project is the extraction pipeline in `src/lib/extraction`; the UI is a
thin layer on top of it.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the app at http://localhost:3000 |
| `pnpm test` | Unit and pipeline tests (Vitest), run once |
| `pnpm test:watch` | Tests in watch mode |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint |
| `pnpm build` | Production build |
| `pnpm e2e` | Browser tests (Playwright). Builds the app, serves it on port 3100, drives the installed Chrome |
| `pnpm fixtures` | Regenerate the self-made sample files in `public/samples/` |
| `.local-map/scripts/check.sh` | Run typecheck, lint and unit tests, and save the output as evidence |
| `.local-map/scripts/check.sh --all` | The same, then `pnpm e2e` (which also builds). Needs a local port, so not inside a sandbox |
| `python3 -I .local-map/scripts/inspect-workbook.py <file>` | Print what a spreadsheet file really stores |

## Rules

1. **Never invent data.** If a value cannot be read with confidence, leave it empty and lower the
   confidence. Keep the original cell text (`raw`) next to every normalised value.
2. **Deterministic first.** The default pipeline uses no LLM and no network. The LLM route is an
   opt-in second opinion; when it fails, the heuristic result stands.
3. **Test first.** A behaviour change starts with a failing test that shows the real input. A new
   spreadsheet quirk gets a fixture or a test case before it gets code.
4. **Keep the pipeline pure.** Nothing in `src/lib/extraction` imports React, Next.js or browser
   globals. Functions take data and return data, so they run the same in Vitest and the browser.
5. **The file stays in the browser.** Do not add an upload endpoint or server-side storage.
6. **No dependency without a decision.** Adding a package needs an entry in
   `.local-map/DECISIONS.md` that says what it replaces and what it costs.
7. **Explainable code.** Small functions, plain names, comments that say *why*. If a line cannot
   be explained in one sentence in a demo, simplify it.
8. **Secrets.** Never read, print or commit `.env*` files other than `.env.example`.

## Definition of done

- `pnpm typecheck && pnpm lint && pnpm test` pass, and you have seen the output yourself.
  Node.js 22.12 or later is needed.
- A change to `src/app`, `src/components` or `e2e` also passes `pnpm e2e`. If you cannot run it
  (no Chrome, no local port), say so in the handoff; do not call the change verified.
- The change is described in `.local-map/JOURNEY.md`; `.local-map/MAP.md` matches the code.
- `.agent/HANDOFF.md` says what changed and what the next agent should pick up.
- Commits are small, with a message that says why.

## Working with other agents

Roles, file ownership and the handoff format are in `.agent/PROTOCOL.md`. In short: one writer per
area at a time, claim work in `.agent/HANDOFF.md` before starting, and stop to ask the human when
a change would break a rule above or an acceptance criterion in `docs/spec.md`.
