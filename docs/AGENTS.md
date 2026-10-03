# AGENTS: one card per actor

Why: every actor has one job, a fixed input and output, and a hard never-do list. Only one actor (Writer) uses AI tokens.

| Actor | Job | Input | Output | Token cost |
|---|---|---|---|---|
| Feed | Pull candidate topics daily | the feeds in each channel.json (Google Trends RSS India, Reddit RSS) | `ideas/<channel>.jsonl` with source link + date | 0 (n8n + code) |
| Recipe | Pick the shape of each slot | channel.json, fingerprints, bench list, 70/30 split | `recipes/<channel>/<week>.json` | 0 (code) |
| Writer (Forge) | Fill the words | the week's recipes (one per posting day), top 20 ideas, RULEBOOK.md, scoreboard.md | one storyboard per recipe in `engine/content/storyboards/` | Muse only, 1 batch per channel per week |
| Render + QA | Render and check, once per platform | storyboard, style preset | per platform variant: mp4, caption, manifest, qa JSON, contact sheet (YouTube: thumbnail) | 0 (code) |
| Dispatch | Send approved platform variants out, each to its own (channel, platform) destination | ledger, manifests, channel.json | that channel's n8n YouTube upload; `queue/<channel>/<platform>/` items for Forge | 0 (code) |
| Learn | Score and steer | metrics, ledger, fingerprints | scoreboard.md, bench list, 70/30 split, missing-primitive hint | 0 (code) |
| Navin | Approve, decide | Telegram (one message per video, its variants listed) | ledger status; commits | About 5 min a week |
| n8n | Glue (relays; the Mac checks and writes) | schedules, webhooks | feed fetches, YouTube uploads after the Mac says yes, YouTube metrics | 0 |

## Rules and never-do lists
| Actor | Rules | Never |
|---|---|---|
| Feed | Every idea has a source link and a date | Invent topics; fetch paid sources |
| Recipe | Must pass all 7 novelty rules and the bench list; 70% proven, 30% experiments | Ask an AI for creativity; reuse a fingerprint across channels in one week |
| Writer | Pick ideas only from the feed; copy the link into `meta.source`; stay within text limits; run `--check`, fix, stop | Change primitives, theme or order; claim results; use banned phrases; edit engine code; read `.env` |
| Render + QA | Measure text boxes at compose time; report the exact error | Use vision models; pass a file that fails any check; use `--force` |
| Dispatch | Act only on ledger status "approved" for that platform variant; route by (channel, platform); refuse any mismatch | Publish anything else; send one channel's video to another's account; retry a publish blind |
| Learn | Bench bottom quartile for 2 weeks | Change rules itself (the monthly audit suggests; Navin decides) |
| Navin | Approve weekly; review and commit changes | Skip the approval page |
| n8n | Run on schedule; take only its own channel's jobs; ask the Mac before every upload | Publish to Instagram or Facebook |

Full contracts: `agents/<name>/RULES.md`.
