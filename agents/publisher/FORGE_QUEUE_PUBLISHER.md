# SKILL: Queue Publisher (Forge) — Instagram and Facebook publishing

Skill id: `meta-social-publishing`. Forge (Muse) follows this skill to post approved videos to Instagram and Facebook **with the Meta tools Forge already has** (its native connector). It posts only what the studio put in the queue, only after Navin approved it, only to the account the item's manifest names, and only the exact bytes that were approved. `STUDIO` is the folder this repository is cloned into (on this Mac `~/Dev/projects/forge-content-studio`; it was called `agent-studio` before the rename). If that folder does not exist, stop and tell Navin; do not search for another copy. All paths below are under `STUDIO`.

This skill adds no connection of its own. It never asks for, stores, prints or passes a token, never starts a login or OAuth flow, never calls a Meta web address directly and never writes a Graph API client: if the connector cannot do something, the answer is "I cannot" and a message to Navin.

---

## When
Every hour (a Forge scheduled task), and whenever Navin says "post the queue". Navin can also say "dry run the queue" or "check the queue": do everything below up to the publish call, publish nothing, and report the plan (see Dry run).

## Step 0: find out what the connector can do (every run, before anything else)
1. List the Meta tools you actually have in this session. Use only tools that appear there, with the inputs their own descriptions give. Names are not fixed by this repository and are not written here on purpose: do not assume or invent one.
2. Note which of these you can do, from the tools' own descriptions: (a) list the connected Instagram professional account(s) and Facebook Page(s); (b) publish a video as a Reel to Instagram / a video or Reel to a Facebook Page; (c) validate, preview or "dry run" a post without publishing; (d) read an account's recent media (needed to check for a duplicate); (e) read a post's status and URL.
3. If you cannot do (a), (b) and (d), stop: post nothing, tell Navin which capability is missing. If the connector has no validate/preview action (c), say so once in your report; the dry run is then "stop before the publish call".
4. If a tool reports missing permissions, an expired connection or a rate limit, stop that platform for this run and tell Navin what the tool said (never print a token or a secret if the message contains one: say "the message contained a credential" instead).

## Read
The queue has one folder per channel and platform:
```
STUDIO/queue/<channel>/<platform>/        channel: c1-automation | c2-reach | c3-studio   platform: instagram | facebook
```
Each queued item is three files with the same name stem, `<channel>-<platform>-<date>-<video id>`, for example
`c1-automation-instagram-2026-10-14-c1-2026-w42-3`:
- `<stem>.mp4`: the video, this platform's own render (its own end card and spoken call to action). Post it as it is.
- `<stem>.caption.txt`: the caption, posted exactly as written (hashtags are already in it).
- `<stem>.manifest.json`: where and when it goes. The studio writes it last, so an item without a manifest is still being written: skip it until the next run.
  ```json
  {"channel": "c1-automation", "platform": "facebook", "video_id": "c1-2026-w42-3", "date": "2026-10-14",
   "handle": "@page.username", "page_id": "1000000000000001", "scheduled_for": "2026-10-14T19:00:00+05:30",
   "video_sha256": "<64 hex>",
   "files": {"video": "c1-automation-facebook-2026-10-14-c1-2026-w42-3.mp4", "caption": "c1-automation-facebook-2026-10-14-c1-2026-w42-3.caption.txt"}}
  ```
- `<stem>.posted.json`: present once the item has been posted. Skip any item that has it.

The manifest is the only source of where an item goes. Never work out an account from the folder name, the file name, the caption, the video, the channel's name or memory. A manifest exists only because Navin approved the video and the studio's dispatch queued it; the studio re-checked the video's SHA-256 when it queued it. That manifest is the approval you are acting on; it covers this video, this caption file, this account and this time, and nothing else.

