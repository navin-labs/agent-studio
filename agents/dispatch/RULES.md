# Dispatch: contract

Why: nothing reaches social media without an approved ledger entry, and each platform variant goes only to its own channel's account on that platform.

| | |
|---|---|
| Runs | Code, after approval (the hourly tick, `studio/run.ts`) |
| Input | Ledger (schemas/ledger.schema.json): one line per platform variant; each variant's manifest (schemas/manifest.schema.json) |
| Output | YouTube: a job for that channel's own n8n upload workflow. Instagram and Facebook: an item in `queue/<channel>/<platform>/` (schemas/queue.schema.json) |
| Tokens | 0 |

## Must
- Act only on ledger lines with status `approved` (or resume its own `dispatching` claim), on channels with `"live": true`.
- Route by the (channel, platform) pair, never by platform alone: `youtube` goes to `channels/<channel>/channel.json` YouTube publisher's `webhook`, which must be exactly `/webhook/agent-studio-youtube-<channel>` (no shared default); `instagram` and `facebook` go to `queue/<channel>/<platform>/`.
- Write every result back to the ledger.
- Dry-run by default until Navin switches it on.

Code: `studio/dispatch.ts` (`node studio/dispatch.ts [--live] [--hold]`), test `studio/dispatch.test.ts` in `npm run check`.
- Live needs both `--live` and `DISPATCH_LIVE=on` in agent-studio/.env; otherwise a dry run that sends and writes nothing.
- Only the latest ledger line per (video, platform) counts. Re-checked right before sending, each a refusal with its reason (Telegram "agent-studio needs you" on the hourly tick):
  - the ledger line is schema-valid (approver, time, the approved video's `sha256`), its platform is youtube, instagram or facebook, its channel exists and owns the storyboard;
  - the variant was rendered and has a schema-valid manifest whose channel, platform and video id match the ledger line;
  - the channel has exactly one publisher for that platform, not pending (a Facebook page with a `page_id` posts while its username is pending), reached the platform's way (`via`: youtube `n8n`, the others `forge-queue`), YouTube with its own webhook, Facebook with a `page_id`;
  - the manifest's destination (via, handle, page_id) is still what channel.json says (otherwise: render it again);
  - QA still passes, for this exact file; the video file exists and is byte for byte the one approved (`sha256`; a render after approval needs a new approval);
  - the video's end card shows that platform's own account; a YouTube job passes the SEO preflight;
  - an Instagram or Facebook item is not already in its queue folder (never queued twice).
- YouTube: multipart POST to that channel's webhook with the job (title, description from the YouTube variant's own caption, tags, category, schedule, channel, platform) and the video bytes that were just hash-checked. The n8n workflow takes only jobs for its own channel and platform, then asks the Mac `/dispatch-check?id=&channel=&platform=youtube` and uploads only on yes: private with a scheduled publish time.
- Instagram and Facebook: the variant's video, caption and manifest (channel, platform, video id, date, handle, page_id for Facebook, scheduled slot, video hash, file names) into `queue/<channel>/<platform>/`, each file named `<channel>-<platform>-<date>-<id>.<kind>`, the manifest written last through temp + rename.
- Never twice: each variant is claimed (`dispatching`) before anything is sent; the YouTube URL is written the moment it is known. `{uploaded: false}` or a refused connection releases the claim (retry next hour); any other answer leaves it stuck until Navin answers on Telegram (Uploaded / Not uploaded) or runs `--resolve <id> <youtube id | none>`; a failure after the upload resumes with the local steps only.
- Published: Forge's `<stem>.posted.json` (with a URL on that platform) marks an Instagram or Facebook variant published; a YouTube variant is marked published once its scheduled publish time has passed (`--hold` uploads have none and stay private).
- Schedule: from data. Learn writes the best time per channel and platform to `state/learn/posting-times.json`; 19:00 IST until there is data. A slot already past goes out 15 minutes from now.

## Never
- Publish anything not approved, or a video other than the one approved.
- Send one channel's video to another channel's workflow, queue or account, or route by platform alone.
- Publish directly to Instagram or Facebook (Forge's Queue Publisher does that, from the manifest).
- Retry an upload whose result is unknown.
