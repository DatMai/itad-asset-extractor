# Agent protocol

How several agents (and humans) work on this repository without stepping on each other. It is
tool-neutral: nothing here depends on a specific assistant.

## Roles and ownership

One writer per area at a time. A reviewer never edits.

| Role | Owns (may edit) | Must not edit |
| --- | --- | --- |
| Extraction engineer | `src/lib/extraction/**`, `scripts/make-fixtures.mjs`, `public/samples/**` | `src/app/**`, `src/components/**` |
| UI engineer | `src/app/**` (the API route included), `src/components/**`, `src/lib/llm/**`, `e2e/**` | `src/lib/extraction/**` (ask for an API change instead) |
| Reviewer | nothing; reports findings | everything |
| Anyone | `.local-map/**`, `.agent/HANDOFF.md`, `docs/**`, `README.md` | |

The contract between areas is the type file `src/lib/extraction/types.ts`. Changing a type there
is a cross-area change: note it in `HANDOFF.md` before you do it.

## The loop

1. **Orient.** Read `AGENTS.md`, `.local-map/README.md`, then `.agent/HANDOFF.md`.
2. **Claim.** Add your task under "In progress" in `HANDOFF.md` with your role and the files you
   will touch. If someone already claimed those files, pick something else.
3. **Work test-first.** Failing test, smallest change that passes, refactor.
4. **Verify.** `pnpm typecheck && pnpm lint && pnpm test`, and `pnpm e2e` for a change to the
   screens. Read the output; do not assume.
5. **Record.** Add a `.local-map/JOURNEY.md` entry. Update `.local-map/MAP.md` if files moved or
   were added. Add a `.local-map/DECISIONS.md` entry if you chose between real alternatives.
6. **Hand off.** Remove your task from "In progress", add an entry to the "Log" in `HANDOFF.md`
   that lists what the next agent should know, and commit.

## Handoff entry format

```
### <date> <role>: <one-line summary>
- Changed: <files or areas>
- Verified: <commands run and their result>
- Not done / not verified: <be specific>
- Next: <the single most useful next step>
- Watch out: <traps the next agent would otherwise fall into>
```

## Stop and ask the human when

- A change would break a rule in `AGENTS.md` or an acceptance criterion in `docs/superpowers/specs/2026-11-11-asset-sheet-extractor-design.md`.
- A new dependency, a new network call, or anything that sends spreadsheet data off the device.
- Two reasonable readings of the spec lead to different behaviour.
- Tests fail for a reason you cannot explain after one honest attempt.
- Anything irreversible outside the repository: pushing, deploying, publishing.

## What agents must never do

- Mark a task done without running the checks.
- Weaken or delete a test to make it pass.
- Fill an unknown value with a guess (rule 1 in `AGENTS.md`).
- Edit files owned by another role that is currently claimed in `HANDOFF.md`.
