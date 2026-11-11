---
name: handoff
description: Use at the end of a work session, before switching tasks, or before passing work to another agent or a human. Updates the local map and the handoff note so the next reader can continue without this conversation.
---

# Hand off

The next reader has none of your context. Write for someone arriving cold.

## 1. Run the `verify` skill

A handoff that says "tests pass" must be backed by a run from this session.

## 2. Update the local map

| File | Update when | What to write |
| --- | --- | --- |
| `local-map/JOURNEY.md` | Always | A dated entry: what you did, why, and the evidence (test name, command output, commit). Append; never rewrite history. |
| `local-map/MAP.md` | Files were added, moved, renamed or changed purpose | Fix the module table and the "where do I change X" list so they match the code. |
| `local-map/DECISIONS.md` | You chose between real alternatives | Context, options, choice, what it costs. Number it `D<n>`. |

## 3. Update `.agent/HANDOFF.md`

Use the entry format in `.agent/PROTOCOL.md`. Keep the top section ("State right now") true:

- what works, with the numbers that prove it;
- what is in progress and who holds it;
- the next step, as one concrete action;
- what is **not** done or **not** verified. This is the most useful part; do not soften it.

Remove your claim from "In progress".

## 4. Commit

Small commit, message says why. Do not push or deploy unless the human asked for it in this
session.
