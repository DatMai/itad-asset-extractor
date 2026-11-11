@AGENTS.md

## Claude Code specifics

- **Skills** (`.claude/skills/`):
  - `add-extraction-rule`: a header, unit, CPU, brand or product line is not recognised.
  - `verify`: run before saying anything is done.
  - `handoff`: end of a session, or before passing work to another agent.
- **Subagents** (`.claude/agents/`):
  - `extraction-engineer`: owns `src/lib/extraction` and its tests.
  - `ui-engineer`: owns `src/app` and `src/components`.
  - `reviewer`: read-only review against `docs/spec.md`, the way the client's engineer would.
- Run the dev server through the Browser pane (`.claude/launch.json`), not through Bash.
