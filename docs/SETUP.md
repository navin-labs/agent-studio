# SETUP: production go-live

Why: everything is built and tested; this is the one list for launch day. Do it top to bottom. Nothing publishes until step 6.

`STUDIO` = `~/Dev/projects/agent-studio`. Commands run in `STUDIO` unless noted.

## 1. Accounts and channel files (Navin)
For each channel you launch, create the accounts, then fill its `channels/<id>/channel.json`:

| Channel | Makes | Accounts | Fill in |
|---|---|---|---|
| `c1-automation` | Automation leads: host (Chiku) and composed videos | Instagram @theautomationguy.navin (exists), YouTube, Facebook (optional) | YouTube handle; Facebook publisher if used; `kpi.target` |
| `c2-reach` | Followers: one-idea explainers (reach format, ink/mono/studio) | Instagram #2, YouTube #2, Facebook (optional) | both handles; `kpi.target`; cadence |
| `c3-studio` | Motion leads: explainers for example brands | Instagram #3 (Behance and LinkedIn later) | handle; `kpi.target`; cadence |

- Handles look like `@name` (letters, digits, `.` and `_`). The render step refuses a channel without a real Instagram handle, so the end card can never show the wrong account.
- Facebook: add `{"platform": "facebook", "handle": "@...", "via": "forge-queue"}` to `publishers`. Forge posts it from the same queue folder as Instagram.
- YouTube: one n8n upload workflow per YouTube account (step 3). For a second or third account add `"webhook": "http://localhost:5678/webhook/agent-studio-youtube-<id>"` to that channel's YouTube publisher.
- Leave `"live": false` for now.
- Check: `npm run check` in `engine/` (validates every channel.json).

## 2. Secrets (Navin, in `STUDIO/.env`, never shared in chat)
Already set: `APPROVAL_SECRET`, `APPROVAL_WEBHOOK_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `YOUTUBE_WEBHOOK_URL`, `DISPATCH_LIVE=on`.
In `engine/.env`: `SARVAM_API_KEY` (voice, exists), `VOICE=on`. Optional `SARVAM_SPEAKER` once Chiku's voice is chosen (re-voice only).

## 3. n8n (http://localhost:5678)
| Workflow | State | To do |
|---|---|---|
| agent-studio: approval webhook | published | nothing |
| agent-studio: YouTube upload | published (C1's YouTube credential) | for C2: duplicate it, change the webhook path to `agent-studio-youtube-c2-reach`, pick C2's YouTube credential, Publish; set that URL as C2's `webhook` |
| agent-studio: YouTube stats | imported, not published | pick the YouTube credential in "Video statistics", Publish. One workflow reads every channel only if one credential can see all channels' videos; otherwise duplicate it per credential |

## 4. Forge (Navin installs the skills, names as below)
| Skill name in Forge | File | Schedule in Forge |
|---|---|---|
| Weekly Writer | `agents/writer/FORGE_WEEKLY_WRITER.md` | Thursday 12:00 IST, for each live channel and next week (the studio writes the recipes Thursday morning and says so on Telegram) |
| Queue Publisher | `agents/publisher/FORGE_QUEUE_PUBLISHER.md` | every hour |
| Metrics Reporter | `agents/learn/FORGE_METRICS_REPORTER.md` | every day |

The old "Instagram Growth Pipeline" skill (reel-engine) is replaced by these three: remove it from Forge.

## 5. The Mac (Claude can run these with Navin)
1. Switch the watcher to this repo (finishes B4b):
   ```
   launchctl unload ~/Library/LaunchAgents/com.theautomationguy.reelwatch.plist
   cd engine && npm run watch:install
   ```
   Its first run marks existing files done. Check: `engine/out/.watch-state.json` exists; a new storyboard gets `<id>.status.txt` saying `ok` or `failed QA`.
2. The hourly loop: `node studio/run.ts --install` (LaunchAgent com.theautomationguy.studio, log `state/run.log`). With no channel live it does nothing.
3. Already running: the approve receiver with Telegram polling (`com.theautomationguy.approve`, log `state/approve.log`). Check: `curl -s 127.0.0.1:5680/health` says ok.
4. Keep the Mac on power and awake (rendering, n8n, the loop and Telegram all run on it).

## 6. Go live, one channel at a time
1. Set `"live": true` in `channels/c1-automation/channel.json`.
2. Wait for (or run) Thursday's tick: `node studio/run.ts tick`. Telegram: "c1-automation <week>: 7 recipes are ready".
3. Forge writes the week; each board renders and passes QA; each passed video arrives on Telegram with an Approve button.
4. Approve. Within the hour the loop dispatches: YouTube scheduled via n8n, Instagram and Facebook into Forge's queue at the posting time.
5. Forge posts, writes `posted.json`; the loop marks the video published. Forge reports metrics at 24h and 7d; n8n reads YouTube views; Learn uses them from the next Thursday.

C2 after C1 has run 14 days with no missed posts (Phase D1). C3 once 20 approved videos exist (D2).

## Daily life
- Telegram is the control panel: videos to approve, "recipes ready", and "agent-studio needs you" when something fails (with the exact reason).
- `state/learn/<channel>/scoreboard.md`: what works, what is benched, best posting hours.
- Nothing posts without your Approve tap. A channel stops at once with `"live": false`.

## What is not automated (on purpose)
- Approval: always Navin.
- Deleting posts or videos: always Navin.
- YouTube reach is views until the YouTube Analytics API is wired (the basic API has no impressions, DMs or follows; those rows never dilute a KPI).
