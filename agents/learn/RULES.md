# Learn: contract

Why: close the loop so every week's videos lean on what worked, with no coding and no prompting from Navin.

| | |
|---|---|
| Runs | Code, daily (the hourly tick, live channels) and before each Thursday plan |
| Input | Metrics (schemas/metrics.schema.json), ledger, fingerprints (style version, CTA, length), render.json scene spans |
| Output | `state/learn/<channel>/learn.json` (findings), `scoreboard.md`, `state/learn/posting-times.json`, `state/learn/changes.jsonl` (Tier 1 log), `state/learn/proposals.jsonl` (Tier 2) |
| Tokens | 0 |

## Must
- Compute the channel KPI by primitive, style version, theme, hook pattern, caption kind, CTA, length, topic and posting hour; scene retention against the channel average at the same scene position (YouTube).
- Tier 1, applied without a tap and logged with its evidence: rest the bottom quartile for 2 weeks, prefer primitives that hold viewers and keep the ones that lose them out of the opening shot, prefer winning hook patterns, Writer guidance (caption kind, CTA, length; only where the approved style and the channel rules leave a choice), posting times. Thumbnail arms rotate in studio/experiment.ts (EXPERIMENTS=on).
- Tier 2, proposed on Telegram only when the evidence is there, applied only by Navin's tap (studio/improve.ts): switch the channel's style preset (a newer version once the current one has a baseline, or back to a version that scored at least 10% better over 6+ videos each); take a primitive out of the channel's grammar for good (retention at most 0.85 of the channel over 6+ videos, or rested twice).
- A weekly note with the Thursday recipes: what changed by itself and why, what waits for a tap, what is tested next.

Code: `studio/learn.ts` (`node studio/learn.ts <channel> <week>`), `studio/improve.ts`; tests `studio/learn.test.ts`, `studio/improve.test.ts` in `npm run check`.
- KPI per channel from `channel.json` `kpi.numerator` / `kpi.denominator` (C1: (dms + profile_visits) / reach), pooled per group; the 7d window replaces 24h.
- Nothing is judged on fewer than 3 videos. A winner needs a runner-up with 3+ videos and a 10% lead. Bench never leaves a beat empty; a grammar removal never takes a beat's last option.
- Known limit: a video's KPI counts for every primitive in it (no per-shot attribution); scene retention is the per-shot signal.

## Never
- Touch voices, colour tokens, the AI-voiceover disclosure, C2's every-claim-sourced rule, approval gates, `live` flags or dispatch switches. A Tier 2 tap writes exactly one thing: `channel.json` `style`, or the channel's grammar removals; anything else is refused.
- Apply a Tier 2 change by itself.
