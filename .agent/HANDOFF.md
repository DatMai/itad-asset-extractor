# Handoff

The state of the work, for whoever picks it up next. Format and rules: `.agent/PROTOCOL.md`.

## State right now

- **Branch:** `feat/asset-extraction` (`main` holds only the scaffold commit).
- **Works:** the scaffolded Next.js app starts. Nothing project-specific is built yet.
- **Written:** `docs/spec.md`, agent guides (`AGENTS.md`, `.agent/`, `.claude/`), `.local-map/`.
- **Not done:** research summary, plan, the whole extraction pipeline, the UI, the LLM route,
  the README.
- **Not verified:** nothing has been pushed or deployed.

## In progress

- Extraction engineer: research summary and plan, then the pipeline in `src/lib/extraction`.

## Next up

1. `docs/research.md` and `docs/plan.md`.
2. Pipeline, test-first: read workbook → detect header → map columns → normalise → parse free
   text → assemble assets.
3. UI: upload → mapping → results → export.
4. Optional LLM mapping suggestion.
5. README with demo script, self-review, release checks.

## Open questions for the human

- Deadline time zone: the brief says 12:00 Friday 13 Nov with no zone. Assumed GMT+7.
- An `ANTHROPIC_API_KEY` is needed to try the LLM route against the real API.
- Deploying to Vercel and pushing to GitHub need the owner's accounts.

## Log

### 2026-11-11 Extraction engineer: project set up
- Changed: scaffold, spec, agent guides, local map.
- Verified: `pnpm install` completed; no checks exist yet beyond the scaffold.
- Not done / not verified: everything under "Not done" above.
- Next: write the plan, then start the pipeline with the header-detection test.
- Watch out: the installed Next.js is newer than most examples online; read
  `node_modules/next/dist/docs/` before using a Next.js API.
