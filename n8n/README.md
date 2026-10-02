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

## youtube-upload.json
Video job (POST `/webhook/agent-studio-youtube`, multipart: `job` JSON + `video` file, sent by `studio/dispatch.ts --live`)
-> Ask the Mac (`http://host.docker.internal:5680/dispatch-check?id=`; yes only if the ledger says approved and QA still passes)
-> Upload to YouTube: private, scheduled `publishAt`, category 28, region IN -> answers `{uploaded, youtube_id}`; otherwise 403 and nothing is uploaded.

Setup (Navin): open the workflow, pick the existing YouTube credential in the upload node, Publish.
Then `YOUTUBE_WEBHOOK_URL=http://localhost:5678/webhook/agent-studio-youtube` in agent-studio/.env. Live dispatch also needs `DISPATCH_LIVE=on`.


## youtube-stats.json
Every day 10:00 IST: ask the Mac which YouTube readings are due (`GET http://host.docker.internal:5680/metrics-due`: dispatched videos 24h and 7d after publishing, not yet recorded) -> read each video's statistics -> `POST http://host.docker.internal:5680/metrics` (rows checked by `studio/metrics.ts`; a video that was never dispatched is refused). A deleted video is skipped and stays due.
YouTube's basic statistics have views only: rows carry `reach` = `views` and never count toward a KPI they cannot measure.

Setup (Navin): imported on 2026-10-02 (inactive). Pick the YouTube credential in "Video statistics", Publish.
Verified: the container reaches `/metrics-due`; a row for an undispatched video gets 400 and nothing is written.

## More than one YouTube account
The YouTube node is tied to one credential, so each YouTube account gets its own copy of `youtube-upload.json` with its own webhook path (e.g. `agent-studio-youtube-c2-reach`). Put that URL in the channel's YouTube publisher as `"webhook"`; channels without one use `YOUTUBE_WEBHOOK_URL`.
