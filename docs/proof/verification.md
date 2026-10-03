# Reproducible pre-launch verification

Date: 2026-10-03. Node 26.0.0, macOS. Pre-launch: every channel is `"live": false`, dispatch is off, nothing has been published. This is not production deployment proof.

## Commands and results
| Command | Result | Log |
|---|---|---|
| `cd engine && npm run check` | exit 0. `tsc` clean; theme gate: 41 contrast pairs pass, 0 fail, no raw colours outside themes.ts; textcheck ok; schema validation: 19 samples ok; 12 of 12 test suites ok (recipe, qa, approval, dispatch, learn, telegram, metrics, run, feed, experiment, improve, loop) | `npm-check.txt` |
| `node studio/simulate.ts` | exit 0 | `simulation.txt` |
| `node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-03` | exit 0; YouTube PASS, Instagram PASS, Facebook HOLD | `qa-c1.txt` |
| `node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-03` | exit 0; YouTube PASS, Instagram PASS, Facebook HOLD | `qa-c2.txt` |
| `node studio/dispatch.ts --live` | `--live ignored: DISPATCH_LIVE=on is not set` (dry run); `DRY RUN: 0 YouTube, 0 Forge queue` | |

QA runs 12 checks per variant (schema, text-limits, audio, format, duration, safe-zones, fingerprint, naming, manifest, cta, destination, seo). QA exits 0 when the only failing check is `destination` for an account that is not set up yet: that is a hold for the channel owner, not a content error.

## The six variants
Measured on the rendered MP4 with `engine/scripts/probe.ts`: every file is mp4, 1080x1920, 30 fps, with an audio stream. Each manifest's `video_sha256` equals the SHA-256 of its MP4.

| Variant | Length | Allowed | CTA | End card | Destination | QA |
|---|---|---|---|---|---|---|
| C1 YouTube | 46.36 s | 40 to 60 s | Subscribe | @theautomationguynavin | n8n, the channel's own upload workflow | PASS |
| C1 Instagram | 46.08 s | 40 to 60 s | Follow | @theautomationguynavin | `queue/c1-automation/instagram/` | PASS |
| C1 Facebook | 46.49 s | 40 to 60 s | Follow (the page) | none (username pending) | `queue/c1-automation/facebook/` | HOLD |
| C2 YouTube | 31.02 s | 25 to 45 s | Subscribe | @backstory.minute | n8n, the channel's own upload workflow | PASS |
| C2 Instagram | 30.78 s | 25 to 45 s | Follow | @backstory.minute | `queue/c2-reach/instagram/` | PASS |
| C2 Facebook | 31.15 s | 25 to 45 s | Follow (the page) | none (username pending) | `queue/c2-reach/facebook/` | HOLD |

C2's range stays 25 to 45 s until its phase-2 history shots exist (docs/DECISIONS.md, ADR 21).

## Why Facebook is on HOLD
Both Facebook variants pass 11 of 12 checks and fail only `destination`, with these exact messages from QA:
- C1: `facebook username is still pending (pending_retry_2026-10-05): held until it is claimed in channels/c1-automation/channel.json, then render again`
- C2: `facebook username is still pending (pending_retry_2026-10-05): held until it is claimed in channels/c2-reach/channel.json, then render again; Facebook needs the page_id in channel.json`

A held variant cannot be approved or dispatched; the other variants of the same video are unaffected.

## Simulation
`node studio/simulate.ts` runs a production cycle on the six real renders inside a temporary sandbox (fake Telegram, fake n8n; nothing leaves the machine). Result:
- 2 videos x 3 platform variants found with the right CTA, end card and QA state.
- One Telegram message per video; one tap approved YouTube and Instagram for each video (4 variants); Facebook held, not approved.
- Dispatch plan: 2 YouTube jobs, each to its own channel's webhook, and 2 Instagram queue items; 0 blocked.
- 9 refusal cases refused: a channel pointed at another channel's workflow, missing manifest, unknown platform, wrong channel/platform pair, wrong channel on the ledger line, changed destination handle, video changed after approval, approval taken back, duplicate queue item.
- The n8n dispatch check answered yes only for the right channel and platform (other channel, wrong platform, no channel: 403).
- A second run sent nothing (0 uploads, 0 queue writes).
- Final line: `simulate ok: 2 masters x 3 platform variants; YouTube and Instagram approved and routed to their own channel; Facebook held (username pending); every refusal failed closed; nothing sent anywhere`.

## Safety state at verification time
- `channels/c1-automation`, `c2-reach`, `c3-studio`: `"live": false`.
- Dispatch: off (`node studio/dispatch.ts --live` refuses to go live and plans 0 sends).
- Ledger: no approvals (`state/` holds no ledger); no `queue/` folder; production `engine/out/` holds no renders.
- Nothing published on any platform.

## Reproduce
```bash
cd engine && npm install && npm run check
VOICE=on npm run make -- test/style-c1.json test/style-c2.json
cd ..
node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date <render date>
node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date <render date>
node studio/simulate.ts
```
Voiceover needs the local voice setup in engine/README.md ("Voice"). Without it, renders have sound effects only and lengths differ.
