# SKILL: Metrics Reporter (Forge)

Forge follows this skill to report how each posted video did on Instagram and Facebook, read from its Meta connector. Learn uses these numbers to decide what next week's videos look like and when they post. All paths are absolute; `STUDIO` is `~/Dev/projects/agent-studio`.

---

## When
Every day (a Forge scheduled task). For each video posted through the queue, report twice: once at least 24 hours after posting (`"window": "24h"`) and once at least 7 days after (`"window": "7d"`).

## Find the posts
`STUDIO/state/queue/instagram/*/posted.json` (posted time and URLs) with the `post.json` beside it (`storyboard_id`, `channel`). Report a window only once: keep your own list of what you already reported, or check `STUDIO/inbox/metrics/done/`.

## Write
One file per video, platform and window in `STUDIO/inbox/metrics/`, named `<storyboard_id>-<platform>-<window>.json`:
```json
{"storyboard_id": "c1-2026-w41-3", "channel": "c1-automation", "platform": "instagram", "window": "24h",
 "reach": 1840, "views": 2310, "avg_watch_s": 21.4, "sends": 12, "saves": 31, "follows": 9, "profile_visits": 64, "dms": 3}
```
- `platform`: `instagram` or `facebook`. `window`: `24h` or `7d`.
- Whole numbers, except `avg_watch_s`. Leave out a field the platform does not give; never guess or estimate one.
- `reach` is required. `dms`: DMs that came from this post (Instagram insights "messaging conversations started" or similar). `enquiries`: DMs that ask about paid work (C3), only if you can tell.
- Copy the numbers exactly as the platform shows them.

The studio checks every file within the hour. A file that is wrong goes to `inbox/metrics/rejected/` with a `.error.txt` saying why. Fix it and drop a new file; tell Navin if you cannot.

## Never
- Report a video that was not posted through the queue.
- Edit `state/` or any file other than your own new files in `inbox/metrics/`.
