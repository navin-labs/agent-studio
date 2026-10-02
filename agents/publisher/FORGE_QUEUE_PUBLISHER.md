# SKILL: Queue Publisher (Forge)

Forge follows this skill to post approved videos to Instagram and Facebook with its Meta connector. It posts only what the studio put in the queue, and only after Navin approved it. All paths are absolute; `STUDIO` is `~/Dev/projects/agent-studio`.

---

## When
Every hour (a Forge scheduled task), and whenever Navin says "post the queue".

## Read
`STUDIO/state/queue/instagram/`: one folder per approved video, named `<date>-<channel>-<id>`, holding:
- `reel.mp4`: the video
- `caption.txt`: the caption with hashtags, posted exactly as written
- `post.json`: `{"storyboard_id", "channel", "accounts": [{"platform": "instagram" | "facebook", "handle"}], "scheduled_for"}` (IST time)
- `posted.json`: present once the folder has been posted. Skip any folder that has it.

## Do
For each folder without `posted.json` whose `scheduled_for` is now or in the past:
1. Post `reel.mp4` as a Reel to every account in `accounts`, with `caption.txt` as the caption. Use the cover frame Instagram picks unless Navin set one.
2. Write `posted.json` in the same folder, as soon as every account is done:
   ```json
   {"posted_at": "2026-10-12T19:00:05+05:30", "urls": {"instagram": "https://www.instagram.com/reel/...", "facebook": "https://www.facebook.com/reel/..."}}
   ```
   Only the accounts actually posted. The studio marks the video published from this file within the hour.
3. If an account fails, post nothing more for that folder, write no `posted.json`, and tell Navin which account and the error. The next run retries.

Folders whose `scheduled_for` is still in the future wait. Never post early, never post twice (check `posted.json` first, every time).

## Never
- Post anything that is not a queue folder, or change a video or caption.
- Post to an account that is not in that folder's `post.json`.
- Comment, like, follow or DM from any account.
- Delete or move queue folders, or edit `post.json`.
