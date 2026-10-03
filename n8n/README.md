# n8n workflows for agent-studio

n8n runs in Docker (`~/Dev/tools/n8n`, http://localhost:5678), so it cannot see this repo. It relays; the Mac decides.

## approval-webhook.json
Approve link (GET `/webhook/agent-studio-approve`) -> forwards the signed query unchanged to the Mac receiver
(`http://host.docker.internal:5680/approve`) -> shows the receiver's answer. n8n never holds `APPROVAL_SECRET`.

Setup (Navin):
1. In `agent-studio/.env`: `APPROVAL_WEBHOOK_URL=http://localhost:5678/webhook/agent-studio-approve` and `APPROVAL_SECRET=<16+ random characters>`.
2. Run the receiver: `node studio/approve-server.ts --install` (LaunchAgent com.theautomationguy.approve, starts at login, log state/approve.log). Remove: `launchctl unload ~/Library/LaunchAgents/com.theautomationguy.approve.plist`.
3. n8n UI -> Import from file -> `n8n/approval-webhook.json` -> Activate. Copy the exported JSON to `~/Dev/tools/n8n/workflows/agent-studio/` if you keep workflows there.
4. Check: open a link from `node studio/approval-page.ts c1-automation <week>`; the receiver log shows `GET /approve -> 200`.

Verified 2026-10-01 on n8n 2.31.4: tampered link -> 403, signed link -> 200 through the receiver.

## youtube-upload.json (C1) and youtube-upload-c2.json (C2)
Video job (POST `/webhook/agent-studio-youtube-<channel>`, multipart: `job` JSON with `channel` and `platform` + `video` file (+ `thumbnail`), sent by `studio/dispatch.ts --live` to the webhook in that channel's channel.json)
-> Ask the Mac: the workflow first takes only its own channel's YouTube jobs (`job.channel` is its channel, `job.platform` is `youtube`); then `http://host.docker.internal:5680/dispatch-check?id=&channel=<its channel>&platform=youtube` (yes only if the dispatcher is sending exactly this video of this channel now: approved, QA still passing, the approved bytes)
-> Upload to YouTube: private, scheduled `publishAt`, category from the job (28, or 27 for C2), region IN, then thumbnail A -> answers `{uploaded, youtube_id}`; otherwise 403 `{uploaded: false}` and nothing is uploaded.
Live dispatch also needs `DISPATCH_LIVE=on`. There is no shared upload webhook: the old `agent-studio-youtube` path no longer exists.


## youtube-stats.json
Every day 10:00 IST: ask the Mac which YouTube readings are due (`GET http://host.docker.internal:5680/metrics-due`: dispatched videos 24h and 7d after publishing, not yet recorded) -> read each video's statistics -> `POST http://host.docker.internal:5680/metrics` (rows checked by `studio/metrics.ts`; a video that was never dispatched is refused). A deleted video is skipped and stays due.
YouTube's basic statistics have views only: rows carry `reach` = `views` and never count toward a KPI they cannot measure.

Published (C1: "ETHAN personal AI assistant" + "YouTube Analytics C1"); C2 has its own copy (`youtube-stats-c2.json`).
Verified: the container reaches `/metrics-due`; a row for an undispatched video gets 400 and nothing is written.

## More than one YouTube account
The YouTube node is tied to one credential, so each YouTube channel has its own upload, stats and packaging workflow:

| File | Workflow | Webhook path | Credentials (by name; the files name them) |
|---|---|---|---|
| `youtube-upload.json` | YouTube upload (C1) | `agent-studio-youtube-c1-automation` | ETHAN personal AI assistant (C1's existing YouTube credential) |
| `youtube-upload-c2.json` | YouTube upload (C2 Backstory) | `agent-studio-youtube-c2-reach` | YouTube C2 Backstory |
| `youtube-stats.json` | YouTube stats (C1) | (schedule) | ETHAN personal AI assistant + YouTube Analytics C1 |
| `youtube-stats-c2.json` | YouTube stats (C2 Backstory) | (schedule) | YouTube C2 Backstory + YouTube Analytics C2 |
| `youtube-packaging-c1.json` | YouTube packaging (C1) | `agent-studio-packaging-c1-automation` | ETHAN personal AI assistant |
| `youtube-packaging-c2.json` | YouTube packaging (C2 Backstory) | `agent-studio-packaging-c2-reach` | YouTube C2 Backstory |

Upload: sets the category from the job (27 Education for C2) and thumbnail A after the upload (custom thumbnails need a phone-verified channel; a failure there never fails the upload). Stats: `GET /metrics-due?channel=<id>` and `/experiment-days-due?channel=<id>`, so each channel reads only its own videos; adds the retention curve and the experiment days from the YouTube Analytics API (a "Google OAuth2 API" credential with scope `yt-analytics.readonly`, signed in as that channel). Packaging: changes a live title (with the description, tags and category unchanged) and thumbnail, only after `GET /packaging-check` says that exact change is due.
Every Mac check carries `channel=<id>`, so one channel's workflow (and its credential) can never upload, read or change another channel's video. Each workflow names its credentials: n8n assigned C1's YouTube credential to every C2 node at the first import, which would have uploaded C2 videos to C1's channel; the named references make a C2 node fail until "YouTube C2 Backstory" exists. Create the credentials with exactly these names (docs/SETUP.md step 3), then open each node once and confirm the credential. In the stats workflows a video, curve or day YouTube cannot read is skipped and asked again the next day; it never stops the other readings.
Deployed state, 2026-10-03: every file here was imported and published (the C1 upload, C1 stats and C2 upload last, then n8n restarted); an export of the running n8n matches these files node for node. The credential check (run by hand) confirmed each YouTube credential reads its own channel and C2's Analytics credential is refused for C1.
Live contract check, 2026-10-03 (a video ID that can never be approved, so nothing could upload): C1 workflow with a C1 job asked the Mac and got 403 -> `{uploaded: false}`; C1 workflow with a C2 job, an Instagram job or a garbled job: refused inside n8n without asking; C2 workflow likewise; the old shared path 404; the approval webhook relays a tampered, expired or malformed link to the Mac, which refuses it (403).
The feed workflow stays one for all channels: it reads every channel's `feeds` from the Mac (C2: Google Trends IN, r/todayilearned, r/history).

## credential-check.json
Read-only, run by hand: asks YouTube which channel each YouTube credential belongs to, and YouTube Analytics for each channel's total views. No webhook, no schedule, never changes anything. Run: `docker exec -e N8N_RUNNERS_BROKER_PORT=5699 n8n_main n8n execute --id=agStudioCredCheck --rawOutput` (the extra port avoids the running instance's task broker), or open it in n8n and click Execute.

## feed.json
Every day 07:00 IST: `GET /feeds` (the feeds listed in channels/*/channel.json) -> `POST /feed {url}` for each, 8 s apart. The Mac fetches the feed itself (Reddit answers 403/429 to this container), parses RSS/Atom, keeps each item's own link, checks every idea against idea.schema.json, dedupes per channel and appends to `ideas/<channel>.jsonl`. One failing feed never stops the others.
Published.
Verified 2026-10-02 from inside the container: Google Trends India -> 20 ideas (n8n-fetched); then through the Mac fetch path r/productivity -> 25 ideas, all schema-valid with their post links, while three Reddit feeds rate-limited that hour (429) wrote nothing and reported "answered HTTP 429 (rate limited, try later)". `{url, body}` (n8n fetched it) is still accepted.

## Upload contract (youtube-upload*.json)
The Mac claims a variant (ledger `dispatching`, platform `youtube`) just before it posts the job, so `/dispatch-check` says yes for a fresh claim of that channel (30 minutes); `channel` and `platform=youtube` are required on every ask. Replies the Mac understands: `{uploaded: true, youtube_id}` (done) and `{uploaded: false, reason}` (certainly not uploaded: retried next hour). A workflow error (500) or anything else is "unknown": the Mac never re-sends it and tells Navin on Telegram to check YouTube Studio and run `node studio/dispatch.ts --resolve <id> <youtube id | none>`.
