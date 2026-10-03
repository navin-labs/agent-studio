# Reproducible pre-launch verification

Date: 2026-10-04. Node 26.0.0, macOS. Pre-launch: every channel is `"live": false`, dispatch is off, nothing has been published. This is not production deployment proof.

## Commands and results
| Command | Result | Log |
|---|---|---|
| `cd engine && npm run check` | exit 0. `tsc` clean; theme gate: 41 contrast pairs pass, 0 fail, no raw colours outside themes.ts; textcheck ok; schema validation: 19 samples ok; 12 of 12 test suites ok (recipe, qa, approval, dispatch, learn, telegram, metrics, run, feed, experiment, improve, loop) | `npm-check.txt` |
| `cd engine && VOICE=on npm run make -- test/style-c1.json test/style-c2.json` | six voiced renders (2 boards x 3 platforms) in `engine/test/out/<channel>/2026-10-04/` | |
| `node studio/qa.ts engine/test/style-c1.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-04` | exit 0; YouTube PASS, Instagram PASS, Facebook PASS (36 of 36 checks) | `qa-c1.txt` |
| `node studio/qa.ts engine/test/style-c2.json --out engine/test/out --recipes engine/test/recipes --date 2026-10-04` | exit 0; YouTube PASS, Instagram PASS, Facebook PASS (36 of 36 checks) | `qa-c2.txt` |
| `node studio/simulate.ts` | exit 0 | `simulation.txt` |
| `node studio/dispatch.ts --live` | `--live ignored: DISPATCH_LIVE=on is not set` (dry run); `DRY RUN: 0 YouTube, 0 Forge queue` | |

QA runs 12 checks per variant: schema, text-limits, audio, format, duration, safe-zones, fingerprint, naming, manifest, cta, destination, seo.

## The six variants
Measured on the rendered MP4 with `engine/scripts/probe.ts`: every file is mp4, 1080x1920, 30 fps, with an audio stream. Each manifest's `video_sha256` equals the SHA-256 of its MP4.

| Variant | Length | Allowed | CTA | End card | Destination | QA |
|---|---|---|---|---|---|---|
| C1 YouTube | 45.78 s | 40 to 60 s | Subscribe | @theautomationguynavin | n8n, the channel's own upload workflow | PASS |
| C1 Instagram | 45.59 s | 40 to 60 s | Follow | @theautomationguynavin | `queue/c1-automation/instagram/` | PASS |
| C1 Facebook | 45.95 s | 40 to 60 s | Follow (the page) | no account (username pending) | `queue/c1-automation/facebook/`, page 1429203763599559 | PASS |
| C2 YouTube | 30.59 s | 25 to 45 s | Subscribe | @backstory.minute | n8n, the channel's own upload workflow | PASS |
| C2 Instagram | 30.61 s | 25 to 45 s | Follow | @backstory.minute | `queue/c2-reach/instagram/` | PASS |
| C2 Facebook | 30.66 s | 25 to 45 s | Follow (the page) | no account (username pending) | `queue/c2-reach/facebook/`, page 1320532171147125 | PASS |

C2's range stays 25 to 45 s until its phase-2 history shots exist (docs/DECISIONS.md, ADR 21).

## Facebook while the username is pending
Both Facebook pages exist; their usernames are not claimed yet (`pending_retry_2026-10-05` in channel.json). Facebook posts are routed by page ID, so a Facebook variant with a `page_id` passes the destination check and goes to the queue for that page; its end card names no account until the username is claimed (docs/DECISIONS.md, ADR 22). Still held, and covered by tests and the simulation: a pending Facebook without a `page_id`, and a pending username on any other platform.

## Simulation
`node studio/simulate.ts` runs a production cycle on the six real renders inside a temporary sandbox (fake Telegram, fake n8n; nothing leaves the machine). Result:
- 2 videos x 3 platform variants found with the right CTA, end card and QA state; six distinct files.
- One Telegram message per video listing all three variants as ready; one tap approved all three (`Approved: style-c1 (instagram, youtube, facebook)`, same for style-c2).
- Dispatch plan: 2 YouTube jobs, each to its own channel's webhook; 4 queue items (Instagram by handle, Facebook by page ID, each in its own channel's folder); 0 blocked.
- 10 refusal cases refused: a channel pointed at another channel's workflow, missing manifest, unknown platform, wrong channel/platform pair, wrong channel on the ledger line, changed destination handle, Facebook username pending with no page_id, video changed after approval, approval taken back, duplicate queue item.
- The n8n dispatch check answered yes only for the right channel and platform (other channel, wrong platform, no channel: 403).
- A second run sent nothing (0 uploads, 0 queue writes).
- Final line: `simulate ok: 2 masters x 3 platform variants; all three approved with one tap and routed to their own channel (Facebook to its page by page_id); every refusal failed closed; nothing sent anywhere`.

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
