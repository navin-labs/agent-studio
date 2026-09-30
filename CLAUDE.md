# agent-studio: rules for Claude Code sessions

Why: keep every session small, cheap, and safe.

## Session start (read in this order, nothing else unless the task needs it)
1. `CLAUDE.md` (this file)
2. `docs/LOG.md`, last entry only
3. `docs/BUILD_PLAN.md`, the next unchecked task

Read other docs only when the task needs them.

## Scope
- One session = one BUILD_PLAN task. Stop when its "done when" passes.
- All work happens in this repo. The engine lives in `engine/`.
- `~/Dev/projects/reel-engine` is the old live engine (v1). Never modify it; it keeps posting until Forge and the watcher switch to `engine/` (end of Phase B).

## Token rules
- Don't paste whole files into chat.
- Read only the lines you need.
- Don't re-read files that haven't changed.
- Prefer small diffs.

## Code rules
- Primitives use role tokens only. No hex colour outside `themes.ts`.
- Every non-trivial function leaves one runnable check.
- No new dependency without asking Navin.
- Before proposing a commit: `npm run check` in engine/ (types, themes, text QA) must pass; renders touched by the change must be re-verified.

## Commit rule
- Every task ends with a commit and a push. Never skip either.
- At the end of a task: show `git status` and a proposed commit message, then wait.
- On Navin's "approve commit": commit, then push to `origin` right away.
- Commits are authored by Navin only (git config user: Navin Rana). Never add `Co-Authored-By`, "Generated with", or any Claude attribution line to a commit message.
- After each approved commit, record it in the session's `docs/LOG.md` entry: `Commit: <short hash> <message>`.

## Safety
- Never read or print `.env`.
- Never publish to any platform.
- Nothing reaches social media without a ledger entry with status "approved".

## Session end
Append an entry to `docs/LOG.md`:
```
## YYYY-MM-DD, session N: <task>
Did: ...
Decisions: ...
Next: <next BUILD_PLAN task>
Open questions: ...
```
