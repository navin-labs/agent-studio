# SETUP: production go-live

Why: everything is built and tested; this is the one list for launch day. Do it top to bottom. Nothing publishes until step 6.

`STUDIO` = `~/Dev/projects/agent-studio`. Commands run in `STUDIO` unless noted.

State on 2026-10-03: clean slate done (test approvals, renders, dry-run boards and recipes archived outside the repo, `out/` and `queue/` empty, nothing approved); every channel `"live": false`; `DISPATCH_LIVE=off`; nothing published. The first video dispatched after go-live is the first launch video.

## How a video goes out (read once)
Every approved video goes out as three platform variants, each its own render with its own call to action, end card, caption and (YouTube) thumbnail, from the channel's style preset:

Cadence: every other day from the launch (Sun 4 Oct 2026: 4, 6, 8, 10 Oct ...; 3 or 4 a week, never two days in a row; channel.json `cadence.every_days` 2 and `start`). Daily: set `every_days` to 1 once a channel has run 14 clean days. A channel's first video is its launch video.

| Platform | Says | Goes to |
|---|---|---|
| YouTube | Subscribe (C1's audit funnel: "DM AUDIT on Instagram") | that channel's own n8n upload workflow (`http://localhost:5678/webhook/agent-studio-youtube-<channel>`), private with a scheduled publish time |
| Instagram | Follow (or DM AUDIT) | `queue/<channel>/instagram/`, posted by Forge's Queue Publisher |
| Facebook | Follow the page (or "DM AUDIT on Instagram") | `queue/<channel>/facebook/`, posted by Forge to the page by its ID |

One Telegram tap approves a video and every variant that passed QA; a variant that failed is held alone. Details: docs/TECH.md "Variants".

## 1. Accounts and channel files (Navin)
For each channel you launch, fill its `channels/<id>/channel.json`:

| Channel | Makes | Accounts | Still to fill in |
|---|---|---|---|
| `c1-automation` | Automation leads: host (Chiku) and explainer videos, 40 to 60 s, night theme only | Instagram + YouTube @theautomationguynavin (claimed; YouTube webhook `agent-studio-youtube-c1-automation`), Facebook page 1429203763599559 (username pending, retry 2026-10-05) | Facebook `handle` once the username is claimed (replaces `pending_retry_2026-10-05`); `kpi.target` |
| `c2-reach` | Backstory: business and tech history, 25 to 45 s, archive theme only | Instagram + YouTube @backstory.minute (claimed; YouTube webhook `agent-studio-youtube-c2-reach`), Facebook page "Backstory.minute" 1320532171147125 (username pending, retry 2026-10-05) | Facebook `handle` once the username is claimed; `kpi.target` |
| `c3-studio` | Motion leads (gated, phase D2): needs a style preset before it can render | Instagram #3 | handle; style preset; `kpi.target`; cadence |

- Handles look like `@name` (letters, digits, `.` and `_`). The render step refuses a channel without a real Instagram handle, so an end card can never show the wrong account.
- Facebook: `{"platform": "facebook", "handle": "@...", "via": "forge-queue", "page_id": "<digits>"}` in `publishers`. While the username is pending (`pending_...`) the Facebook variant renders with no account on its end card and still posts, to the page by its `page_id` (decided 2026-10-04); without a `page_id` QA holds it ("held for Navin") and nothing is sent to Facebook. After you claim the username: fill `handle`, then re-save the week's boards (or wait for the next week) so the Facebook variants render with the page's name.
- YouTube: every YouTube publisher has `"via": "n8n"` and its own `"webhook": "http://localhost:5678/webhook/agent-studio-youtube-<channel id>"`. There is no shared default: a channel without its own webhook sends nothing to YouTube.
- Leave `"live": false` for now.
- Check: `npm run check` in `engine/` (validates every channel.json, every style preset, and that each publisher's route matches its platform).

## 2. Secrets (Navin, in `STUDIO/.env`, never shared in chat)
Set: `APPROVAL_SECRET`, `APPROVAL_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `DISPATCH_LIVE=off` (dispatch is a dry run until step 6 turns it on). `YOUTUBE_WEBHOOK_URL` is no longer read (each channel's webhook is in its channel.json); you can delete that line.
In `engine/.env`: `VOICE=on` (and `RENDER_COPY_DIR` only if Drive for desktop has several accounts). Voices are local (engine/README.md "Voice"); no voice API key is needed. The variable names are in `.env.example` and `engine/.env.example`.

## 3. n8n (http://localhost:5678)
All workflows were imported from `n8n/` and published on 2026-10-03; the deployed versions equal the files.

| Workflow | Webhook / schedule | Credentials (names) |
|---|---|---|
| agent-studio: approval webhook | GET `agent-studio-approve` | none (relays the signed link to the Mac) |
| agent-studio: YouTube upload (C1) | POST `agent-studio-youtube-c1-automation` | ETHAN personal AI assistant (C1's YouTube) |
| agent-studio: YouTube upload (C2 Backstory) | POST `agent-studio-youtube-c2-reach` | YouTube C2 Backstory |
| agent-studio: YouTube stats (C1), (C2 Backstory) | daily 10:00 | that channel's YouTube + "YouTube Analytics C1" / "YouTube Analytics C2" |
| agent-studio: YouTube packaging (C1), (C2 Backstory) | POST `agent-studio-packaging-<channel>` | that channel's YouTube; changes nothing unless `EXPERIMENTS=on` and the Mac says the change is due |
| agent-studio: feed | daily 07:00 | none |
| agent-studio: credential check (read-only) | by hand | all four; proves each credential belongs to the right channel |

Each upload workflow takes only its own channel's YouTube jobs and asks the Mac (`/dispatch-check?id=&channel=&platform=youtube`) before every upload; anything else gets `{uploaded: false}` and nothing is uploaded. After changing a workflow file: `docker cp n8n/<file>.json n8n_main:/tmp/x.json && docker exec n8n_main n8n import:workflow --input=/tmp/x.json && docker exec n8n_main n8n publish:workflow --id=<id>`, then restart n8n (`docker restart n8n_main n8n_worker`); import unpublishes a workflow until then.
Custom thumbnails need each YouTube channel phone-verified at youtube.com/verify.

## 4. Forge (Navin installs the skills, names as below)
| Skill name in Forge | File | Schedule in Forge |
|---|---|---|
| Weekly Writer | `agents/writer/FORGE_WEEKLY_WRITER.md` | Thursday 12:00 IST, for each live channel and next week (the studio writes the recipes Thursday morning and says so on Telegram) |
| Queue Publisher | `agents/publisher/FORGE_QUEUE_PUBLISHER.md` (reads `queue/<channel>/<platform>/` manifests) | every hour |
| Metrics Reporter | `agents/learn/FORGE_METRICS_REPORTER.md` | every day |

The old "Instagram Growth Pipeline" skill (reel-engine) is replaced by these three: remove it from Forge. If an older copy of these skills is installed, install these versions again (the queue layout changed on 2026-10-03).

## 5. The Mac
1. Watcher handover (finishes B4b). Do it in this order, so Forge never writes into a folder nothing renders:
   1. Install the three Forge skills (step 4). Forge now writes to `engine/content/storyboards/`.
   2. Stop the old v1 watcher (reel-engine):
      ```
      launchctl unload ~/Library/LaunchAgents/com.theautomationguy.reelwatch.plist
      ```
   3. (Re)install this repo's watcher; safe to repeat (com.theautomationguy.studiowatch, log `engine/out/watch.log`):
      ```
      cd engine && npm run watch:install
      ```
   Once any channel is live, the hourly loop alerts on Telegram if this watcher is missing, stopped or pointing at another engine, and "two watchers" if the old one is still loaded.
2. The hourly loop: `node studio/run.ts --install` (LaunchAgent com.theautomationguy.studio, log `state/run.log`). With no channel live it does nothing.
3. The watcher starts a tick itself whenever a video passes QA, so videos reach Telegram within a minute; the hourly loop covers everything else (dispatch, published, metrics, Thursday planning). Running `node studio/run.ts tick` by hand is never required.
4. Already running: the approve receiver with Telegram polling (`com.theautomationguy.approve`, log `state/approve.log`). Check: `curl -s 127.0.0.1:5680/health` says ok. After a code update: `launchctl kickstart -k gui/$(id -u)/com.theautomationguy.approve`.
4. Keep the Mac on power and awake (rendering, n8n, the loop and Telegram all run on it).
5. Optional rehearsal, any time: render the two test boards and run the production simulation (sandbox only, nothing sent):
   ```
   cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json && cd ..
   node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date <render date>
   node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date <render date>
   node studio/simulate.ts
   ```

## 6. Go live, one channel at a time
1. Turn dispatch on: add a last line `DISPATCH_LIVE=on` to `agent-studio/.env` (the last DISPATCH_LIVE line wins): `echo 'DISPATCH_LIVE=on' >> .env` in `STUDIO`. Check: `node studio/dispatch.ts --live` no longer says "--live ignored".
2. Set `"live": true` in `channels/c1-automation/channel.json`.
3. Plan the launch week and the next by hand, in that order: `node studio/recipe.ts <channel> <week>` writes one recipe per posting day from the channel's `cadence.start`; the first is the launch video (`"launch": true`, posted first on all three platforms). Then tell Forge: "Run Weekly Writer for c1-automation, week <week>". From then on the Thursday tick plans next week by itself (Telegram: "c1-automation <week>: 4 recipes are ready").
4. Forge writes the week; each board renders three platform videos and QA checks each; each video arrives on Telegram once, listing its variants (ready with its CTA, or held with why) and an **Approve** button.
5. Approve. Within the hour the loop dispatches each approved variant: YouTube scheduled through C1's own n8n workflow, Instagram and Facebook (to the page by its ID) into `queue/c1-automation/<platform>/` for Forge at the posting time (19:00 IST until Learn has data).
6. Forge posts, writes `<item>.posted.json`; the loop marks that variant published (YouTube once its scheduled time has passed). Forge reports metrics at 24h and 7d; n8n reads YouTube views; Learn uses them from the next Thursday.

C1 and C2 launch together on Sun 4 Oct 2026 (Navin): both channels live in step 2; 2026-W40 (the launch, 4 Oct) and 2026-W41 (6, 8, 10 Oct) planned for both in step 3. C3 once it has a style preset and 20 approved videos exist (D2).

## Daily life
- Telegram is the control panel: videos to approve (one message per video, its variants listed), "recipes ready", and "agent-studio needs you" when something fails or a variant is refused at dispatch (with the exact reason).
- Every render is copied to Google Drive: My Drive > Reel Engine > <channel> > <date> > <video id> > youtube | instagram | facebook.
- `state/learn/<channel>/scoreboard.md`: what works, what is benched, best posting hours.
- Nothing posts without your Approve tap. A channel stops at once with `"live": false`; all dispatch stops with `DISPATCH_LIVE=off`.
- "YouTube did not answer clearly" on Telegram: the studio will not send that video again by itself. Look in YouTube Studio, then tap **Uploaded** (and reply with the video ID or link) or **Not uploaded** (it goes out again next hour). From the Mac: `node studio/dispatch.ts --resolve <id> <video id | none>`.
- Change your mind before a video goes out: `node studio/ledger.ts reject <id>` (all its approved variants).

## What is not automated (on purpose)
- Approval: always Navin.
- Deleting posts or videos: always Navin.
- YouTube reach is views until the YouTube Analytics API is wired (the basic API has no impressions, DMs or follows; those rows never dilute a KPI).
