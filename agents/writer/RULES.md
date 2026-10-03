# Writer (Forge): contract

Why: the one AI step. It writes words, nothing else.

| | |
|---|---|
| Runs | Forge "Weekly Writer" skill, one batch per channel per week |
| Input | `recipes/<channel>/<week>.json`, `ideas/<channel>.jsonl` (top 20), `scoreboard.md`, channel `RULEBOOK.md` |
| Output | One storyboard JSON per recipe in `engine/content/storyboards/<recipe id>.json` (schemas/storyboard.schema.json), which renders as three platform videos; new idea lines in `ideas/<channel>.jsonl` when the feed has too few |
| Skill text | `agents/writer/FORGE_WEEKLY_WRITER.md` (Navin installs it in Forge) |
| Tokens | Muse only |

## Must
- Pick one idea per recipe, only from the feed. Copy its link into `meta.source`.
- Fill hook, voice lines, labels, caption within each primitive's text limits.
- Choose the CTA kind in the closer's text (`*Follow*`, `DM *AUDIT*`, `*Send* it`); never write platform CTA words (Subscribe, Follow, DM) into the caption body or other lines: the style preset adds each platform's own.
- Length: C1 40 to 60 s in both formats, no exceptions; C2 25 to 45 s.
- Follow the channel RULEBOOK (honesty, CTA, hashtags).
- Read `<id>.status.txt` (gate, render and QA), fix failures, then stop.

## Never
- Change the recipe's primitives, theme or order.
- Claim a client or a result. Use banned phrases.
- Edit engine code, read `.env`, delete anything.
