# AGENTS: one card per actor

Why: every actor has one job, a fixed input and output, and a hard never-do list. Only one actor (Writer) uses AI tokens.

| Actor | Job | Input | Output | Token cost |
|---|---|---|---|---|
| Feed | Pull candidate topics weekly | Reddit RSS (r/smallbusiness, r/IndiaBusiness, r/Excel), Google Trends RSS India, YouTube search, IG Question-box replies | `ideas/<channel>.jsonl` with source link + date | 0 (n8n) |
| Recipe | Pick the shape of each slot | channel.json, fingerprints, bench list, 70/30 split | `recipes/<channel>/<week>.json` | 0 (code) |
| Writer (Forge) | Fill the words | 7 recipes, top 20 ideas, RULEBOOK.md, scoreboard.md | 7 storyboards in `content/<channel>/` | Muse only, 1 batch per channel per week |
| Render + QA | Render and check | storyboard | mp4, qa JSON, contact sheet PNG | 0 (code) |
| Dispatch | Send approved videos out | ledger | n8n YouTube call; Forge IG queue entry | 0 (code) |
| Learn | Score and steer | metrics, ledger, fingerprints | scoreboard.md, bench list, 70/30 split, missing-primitive hint | 0 (code) |
| Navin | Approve, decide | approval page | ledger status; commits | About 5 min a week |
| n8n | Glue | schedules, webhooks | ideas, uploads, ledger writes, metrics | 0 |

## Rules and never-do lists
| Actor | Rules | Never |
|---|---|---|
| Feed | Every idea has a source link and a date | Invent topics; fetch paid sources |
| Recipe | Must pass all 7 novelty rules and the bench list; 70% proven, 30% experiments | Ask an AI for creativity; reuse a fingerprint across channels in one week |
| Writer | Pick ideas only from the feed; copy the link into `meta.source`; stay within text limits; run `--check`, fix, stop | Change primitives, theme or order; claim results; use banned phrases; edit engine code; read `.env` |
| Render + QA | Measure text boxes at compose time; report the exact error | Use vision models; pass a file that fails any check; use `--force` |
| Dispatch | Act only on ledger status "approved" | Publish anything else; retry a publish blind |
| Learn | Bench bottom quartile for 2 weeks | Change rules itself (the monthly audit suggests; Navin decides) |
| Navin | Approve weekly; reply "approve commit" to commit | Skip the approval page |
| n8n | Run on schedule; write only its own files | Publish to Instagram |

Full contracts: `agents/<name>/RULES.md`.
