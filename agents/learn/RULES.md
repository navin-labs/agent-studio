# Learn: contract

Why: close the loop so next week's recipes lean on what worked.

| | |
|---|---|
| Runs | Code, weekly |
| Input | Metrics (schemas/metrics.schema.json), ledger, fingerprints |
| Output | `scoreboard.md` per channel, bench list, 70/30 split, missing-primitive hint |
| Tokens | 0 |

## Must
- Compute the channel KPI by primitive, theme, hook pattern and topic.
- Bench the bottom quartile for 2 weeks.
- Suggest which primitive kind is missing (for the fortnightly build session).

Code: `studio/learn.ts` (`node studio/learn.ts <channel> <week>`), test `studio/learn.test.ts` in `npm run check`.
- KPI per channel from `channel.json` `kpi.numerator` / `kpi.denominator` (C1: (dms + profile_visits) / reach), pooled per group; the 7d window replaces 24h.
- Input: `state/metrics.jsonl` (schema-checked, a bad line stops the run), `state/fingerprints.jsonl`, ledger `scheduled_for`.
- Nothing is judged on fewer than 3 videos. Bench = bottom quartile (needs 4+ judged primitives), for 2 weeks, never a primitive that is a beat's only option. Proven = at or above the median.
- Output: `state/learn/<channel>/learn.json` + `scoreboard.md`, `state/learn/posting-times.json` (best hour per platform, read by Dispatch). Recipe reads learn.json: proven picks for the 70%, experiments must try something unproven.
- Known limit: a video's KPI counts for every primitive in it (no per-shot attribution).

## Never
- Change rules itself. The monthly Claude audit suggests; Navin decides.