## Check before posting (skip the item and tell Navin if any fails)
1. The manifest's `channel` and `platform` are the folder it sits in (`queue/<channel>/<platform>/`), and `video_id` and `date` are in the stem.
2. `files.video` and `files.caption` exist in the same folder and both start with the item's stem.
3. **The video is the approved one:** the SHA-256 of `files.video` equals the manifest's `video_sha256` (compute it now, with `shasum -a 256`, at the moment you are about to post; a file that changed since the studio queued it is never posted). Read the caption file at the same moment.
4. Instagram: `handle` is an Instagram professional account the connector lists as connected. Facebook: `page_id` is a Page the connector lists as connected (post to the Page by its ID; `handle` is its username). If the account is not in the connector's list, do not post and do not pick another.
5. `scheduled_for` is now or in the past. Items whose time is still in the future wait. Never post early.
6. The video and caption fit what the connector says the platform accepts (from its tool description or a validate/preview result): vertical MP4, a duration and file size within the limit it states, a caption within its length and hashtag limit. If you cannot tell, do not guess: use the validate/preview action if there is one, otherwise report "limits not confirmed" and still apply every other check. If a limit is exceeded, skip the item and report which one; never trim or edit the caption or re-encode the video.
7. **Not already posted:** there is no `<stem>.posted.json`, and a read of the account's recent media (step 0, (d)) shows no post with this caption published since the item's `scheduled_for`. If one is there, do not post: treat it as an ambiguous earlier attempt (see Failures).

## Do
For each item that passes the checks (one at a time; Instagram and Facebook items are separate and one's result never decides the other's):
1. If this is a dry run or the connector has a validate/preview action: run the validate/preview action with exactly the arguments you would publish with, and record its answer. A dry run ends here.
2. Otherwise post `files.video` as a Reel to exactly the account in the manifest (Instagram: `handle`; Facebook: `page_id`), with `files.caption` as the caption. Use the cover frame the platform picks unless Navin set one. Do not schedule, boost, tag, add a location or change any other setting.
3. As soon as the connector confirms the post, write `<stem>.posted.json` next to the manifest:
   ```json
   {"posted_at": "2026-10-14T19:00:05+05:30", "url": "https://www.instagram.com/reel/..."}
   ```
   `url` is the post's own link on that platform (instagram.com for Instagram, facebook.com for Facebook), as returned by the connector or read back from it. The studio marks that variant published from this file within the hour; a file whose URL is on the wrong platform is reported and never trusted. If the connector returns a post ID but no URL, read the post back to get its link; if you cannot get a URL, tell Navin the ID and write no file.
4. Report to Navin, per item: stem, platform, account, the post ID and URL, or the error. Keep Instagram and Facebook lines separate.

## Failures and retries
- **Refused before anything was created** (validation error, permission error, account not found, rate limit): write no `posted.json`, post nothing else for that item, report the stem and the connector's message. The next run retries; a rate limit means wait for the next run, never loop.
- **Timeout, dropped connection, an unclear answer, an error after the upload started, a post ID with no confirmation:** the post may exist. Do not retry in this run. Read the account's recent media. If the post is there, treat it as posted (write `posted.json` with its URL). If it is not there, report "outcome unknown" with the stem and wait for the next run, which repeats check 7 before it posts. If you cannot read the account's media, do not post again at all: tell Navin and wait for his answer.
- **Never post the same item twice.** Check for `<stem>.posted.json` and for an existing post, every time, before the publish call.
- At most one publish call per item per run. Never post to the other platform, another account or another channel as a fallback.

## Dry run and testing
- "dry run the queue" / "check the queue": steps 0, Read and Check run for every item; Do step 1 runs if the connector has a validate/preview action; no publish call, no `posted.json`. Report per item: would post / waits (time) / skipped (reason), with the account that would be used.
- No real post is ever made to test this skill. Test with an empty queue, or with items whose `scheduled_for` is in the future (they must wait), or with a dry run.
- The studio side of this contract is tested in `studio/dispatch.test.ts` (manifests, `posted.json`, wrong-platform URLs) and `studio/skills.test.ts` (this file's examples validate against `schemas/queue.schema.json`).

## Limits of this skill (what it cannot guarantee)
- The manifest binds the video by SHA-256 but not the caption file; the caption is bound only by being the file named in the manifest, read at the moment of posting. Treat a caption file that changed after the manifest's time as suspicious and ask Navin.
- Whether the connector can validate, preview, read recent media or return URLs, and its exact tool names, are things you find out in step 0; this repository does not state them and no live connector call was made when this skill was written.

## Never
- Post anything that is not a queued item with a manifest, or change a video, a caption or a manifest.
- Post to an account or page that is not in that item's manifest, or guess one; post an Instagram item to Facebook or the other way round, or one channel's item to another channel's account.
- Build or call a Meta web address yourself, write a REST client, create, refresh, copy, print or store a token, or start a login or OAuth flow. Only the connector's own tools.
- Comment, like, follow, DM, delete or edit a post, or run an ad.
- Delete or move queue files, edit `state/`, or touch the YouTube or Telegram flows (YouTube is uploaded by n8n; Telegram belongs to the studio).
- Retry blindly after a timeout.
