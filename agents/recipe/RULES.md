# Recipe: contract

Why: uniqueness is guaranteed by code, not by asking an AI to be creative.

| | |
|---|---|
| Runs | Code, weekly per channel |
| Input | `channel.json`, past fingerprints, bench list, 70/30 split from Learn |
| Output | `recipes/<channel>/<week>.json`, one recipe per posting day (`cadence`: every `every_days` days from `start` when set, otherwise `posts_per_week` spread over the week; each with its `date`; a channel's first recipe is `"launch": true`) (schemas/recipe.schema.json) + fingerprints |
| Tokens | 0 |

## Must
- Pick theme, opening primitive, primitive sequence, transitions, rhythm, hook pattern.
- Random but seeded, so runs are repeatable.
- Redraw until all 7 novelty rules pass (docs/TECH.md).
- Use only primitives suited to the channel and not benched.
- 70% proven, 30% experiments. Proven picks are a preference: when only they would break a novelty rule, the slot draws from the whole pool (benched shots stay out).

## Never
- Call an AI.
- Reuse a recipe fingerprint on two channels in the same week.
