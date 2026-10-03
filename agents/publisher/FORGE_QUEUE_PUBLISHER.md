# SKILL: Queue Publisher (Forge)

Forge follows this skill to post approved videos to Instagram and Facebook with its Meta connector. It posts only what the studio put in the queue, only after Navin approved it, and only to the account the item's manifest names. All paths are absolute; `STUDIO` is `~/Dev/projects/agent-studio`.

---

## When
Every hour (a Forge scheduled task), and whenever Navin says "post the queue".

## Read
The queue has one folder per channel and platform:
```
STUDIO/queue/<channel>/<platform>/        channel: c1-automation | c2-reach | c3-studio   platform: instagram | facebook
```
Each queued item is three files with the same name stem, `<channel>-<platform>-<date>-<video id>`, for example
`c1-automation-instagram-2026-10-14-c1-2026-w42-3`:
- `<stem>.mp4`: the video, this platform's own render (its own end card and spoken call to action). Post it as it is.
- `<stem>.caption.txt`: the caption, posted exactly as written.
- `<stem>.manifest.json`: where and when it goes. The studio writes it last, so an item without a manifest is still being written: skip it until the next run.
  ```json
  {"channel": "c1-automation", "platform": "facebook", "video_id": "c1-2026-w42-3", "date": "2026-10-14",
   "handle": "@page.username", "page_id": "1000000000000001", "scheduled_for": "2026-10-14T19:00:00+05:30",
   "video_sha256": "<64 hex>", "files": {"video": "<stem>.mp4", "caption": "<stem>.caption.txt"}}
  ```
- `<stem>.posted.json`: present once the item has been posted. Skip any item that has it.

The manifest is the only source of where an item goes. Never work out an account from the folder name, the file name, the caption, the video, the channel's name or memory.

## Check before posting (skip the item and tell Navin if any fails)
1. The manifest's `channel` and `platform` are the folder it sits in (`queue/<channel>/<platform>/`).
2. `files.video` and `files.caption` exist in the same folder and both start with the item's stem.
3. Instagram: `handle` is an Instagram account Forge is connected to. Facebook: `page_id` is a page Forge is connected to (post to the page by its ID; `handle` is its username).
4. `scheduled_for` is now or in the past. Items whose time is still in the future wait. Never post early.

## Do
For each item that passes the checks:
1. Post `files.video` as a Reel to exactly the account in the manifest (Instagram: `handle`; Facebook: `page_id`), with `files.caption` as the caption. Use the cover frame the platform picks unless Navin set one.
2. As soon as it is posted, write `<stem>.posted.json` next to the manifest:
   ```json
   {"posted_at": "2026-10-14T19:00:05+05:30", "url": "https://www.instagram.com/reel/..."}
   ```
   `url` is the post's own link on that platform (instagram.com for Instagram, facebook.com for Facebook). The studio marks that variant published from this file within the hour; a file whose URL is on the wrong platform is reported and never trusted.
3. If posting fails, write no `posted.json`, post nothing else for that item, and tell Navin the item's stem and the error. The next run retries.

Never post twice: check for `<stem>.posted.json` first, every time.

## Never
- Post anything that is not a queued item with a manifest, or change a video or caption.
- Post to an account or page that is not in that item's manifest, or guess one.
- Post an Instagram item to Facebook or the other way round, or one channel's item to another channel's account.
- Comment, like, follow or DM from any account.
- Delete or move queue files, or edit a manifest.
