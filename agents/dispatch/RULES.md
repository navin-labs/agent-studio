# Dispatch: contract

Why: nothing reaches social media without an approved ledger entry.

| | |
|---|---|
| Runs | Code, after approval |
| Input | Ledger (schemas/ledger.schema.json) |
| Output | YouTube: n8n upload call with schedule. Instagram: entry in Forge's publish queue (folder + message) |
| Tokens | 0 |

## Must
- Act only on entries with status `approved`.
- Write the dispatch result back to the ledger.
- Dry-run by default until Navin switches it on.

Code: `studio/dispatch.ts` (`node studio/dispatch.ts [--live]`), test `studio/dispatch.test.ts` in `npm run check`.
- Live needs both `--live` and `DISPATCH_LIVE=on` in agent-studio/.env; otherwise a dry run that sends and writes nothing.
- Only the latest ledger line per video counts. Re-checked at dispatch: schema (approver and time present), QA still passes, video file present, recipe found.
- YouTube: multipart POST to `YOUTUBE_WEBHOOK_URL` (n8n workflow `n8n/youtube-upload.json`) with the job (title, description, tags, schedule) and the video file itself (n8n runs in Docker and cannot read the Mac). n8n asks the Mac receiver `/dispatch-check?id=` first and uploads only on yes: private with a scheduled publish time.
- Instagram: one queue folder for every channel, `state/queue/instagram/<date>-<channel>-<id>/` with reel.mp4, caption.txt, post.json (channel, Instagram handles, schedule). Queued only after YouTube succeeded, so a retry never queues twice.
- A YouTube upload counts only if n8n answers `{uploaded: true, youtube_id}`; the Shorts link goes into the ledger (`post_urls`). `--hold` uploads private with no publish time (and records no schedule).
- Schedule: from data. Learn writes the best time per channel and platform to `state/learn/posting-times.json`; 19:00 IST until there is data. A slot already past goes out 15 minutes from now.

## Never
- Publish anything not approved.
- Publish directly to Instagram (Forge's queue does that; see LOG open question 3).
