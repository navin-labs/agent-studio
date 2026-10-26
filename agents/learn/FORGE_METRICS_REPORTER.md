# SKILL: Metrics Reporter (Forge) — Instagram and Facebook analytics

Skill id: `meta-social-analytics`. Forge (Muse) follows this skill to report how each posted video did on Instagram and Facebook, read from **the Meta tools Forge already has** (its native connector), in read-only mode. Learn uses these numbers to decide what next week's videos look like and when they post. `STUDIO` is the folder this repository is cloned into (on this Mac `~/Dev/projects/forge-content-studio`; it was called `agent-studio` before the rename). If it does not exist, stop and tell Navin. All paths below are under `STUDIO`.

This skill adds no connection of its own: no token handling, no login or OAuth flow, no direct web calls, no Graph API client. If the connector cannot give a number, the number is reported as unavailable.

---

## When
Every day (a Forge scheduled task), and when Navin asks for a report ("how did last week's reels do?"). For each item posted through the queue, report twice: once at least 24 hours after posting (`"window": "24h"`) and once at least 7 days after (`"window": "7d"`).

## Step 0: find out what the connector exposes (every run)
1. List the Meta tools you actually have. Use only those, with the inputs their descriptions give. Names are not fixed by this repository: do not assume or invent one.
2. Note which of these exist: list connected accounts/Pages; list an account's media; read one post's insights; read account-level insights over a period. For each insight tool, read its description to learn which metrics it returns, their definitions and any period or delay it states. Only metrics you saw in a tool's description or in a real response may be reported.
3. Use read-only tools only. If a tool could change anything (publish, edit, delete, comment), do not call it from this skill.
4. If you hit a rate limit or a permission error, stop that platform for this run, report what the tool said (never print a credential), and continue next run. Do not retry in a loop.

## Find the posts
`STUDIO/queue/<channel>/<platform>/*.posted.json` (posted time and URL), each with the `.manifest.json` of the same stem beside it (`video_id`, `channel`, `platform`). Report a window only once: keep your own list of what you already reported, or check `STUDIO/inbox/metrics/done/`. Match each post to the platform's media list by the URL in `posted.json`; if you cannot match it with certainty, report that post as "not found" and write no row.

## Write the rows (what the studio reads)
One file per video, platform and window in `STUDIO/inbox/metrics/`, named `<video_id>-<platform>-<window>.json`:
```json
{"storyboard_id": "c1-2026-w42-3", "channel": "c1-automation", "platform": "instagram", "window": "24h",
 "reach": 1840, "views": 2310, "avg_watch_s": 21.4, "sends": 12, "saves": 31, "follows": 9, "profile_visits": 64, "dms": 3}
```
- `storyboard_id`, `channel` and `platform`: copied from the manifest (`video_id`, `channel`, `platform`). `window`: `24h` or `7d`.
- Whole numbers, except `avg_watch_s`. Copy the numbers exactly as the platform gives them, in the unit it gives them.
- **Zero is a number; missing is not zero.** Write `0` only when the platform returned 0. A metric the connector does not offer, the platform has not produced yet, or that failed to fetch is **left out of the row**. Never write 0, an estimate or an average in its place.
- `reach` is required by the schema. If `reach` is unavailable (not offered, not ready yet, or the fetch failed), write no row for that window, do not use another number in its place, and report why. If the platform says insights are not ready yet, try again on the next daily run (a window is reported once it is at least 24 h / 7 d old and the numbers are there).
- `dms`: DMs that came from this post (insights "messaging conversations started" or similar), only if the connector gives it. `enquiries`: DMs that ask about paid work (C3), only if you can tell.
- One row per window is final: do not re-send a corrected row for the same window unless Navin asks.

The studio checks every file within the hour. A row for a platform variant that was never dispatched there, or for another channel, is refused: the file goes to `inbox/metrics/rejected/` with a `.error.txt` saying why. Fix it and drop a new file; tell Navin if you cannot.

## Report to Navin (separate from the rows; short)
When a window is reported, or when Navin asks, give a concise note, not a table of everything:
1. **Scope:** accounts and Pages, the posts, and the period (dates with time zone) each number covers; when you fetched it (freshness) and which metrics the connector does not offer or failed to return, by name.
2. **Numbers, with definitions:** each metric as the platform defines it (for example "views" and "reach" are different; say which you used). Mark unavailable metrics "n/a: <reason>", never blank and never 0.
3. **Rates only with a stated formula.** Engagement rate = (likes + comments + shares + saves, only those the connector gave) ÷ reach (or ÷ views, say which). If a part of the numerator is missing, name it and say the rate is a lower bound, or do not give a rate. Never compare rates built from different formulas.
4. **Comparisons without invented figures:** compare posts or periods only on metrics both have, over equal windows (24 h to 24 h, 7 d to 7 d). Say "no comparison possible" when they share none.
5. **What worked / what did not / what to try next:** each point cites the numbers it rests on; label a small sample ("2 posts") as weak evidence. No recommendation without evidence.

## Privacy
Only post-level and account-level statistics. Do not collect, copy or report names, handles, profile details, comment text or DM content of other people. Never print or store tokens, secrets or account identifiers beyond the post URL and the channel/video ids already in the manifest.

## Dry run and testing
- "Dry run the metrics": steps 0 and Find run; report which rows would be written and which metrics are missing; write no file.
- No live fetch is needed to test the contract: `studio/skills.test.ts` checks that the example row above is valid against `schemas/metrics.schema.json`, and `studio/metrics.test.ts` checks that the studio refuses rows for posts that were never dispatched.
- Whether the connector exposes insights, which metrics, and their exact tool names are found in step 0; this repository does not state them and no live connector call was made when this skill was written.

## Failures
A fetch that fails, times out or returns something unreadable: write no row for that window, report the post, the metric and the tool's message, and try again on the next run. A rate limit: stop for this run. Never fill a gap from an older reading or another post.

## Never
- Report a video that was not posted through the queue.
- Edit `state/`, `queue/` or any file other than your own new files in `inbox/metrics/`.
- Call a tool that publishes, edits, deletes, comments, follows or messages.
- Invent, estimate, round up, carry forward or average a metric; turn "unavailable" into 0.
- Build or call a Meta web address yourself, write a REST client, create, refresh, copy, print or store a token, or start a login or OAuth flow.
- Touch the YouTube numbers (n8n reads those) or the Telegram flow.
