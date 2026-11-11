# Map

What is in the repository and where to change things. This file describes the code as it is.

## Top level

| Path | What it is |
| --- | --- |
| `AGENTS.md`, `CLAUDE.md` | Rules and commands for coding agents. `CLAUDE.md` imports `AGENTS.md`. |
| `.agent/` | Tool-neutral agent protocol (`PROTOCOL.md`) and live state (`HANDOFF.md`). |
| `.claude/` | Claude Code skills (`skills/`) and subagent definitions (`agents/`). |
| `local-map/` | This map, the journey log and the decision log. |
| `docs/` | `spec.md` (requirements), `research.md`, `plan.md`. |
| `src/app/` | Next.js App Router entry: `layout.tsx`, `page.tsx`, `globals.css`. Still the scaffold. |
| `public/` | Static files. Scaffold icons for now. |
| `next.config.ts` | Scaffold defaults: `cacheComponents` (static shell is prerendered), `partialPrefetching` (link prefetch behaviour, irrelevant with a single route), and the Turbopack rule that runs Tailwind 4 on CSS files. |
| `eslint.config.mjs` | Next.js core-web-vitals and TypeScript rule sets. |
| `tsconfig.json` | Strict TypeScript; `@/*` maps to `src/*`. |
| `pnpm-workspace.yaml` | Tells pnpm not to run the install scripts of `sharp` and `unrs-resolver`. |

## Not built yet

The extraction pipeline, the UI and the LLM route are described in `docs/plan.md`. This section is
replaced by the real module table as they land.
