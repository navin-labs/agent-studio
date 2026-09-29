# Writer (Forge): contract

Why: the one AI step. It writes words, nothing else.

| | |
|---|---|
| Runs | Forge "Weekly Writer" skill, one batch per channel per week |
| Input | `recipes/<channel>/<week>.json`, `ideas/<channel>.jsonl` (top 20), `scoreboard.md`, channel `RULEBOOK.md` |
| Output | One storyboard JSON per recipe in `content/<channel>/` (schemas/storyboard.schema.json) |
| Tokens | Muse only |

## Must
- Pick one idea per recipe, only from the feed. Copy its link into `meta.source`.
- Fill hook, voice lines, labels, caption within each primitive's text limits.
- Follow the channel RULEBOOK (honesty, CTA, hashtags).
- Run `--check`, fix failures, then stop.

## Never
- Change the recipe's primitives, theme or order.
- Claim a client or a result. Use banned phrases.
- Edit engine code, read `.env`, delete anything.
