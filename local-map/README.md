# Local map

A map of this repository and a log of how it got here, kept current while the work happens. It
exists so that a person or an agent arriving cold can answer four questions quickly:

| Question | File |
| --- | --- |
| Where is the code that does X, and where do I change it? | [`MAP.md`](MAP.md) |
| What was done, in what order, and what proves it? | [`JOURNEY.md`](JOURNEY.md) |
| Why was it built this way and what did that cost? | [`DECISIONS.md`](DECISIONS.md) |
| What is the state right now and what comes next? | [`../.agent/HANDOFF.md`](../.agent/HANDOFF.md) |

Related documents:

- [`../docs/spec.md`](../docs/spec.md): requirements and acceptance criteria. Wins over everything.
- [`../docs/research.md`](../docs/research.md): one page of research with sources.
- [`../docs/plan.md`](../docs/plan.md): the implementation plan.
- [`../AGENTS.md`](../AGENTS.md): rules and commands for any coding agent.
- [`../.agent/PROTOCOL.md`](../.agent/PROTOCOL.md): how agents share the work.

## Conventions

- **`JOURNEY.md` is append-only.** New entries go at the bottom with a date and time. A mistake is
  corrected by a new entry, not by editing an old one.
- **Every claim has evidence.** A test name, a command and its result, a commit hash, a file and
  line, or a link. "Verified by reading the file" is evidence; "should work" is not.
- **`MAP.md` describes the code as it is**, not as planned. Plans live in `docs/plan.md`.
- **`DECISIONS.md` records choices between real alternatives** and what each choice costs.
  A reversal is a new entry that names the one it replaces.
- Update the map in the same commit as the change it describes.
